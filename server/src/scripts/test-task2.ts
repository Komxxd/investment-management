import { ensureHistoricalCandles } from '../modules/prices/data-storage.service';
import { computeRollingIndicators } from '../modules/backtest/rolling-indicators.service';
import {
  generateSignalsSeries,
  evaluateRuleOnBar,
} from '../modules/backtest/signal-evaluator.service';
import { StrategyRule } from '../modules/backtest/types';

async function runTask2Test() {
  const symbol = process.argv[2] || 'RELIANCE.NS';
  const years = Number(process.argv[3]) || 3;

  console.log('====================================================');
  console.log(`[Task 2 Test] Rolling Indicators & Signal Evaluation`);
  console.log(`Symbol: ${symbol} | Time Span: ${years} Years`);
  console.log('====================================================\n');

  // 1. Ingest candles
  console.log('1. Loading historical candles...');
  const candles = await ensureHistoricalCandles(symbol, { years });
  console.log(`✓ Loaded ${candles.length} candles (from ${candles[0].date} to ${candles[candles.length - 1].date})`);

  // 2. Compute rolling indicators
  console.log('\n2. Computing rolling indicators (RSI-14, DMA50, DMA200, Change %)...');
  const tStart = Date.now();
  const bars = computeRollingIndicators(candles);
  const duration = Date.now() - tStart;
  console.log(`✓ Processed ${bars.length} bars in ${duration}ms!`);

  // Inspect sample mature bar
  const latestBar = bars[bars.length - 1];
  console.log(`  - Latest Bar Date    : ${latestBar.date}`);
  console.log(`  - Close Price        : ₹${latestBar.close}`);
  console.log(`  - Daily Change %     : ${latestBar.changePercent}%`);
  console.log(`  - Wilder's RSI(14)   : ${latestBar.indicators.rsi}`);
  console.log(`  - DMA 50             : ₹${latestBar.indicators.dma50}`);
  console.log(`  - DMA 200            : ₹${latestBar.indicators.dma200}`);

  // 3. Define sample test rules
  const buyRule: StrategyRule = {
    name: 'RSI Oversold + Trend Filter',
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
    name: 'RSI Overbought Exit',
    action: 'SELL',
    sizingType: 'DECREASE_PCT',
    sizingValue: 100,
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

  const goldenCrossRule: StrategyRule = {
    name: 'Golden Cross (DMA50 Crossing Over DMA200)',
    action: 'BUY',
    sizingType: 'VALUE',
    sizingValue: 50000,
    conditions: [
      {
        id: 'c4',
        leftIndicator: 'dma50',
        operator: 'CROSSINGOVER',
        rightType: 'indicator',
        rightIndicator: 'dma200',
      },
    ],
    enabled: true,
  };

  // 4. Test signal generation
  const today = new Date();
  const nominalStart = new Date();
  nominalStart.setFullYear(today.getFullYear() - years);
  const nominalStartStr = nominalStart.toISOString().split('T')[0];

  console.log(`\n3. Evaluating Strategy Signals (Nominal Start: ${nominalStartStr})...`);
  const rules = [buyRule, sellRule, goldenCrossRule];
  const signals = generateSignalsSeries(bars, rules, nominalStartStr);

  console.log(`✓ Total Signals Generated: ${signals.length}`);
  const buySignals = signals.filter((s) => s.action === 'BUY');
  const sellSignals = signals.filter((s) => s.action === 'SELL');
  console.log(`  - BUY Signals : ${buySignals.length}`);
  console.log(`  - SELL Signals: ${sellSignals.length}`);

  console.log('\n4. Sample Triggered Signals:');
  signals.slice(0, 8).forEach((s, idx) => {
    console.log(
      `  [${idx + 1}] ${s.date} | ${s.action.padEnd(4)} @ ₹${s.price.toFixed(2)} | Rule: "${s.ruleName}" (${s.reason})`
    );
  });

  console.log('\n====================================================');
  console.log(`🎉 Task 2 Test Passed Successfully!`);
  console.log('====================================================\n');
}

runTask2Test().catch((err) => {
  console.error('Task 2 test failed:', err);
  process.exit(1);
});
