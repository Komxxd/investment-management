import { ensureHistoricalCandles } from '../modules/prices/data-storage.service';
import { computeRollingIndicators } from '../modules/backtest/rolling-indicators.service';
import { runSimulation } from '../modules/backtest/simulator.service';
import { computeBacktestMetrics } from '../modules/backtest/metrics.service';
import { StrategyRule } from '../modules/backtest/types';

async function runTask4Test() {
  const symbol = process.argv[2] || 'TCS.NS';
  const years = Number(process.argv[3]) || 3;
  const initialCapital = 100000;

  console.log('====================================================');
  console.log(`[Task 4 Test] Financial Metrics & Benchmark Analytics`);
  console.log(`Symbol: ${symbol} | Time Span: ${years} Years | Capital: ₹${initialCapital.toLocaleString()}`);
  console.log('====================================================\n');

  // 1. Ingest & compute indicators
  console.log('1. Loading candles & running simulation...');
  const candles = await ensureHistoricalCandles(symbol, { years });
  const bars = computeRollingIndicators(candles);

  const today = new Date();
  const nominalStart = new Date();
  nominalStart.setFullYear(today.getFullYear() - years);
  const nominalStartStr = nominalStart.toISOString().split('T')[0];

  const buyRule: StrategyRule = {
    name: 'RSI Oversold Pullback',
    action: 'BUY',
    sizingType: 'VALUE',
    sizingValue: 25000,
    conditions: [
      {
        id: 'c1',
        leftIndicator: 'rsi',
        operator: '<',
        rightType: 'value',
        rightValue: 35,
      },
    ],
    enabled: true,
  };

  const sellRule: StrategyRule = {
    name: 'RSI Overbought Profit Taking',
    action: 'SELL',
    sizingType: 'DECREASE_PCT',
    sizingValue: 100,
    conditions: [
      {
        id: 'c2',
        leftIndicator: 'rsi',
        operator: '>',
        rightType: 'value',
        rightValue: 68,
      },
    ],
    enabled: true,
  };

  const simResult = runSimulation(symbol, bars, [buyRule, sellRule], {
    initialCapital,
    nominalStartDate: nominalStartStr,
    slippagePct: 0.0005,
    feePct: 0.001,
  });

  // 2. Compute Institutional Performance Metrics
  console.log('2. Computing Quantitative Financial Metrics...');
  const tStart = Date.now();
  const metrics = computeBacktestMetrics(simResult);
  const duration = Date.now() - tStart;
  console.log(`✓ Metrics computed in ${duration}ms!\n`);

  console.log('====================================================');
  console.log('INSTITUTIONAL PERFORMANCE SCORECARD');
  console.log('====================================================');
  console.log(`Testing Period        : ${metrics.startDate} to ${metrics.endDate} (${metrics.tradingDays} trading days)`);
  console.log(`Initial Capital       : ₹${metrics.initialCapital.toLocaleString()}`);
  console.log(`Final Portfolio Value : ₹${metrics.finalEquity.toLocaleString()}`);
  console.log(`Net Profit            : ${metrics.netProfit >= 0 ? '+' : ''}₹${metrics.netProfit.toLocaleString()} (${metrics.totalReturnPct}%)`);
  console.log(`CAGR (Annual Return)  : ${metrics.cagrPct}%`);
  console.log(`Benchmark B&H Return  : ${metrics.benchmarkReturnPct}% (CAGR: ${metrics.benchmarkCagrPct}%)`);
  console.log(`Alpha vs Benchmark    : ${metrics.alphaPct >= 0 ? '+' : ''}${metrics.alphaPct}%`);
  console.log(`Maximum Drawdown (MDD): ${metrics.maxDrawdownPct}%`);
  console.log(`Sharpe Ratio          : ${metrics.sharpeRatio !== null ? metrics.sharpeRatio : 'N/A'}`);
  console.log(`Sortino Ratio         : ${metrics.sortinoRatio !== null ? metrics.sortinoRatio : 'N/A'}`);
  console.log(`Market Exposure       : ${metrics.marketExposurePct}% of time in market`);

  console.log('\n====================================================');
  console.log('TRADE ACCURACY & RISK PROFILE');
  console.log('====================================================');
  console.log(`Total Trades Executed : ${metrics.totalTrades} (Closed: ${metrics.closedTrades})`);
  console.log(`Win Rate              : ${metrics.winRatePct}% (${metrics.winningTrades} Wins / ${metrics.losingTrades} Losses)`);
  console.log(`Profit Factor         : ${metrics.profitFactor !== null ? metrics.profitFactor : 'N/A'}`);
  console.log(`Average Trade P&L     : ₹${metrics.avgTradePnl.toLocaleString()}`);
  console.log(`Average Win           : ₹${metrics.avgWin.toLocaleString()}`);
  console.log(`Average Loss          : ₹${metrics.avgLoss.toLocaleString()}`);
  console.log(`Win / Loss Ratio      : ${metrics.winLossRatio !== null ? metrics.winLossRatio : 'N/A'}`);

  console.log('\n====================================================');
  console.log(`🎉 Task 4 Test Passed Successfully!`);
  console.log('====================================================\n');
}

runTask4Test().catch((err) => {
  console.error('Task 4 test failed:', err);
  process.exit(1);
});
