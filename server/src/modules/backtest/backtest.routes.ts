import { Router } from 'express';
import { optionalAuthMiddleware } from '../../middleware/auth';
import { getAnonClient } from '../../config/supabase';
import { ensureHistoricalCandles, readLocalCandles } from '../prices/data-storage.service';
import { computeRollingIndicators } from './rolling-indicators.service';
import { runSimulation } from './simulator.service';
import { computeBacktestMetrics } from './metrics.service';
import { StrategyRule, BacktestResponse } from './types';

const router = Router();

/**
 * GET /api/backtest/data-range?symbol=RELIANCE.NS
 * Returns the exact historical candle range and the backtestable date window
 * after excluding the warmup buffer (200 trading bars for DMA200/RSI14).
 */
router.get('/data-range', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const symbol = (req.query.symbol as string) || (req.query.targetSymbol as string);
    const timeframe = ((req.query.timeframe as string) || 'hour') as 'day' | 'hour';
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Stock symbol parameter is required.' });
    }

    let candles = readLocalCandles(symbol, timeframe);
    if (candles.length === 0) {
      candles = await ensureHistoricalCandles(symbol, {
        timeframe,
        years: timeframe === 'hour' ? 2 : 3,
      });
    }

    if (!candles || candles.length === 0) {
      return res.status(404).json({ error: `No historical data available for ${symbol}.` });
    }

    const toDateOnly = (d: string) => (d ? (d.includes(' ') ? d.split(' ')[0] : d.split('T')[0]) : d);

    const totalCandles = candles.length;
    const dataStartDate = toDateOnly(candles[0].date);
    const dataEndDate = toDateOnly(candles[totalCandles - 1].date);

    // Buffer: For daily data, standard warmup is 200 bars (for DMA200/RSI14)
    // For hourly data, warmup is provided by the historical daily candles baseline
    const warmupBars =
      timeframe === 'hour'
        ? 0
        : totalCandles >= 200
        ? 200
        : Math.min(50, Math.max(14, Math.floor(totalCandles / 3)));
    const backtestableCandles = candles.slice(warmupBars);
    const backtestableStartDate = toDateOnly(backtestableCandles[0]?.date || dataStartDate);
    const backtestableEndDate = dataEndDate;

    // Deduplicate dates so each calendar date appears only once (no duplicate hours or time strings)
    const availableDates = Array.from(new Set(backtestableCandles.map((c) => toDateOnly(c.date))));

    return res.json({
      symbol,
      totalCandles,
      warmupBars,
      dataStartDate,
      dataEndDate,
      backtestableStartDate,
      backtestableEndDate,
      availableDates,
    });
  } catch (err: any) {
    console.error('[Backtest Data-Range Error]:', err);
    return res.status(500).json({ error: err.message || 'Failed to get data range.' });
  }
});

/**
 * POST /api/backtest/run (or POST /api/strategies/backtest)
 * Executes a full backtest on historical daily candles.
 */
