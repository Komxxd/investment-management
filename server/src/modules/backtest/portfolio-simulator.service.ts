import { readLocalCandles, ensureHistoricalCandles } from '../prices/data-storage.service';
import { computeRollingIndicators } from './rolling-indicators.service';
import { computeBacktestMetrics } from './metrics.service';
import {
  BacktestResponse,
  BacktestTrade,
  DailyEquityPoint,
  InitialInvestmentInfo,
  SimulationResult,
  PortfolioBacktestConfig,
} from './types';

interface HeldPosition {
  qty: number;
  totalCost: number;
  avgPrice: number;
}

/**
 * Runs a complete historical backtest for an entire portfolio using either:
 * 1. ONE_TIME: Lump-sum investment (Buy & Hold) from start date to end date
 * 2. SIP: Systematic Investment Plan (recurring purchases at specified date and time)
 */
export async function simulatePortfolio(
  portfolioStocks: Array<{ id?: string; symbol: string; quantity?: number; entry_price?: number }>,
  config: PortfolioBacktestConfig
): Promise<BacktestResponse> {
  const mode = config.mode || 'ONE_TIME';
  const timeframe = mode === 'ONE_TIME' ? 'day' : (config.timeframe === 'day' ? 'day' : 'hour');
  const initialCapital = Number(config.initialCapital) || 100000;
  const sipAmount = Number(config.sipAmount) || 10000;
  const frequency = config.frequency || 'monthly';
  const sipDay = Number(config.sipDay) || 5;
  const sipTime = config.sipTime || '09:15';

  if (!portfolioStocks || portfolioStocks.length === 0) {
    throw new Error('Portfolio has no stocks configured. Please add stocks to this portfolio first.');
  }

  // 1. Fetch candles for each constituent stock
  const candleMap = new Map<string, any[]>();
  for (const item of portfolioStocks) {
    const sym = item.symbol.trim().toUpperCase();
    if (!sym) continue;

    let candles: any[] = [];
    try {
      candles = await ensureHistoricalCandles(sym, {
        timeframe,
        startDate: config.startDate,
        endDate: config.endDate,
        years: timeframe === 'hour' ? 2 : 5,
      });
    } catch (err: any) {
      console.warn(`[Portfolio Backtest] Could not fetch candles for ${sym}:`, err.message);
      candles = readLocalCandles(sym, timeframe);
    }
    if (candles && candles.length > 0) {
      candleMap.set(sym, candles);
    }
  }

  if (candleMap.size === 0) {
    throw new Error('No historical market data could be loaded for any stocks in this portfolio.');
  }

  const validStocks = portfolioStocks.filter((s) => candleMap.has(s.symbol.trim().toUpperCase()));
  const uniqueValidSymbols = Array.from(
    new Set(validStocks.map((s) => s.symbol.trim().toUpperCase()))
  );

  // 2. Precalculate rolling indicators for each constituent stock
  const stockBarByTime = new Map<string, Map<string, any>>();
  for (const [sym, candles] of candleMap.entries()) {
    let dailyCandles: any = undefined;
    if (timeframe === 'hour') {
      try {
        dailyCandles = await ensureHistoricalCandles(sym, {
          timeframe: 'day',
          startDate: config.startDate,
          endDate: config.endDate,
          years: 3,
        });
      } catch (err: any) {
        console.warn(`[Portfolio Backtest] Could not fetch daily candles for ${sym}:`, err.message);
        dailyCandles = readLocalCandles(sym, 'day');
      }
    }

    const bars = computeRollingIndicators(candles, dailyCandles);
    const bMap = new Map<string, any>();
    for (const b of bars) {
      bMap.set(b.date, b);
    }
    stockBarByTime.set(sym, bMap);
  }

  // 3. Allocate capital equally across all unique constituent stocks (no weighted allocation)
  const stockWeights = new Map<string, number>();
  const eqW = uniqueValidSymbols.length > 0 ? 1 / uniqueValidSymbols.length : 0;
  for (const sym of uniqueValidSymbols) {
    stockWeights.set(sym, eqW);
  }

  // 4. Build unified chronological timeline of all timestamps
  const timestampSet = new Set<string>();
  const stockCandleByTime = new Map<string, Map<string, any>>();

  for (const [sym, cList] of candleMap.entries()) {
    const byTime = new Map<string, any>();
    for (const c of cList) {
      timestampSet.add(c.date);
      byTime.set(c.date, c);
    }
    stockCandleByTime.set(sym, byTime);
  }

  const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a.localeCompare(b));

  // Filter timestamps by requested date window
  const nominalStart = config.startDate;
  const nominalEnd = config.endDate;
  const timeline = sortedTimestamps.filter((t) => {
    const d = t.includes(' ') ? t.split(' ')[0] : t.split('T')[0];
    if (nominalStart && d < nominalStart) return false;
    if (nominalEnd && d > nominalEnd) return false;
    return true;
  });

  if (timeline.length === 0) {
    throw new Error('No candle data found within the selected start and end date range.');
  }

  // 5. State tracking for simulation
  let cash = mode === 'ONE_TIME' ? initialCapital : 0;
  let totalCapitalInvested = mode === 'ONE_TIME' ? initialCapital : 0;
  const heldPositions = new Map<string, HeldPosition>();
  const lastKnownCandle = new Map<string, any>();
  const trades: BacktestTrade[] = [];
  const equityCurve: DailyEquityPoint[] = [];
  const stocksData: Record<string, DailyEquityPoint[]> = {};
  for (const sym of uniqueValidSymbols) {
    stocksData[sym] = [];
  }
  let initialInvestment: InitialInvestmentInfo | undefined = undefined;
  let peakEquity = mode === 'ONE_TIME' ? initialCapital : sipAmount;
  let benchmarkInitialVal = 0;
  let sipCount = 0;

  // SIP timing trackers & precalculated monthly execution dates
  let lastSipMonth = '';
  let lastSipWeek = '';
  let lastSipDay = '';

  const monthlySipExecDates = new Map<string, string>();
  if (mode === 'SIP' && frequency === 'monthly') {
    const timelineDates = Array.from(
      new Set(timeline.map((t) => (t.includes(' ') ? t.split(' ')[0] : t.split('T')[0])))
    ).sort();
    const timelineDateSet = new Set(timelineDates);

    // Group available trading days by month ('YYYY-MM')
    const datesByMonth = new Map<string, string[]>();
    for (const d of timelineDates) {
      const m = d.substring(0, 7);
      if (!datesByMonth.has(m)) {
        datesByMonth.set(m, []);
      }
      datesByMonth.get(m)!.push(d);
    }

    const firstMonthKey = timelineDates.length > 0 ? timelineDates[0].substring(0, 7) : '';

    for (const [mKey, mDays] of datesByMonth.entries()) {
      const targetDateStr = `${mKey}-${String(sipDay).padStart(2, '0')}`;

      if (timelineDateSet.has(targetDateStr)) {
        // Target sipDay is an active market trading day
        monthlySipExecDates.set(mKey, targetDateStr);
      } else {
        // Target sipDay is NOT a market day (weekend or market holiday).
        // Execute on the previous market trading day in that month before the target day!
        const prevDays = mDays.filter((d) => d < targetDateStr);
        if (prevDays.length > 0) {
          monthlySipExecDates.set(mKey, prevDays[prevDays.length - 1]);
        } else if (mKey === firstMonthKey && nominalStart && targetDateStr < nominalStart) {
          // If simulation started after the SIP day in the first month (e.g. started on Nov 18 while SIP day is 5th),
          // execute initial installment on the first available trading day of the simulation
          monthlySipExecDates.set(mKey, mDays[0]);
        } else {
          // If no previous market day in this month (e.g. sipDay=1 and 1st is holiday), fallback to first market day
          monthlySipExecDates.set(mKey, mDays[0]);
        }
      }
    }
  }

  // 6. Run simulation across timeline
  for (let i = 0; i < timeline.length; i++) {
    const t = timeline[i];
    const datePart = t.includes(' ') ? t.split(' ')[0] : t.split('T')[0];
    const timePart = t.includes(' ') ? t.split(' ')[1] : undefined;

    // Update latest known candle for each stock
    for (const sym of uniqueValidSymbols) {
      const c = stockCandleByTime.get(sym)?.get(t);
      if (c) {
        lastKnownCandle.set(sym, c);
      }
    }

    let candleAction: string | undefined = undefined;
    let actionReason: string | undefined = undefined;
    const stockActionThisBar = new Map<string, { action: string; reason?: string }>();

    // =========================================================================
    // A. ONE_TIME LUMP SUM EXECUTION (on first bar)
    // =========================================================================
    if (mode === 'ONE_TIME' && i === 0) {
      candleAction = 'Initial Entry';
      actionReason = 'One-Time Lump Sum Portfolio Entry';
      let totalGrossOutlay = 0;
      let totalSharesBought = 0;

      for (const sym of uniqueValidSymbols) {
        const w = stockWeights.get(sym) || 1 / uniqueValidSymbols.length;
        const targetAlloc = initialCapital * w;
        const candle = stockCandleByTime.get(sym)?.get(t) || lastKnownCandle.get(sym);
        const execPrice = candle ? candle.open : 100;

        if (execPrice > 0) {
          const fillQty = Math.floor(targetAlloc / execPrice);
          if (fillQty > 0) {
            const cost = parseFloat((fillQty * execPrice).toFixed(2));
            heldPositions.set(sym, {
              qty: fillQty,
              totalCost: cost,
              avgPrice: execPrice,
            });
            cash -= cost;
            totalGrossOutlay += cost;
            totalSharesBought += fillQty;

            trades.push({
              id: `trade_${sym}_1`,
              symbol: sym,
              action: 'BUY',
              entryDate: t,
              entryPrice: execPrice,
              qty: fillQty,
              totalCost: cost,
              status: 'OPEN',
              entryReason: 'One-Time Initial Allocation',
            });

            stockActionThisBar.set(sym, {
              action: 'Initial Entry',
              reason: 'One-Time Initial Allocation',
            });
          }
        }
      }

      initialInvestment = {
        date: datePart,
        time: timePart,
        action: 'Initial Entry',
        open: totalGrossOutlay,
        high: totalGrossOutlay,
        low: totalGrossOutlay,
        close: totalGrossOutlay,
        invested: parseFloat(totalGrossOutlay.toFixed(2)),
        qty: totalSharesBought,
        execPrice: parseFloat((totalGrossOutlay / Math.max(1, totalSharesBought)).toFixed(2)),
        cashRemaining: parseFloat(cash.toFixed(2)),
        initialCapital,
      };
    }

    // =========================================================================
    // B. SIP (RECURRING BUY) EXECUTION
    // =========================================================================
    if (mode === 'SIP') {
      let isSipTriggered = false;

      if (frequency === 'monthly') {
        const monthKey = datePart.substring(0, 7); // 'YYYY-MM'
        const scheduledDate = monthlySipExecDates.get(monthKey);

        if (lastSipMonth !== monthKey && scheduledDate === datePart) {
          // Check execution time or take first available bar of the day
          const isTimeMatch = !timePart || timePart === sipTime || timePart >= sipTime;
          if (isTimeMatch) {
            isSipTriggered = true;
            lastSipMonth = monthKey;
          }
        }
      } else if (frequency === 'weekly') {
        // Trigger weekly on Monday
        const dObj = new Date(datePart);
        const dayOfWeek = dObj.getDay(); // 1 = Monday
        const weekKey = `${datePart.substring(0, 7)}-w${Math.ceil(dObj.getDate() / 7)}`;
        if (lastSipWeek !== weekKey && (dayOfWeek === 1 || dayOfWeek === 2)) {
          const isTimeMatch = !timePart || timePart === sipTime || timePart >= sipTime;
          if (isTimeMatch) {
            isSipTriggered = true;
            lastSipWeek = weekKey;
          }
        }
      } else if (frequency === 'daily') {
        // Trigger daily
        if (lastSipDay !== datePart) {
          const isTimeMatch = !timePart || timePart === sipTime || timePart >= sipTime;
          if (isTimeMatch) {
            isSipTriggered = true;
            lastSipDay = datePart;
          }
        }
      }

      if (isSipTriggered) {
        sipCount++;
        cash += sipAmount;
        totalCapitalInvested += sipAmount;
        candleAction = i === 0 ? 'Initial Entry' : 'SIP Buy';
        actionReason = `SIP Installment #${sipCount} (₹${sipAmount.toLocaleString()} invested)`;

        let totalOutlayThisSip = 0;
        let sharesBoughtThisSip = 0;

        for (const sym of uniqueValidSymbols) {
          const w = stockWeights.get(sym) || 1 / uniqueValidSymbols.length;
          const targetAlloc = sipAmount * w;
          const candle = stockCandleByTime.get(sym)?.get(t) || lastKnownCandle.get(sym);
          const execPrice = candle ? (candle.open || candle.close) : 100;

          if (execPrice > 0) {
            const fillQty = Math.floor(targetAlloc / execPrice);
            if (fillQty > 0) {
              const cost = parseFloat((fillQty * execPrice).toFixed(2));
              const currentPos = heldPositions.get(sym) || { qty: 0, totalCost: 0, avgPrice: 0 };
              const newQty = currentPos.qty + fillQty;
              const newTotalCost = parseFloat((currentPos.totalCost + cost).toFixed(2));
              const newAvgPrice = parseFloat((newTotalCost / newQty).toFixed(2));

              heldPositions.set(sym, {
                qty: newQty,
                totalCost: newTotalCost,
                avgPrice: newAvgPrice,
              });

              cash -= cost;
              totalOutlayThisSip += cost;
              sharesBoughtThisSip += fillQty;

              trades.push({
                id: `trade_${sym}_${trades.length + 1}`,
                symbol: sym,
                action: 'BUY',
                entryDate: t,
                entryPrice: execPrice,
                qty: fillQty,
                totalCost: cost,
                status: 'OPEN',
                entryReason: `SIP Installment #${sipCount}`,
              });

              stockActionThisBar.set(sym, {
                action: i === 0 ? 'Initial Entry' : 'SIP Buy',
                reason: `SIP Installment #${sipCount}`,
              });
            }
          }
        }

        if (i === 0 || !initialInvestment) {
          initialInvestment = {
            date: datePart,
            time: timePart,
            action: 'Initial Entry',
            open: totalOutlayThisSip,
            high: totalOutlayThisSip,
            low: totalOutlayThisSip,
            close: totalOutlayThisSip,
            invested: parseFloat(totalOutlayThisSip.toFixed(2)),
            qty: sharesBoughtThisSip,
            execPrice: parseFloat((totalOutlayThisSip / Math.max(1, sharesBoughtThisSip)).toFixed(2)),
            cashRemaining: parseFloat(cash.toFixed(2)),
            initialCapital: sipAmount,
          };
        }
      }
    }

    // =========================================================================
    // C. MARK-TO-MARKET VALUATION ACROSS ALL HELD POSITIONS
    // =========================================================================
    let totalHoldingsValue = 0;
    let totalCostBasis = 0;
    let totalHeldShares = 0;
    let aggregateOpen = 0;
    let aggregateHigh = 0;
    let aggregateLow = 0;
    let aggregateClose = 0;

    for (const sym of uniqueValidSymbols) {
      const pos = heldPositions.get(sym);
      const candle = stockCandleByTime.get(sym)?.get(t) || lastKnownCandle.get(sym);
      const barData = stockBarByTime.get(sym)?.get(t);

      const open = candle ? candle.open : (barData?.open ?? 0);
      const high = candle ? candle.high : (barData?.high ?? 0);
      const low = candle ? candle.low : (barData?.low ?? 0);
      const close = candle ? candle.close : (barData?.close ?? 0);
      const changePercent = barData?.changePercent;
      const indicators = barData?.indicators;

      const heldQty = pos ? pos.qty : 0;
      const invested = pos ? pos.totalCost : 0;
      const closeP = candle ? candle.close : (pos?.avgPrice || 0);
      const stockHoldingVal = parseFloat((heldQty * closeP).toFixed(2));
      const stockUnrealized = parseFloat((stockHoldingVal - invested).toFixed(2));
      const stockRealized = 0;
      const stockTotalPnl = stockUnrealized;
      const act = stockActionThisBar.get(sym);

      stocksData[sym].push({
        date: datePart,
        time: timePart,
        open,
        high,
        low,
        close,
        changePercent,
        indicators,
        invested,
        heldQty,
        holdingsValue: stockHoldingVal,
        equity: stockHoldingVal,
        cash: 0,
        unrealizedPnl: stockUnrealized,
        realizedPnl: stockRealized,
        totalPnl: stockTotalPnl,
        stockClose: close,
        benchmarkEquity: 0,
        drawdownPercent: 0,
        action: act?.action,
        actionReason: act?.reason,
        conditionMatched: Boolean(act),
      });

      if (pos && pos.qty > 0) {
        totalHoldingsValue += pos.qty * closeP;
        totalCostBasis += pos.totalCost;
        totalHeldShares += pos.qty;
      }

      if (candle) {
        aggregateOpen += candle.open;
        aggregateHigh += candle.high;
        aggregateLow += candle.low;
        aggregateClose += candle.close;
      }
    }

    totalHoldingsValue = parseFloat(totalHoldingsValue.toFixed(2));
    totalCostBasis = parseFloat(totalCostBasis.toFixed(2));
    const currentEquity = parseFloat((cash + totalHoldingsValue).toFixed(2));
    peakEquity = Math.max(peakEquity, currentEquity);
    const ddPercent =
      peakEquity > 0
        ? parseFloat((((peakEquity - currentEquity) / peakEquity) * 100).toFixed(2))
        : 0;

    // Benchmark comparison (Buy & hold equal baseline)
    if (benchmarkInitialVal === 0 && aggregateClose > 0) {
      benchmarkInitialVal = aggregateClose;
    }
    const benchmarkEquity =
      benchmarkInitialVal > 0 && aggregateClose > 0
        ? parseFloat(
            (
              ((mode === 'ONE_TIME' ? initialCapital : totalCapitalInvested) / benchmarkInitialVal) *
              aggregateClose
            ).toFixed(2)
          )
        : currentEquity;

    const unrealizedPnl = parseFloat((totalHoldingsValue - totalCostBasis).toFixed(2));
    const realizedPnl = 0;
    const totalPnl = unrealizedPnl;

    equityCurve.push({
      date: datePart,
      time: timePart,
      action: candleAction,
      open: aggregateOpen,
      high: aggregateHigh,
      low: aggregateLow,
      close: aggregateClose,
      invested: totalCostBasis,
      heldQty: totalHeldShares,
      holdingsValue: totalHoldingsValue,
      equity: currentEquity,
      cash: parseFloat(cash.toFixed(2)),
      unrealizedPnl,
      realizedPnl,
      totalPnl,
      stockClose: aggregateClose,
      benchmarkEquity,
      drawdownPercent: ddPercent,
      conditionMatched: Boolean(candleAction),
      actionReason,
    });
  }

  // 6. Compute institutional summary metrics
  const simResult: SimulationResult = {
    symbol: `${config.portfolioName || 'Portfolio'} (${mode === 'SIP' ? 'SIP' : 'One-Time'})`,
    initialCapital: mode === 'SIP' ? totalCapitalInvested : initialCapital,
    finalEquity: equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : initialCapital,
    cash,
    holdingsValue: equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].holdingsValue : 0,
    heldQty: equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].heldQty : 0,
    initialInvestment,
    trades,
    equityCurve,
    stocksData,
  };

  const summary = computeBacktestMetrics(simResult);
  const cleanDate = (d?: string) => (d ? (d.includes(' ') ? d.split(' ')[0] : d.split('T')[0]) : '');

  return {
    symbol: simResult.symbol,
    summary: {
      ...summary,
      initialCapital: mode === 'SIP' ? totalCapitalInvested : initialCapital,
      startDate: cleanDate(summary.startDate),
      endDate: cleanDate(summary.endDate),
    },
    initialInvestment: simResult.initialInvestment
      ? {
          ...simResult.initialInvestment,
          date: cleanDate(simResult.initialInvestment.date),
        }
      : undefined,
    trades: simResult.trades,
    equityCurve: simResult.equityCurve,
    stocksData,
  };
}

