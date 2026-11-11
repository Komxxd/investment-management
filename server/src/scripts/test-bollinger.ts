import {
  computeBollingerBands,
  computeBollingerBandsSeries,
} from '../modules/prices/data-storage.service';
import { computeRollingIndicators } from '../modules/backtest/rolling-indicators.service';
import { evaluateConditionOnBar } from '../modules/backtest/signal-evaluator.service';
import { runSimulation } from '../modules/backtest/simulator.service';
import { BarMarketData, StrategyCondition, StrategyRule } from '../modules/backtest/types';

function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING INDICATOR 4: BOLLINGER BANDS (20, 2)');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Mathematical Accuracy of Bollinger Bands Series & Scalar
  // -------------------------------------------------------------------------
  console.log('Test 1: Mathematical Verification of Bollinger Bands (20, 2)...');

  // 25 sample closes
  const samplePrices = [
    100, 102, 101, 103, 102, 104, 103, 105, 104, 106,
    105, 107, 106, 108, 107, 109, 108, 110, 109, 111,
    110, 112, 111, 113, 112,
  ];

  const series = computeBollingerBandsSeries(samplePrices, 20, 2);
  const scalar = computeBollingerBands(samplePrices, 20, 2);

  // Warmup checks: first 19 (indices 0..18) must be null
  for (let i = 0; i < 19; i++) {
    if (
      series.upper[i] !== null ||
      series.middle[i] !== null ||
      series.lower[i] !== null
    ) {
      throw new Error(`Bollinger Bands at index ${i} should be null during warmup!`);
    }
  }

  // Index 19 is the 20th price -> must have values
  if (
    series.upper[19] === null ||
    series.middle[19] === null ||
    series.lower[19] === null
  ) {
    throw new Error('Bollinger Bands at index 19 must have valid values!');
  }

  // Manual calculation for index 19 (first 20 prices: 100 to 111)
  const slice19 = samplePrices.slice(0, 20);
  const manualMean = slice19.reduce((a, b) => a + b, 0) / 20;
  const manualVariance = slice19.reduce((acc, v) => acc + Math.pow(v - manualMean, 2), 0) / 20;
  const manualStdDev = Math.sqrt(manualVariance);
  const expectedUpper = parseFloat((manualMean + 2 * manualStdDev).toFixed(2));
  const expectedLower = parseFloat((manualMean - 2 * manualStdDev).toFixed(2));
  const expectedMiddle = parseFloat(manualMean.toFixed(2));

  console.log(`  Expected: Upper=${expectedUpper}, Middle=${expectedMiddle}, Lower=${expectedLower}`);
  console.log(`  Got:      Upper=${series.upper[19]}, Middle=${series.middle[19]}, Lower=${series.lower[19]}`);

  if (
    Math.abs(series.upper[19]! - expectedUpper) > 0.05 ||
    Math.abs(series.middle[19]! - expectedMiddle) > 0.05 ||
    Math.abs(series.lower[19]! - expectedLower) > 0.05
  ) {
    throw new Error('Calculated Bollinger Bands values do not match theoretical expected values!');
  }

  // Verify scalar matches series last value
  const lastIdx = samplePrices.length - 1;
  if (
    scalar.upper !== series.upper[lastIdx] ||
    scalar.middle !== series.middle[lastIdx] ||
    scalar.lower !== series.lower[lastIdx]
  ) {
    throw new Error('Scalar Bollinger Bands does not match series tail!');
  }

  console.log(`  Scalar (last): Upper=${scalar.upper}, Mid=${scalar.middle}, Lower=${scalar.lower}, BW=${scalar.bandwidth}%, %B=${scalar.percentB}`);
  console.log('  ✅ Bollinger Bands mathematical series verified perfectly!\n');

  // -------------------------------------------------------------------------
  // Test 2: Buy Trigger (Price dips below lower band and prints reversal candle back inside)
  // -------------------------------------------------------------------------
  console.log('Test 2: Testing Buy Trigger (Dip below lower band & reversal back inside)...');

  // Condition: price CROSSINGOVER bbLower
  const bbLowerCrossCond: StrategyCondition = {
    id: 'price_cross_bb_lower',
    leftIndicator: 'price',
    operator: 'CROSSINGOVER',
    rightType: 'indicator',
    rightIndicator: 'bbLower',
  };

  // Bar t-1: Price dipped below lower band (Price 97 <= Lower Band 98)
  const prevBarDip: BarMarketData = {
    index: 25,
    date: '2024-04-10',
    open: 99,
    high: 99.5,
    low: 96.5,
    close: 97.0,
    volume: 12000,
    changePercent: -2.0,
    indicators: {
      rsi: 28,
      dma50: 105,
      dma200: 110,
      bbUpper: 112,
      bbMiddle: 105,
      bbLower: 98,
      bbBandwidth: 13.33,
      bbPercentB: -0.07,
    },
  };

  // Bar t: Reversal candle closes back INSIDE (Price 99.5 crosses OVER Lower Band 98.2)
  const currentBarRebound: BarMarketData = {
    index: 26,
    date: '2024-04-11',
    open: 97.5,
    high: 100.2,
    low: 97.2,
    close: 99.5,
    volume: 18000,
    changePercent: 2.58,
    indicators: {
      rsi: 36,
      dma50: 105,
      dma200: 110,
      bbUpper: 112,
      bbMiddle: 105,
      bbLower: 98.2,
      bbBandwidth: 13.14,
      bbPercentB: 0.09,
    },
  };

  const buyTriggered = evaluateConditionOnBar(bbLowerCrossCond, currentBarRebound, prevBarDip);
  if (!buyTriggered) {
    throw new Error('Expected BUY signal when price reverses and crosses over bbLower!');
  }
  console.log('  ✅ Lower band reversal bounce (price CROSSINGOVER bbLower): PASSED');

  // Negative test: Price staying below lower band (no reversal) should NOT trigger
  const barStayBelow: BarMarketData = {
    ...currentBarRebound,
    close: 96.8, // Still below lower band
  };
  const negativeBuyTriggered = evaluateConditionOnBar(bbLowerCrossCond, barStayBelow, prevBarDip);
  if (negativeBuyTriggered) {
    throw new Error('Buy trigger must NOT fire when price remains below lower band!');
  }
  console.log('  ✅ Negative check (Price continuing below lower band rejected): PASSED\n');

  // -------------------------------------------------------------------------
  // Test 3: Sell / Exit Triggers (Touches/pierces upper band or closes below 20 SMA middle)
  // -------------------------------------------------------------------------
  console.log('Test 3: Testing Sell / Exit Triggers (Upper Band Pierce & 20 SMA Middle Crossunder)...');

  // Exit Condition 1: price CROSSINGOVER bbUpper (pierces upper band)
  const bbUpperCrossCond: StrategyCondition = {
    id: 'price_cross_bb_upper',
    leftIndicator: 'price',
    operator: 'CROSSINGOVER',
    rightType: 'indicator',
    rightIndicator: 'bbUpper',
  };

  // Exit Condition 2: price CROSSINGUNDER bbMiddle (closes back below 20 SMA middle band)
  const bbMiddleCrossUnderCond: StrategyCondition = {
    id: 'price_cross_under_bb_middle',
    leftIndicator: 'price',
    operator: 'CROSSINGUNDER',
    rightType: 'indicator',
    rightIndicator: 'bbMiddle',
  };

  // Upper band pierce test
  const prevBarBeforeUpper: BarMarketData = {
    index: 35,
    date: '2024-04-24',
    open: 110,
    high: 111.5,
    low: 109.8,
    close: 111.0,
    volume: 15000,
    changePercent: 1.1,
    indicators: {
      rsi: 65,
      dma50: 105,
      dma200: 110,
      bbUpper: 111.5,
      bbMiddle: 105,
      bbLower: 98.5,
    },
  };

  const currentBarPiercingUpper: BarMarketData = {
    index: 36,
    date: '2024-04-25',
    open: 111.2,
    high: 113.8,
    low: 111.0,
    close: 113.2,
    volume: 22000,
    changePercent: 1.98,
    indicators: {
      rsi: 72,
      dma50: 105,
      dma200: 110,
      bbUpper: 112.0,
      bbMiddle: 105,
      bbLower: 98.0,
    },
  };

  const upperPierceTriggered = evaluateConditionOnBar(bbUpperCrossCond, currentBarPiercingUpper, prevBarBeforeUpper);
  if (!upperPierceTriggered) {
    throw new Error('Expected EXIT signal when price pierces above bbUpper!');
  }
  console.log('  ✅ Upper Band Pierce (price CROSSINGOVER bbUpper): PASSED');

  // Middle band crossunder test
  const prevBarAboveMiddle: BarMarketData = {
    index: 40,
    date: '2024-05-02',
    open: 106,
    high: 106.5,
    low: 105.2,
    close: 105.5,
    volume: 9000,
    changePercent: -0.5,
    indicators: {
      rsi: 48,
      dma50: 105,
      dma200: 110,
      bbUpper: 112,
      bbMiddle: 105.0,
      bbLower: 98,
    },
  };

  const currentBarBelowMiddle: BarMarketData = {
    index: 41,
    date: '2024-05-03',
    open: 105.2,
    high: 105.3,
    low: 103.5,
    close: 104.0,
    volume: 14000,
    changePercent: -1.42,
    indicators: {
      rsi: 42,
      dma50: 105,
      dma200: 110,
      bbUpper: 112,
      bbMiddle: 105.0,
      bbLower: 98,
    },
  };

  const middleCrossUnderTriggered = evaluateConditionOnBar(bbMiddleCrossUnderCond, currentBarBelowMiddle, prevBarAboveMiddle);
  if (!middleCrossUnderTriggered) {
    throw new Error('Expected EXIT signal when price crosses under 20 SMA middle band!');
  }
  console.log('  ✅ 20 SMA Middle Band Crossunder (price CROSSINGUNDER bbMiddle): PASSED\n');

  // -------------------------------------------------------------------------
  // Test 4: Rolling Indicators Integration
  // -------------------------------------------------------------------------
  console.log('Test 4: Verifying Rolling Indicators attach Bollinger Bands to candles...');

  const candles = samplePrices.map((close, i) => {
    const day = (i + 1).toString().padStart(2, '0');
    return {
      date: `2024-01-${day}`,
      open: close - 0.5,
      high: close + 1.0,
      low: close - 1.0,
      close,
      volume: 15000 + i * 200,
    };
  });

  const barData = computeRollingIndicators(candles);
  if (barData.length !== candles.length) {
    throw new Error(`Expected ${candles.length} bars, got ${barData.length}`);
  }

  const lastBar = barData[barData.length - 1];
  if (
    lastBar.indicators.bbUpper === null ||
    lastBar.indicators.bbMiddle === null ||
    lastBar.indicators.bbLower === null ||
    lastBar.indicators.bbBandwidth === null
  ) {
    throw new Error('Last bar must contain computed Bollinger Bands!');
  }
  console.log(`  Bar ${lastBar.index} (${lastBar.date}): Upper=${lastBar.indicators.bbUpper}, Mid=${lastBar.indicators.bbMiddle}, Lower=${lastBar.indicators.bbLower}, BW=${lastBar.indicators.bbBandwidth}%`);
  console.log('  ✅ Rolling Indicators properly compute and attach Bollinger Bands!\n');

  // -------------------------------------------------------------------------
  // Test 5: Full Backtest Simulation using Bollinger Band Mean Reversion
  // -------------------------------------------------------------------------
  console.log('Test 5: Full Backtest Simulation with Bollinger Band Mean Reversion Rule...');

  // Build a 70-day series that dips below lower band, recovers to middle, and exits
  const simulationPrices: number[] = [];
  let p = 100;
  for (let i = 0; i < 70; i++) {
    if (i < 25) {
      p += 0.2; // Base consolidation
    } else if (i < 32) {
      p -= 2.0; // Sharp dip below lower band
    } else if (i < 45) {
      p += 1.8; // Mean reversion recovery
    } else {
      p += 0.1; // Stabilization
    }
    simulationPrices.push(parseFloat(p.toFixed(2)));
  }

  const simCandles = simulationPrices.map((close, i) => {
    const day = (i + 1).toString().padStart(2, '0');
    return {
      date: `2024-02-${day}`,
      open: close - 0.3,
      high: close + 0.8,
      low: close - 0.8,
      close,
      volume: 20000,
    };
  });

  const simBars = computeRollingIndicators(simCandles);

  const bbRule: StrategyRule = {
    id: 'test_bb_rule',
    name: 'Bollinger Band Mean Reversion (20, 2)',
    scope: 'stock',
    targetSymbol: 'MOCK.NS',
    action: 'BUY',
    sizingType: 'QTY',
    sizingValue: 20,
    enabled: true,
    frequency: 'daily',
    entryConditions: [
      {
        id: 'entry_bb_reversal',
        leftIndicator: 'price',
        operator: 'CROSSINGOVER',
        rightType: 'indicator',
        rightIndicator: 'bbLower',
      },
    ],
    exitConditions: [
      {
        id: 'exit_bb_upper',
        leftIndicator: 'price',
        operator: 'CROSSINGOVER',
        rightType: 'indicator',
        rightIndicator: 'bbUpper',
      },
    ],
    exitSizingType: 'DECREASE_PCT',
    exitSizingValue: 100,
    conditions: [],
  };

  const simulationResult = runSimulation(
    'MOCK.NS',
    simBars,
    [bbRule],
    {
      initialCapital: 100000,
      nominalStartDate: '2024-02-01',
    }
  );

  console.log(`  Simulation Completed!`);
  console.log(`  Initial Capital: ₹100,000 | Final Equity: ₹${simulationResult.finalEquity.toFixed(2)}`);
  console.log(`  Total Trades Executed: ${simulationResult.trades.length}`);

  if (simulationResult.trades.length < 1) {
    throw new Error('Expected at least 1 trade from Bollinger Band Reversal strategy!');
  }
  for (const t of simulationResult.trades) {
    console.log(`  Trade #${t.id}: ${t.action} @ ₹${t.entryPrice} on ${t.entryDate} -> Status: ${t.status}${t.exitDate ? ` Exit: ${t.exitDate} @ ₹${t.exitPrice} PnL: ₹${t.pnl}` : ''}`);
  }
  console.log('  ✅ End-to-end Backtest Simulation executed successfully!\n');

  console.log('====================================================');
  console.log('🎉 ALL 5 BOLLINGER BANDS (20, 2) TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runTests();

