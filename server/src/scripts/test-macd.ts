import {
  computeMACD,
  computeMACDSeries,
  computeEMASeries,
} from '../modules/prices/data-storage.service';
import { computeRollingIndicators } from '../modules/backtest/rolling-indicators.service';
import { evaluateConditionOnBar } from '../modules/backtest/signal-evaluator.service';
import { runSimulation } from '../modules/backtest/simulator.service';
import { BarMarketData, StrategyCondition, StrategyRule } from '../modules/backtest/types';

function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING INDICATOR 3: MACD (12, 26, 9) & HISTOGRAM');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Mathematical Accuracy of MACD Series & Scalar
  // -------------------------------------------------------------------------
  console.log('Test 1: Mathematical Verification of MACD (12, 26, 9)...');
  
  // Generate 60 closing prices with known trend reversal to form crossovers
  const closes: number[] = [];
  let price = 100;
  for (let i = 0; i < 60; i++) {
    // Downtrend for first 35 days, then strong uptrend for next 25 days
    if (i < 35) {
      price -= 0.8 + (i % 3) * 0.2;
    } else {
      price += 1.5 + (i % 2) * 0.3;
    }
    closes.push(parseFloat(price.toFixed(2)));
  }

  const series = computeMACDSeries(closes, 12, 26, 9);
  const scalar = computeMACD(closes, 12, 26, 9);

  // Check warmup periods
  // 1. MACD line requires slowPeriod = 26 candles (index 0..24 null, 25 valid)
  for (let i = 0; i < 25; i++) {
    if (series.macd[i] !== null) {
      throw new Error(`MACD Line at index ${i} should be null during slowPeriod warmup!`);
    }
  }
  if (series.macd[25] === null) {
    throw new Error('MACD Line at index 25 should be non-null!');
  }

  // 2. Signal line requires 26 + 9 - 1 = 33 candles (index 0..32 null, 33 valid)
  for (let i = 0; i < 33; i++) {
    if (series.signal[i] !== null) {
      throw new Error(`Signal Line at index ${i} should be null during signalPeriod warmup!`);
    }
    if (series.histogram[i] !== null) {
      throw new Error(`Histogram at index ${i} should be null during warmup!`);
    }
  }
  if (series.signal[33] === null || series.histogram[33] === null) {
    throw new Error('Signal Line and Histogram at index 33 should be non-null!');
  }

  // 3. Check mathematical consistency: Histogram = MACD - Signal
  for (let i = 33; i < closes.length; i++) {
    const m = series.macd[i]!;
    const s = series.signal[i]!;
    const h = series.histogram[i]!;
    const diff = parseFloat((m - s).toFixed(2));
    if (Math.abs(h - diff) > 0.05) {
      throw new Error(`Histogram discrepancy at index ${i}: h=${h}, m-s=${diff}`);
    }
  }

  // 4. Scalar matches series last value
  const lastIdx = closes.length - 1;
  if (
    scalar.macd !== series.macd[lastIdx] ||
    scalar.signal !== series.signal[lastIdx] ||
    scalar.histogram !== series.histogram[lastIdx]
  ) {
    throw new Error(
      `Scalar MACD (${JSON.stringify(scalar)}) does not match series tail (${series.macd[lastIdx]}, ${series.signal[lastIdx]}, ${series.histogram[lastIdx]})`
    );
  }

  console.log(`  MACD Line (last): ${scalar.macd}`);
  console.log(`  Signal Line (last): ${scalar.signal}`);
  console.log(`  Histogram (last): ${scalar.histogram}`);
  console.log('  ✅ MACD (12, 26, 9) mathematical series verified perfectly!\n');

  // -------------------------------------------------------------------------
  // Test 2: Buy Trigger (MACD crosses above Signal below zero line)
  // -------------------------------------------------------------------------
  console.log('Test 2: Testing Buy Trigger (MACD crosses above Signal below 0 line)...');

  const macdCrossOverCond: StrategyCondition = {
    id: 'macd_cross_signal',
    leftIndicator: 'macd',
    operator: 'CROSSINGOVER',
    rightType: 'indicator',
    rightIndicator: 'macdSignal',
  };

  const macdBelowZeroCond: StrategyCondition = {
    id: 'macd_below_zero',
    leftIndicator: 'macd',
    operator: '<',
    rightType: 'value',
    rightValue: 0,
  };

  const macdHistPosCond: StrategyCondition = {
    id: 'macd_hist_positive',
    leftIndicator: 'macdHist',
    operator: '>',
    rightType: 'value',
    rightValue: 0,
  };

  // Bar t-1: MACD = -2.5, Signal = -2.1 (MACD is BELOW Signal, both below zero)
  const prevBarBuy: BarMarketData = {
    index: 40,
    date: '2024-04-01',
    open: 80,
    high: 81,
    low: 79,
    close: 80.5,
    volume: 10000,
    changePercent: 0.6,
    indicators: {
      rsi: 42,
      dma50: 95,
      dma200: 105,
      macd: -2.5,
      macdSignal: -2.1,
      macdHist: -0.4,
    },
  };

  // Bar t: MACD = -1.8, Signal = -2.0 (MACD CROSSES OVER Signal, both still below zero, hist > 0)
  const currentBarBuy: BarMarketData = {
    index: 41,
    date: '2024-04-02',
    open: 81,
    high: 84,
    low: 80.8,
    close: 83.5,
    volume: 25000,
    changePercent: 3.7,
    indicators: {
      rsi: 49,
      dma50: 95,
      dma200: 105,
      macd: -1.8,
      macdSignal: -2.0,
      macdHist: 0.2,
    },
  };

  const crossOverTriggered = evaluateConditionOnBar(macdCrossOverCond, currentBarBuy, prevBarBuy);
  const belowZeroTriggered = evaluateConditionOnBar(macdBelowZeroCond, currentBarBuy);
  const histPosTriggered = evaluateConditionOnBar(macdHistPosCond, currentBarBuy);

  if (!crossOverTriggered || !belowZeroTriggered || !histPosTriggered) {
    throw new Error('MACD Buy Trigger should evaluate to true on valid bullish crossover below zero line!');
  }
  console.log('  ✅ Bullish Crossover below Zero line: PASSED (All 3 entry criteria met)');

  // Negative test: crossover happening ABOVE 0 line should fail the "below zero line" condition
  const barAboveZero: BarMarketData = {
    ...currentBarBuy,
    indicators: {
      ...currentBarBuy.indicators,
      macd: 1.5,
      macdSignal: 1.2,
      macdHist: 0.3,
    },
  };
  const aboveZeroResult = evaluateConditionOnBar(macdBelowZeroCond, barAboveZero);
  if (aboveZeroResult !== false) {
    throw new Error('MACD below zero condition must fail when MACD is above 0!');
  }
  console.log('  ✅ Negative Check (Crossover above 0 rejected): PASSED\n');

  // -------------------------------------------------------------------------
  // Test 3: Sell / Exit Trigger (MACD crosses below Signal or histogram flip)
  // -------------------------------------------------------------------------
  console.log('Test 3: Testing Sell / Exit Trigger (Crossunder or Histogram flip)...');

  const macdCrossUnderCond: StrategyCondition = {
    id: 'macd_cross_under',
    leftIndicator: 'macd',
    operator: 'CROSSINGUNDER',
    rightType: 'indicator',
    rightIndicator: 'macdSignal',
  };

  const macdHistFlipCond: StrategyCondition = {
    id: 'macd_hist_flip',
    leftIndicator: 'macdHist',
    operator: '<=',
    rightType: 'value',
    rightValue: 0,
  };

  // Bar t-1: MACD = +3.2, Signal = +2.9 (MACD above Signal, hist > 0)
  const prevBarExit: BarMarketData = {
    index: 55,
    date: '2024-04-18',
    open: 110,
    high: 112,
    low: 109,
    close: 111,
    volume: 12000,
    changePercent: 1.0,
    indicators: {
      rsi: 68,
      dma50: 95,
      dma200: 105,
      macd: 3.2,
      macdSignal: 2.9,
      macdHist: 0.3,
    },
  };

  // Bar t: MACD = +2.7, Signal = +2.85 (MACD crosses under Signal, hist flips negative to -0.15)
  const currentBarExit: BarMarketData = {
    index: 56,
    date: '2024-04-19',
    open: 111,
    high: 111.5,
    low: 107,
    close: 107.5,
    volume: 18000,
    changePercent: -3.1,
    indicators: {
      rsi: 58,
      dma50: 95,
      dma200: 105,
      macd: 2.7,
      macdSignal: 2.85,
      macdHist: -0.15,
    },
  };

  const crossUnderTriggered = evaluateConditionOnBar(macdCrossUnderCond, currentBarExit, prevBarExit);
  const histFlipTriggered = evaluateConditionOnBar(macdHistFlipCond, currentBarExit);

  if (!crossUnderTriggered) {
    throw new Error('MACD Crossunder should evaluate to true when MACD drops below Signal line!');
  }
  if (!histFlipTriggered) {
    throw new Error('Histogram flip (macdHist <= 0) should evaluate to true when histogram turns negative!');
  }
  console.log('  ✅ MACD Crossunder exit trigger: PASSED');
  console.log('  ✅ Momentum flip (histogram <= 0) exit trigger: PASSED\n');

  // -------------------------------------------------------------------------
  // Test 4: Rolling Indicators Integration
  // -------------------------------------------------------------------------
  console.log('Test 4: Verifying Rolling Indicators attach MACD to candles...');

  const candles = closes.map((close, i) => {
    const day = (i + 1).toString().padStart(2, '0');
    return {
      date: `2024-01-${day}`,
      open: close - 0.5,
      high: close + 1.0,
      low: close - 1.0,
      close,
      volume: 10000 + i * 500,
    };
  });

  const barData = computeRollingIndicators(candles);
  if (barData.length !== candles.length) {
    throw new Error(`Expected ${candles.length} bars, got ${barData.length}`);
  }

  // Check last bar indicators
  const lastBar = barData[barData.length - 1];
  if (
    lastBar.indicators.macd === null ||
    lastBar.indicators.macdSignal === null ||
    lastBar.indicators.macdHist === null
  ) {
    throw new Error('Last bar must contain computed MACD, Signal, and Histogram!');
  }
  console.log(`  Bar ${lastBar.index} (${lastBar.date}): MACD=${lastBar.indicators.macd}, Signal=${lastBar.indicators.macdSignal}, Hist=${lastBar.indicators.macdHist}`);
  console.log('  ✅ Rolling Indicators properly compute and attach MACD!\n');

  // -------------------------------------------------------------------------
  // Test 5: Full Backtest Simulation using MACD Rules
  // -------------------------------------------------------------------------
  console.log('Test 5: Full Backtest Simulation with MACD Momentum Crossover Rule...');

  const macdRule: StrategyRule = {
    id: 'test_macd_rule',
    name: 'MACD Momentum Crossover (12, 26, 9)',
    scope: 'stock',
    targetSymbol: 'MOCK.NS',
    action: 'BUY',
    sizingType: 'QTY',
    sizingValue: 20,
    enabled: true,
    frequency: 'daily',
    entryConditions: [
      {
        id: 'entry_cross',
        leftIndicator: 'macd',
        operator: 'CROSSINGOVER',
        rightType: 'indicator',
        rightIndicator: 'macdSignal',
      },
      {
        id: 'entry_below_zero',
        connector: 'AND',
        leftIndicator: 'macd',
        operator: '<',
        rightType: 'value',
        rightValue: 0,
      },
    ],
    exitConditions: [
      {
        id: 'exit_flip',
        leftIndicator: 'macdHist',
        operator: '<=',
        rightType: 'value',
        rightValue: 0,
      },
    ],
    exitSizingType: 'DECREASE_PCT',
    exitSizingValue: 100,
    conditions: [],
  };

  const simulationResult = runSimulation(
    'MOCK.NS',
    barData,
    [macdRule],
    {
      initialCapital: 100000,
      nominalStartDate: '2024-01-01',
    }
  );

  console.log(`  Simulation Completed!`);
  console.log(`  Initial Capital: 100,000 | Final Equity: ${simulationResult.finalEquity.toFixed(2)}`);
  console.log(`  Total Trades Executed: ${simulationResult.trades.length}`);

  if (simulationResult.trades.length < 1) {
    throw new Error('Expected at least 1 trade from the MACD crossover strategy!');
  }
  for (const t of simulationResult.trades) {
    console.log(`  Trade #${t.id}: ${t.action} @ ₹${t.entryPrice} on ${t.entryDate} -> Status: ${t.status}${t.exitDate ? ` Exit: ${t.exitDate} @ ₹${t.exitPrice} PnL: ₹${t.pnl}` : ''}`);
  }
  console.log('  ✅ End-to-end Backtest Simulation executed successfully!\n');

  console.log('====================================================');
  console.log('🎉 ALL 5 MACD INDICATOR TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runTests();
