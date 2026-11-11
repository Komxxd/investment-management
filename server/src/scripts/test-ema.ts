import { computeEMA, computeEMASeries } from '../modules/prices/data-storage.service';
import { computeRollingIndicators } from '../modules/backtest/rolling-indicators.service';
import { evaluateConditionOnBar } from '../modules/backtest/signal-evaluator.service';
import { BarMarketData, StrategyCondition, StrategyRule } from '../modules/backtest/types';

function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING INDICATOR 1: EMA (20 / 50 / 200)');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Mathematical Accuracy of EMA Calculation
  // -------------------------------------------------------------------------
  console.log('Test 1: Mathematical Verification of EMA formula...');
  // Simple synthetic series: 5 days of constant 100, then day 6 is 110 (for period = 5)
  // SMA of first 5 = 100
  // Multiplier for N=5: k = 2 / (5 + 1) = 2/6 = 1/3
  // EMA_6 = (110 * 1/3) + (100 * 2/3) = 36.6667 + 66.6667 = 103.33
  const testPrices = [100, 100, 100, 100, 100, 110];
  const ema5 = computeEMA(testPrices, 5);
  console.log(`  Expected EMA(5) for [100, 100, 100, 100, 100, 110]: 103.33 | Got: ${ema5}`);
  if (ema5 !== 103.33) {
    throw new Error(`Mathematical EMA calculation failed! Expected 103.33, got ${ema5}`);
  }
  console.log('  ✅ Single EMA calculation matches expected theoretical value!');

  // Test Series
  const series5 = computeEMASeries(testPrices, 5);
  console.log('  Series result:', series5);
  if (series5[0] !== null || series5[3] !== null || series5[4] !== 100 || series5[5] !== 103.33) {
    throw new Error(`EMA series mismatch: ${JSON.stringify(series5)}`);
  }
  console.log('  ✅ EMA Series respects warmup period (null before N-1) and matches exact math!\n');

  // -------------------------------------------------------------------------
  // Test 2: Multi-period EMA (20, 50, 200) on 250 price points
  // -------------------------------------------------------------------------
  console.log('Test 2: Verifying EMA 20, 50, 200 with realistic sequence (250 bars)...');
  const syntheticCandles = [];
  let basePrice = 1000;
  for (let i = 0; i < 250; i++) {
    // Generate trending/oscillating prices
    basePrice += (i % 2 === 0 ? 1 : -0.5) * 2;
    syntheticCandles.push({
      date: `2024-01-01 ${String(i).padStart(3, '0')}`,
      open: basePrice,
      high: basePrice + 5,
      low: basePrice - 5,
      close: basePrice,
      volume: 10000,
    });
  }

  const rollingBars = computeRollingIndicators(syntheticCandles);
  if (rollingBars.length !== 250) {
    throw new Error(`Expected 250 bars, got ${rollingBars.length}`);
  }

  // Check bar 19 (index 19 is 20th bar) -> EMA20 should become non-null
  const bar20 = rollingBars[19];
  console.log(`  Bar 20 (index 19) -> EMA20: ${bar20.indicators.ema20}, EMA50: ${bar20.indicators.ema50}, EMA200: ${bar20.indicators.ema200}`);
  if (bar20.indicators.ema20 === null || bar20.indicators.ema50 !== null || bar20.indicators.ema200 !== null) {
    throw new Error('Warmup boundary failure: EMA20 should be available, EMA50 and EMA200 should be null.');
  }

  // Check bar 50 (index 49 is 50th bar) -> EMA50 should become non-null
  const bar50 = rollingBars[49];
  console.log(`  Bar 50 (index 49) -> EMA20: ${bar50.indicators.ema20}, EMA50: ${bar50.indicators.ema50}, EMA200: ${bar50.indicators.ema200}`);
  if (bar50.indicators.ema20 === null || bar50.indicators.ema50 === null || bar50.indicators.ema200 !== null) {
    throw new Error('Warmup boundary failure: EMA20 and EMA50 should be available, EMA200 should be null.');
  }

  // Check bar 200 (index 199 is 200th bar) -> EMA200 should become non-null
  const bar200 = rollingBars[199];
  console.log(`  Bar 200 (index 199) -> EMA20: ${bar200.indicators.ema20}, EMA50: ${bar200.indicators.ema50}, EMA200: ${bar200.indicators.ema200}`);
  if (bar200.indicators.ema20 === null || bar200.indicators.ema50 === null || bar200.indicators.ema200 === null) {
    throw new Error('Warmup boundary failure: All EMAs (20, 50, 200) should be available.');
  }
  console.log('  ✅ Multi-period warmup boundaries (20, 50, 200) verified perfectly!\n');

  // -------------------------------------------------------------------------
  // Test 3: Strategy Signal Evaluation (Golden Cross & Death Cross)
  // -------------------------------------------------------------------------
  console.log('Test 3: Testing Strategy Crossover Triggers (Golden Cross & Death Cross)...');

  // Golden Cross Condition: ema50 CROSSINGOVER ema200
  const goldenCrossCondition: StrategyCondition = {
    id: 'gc1',
    leftIndicator: 'ema50',
    operator: 'CROSSINGOVER',
    rightType: 'indicator',
    rightIndicator: 'ema200',
  };

  // Bar t-1: ema50 (148) <= ema200 (150)
  const prevBar: BarMarketData = {
    index: 100,
    date: '2024-05-01',
    open: 150,
    high: 152,
    low: 147,
    close: 149,
    volume: 5000,
    changePercent: 0,
    indicators: {
      rsi: 55,
      dma50: 147,
      dma200: 150,
      ema20: 151,
      ema50: 148,
      ema200: 150,
    },
  };

  // Bar t: ema50 (152) > ema200 (150) -> True Golden Cross
  const currentBarGolden: BarMarketData = {
    index: 101,
    date: '2024-05-02',
    open: 153,
    high: 156,
    low: 151,
    close: 155,
    volume: 8000,
    changePercent: 4.0,
    indicators: {
      rsi: 65,
      dma50: 149,
      dma200: 150,
      ema20: 154,
      ema50: 152,
      ema200: 150,
    },
  };

  const isGoldenCross = evaluateConditionOnBar(goldenCrossCondition, currentBarGolden, prevBar);
  console.log(`  Evaluating 50 EMA (${currentBarGolden.indicators.ema50}) CROSSINGOVER 200 EMA (${currentBarGolden.indicators.ema200}): ${isGoldenCross}`);
  if (!isGoldenCross) {
    throw new Error('Golden Cross failed to trigger when 50 EMA crossed over 200 EMA!');
  }
  console.log('  ✅ Golden Cross (50 EMA crosses above 200 EMA) triggered BUY signal accurately!');

  // Death Cross Condition: ema50 CROSSINGUNDER ema200
  const deathCrossCondition: StrategyCondition = {
    id: 'dc1',
    leftIndicator: 'ema50',
    operator: 'CROSSINGUNDER',
    rightType: 'indicator',
    rightIndicator: 'ema200',
  };

  // Bar t+1: ema50 falls back below ema200
  const currentBarDeath: BarMarketData = {
    index: 102,
    date: '2024-05-03',
    open: 148,
    high: 149,
    low: 144,
    close: 145,
    volume: 9000,
    changePercent: -6.4,
    indicators: {
      rsi: 38,
      dma50: 148,
      dma200: 150,
      ema20: 146,
      ema50: 147,
      ema200: 150,
    },
  };

  const isDeathCross = evaluateConditionOnBar(deathCrossCondition, currentBarDeath, currentBarGolden);
  console.log(`  Evaluating 50 EMA (${currentBarDeath.indicators.ema50}) CROSSINGUNDER 200 EMA (${currentBarDeath.indicators.ema200}): ${isDeathCross}`);
  if (!isDeathCross) {
    throw new Error('Death Cross failed to trigger when 50 EMA crossed under 200 EMA!');
  }
  console.log('  ✅ Death Cross (50 EMA crosses below 200 EMA) triggered SELL signal accurately!');

  // -------------------------------------------------------------------------
  // Test 4: Price 20 EMA bounce trigger
  // -------------------------------------------------------------------------
  console.log('\nTest 4: Testing 20 EMA bounce trigger (price CROSSINGOVER ema20)...');
  const bounceCondition: StrategyCondition = {
    id: 'bounce1',
    leftIndicator: 'price',
    operator: 'CROSSINGOVER',
    rightType: 'indicator',
    rightIndicator: 'ema20',
  };

  // Prev bar: price (99) <= ema20 (100)
  const prevBounceBar: BarMarketData = {
    index: 200,
    date: '2024-06-01',
    open: 101,
    high: 102,
    low: 98,
    close: 99,
    volume: 4000,
    changePercent: -1.0,
    indicators: {
      rsi: 45,
      dma50: 95,
      dma200: 90,
      ema20: 100,
      ema50: 96,
      ema200: 91,
    },
  };

  // Current bar: price bounces to 103 > ema20 (100.5)
  const currentBounceBar: BarMarketData = {
    index: 201,
    date: '2024-06-02',
    open: 100,
    high: 104,
    low: 99.5,
    close: 103,
    volume: 7500,
    changePercent: 4.0,
    indicators: {
      rsi: 58,
      dma50: 96,
      dma200: 91,
      ema20: 100.5,
      ema50: 97,
      ema200: 91.5,
    },
  };

  const isBounce = evaluateConditionOnBar(bounceCondition, currentBounceBar, prevBounceBar);
  console.log(`  Evaluating price (${currentBounceBar.close}) CROSSINGOVER 20 EMA (${currentBounceBar.indicators.ema20}): ${isBounce}`);
  if (!isBounce) {
    throw new Error('20 EMA bounce failed to trigger when price crossed above 20 EMA!');
  }
  console.log('  ✅ 20 EMA bounce triggered successfully!\n');

  // -------------------------------------------------------------------------
  // Test 5: Full Backtest Engine Integration with EMA Rules
  // -------------------------------------------------------------------------
  console.log('\nTest 5: Testing Full Backtest Engine with EMA Golden Cross Rule...');
  const { runSimulation } = require('../modules/backtest/simulator.service');
  const emaStrategyRule: StrategyRule = {
    id: 'ema-golden-rule',
    name: 'EMA Golden Cross Strategy',
    scope: 'stock',
    targetSymbol: 'MOCK',
    action: 'BUY',
    sizingType: 'QTY',
    sizingValue: 10,
    conditions: [
      {
        id: 'c1',
        leftIndicator: 'ema50',
        operator: 'CROSSINGOVER',
        rightType: 'indicator',
        rightIndicator: 'ema200',
      },
    ],
    entryConditions: [
      {
        id: 'c1_entry',
        leftIndicator: 'ema50',
        operator: 'CROSSINGOVER',
        rightType: 'indicator',
        rightIndicator: 'ema200',
      },
    ],
    exitConditions: [
      {
        id: 'c1_exit',
        leftIndicator: 'ema50',
        operator: 'CROSSINGUNDER',
        rightType: 'indicator',
        rightIndicator: 'ema200',
      },
    ],
    exitSizingType: 'DECREASE_PCT',
    exitSizingValue: 100,
    enabled: true,
  };

  // Construct a price series that starts low, rallies (crossing over), then falls (crossing under)
  const fullSimulationCandles = [];
  let p = 100;
  for (let i = 0; i < 300; i++) {
    if (i < 180) {
      p += 0.2; // slow baseline
    } else if (i < 240) {
      p += 3.0; // strong rally -> 50 EMA crosses above 200 EMA
    } else {
      p -= 3.5; // sharp drop -> 50 EMA crosses below 200 EMA
    }
    fullSimulationCandles.push({
      date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
      open: p,
      high: p + 1,
      low: p - 1,
      close: p,
      volume: 10000,
    });
  }

  const simBars = computeRollingIndicators(fullSimulationCandles);
  const simResult = runSimulation('MOCK', simBars, [emaStrategyRule], {
    initialCapital: 100000,
    nominalStartDate: '2024-01-01',
  });

  console.log(`  Backtest completed. Total trades executed: ${simResult.trades.length}`);
  console.log(`  Initial capital: ₹${simResult.initialCapital} | Final equity: ₹${simResult.finalEquity}`);
  if (simResult.trades.length === 0) {
    throw new Error('Expected EMA Golden Cross simulation to generate trades!');
  }
  for (const t of simResult.trades) {
    console.log(`    Trade: ${t.action || 'BUY'} at ${t.entryDate} @ ₹${t.entryPrice} -> Status: ${t.status}${t.exitDate ? ` Exit: ${t.exitDate} @ ₹${t.exitPrice} PnL: ₹${t.pnl}` : ''}`);
  }
  console.log('  ✅ Full backtest simulation using EMA Golden / Death Cross succeeded!\n');

  console.log('====================================================');
  console.log('🎉 ALL TESTS PASSED FOR EMA (20 / 50 / 200)!');
  console.log('====================================================');
}

runTests();
