import { SimulationResult, BacktestSummaryMetrics } from './types';

/**
 * Computes institutional-grade risk & performance metrics from a SimulationResult.
 */
export function computeBacktestMetrics(sim: SimulationResult): BacktestSummaryMetrics {
  const { initialCapital, finalEquity, trades, equityCurve } = sim;
  const netProfit = parseFloat((finalEquity - initialCapital).toFixed(2));
  const totalReturnPct = initialCapital > 0 ? parseFloat(((netProfit / initialCapital) * 100).toFixed(2)) : 0;

  // Trading days & calendar timeline
  const uniqueDates = new Set(
    equityCurve
      .map((pt) => (pt.date.includes(' ') ? pt.date.split(' ')[0] : pt.date.split('T')[0]))
      .filter(Boolean)
  );
  const tradingDays = uniqueDates.size > 0 ? uniqueDates.size : equityCurve.length;

  const startDate = equityCurve.length > 0 ? equityCurve[0].date : '';
  const endDate = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].date : '';

  let calendarDays = 1;
  if (startDate && endDate) {
    const d1 = new Date(startDate.split(' ')[0].split('T')[0]).getTime();
    const d2 = new Date(endDate.split(' ')[0].split('T')[0]).getTime();
    const msDiff = d2 - d1;
    calendarDays = Math.max(1, Math.round(msDiff / (1000 * 60 * 60 * 24)));
  }

  // CAGR Calculation (Calendar-day standard: (Final / Initial)^(365.25 / calendarDays) - 1)
  let cagrPct = totalReturnPct;
  if (calendarDays > 0 && initialCapital > 0 && finalEquity > 0) {
    const years = calendarDays / 365.25;
    const compoundRatio = finalEquity / initialCapital;
    cagrPct = parseFloat(((Math.pow(compoundRatio, 1 / years) - 1) * 100).toFixed(2));
  } else if (finalEquity <= 0) {
    cagrPct = -100;
  }

  // Benchmark performance
  let benchmarkFinal = initialCapital;
  let benchmarkReturnPct = 0;
  let benchmarkCagrPct = 0;
  if (equityCurve.length > 0) {
    benchmarkFinal = equityCurve[equityCurve.length - 1].benchmarkEquity;
    benchmarkReturnPct = parseFloat(
      (((benchmarkFinal - initialCapital) / initialCapital) * 100).toFixed(2)
    );
    if (calendarDays > 0 && initialCapital > 0 && benchmarkFinal > 0) {
      const years = calendarDays / 365.25;
      const bRatio = benchmarkFinal / initialCapital;
      benchmarkCagrPct = parseFloat(((Math.pow(bRatio, 1 / years) - 1) * 100).toFixed(2));
    }
  }
  const alphaPct = parseFloat((totalReturnPct - benchmarkReturnPct).toFixed(2));

  // Max Drawdown (MDD)
  let maxDrawdownPct = 0;
  for (const pt of equityCurve) {
    if (pt.drawdownPercent > maxDrawdownPct) {
      maxDrawdownPct = pt.drawdownPercent;
    }
  }

  // Trade Statistics (Closed trades only)
  const closedTrades = trades.filter((t) => t.status === 'CLOSED');
  const winningTrades = closedTrades.filter((t) => (t.pnl || 0) > 0);
  const losingTrades = closedTrades.filter((t) => (t.pnl || 0) < 0);

  const winRatePct =
    closedTrades.length > 0
      ? parseFloat(((winningTrades.length / closedTrades.length) * 100).toFixed(2))
      : 0;

  const grossWins = winningTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const grossLosses = Math.abs(losingTrades.reduce((acc, t) => acc + (t.pnl || 0), 0));

  let profitFactor: number | null = null;
  if (grossLosses > 0) {
    profitFactor = parseFloat((grossWins / grossLosses).toFixed(2));
  } else if (grossWins > 0) {
    profitFactor = 99.99; // 100% profitable, zero losses
  }

  const avgTradePnl =
    closedTrades.length > 0
      ? parseFloat((closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0) / closedTrades.length).toFixed(2))
      : 0;

  const avgWin =
    winningTrades.length > 0 ? parseFloat((grossWins / winningTrades.length).toFixed(2)) : 0;
  const avgLoss =
    losingTrades.length > 0 ? parseFloat((grossLosses / losingTrades.length).toFixed(2)) : 0;
  const winLossRatio = avgLoss > 0 ? parseFloat((avgWin / avgLoss).toFixed(2)) : null;

  // Market Exposure % (Days holding stock vs in cash)
  const daysInMarket = equityCurve.filter((pt) => pt.heldQty > 0).length;
  const marketExposurePct =
    tradingDays > 0 ? parseFloat(((daysInMarket / tradingDays) * 100).toFixed(2)) : 0;

  // Sharpe and Sortino Ratios (Daily returns annualized)
  let sharpeRatio: number | null = null;
  let sortinoRatio: number | null = null;

  if (tradingDays > 5) {
    const dailyReturns: number[] = [];
    for (let i = 1; i < tradingDays; i++) {
      const prev = equityCurve[i - 1].equity;
      const curr = equityCurve[i].equity;
      if (prev > 0) {
        dailyReturns.push((curr - prev) / prev);
      }
    }

    if (dailyReturns.length > 0) {
      // Risk free rate: assume ~6% annual risk-free rate (approx 0.06 / 252 daily)
      const dailyRf = 0.06 / 252;
      const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;

      const variance =
        dailyReturns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) /
        dailyReturns.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 0) {
        sharpeRatio = parseFloat((((meanReturn - dailyRf) / stdDev) * Math.sqrt(252)).toFixed(2));
      }

      // Sortino: downside deviation (only returns below dailyRf)
      const downsideVariance =
        dailyReturns.reduce((acc, r) => {
          const diff = Math.min(0, r - dailyRf);
          return acc + Math.pow(diff, 2);
        }, 0) / dailyReturns.length;
      const downsideStdDev = Math.sqrt(downsideVariance);

      if (downsideStdDev > 0) {
        sortinoRatio = parseFloat(
          (((meanReturn - dailyRf) / downsideStdDev) * Math.sqrt(252)).toFixed(2)
        );
      }
    }
  }

  // Calmar Ratio: CAGR / Max Drawdown
  let calmarRatio: number | null = null;
  if (maxDrawdownPct > 0) {
    calmarRatio = parseFloat((cagrPct / maxDrawdownPct).toFixed(2));
  }

  // Max Drawdown Duration (Underwater days)
  let currentUnderwater = 0;
  let maxDrawdownDurationDays = 0;
  for (const pt of equityCurve) {
    if (pt.drawdownPercent > 0.05) {
      currentUnderwater++;
      if (currentUnderwater > maxDrawdownDurationDays) {
        maxDrawdownDurationDays = currentUnderwater;
      }
    } else {
      currentUnderwater = 0;
    }
  }

  // Beta: Portfolio sensitivity to Benchmark
  let beta: number | null = null;
  if (tradingDays > 5) {
    const stratReturns: number[] = [];
    const benchReturns: number[] = [];
    for (let i = 1; i < tradingDays; i++) {
      const prevE = equityCurve[i - 1].equity;
      const currE = equityCurve[i].equity;
      const prevB = equityCurve[i - 1].benchmarkEquity;
      const currB = equityCurve[i].benchmarkEquity;
      if (prevE > 0 && prevB > 0) {
        stratReturns.push((currE - prevE) / prevE);
        benchReturns.push((currB - prevB) / prevB);
      }
    }
    if (stratReturns.length > 0) {
      const meanS = stratReturns.reduce((a, b) => a + b, 0) / stratReturns.length;
      const meanB = benchReturns.reduce((a, b) => a + b, 0) / benchReturns.length;
      let cov = 0;
      let varB = 0;
      for (let i = 0; i < stratReturns.length; i++) {
        cov += (stratReturns[i] - meanS) * (benchReturns[i] - meanB);
        varB += Math.pow(benchReturns[i] - meanB, 2);
      }
      if (varB > 0) {
        beta = parseFloat((cov / varB).toFixed(2));
      }
    }
  }

  return {
    initialCapital,
    finalEquity,
    netProfit,
    totalReturnPct,
    cagrPct,
    benchmarkReturnPct,
    benchmarkCagrPct,
    alphaPct,
    maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
    winRatePct,
    profitFactor,
    sharpeRatio,
    sortinoRatio,
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    avgTradePnl,
    avgWin,
    avgLoss,
    winLossRatio,
    marketExposurePct,
    tradingDays,
    startDate,
    endDate,
    calmarRatio,
    beta,
    maxDrawdownDurationDays,
  };
}
