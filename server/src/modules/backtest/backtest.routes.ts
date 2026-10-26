import { Router } from 'express';
import { optionalAuthMiddleware } from '../../middleware/auth';
import { getAnonClient } from '../../config/supabase';
import { ensureHistoricalCandles } from '../prices/data-storage.service';
import { computeRollingIndicators } from './rolling-indicators.service';
import { runSimulation } from './simulator.service';
import { computeBacktestMetrics } from './metrics.service';
import { StrategyRule, BacktestResponse } from './types';

const router = Router();

/**
 * POST /api/backtest/run (or POST /api/strategies/backtest)
 * Executes a full backtest on historical daily candles.
 */
router.post('/run', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const {
      symbol,
      rules,
      strategyId,
      strategy_id,
      years = 3,
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

    const finalYears = Number(years) || 3;
    const finalStartDate = start_date || startDate;
    const finalEndDate = end_date || endDate;
    const finalCapital = Number(initial_capital || initialCapital) || 100000;
    const finalSlippage = Number(slippage_pct !== undefined ? slippage_pct : slippagePct);
    const finalFee = Number(fee_pct !== undefined ? fee_pct : feePct);

    // 1. Fetch historical candles with warmup period
    const candles = await ensureHistoricalCandles(symbol, {
      years: finalYears,
      startDate: finalStartDate,
      endDate: finalEndDate,
    });

    if (!candles || candles.length < 50) {
      return res.status(404).json({
        error: `Insufficient historical data available for ${symbol} to perform a backtest.`,
      });
    }

    // 2. Compute rolling indicators
    const bars = computeRollingIndicators(candles);

    // 3. Determine nominal simulation start date
    let nominalStartStr = finalStartDate;
    if (!nominalStartStr) {
      const today = new Date();
      const nStart = new Date();
      nStart.setFullYear(today.getFullYear() - finalYears);
      nominalStartStr = nStart.toISOString().split('T')[0];
    }

    // 4. Run simulation
    const simResult = runSimulation(symbol, bars, finalRules, {
      initialCapital: finalCapital,
      slippagePct: finalSlippage,
      feePct: finalFee,
      nominalStartDate: nominalStartStr,
      nominalEndDate: finalEndDate,
    });

    // 5. Compute summary metrics
    const summary = computeBacktestMetrics(simResult);

    const response: BacktestResponse = {
      symbol,
      summary,
      trades: simResult.trades,
      equityCurve: simResult.equityCurve,
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
