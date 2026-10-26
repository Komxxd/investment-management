import { ensureHistoricalCandles } from '../modules/prices/data-storage.service';
import { computeRollingIndicators } from '../modules/backtest/rolling-indicators.service';
import { runSimulation } from '../modules/backtest/simulator.service';
import { StrategyRule } from '../modules/backtest/types';

async function runTask3Test() {
  const symbol = process.argv[2] || 'RELIANCE.NS';
  const years = Number(process.argv[3]) || 3;
  const initialCapital = 100000; // ₹1,00,000

  console.log('====================================================');
  console.log(`[Task 3 Test] Virtual Broker & Order Execution Simulator`);
  console.log(`Symbol: ${symbol} | Time Span: ${years} Years | Capital: ₹${initialCapital.toLocaleString()}`);
  console.log('====================================================\n');

  // 1. Load historical candles
  console.log('1. Loading candles & computing rolling indicators...');
  const candles = await ensureHistoricalCandles(symbol, { years });
  const bars = computeRollingIndicators(candles);

  const today = new Date();
  const nominalStart = new Date();
  nominalStart.setFullYear(today.getFullYear() - years);
  const nominalStartStr = nominalStart.toISOString().split('T')[0];

  // 2. Setup strategy rules
  const buyRule: StrategyRule = {
    name: 'RSI Oversold Pullback',
    action: 'BUY',
    sizingType: 'VALUE',
    sizingValue: 25000, // ₹25,000 per entry
    conditions: [
      {
        id: 'c1',
        leftIndicator: 'rsi',
        operator: '<',
        rightType: 'value',
        rightValue: 35,
      },
      {
        id: 'c2',
        leftIndicator: 'price',
        operator: '>',
        rightType: 'indicator',
        rightIndicator: 'dma200',
        connector: 'AND',
      },
    ],
    enabled: true,
  };

  const sellRule: StrategyRule = {
    name: 'RSI Overbought Profit Taking',
    action: 'SELL',
    sizingType: 'DECREASE_PCT',
    sizingValue: 100, // Sell 100% of holding
    conditions: [
      {
        id: 'c3',
        leftIndicator: 'rsi',
        operator: '>',
        rightType: 'value',
        rightValue: 68,
      },
    ],
    enabled: true,
  };

  // 3. Execute simulation
  console.log(`\n2. Running Simulation from ${nominalStartStr} with slippage & transaction costs...`);
  const tStart = Date.now();
  const result = runSimulation(symbol, bars, [buyRule, sellRule], {
    initialCapital,
    nominalStartDate: nominalStartStr,
    slippagePct: 0.0005, // 0.05%
    feePct: 0.001,       // 0.1%
  });
  const duration = Date.now() - tStart;

  console.log(`✓ Simulation completed in ${duration}ms!`);

  // 4. Summarize Results
  const totalReturn = result.finalEquity - result.initialCapital;
  const returnPct = ((totalReturn / result.initialCapital) * 100).toFixed(2);
  const benchmarkFinal = result.equityCurve.length > 0 ? result.equityCurve[result.equityCurve.length - 1].benchmarkEquity : initialCapital;
  const benchmarkReturnPct = (((benchmarkFinal - initialCapital) / initialCapital) * 100).toFixed(2);

  console.log('\n====================================================');
  console.log('SIMULATION ACCOUNT SUMMARY');
  console.log('====================================================');
  console.log(`Initial Capital    : ₹${result.initialCapital.toLocaleString()}`);
  console.log(`Final Portfolio Val: ₹${result.finalEquity.toLocaleString()}`);
  console.log(`Cash Balance       : ₹${result.cash.toLocaleString()}`);
  console.log(`Holdings Value     : ₹${result.holdingsValue.toLocaleString()} (${result.heldQty} shares)`);
  console.log(`Strategy Net Return: ${totalReturn >= 0 ? '+' : ''}₹${totalReturn.toFixed(2)} (${returnPct}%)`);
  console.log(`Buy & Hold Return  : ${benchmarkReturnPct}%`);
  console.log(`Total Trades       : ${result.trades.length}`);

  // 5. Display Trade Ledger
  console.log('\n====================================================');
  console.log('TRADE BLOTTER (EXECUTION LOG)');
  console.log('====================================================');
  if (result.trades.length === 0) {
    console.log('No trades were triggered during this time window.');
  } else {
    result.trades.forEach((t, idx) => {
      const pnlSign = (t.pnl || 0) >= 0 ? '+' : '';
      console.log(
        `[#${idx + 1}] ${t.status.padEnd(6)} | Qty: ${String(t.qty).padEnd(4)} | Entry: ${t.entryDate} @ ₹${t.entryPrice.toFixed(2)} -> Exit: ${t.exitDate} @ ₹${(t.exitPrice || 0).toFixed(2)} | P&L: ${pnlSign}₹${(t.pnl || 0).toFixed(2)} (${pnlSign}${(t.pnlPercent || 0).toFixed(2)}%) | Held: ${t.holdingPeriodDays} days`
      );
    });
  }

  console.log('\n====================================================');
  console.log(`🎉 Task 3 Test Passed Successfully!`);
  console.log('====================================================\n');
}

runTask3Test().catch((err) => {
  console.error('Task 3 test failed:', err);
  process.exit(1);
});