router.post('/run', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const {
      symbol,
      rules,
      timeframe = 'hour',
      strategyId,
      strategy_id,
      years = 2,
      startDate,
      start_date,
      endDate,
      end_date,
      initialCapital = 100000,
      initial_capital,
      slippagePct = 0.0005,
      slippage_pct,
      feePct = 0.001,
      fee_pct,
    } = req.body;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Valid stock symbol is required.' });
    }

    let finalRules: StrategyRule[] = Array.isArray(rules) ? rules : [];

    // If strategyId was passed instead of inline rules, load from Supabase
    const targetStrategyId = strategy_id || strategyId;
    if (finalRules.length === 0 && targetStrategyId) {
      const client = req.supabase || getAnonClient();
      const { data: stratRow, error } = await client
        .from('portfolio_strategies')
        .select('*')
        .eq('id', targetStrategyId)
        .single();

      if (!error && stratRow) {
        finalRules = [
          {
            id: stratRow.id,
            name: stratRow.name,
            action: stratRow.action || 'BUY',
            sizingType: stratRow.sizing_type || 'QTY',
            sizingValue: stratRow.sizing_value || 10,
            conditions: Array.isArray(stratRow.conditions) ? stratRow.conditions : [],
            enabled: stratRow.enabled ?? true,
          },
        ];
      }
    }

    if (finalRules.length === 0) {
      return res.status(400).json({ error: 'At least one strategy rule with conditions is required.' });
    }

    const finalTimeframe = (timeframe === 'day' ? 'day' : 'hour') as 'day' | 'hour';
    const finalYears = Number(years) || (finalTimeframe === 'hour' ? 2 : 3);
    const finalStartDate = start_date || startDate;
    const finalEndDate = end_date || endDate;
    const finalCapital = Number(initial_capital || initialCapital) || 100000;
    const finalSlippage = Number(slippage_pct !== undefined ? slippage_pct : slippagePct);
    const finalFee = Number(fee_pct !== undefined ? fee_pct : feePct);

    // 1. Fetch historical candles with warmup period (under hourdata or daydata)
    const candles = await ensureHistoricalCandles(symbol, {
      timeframe: finalTimeframe,
      years: finalTimeframe === 'hour' ? Math.min(2, finalYears) : finalYears,
      startDate: finalStartDate,
      endDate: finalEndDate,
    });

    if (!candles || candles.length < 50) {
      return res.status(404).json({
        error: `Insufficient historical data available for ${symbol} to perform a backtest.`,
      });
    }

    // 2. Fetch daily candles for baseline if timeframe is 'hour'
    let dailyCandles: any = undefined;
    if (finalTimeframe === 'hour') {
      try {
        dailyCandles = await ensureHistoricalCandles(symbol, {
          timeframe: 'day',
          years: Math.max(3, finalYears + 1),
        });
      } catch (err: any) {
        console.warn('[Backtest] Could not load daily candles for provisional indicators:', err.message);
      }
    }

    // 3. Compute rolling indicators (provisional daily indicators on hourly bars)
    const bars = computeRollingIndicators(candles, dailyCandles);

    // 4. Determine nominal simulation start date
    let nominalStartStr = finalStartDate;
    if (!nominalStartStr) {
      const today = new Date();
      const nStart = new Date();
      nStart.setFullYear(today.getFullYear() - finalYears);
      nominalStartStr = nStart.toISOString().split('T')[0];
    }

    // 5. Run simulation
    const simResult = runSimulation(symbol, bars, finalRules, {
      initialCapital: finalCapital,
      slippagePct: finalSlippage,
      feePct: finalFee,
      nominalStartDate: nominalStartStr,
      nominalEndDate: finalEndDate,
    });

    // 5. Compute summary metrics
    const summary = computeBacktestMetrics(simResult);

    const cleanDate = (d: string | undefined) => (d ? (d.includes(' ') ? d.split(' ')[0] : d.split('T')[0]) : '');

    const response: BacktestResponse = {
      symbol,
      summary: {
        ...summary,
        startDate: cleanDate(summary.startDate),
        endDate: cleanDate(summary.endDate),
      },
      initialInvestment: simResult.initialInvestment
        ? {
            ...simResult.initialInvestment,
            date: cleanDate(simResult.initialInvestment.date),
            time: simResult.initialInvestment.time,
          }
        : undefined,
      trades: simResult.trades.map((t) => ({
        ...t,
        entryDate: cleanDate(t.entryDate),
        exitDate: cleanDate(t.exitDate),
      })),
      equityCurve: simResult.equityCurve.map((pt) => ({
        ...pt,
        date: cleanDate(pt.date),
        time: pt.time,
      })),
    };

    return res.json(response);
  } catch (err: any) {
    console.error('[Backtest Route Error]:', err);
    return res.status(500).json({ error: err.message || 'Failed to execute backtest.' });
  }
});

// Alias POST / to /run
router.post('/', optionalAuthMiddleware, async (req: any, res: any) => {
  return (router as any).handle({ ...req, url: '/run' }, res);
});

export default router;
