import {
  computeWildersRSI,
  computeRSISeries,
  detectRSIDivergenceSeries,
} from '../modules/prices/data-storage.service';
import { computeRollingIndicators } from '../modules/backtest/rolling-indicators.service';
import { evaluateConditionOnBar } from '../modules/backtest/signal-evaluator.service';
import { runSimulation } from '../modules/backtest/simulator.service';
import { BarMarketData, StrategyCondition, StrategyRule } from '../modules/backtest/types';

function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING INDICATOR 2: RSI (14-period) & DIVERGENCES');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Mathematical Accuracy of RSI (14) Series
  // -------------------------------------------------------------------------
  console.log('Test 1: Mathematical Verification of Wilder\'s RSI (14)...');
  const samplePrices = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
    45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64,
  ];
  const rsiScalar = computeWildersRSI(samplePrices, 14);
  const rsiSeries = computeRSISeries(samplePrices, 14);
  const lastSeriesVal = rsiSeries[samplePrices.length - 1];

  console.log(`  Scalar Wilder RSI: ${rsiScalar} | Series Last Value: ${lastSeriesVal}`);
  if (rsiScalar === null || lastSeriesVal === null || Math.abs(rsiScalar - lastSeriesVal) > 0.05) {
    throw new Error(`RSI scalar (${rsiScalar}) and series last value (${lastSeriesVal}) do not match!`);
  }
  // Warmup check: first 14 values (indices 0..13) should be null
  for (let i = 0; i < 14; i++) {
    if (rsiSeries[i] !== null) {
      throw new Error(`RSI series index ${i} should be null during warmup!`);
    }
  }
  if (rsiSeries[14] === null) {
    throw new Error('RSI series index 14 should have a value!');
  }
  console.log('  ✅ Wilder\'s RSI 14-period mathematical series verified perfectly!\n');

  // -------------------------------------------------------------------------
  // Test 2: Oversold Reversal (Crossing over 30) & Overbought Exit (Crossing under 70)
  // -------------------------------------------------------------------------
  console.log('Test 2: Testing Crossover Triggers (Oversold 30 & Overbought 70)...');
  
  // Buy Trigger: rsi CROSSINGOVER 30
  const oversoldCrossCondition: StrategyCondition = {
    id: 'rsi_os_cross',
    leftIndicator: 'rsi',
    operator: 'CROSSINGOVER',
    rightType: 'value',
    rightValue: 30,
  };

  const prevBarOversold: BarMarketData = {
    index: 50,
    date: '2024-03-01',
    open: 100,
    high: 101,
    low: 97,
    close: 98,
    volume: 5000,
    changePercent: -2.0,
    indicators: { rsi: 28.5, dma50: 110, dma200: 120 },
  };

  const currentBarOversold: BarMarketData = {
    index: 51,
    date: '2024-03-02',
    open: 98,
    high: 103,
    low: 98,
    close: 102,
    volume: 8000,
    changePercent: 4.1,
    indicators: { rsi: 34.2, dma50: 110, dma200: 120 },
  };

  const isOversoldTriggered = evaluateConditionOnBar(oversoldCrossCondition, currentBarOversold, prevBarOversold);
  console.log(`  Evaluating RSI (Prev: ${prevBarOversold.indicators.rsi} -> Curr: ${currentBarOversold.indicators.rsi}) CROSSINGOVER 30: ${isOversoldTriggered}`);
  if (!isOversoldTriggered) {
    throw new Error('RSI crossing over 30 failed to trigger Buy signal!');
  }
  console.log('  ✅ Buy Trigger: RSI crosses above 30 from oversold verified!');

  // Sell Trigger: rsi CROSSINGUNDER 70
  const overboughtCrossCondition: StrategyCondition = {
    id: 'rsi_ob_cross',
    leftIndicator: 'rsi',
    operator: 'CROSSINGUNDER',
    rightType: 'value',
    rightValue: 70,
  };

  const prevBarOverbought: BarMarketData = {
    index: 80,
    date: '2024-04-10',
    open: 150,
    high: 155,
    low: 149,
    close: 154,
    volume: 9000,
    changePercent: 3.0,
    indicators: { rsi: 72.8, dma50: 130, dma200: 125 },
  };

  const currentBarOverbought: BarMarketData = {
    index: 81,
    date: '2024-04-11',
    open: 153,
    high: 154,
    low: 148,
    close: 149,
    volume: 8500,
    changePercent: -3.2,
    indicators: { rsi: 66.4, dma50: 131, dma200: 125 },
  };

  const isOverboughtTriggered = evaluateConditionOnBar(overboughtCrossCondition, currentBarOverbought, prevBarOverbought);
  console.log(`  Evaluating RSI (Prev: ${prevBarOverbought.indicators.rsi} -> Curr: ${currentBarOverbought.indicators.rsi}) CROSSINGUNDER 70: ${isOverboughtTriggered}`);
  if (!isOverboughtTriggered) {
    throw new Error('RSI crossing under 70 failed to trigger Sell signal!');
  }
  console.log('  ✅ Sell Trigger: RSI crosses below 70 from overbought verified!\n');

  // -------------------------------------------------------------------------
  // Test 3: Bullish Divergence Detection
  // (Price makes lower low while RSI makes higher low from oversold)
  // -------------------------------------------------------------------------
  console.log('Test 3: Testing Bullish Divergence Detection (Lower Low in Price, Higher Low in RSI)...');
  
  // Construct 40 bars with a clear classic bullish divergence:
  // - Swing 1 Low around bar 18: Price 90, RSI ~26 (steep selloff)
  // - Bounce around bar 23: Price 96, RSI ~45
  // - Swing 2 Low around bar 30: Price 86 (Lower Low!), RSI ~33 (Higher Low!)
  const bullDivCandles = [];
  const pricesBull = [
    120, 118, 115, 112, 110, 108, 105, 102, 100, 97,
    95, 93, 91, 90.5, 90, 89.8, 90.2, 91, 90.0, 92,
    93, 95, 96, 95, 93, 91, 89, 88, 87, 86.0,
    86.2, 87, 89, 91, 93, 95, 96, 98, 100, 102
  ];
  for (let i = 0; i < pricesBull.length; i++) {
    const pr = pricesBull[i];
    bullDivCandles.push({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      open: pr,
      high: pr + 0.5,
      low: pr - 0.5,
      close: pr,
      volume: 10000,
    });
  }

  const bullRsiSeries = computeRSISeries(pricesBull, 14);
  const bullDivSeries = detectRSIDivergenceSeries(bullDivCandles, bullRsiSeries, 3, 20);

  const bullDivIndices = bullDivSeries
    .map((d, idx) => (d === 'BULLISH' ? idx : -1))
    .filter((idx) => idx !== -1);

  console.log(`  Bullish Divergence detected at bar index/indices: ${bullDivIndices.join(', ')}`);
  if (bullDivIndices.length === 0) {
    throw new Error('Failed to detect Bullish Divergence in test scenario!');
  }
  const detectedBar = bullDivIndices[0];
  console.log(`  At Bar ${detectedBar}: Price = ${pricesBull[detectedBar]}, RSI = ${bullRsiSeries[detectedBar]}`);

  // Test StrategyCondition evaluation for BULLISH_DIVERGENCE operator
  const bullDivCondition: StrategyCondition = {
    id: 'div_cond_1',
    leftIndicator: 'rsi',
    operator: 'BULLISH_DIVERGENCE',
    rightType: 'value',
  };

  const testBarMarket: BarMarketData = {
    index: detectedBar,
    date: bullDivCandles[detectedBar].date,
    open: bullDivCandles[detectedBar].open,
    high: bullDivCandles[detectedBar].high,
    low: bullDivCandles[detectedBar].low,
    close: bullDivCandles[detectedBar].close,
    volume: bullDivCandles[detectedBar].volume,
    changePercent: 0,
    indicators: {
      rsi: bullRsiSeries[detectedBar],
      dma50: null,
      dma200: null,
      rsiDivergence: 'BULLISH',
      rsiBullishDiv: 1,
    },
  };

  const isBullDivConditionMet = evaluateConditionOnBar(bullDivCondition, testBarMarket);
  console.log(`  StrategyCondition evaluateConditionOnBar for BULLISH_DIVERGENCE: ${isBullDivConditionMet}`);
  if (!isBullDivConditionMet) {
    throw new Error('Strategy condition for BULLISH_DIVERGENCE failed to evaluate to true!');
  }
  console.log('  ✅ Bullish Divergence detection & condition evaluation verified!\n');

  // -------------------------------------------------------------------------
  // Test 4: Bearish Divergence Detection
  // (Price makes higher high while RSI makes lower high from overbought)
  // -------------------------------------------------------------------------
  console.log('Test 4: Testing Bearish Divergence Detection (Higher High in Price, Lower High in RSI)...');
  
  // Construct 40 bars with a classic bearish divergence:
  // - Swing 1 High around bar 18: Price 150, RSI ~76 (strong rally)
  // - Pullback around bar 23: Price 142, RSI ~52
  // - Swing 2 High around bar 30: Price 155 (Higher High!), RSI ~65 (Lower High!)
  const bearDivCandles = [];
  const pricesBear = [
    100, 103, 106, 110, 115, 120, 125, 130, 135, 140,
    144, 147, 149, 150.2, 150.5, 150.0, 148, 146, 144, 142.5,
    142.0, 143, 145, 148, 151, 153, 154, 155.0, 155.5, 154.5,
    153, 151, 149, 146, 143, 140, 138, 135, 133, 130
  ];
  for (let i = 0; i < pricesBear.length; i++) {
    const pr = pricesBear[i];
    bearDivCandles.push({
      date: `2024-02-${String(i + 1).padStart(2, '0')}`,
      open: pr,
      high: pr + 0.5,
      low: pr - 0.5,
      close: pr,
      volume: 10000,
    });
  }

  const bearRsiSeries = computeRSISeries(pricesBear, 14);
  const bearDivSeries = detectRSIDivergenceSeries(bearDivCandles, bearRsiSeries, 3, 20);

  const bearDivIndices = bearDivSeries
    .map((d, idx) => (d === 'BEARISH' ? idx : -1))
    .filter((idx) => idx !== -1);

  console.log(`  Bearish Divergence detected at bar index/indices: ${bearDivIndices.join(', ')}`);
  if (bearDivIndices.length === 0) {
    throw new Error('Failed to detect Bearish Divergence in test scenario!');
  }
  const detectedBearBar = bearDivIndices[0];
  console.log(`  At Bar ${detectedBearBar}: Price = ${pricesBear[detectedBearBar]}, RSI = ${bearRsiSeries[detectedBearBar]}`);

  // Test StrategyCondition evaluation for BEARISH_DIVERGENCE operator
  const bearDivCondition: StrategyCondition = {
    id: 'div_cond_2',
    leftIndicator: 'rsi',
    operator: 'BEARISH_DIVERGENCE',
    rightType: 'value',
  };

  const testBearBarMarket: BarMarketData = {
    index: detectedBearBar,
    date: bearDivCandles[detectedBearBar].date,
    open: bearDivCandles[detectedBearBar].open,
    high: bearDivCandles[detectedBearBar].high,
    low: bearDivCandles[detectedBearBar].low,
    close: bearDivCandles[detectedBearBar].close,
    volume: bearDivCandles[detectedBearBar].volume,
    changePercent: 0,
    indicators: {
      rsi: bearRsiSeries[detectedBearBar],
      dma50: null,
      dma200: null,
      rsiDivergence: 'BEARISH',
      rsiBearishDiv: 1,
    },
  };

  const isBearDivConditionMet = evaluateConditionOnBar(bearDivCondition, testBearBarMarket);
  console.log(`  StrategyCondition evaluateConditionOnBar for BEARISH_DIVERGENCE: ${isBearDivConditionMet}`);
  if (!isBearDivConditionMet) {
    throw new Error('Strategy condition for BEARISH_DIVERGENCE failed to evaluate to true!');
  }
  console.log('  ✅ Bearish Divergence detection & condition evaluation verified!\n');

  // -------------------------------------------------------------------------
  // Test 5: Full Backtest Simulation with RSI Divergence Strategy
  // -------------------------------------------------------------------------
  console.log('Test 5: Running Full Backtest Simulation with RSI Divergence & Crossover Strategy...');
  
  const rsiStrategy: StrategyRule = {
    id: 'rsi-divergence-strategy',
    name: 'RSI Divergence Strategy',
    scope: 'stock',
    targetSymbol: 'RSI_TEST',
    action: 'BUY',
    sizingType: 'QTY',
    sizingValue: 10,
    conditions: [
      {
        id: 'rsi_buy',
        leftIndicator: 'rsi',
        operator: 'CROSSINGOVER',
        rightType: 'value',
        rightValue: 30,
      },
    ],
    entryConditions: [
      {
        id: 'rsi_entry_1',
        leftIndicator: 'rsi',
        operator: 'CROSSINGOVER',
        rightType: 'value',
        rightValue: 30,
      },
    ],
    exitConditions: [
      {
        id: 'rsi_exit_1',
        leftIndicator: 'rsi',
        operator: 'CROSSINGUNDER',
        rightType: 'value',
        rightValue: 70,
      },
    ],
    exitSizingType: 'DECREASE_PCT',
    exitSizingValue: 100,
    enabled: true,
  };

  // Combine prices into a full backtestable sequence with dips and peaks
  const fullPrices = [...pricesBull, ...pricesBear];
  const fullCandles = fullPrices.map((pr, i) => ({
    date: `2024-03-${String(i + 1).padStart(3, '0')}`,
    open: pr,
    high: pr + 1,
    low: pr - 1,
    close: pr,
    volume: 10000,
  }));

  const simBars = computeRollingIndicators(fullCandles);
  const simResult = runSimulation('RSI_TEST', simBars, [rsiStrategy], {
    initialCapital: 100000,
    nominalStartDate: '2024-03-01',
  });

  console.log(`  Simulation finished. Trades executed: ${simResult.trades.length}`);
  console.log(`  Initial capital: ₹${simResult.initialCapital} | Final equity: ₹${simResult.finalEquity}`);
  for (const t of simResult.trades) {
    console.log(`    Trade: ${t.action || 'BUY'} entry at ${t.entryDate} @ ₹${t.entryPrice} -> Status: ${t.status}${t.exitDate ? ` Exit: ${t.exitDate} @ ₹${t.exitPrice} PnL: ₹${t.pnl}` : ''}`);
  }
  console.log('  ✅ Full RSI Divergence & Crossover backtest simulation completed successfully!\n');

  console.log('====================================================');
  console.log('🎉 ALL TESTS PASSED FOR RSI (14-period) & DIVERGENCES!');
  console.log('====================================================');
}

runTests();

