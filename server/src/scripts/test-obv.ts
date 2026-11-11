import {
  computeOBV,
  computeOBVSeries,
  DailyCandle,
} from '../modules/prices/data-storage.service';
import { computeRollingIndicators } from '../modules/backtest/rolling-indicators.service';
import { evaluateConditionOnBar } from '../modules/backtest/signal-evaluator.service';
import { runSimulation } from '../modules/backtest/simulator.service';
import { BarMarketData, StrategyCondition, StrategyRule } from '../modules/backtest/types';

function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING INDICATOR 6: OBV / VOLUME (CONFIRMATION)');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Mathematical Accuracy of OBV & 20-period Signal Line
  // -------------------------------------------------------------------------
  console.log('Test 1: Mathematical Verification of On-Balance Volume (OBV)...');

  // 5 simple daily candles
  const testCandles: DailyCandle[] = [
    { date: '2024-01-01', open: 100, high: 105, low: 95, close: 100, volume: 1000 }, // Bar 0: OBV = 1,000
    { date: '2024-01-02', open: 100, high: 110, low: 100, close: 105, volume: 2000 }, // Bar 1: Up (+5) -> OBV = 1,000 + 2,000 = 3,000
    { date: '2024-01-03', open: 105, high: 108, low: 98, close: 102, volume: 1500 },  // Bar 2: Down (-3) -> OBV = 3,000 - 1,500 = 1,500
    { date: '2024-01-04', open: 102, high: 105, low: 100, close: 102, volume: 800 },   // Bar 3: Flat (0) -> OBV = 1,500
    { date: '2024-01-05', open: 102, high: 112, low: 101, close: 110, volume: 3000 },  // Bar 4: Up (+8) -> OBV = 1,500 + 3,000 = 4,500
  ];

  const series = computeOBVSeries(testCandles, 3); // 3-period signal for testing short series
  const scalar = computeOBV(testCandles, 3);

  console.log(`  Bar 0 OBV: ${series.obv[0]} (Expected: 1000)`);
  console.log(`  Bar 1 OBV: ${series.obv[1]} (Expected: 3000)`);
  console.log(`  Bar 2 OBV: ${series.obv[2]} (Expected: 1500)`);
  console.log(`  Bar 3 OBV: ${series.obv[3]} (Expected: 1500)`);
  console.log(`  Bar 4 OBV: ${series.obv[4]} (Expected: 4500)`);

  if (
    series.obv[0] !== 1000 ||
    series.obv[1] !== 3000 ||
    series.obv[2] !== 1500 ||
    series.obv[3] !== 1500 ||
    series.obv[4] !== 4500
  ) {
    throw new Error('OBV cumulative calculations do not match expected On-Balance Volume rules!');
  }

  // Signal line at bar 4 (3-period SMA of bars 2, 3, 4: (1500 + 1500 + 4500) / 3 = 2500)
  console.log(`  Bar 4 3-period Signal: ${series.obvSignal[4]} (Expected: 2500)`);
  if (series.obvSignal[4] !== 2500) {
    throw new Error(`Expected OBV Signal to be 2500, got ${series.obvSignal[4]}`);
  }

  // Check scalar matches last series element
  if (scalar.obv !== series.obv[4] || scalar.obvSignal !== series.obvSignal[4]) {
    throw new Error(`Scalar OBV (${scalar.obv}) does not match series tail (${series.obv[4]})`);
  }
  console.log('  ✅ Mathematical calculation of cumulative On-Balance Volume verified!\n');

  // -------------------------------------------------------------------------
  // Test 2: Buy Trigger (Breakout confirmed by volume spike and OBV crossing over Signal)
  // -------------------------------------------------------------------------
  console.log('Test 2: Testing Buy Trigger (OBV CROSSINGOVER Signal + Volume > AvgVolume)...');

  const obvCrossCond: StrategyCondition = {
    id: 'obv_cross_signal',
    leftIndicator: 'obv',
    operator: 'CROSSINGOVER',
    rightType: 'indicator',
    rightIndicator: 'obvSignal',
  };

  const volumeAboveAvgCond: StrategyCondition = {
    id: 'vol_above_avg',
    leftIndicator: 'volume',
    operator: '>',
    rightType: 'indicator',
    rightIndicator: 'avgVolume',
  };

  // Bar t-1: OBV = 45,000, Signal = 50,000 (OBV <= Signal)
  const prevBarBuy: BarMarketData = {
    index: 20,
    date: '2024-01-20',
    open: 99,
    high: 100,
    low: 98,
    close: 99,
    volume: 5000,
    changePercent: -1.0,
    indicators: {
      rsi: 50,
      dma50: 100,
      dma200: 100,
      avgVolume: 8000,
      obv: 45000,
      obvSignal: 50000,
    },
  };

  // Bar t: OBV surges to 58,000 > Signal 52,000 (Crossed Over!) with Volume 16,000 > AvgVolume 8,000
  const currentBarBuy: BarMarketData = {
    index: 21,
    date: '2024-01-21',
    open: 100,
    high: 106,
    low: 99.5,
    close: 105,
    volume: 16000, // Spike to multi-week high volume
    changePercent: 6.06,
    indicators: {
      rsi: 62,
      dma50: 100,
      dma200: 100,
      avgVolume: 8000,
      obv: 58000,
      obvSignal: 52000,
    },
  };

  const crossTriggered = evaluateConditionOnBar(obvCrossCond, currentBarBuy, prevBarBuy);
  const volSurgeTriggered = evaluateConditionOnBar(volumeAboveAvgCond, currentBarBuy);

  if (!crossTriggered || !volSurgeTriggered) {
    throw new Error('Expected Buy Trigger to evaluate to TRUE when OBV crosses over Signal with high volume!');
  }
  console.log('  ✅ Buy Trigger (OBV CROSSINGOVER Signal on volume surge): PASSED');

  // Negative test: OBV crossed over but volume did not spike above average volume
  const lowVolBar: BarMarketData = {
    ...currentBarBuy,
    volume: 6000, // Below 8,000 avg volume
  };
  const lowVolResult = evaluateConditionOnBar(volumeAboveAvgCond, lowVolBar);
  if (lowVolResult !== false) {
    throw new Error('Volume confirmation must evaluate to FALSE when volume is below average!');
  }
  console.log('  ✅ Negative test: Low volume breakout confirmation fails as expected!\n');

  // -------------------------------------------------------------------------
  // Test 3: Sell / Exit Trigger (OBV drops below signal line - distribution / divergence)
  // -------------------------------------------------------------------------
  console.log('Test 3: Testing Sell / Exit Trigger (OBV CROSSINGUNDER Signal)...');

  const obvCrossUnderCond: StrategyCondition = {
    id: 'obv_cross_under',
    leftIndicator: 'obv',
    operator: 'CROSSINGUNDER',
    rightType: 'indicator',
    rightIndicator: 'obvSignal',
  };

  // Bar t-1: OBV = 55,000 >= Signal 52,000
  const prevBarSell: BarMarketData = {
    index: 25,
    date: '2024-01-25',
    open: 105,
    high: 107,
    low: 104,
    close: 106,
    volume: 7000,
    changePercent: 0.95,
    indicators: {
      rsi: 65,
      dma50: 100,
      dma200: 100,
      obv: 55000,
      obvSignal: 52000,
    },
  };

  // Bar t: Heavy selling volume pushes OBV down to 42,000 < Signal 50,000
  const currentBarSell: BarMarketData = {
    index: 26,
    date: '2024-01-26',
    open: 105,
    high: 105.5,
    low: 99,
    close: 100,
    volume: 15000, // Heavy selling distribution
    changePercent: -5.66,
    indicators: {
      rsi: 48,
      dma50: 100,
      dma200: 100,
      obv: 42000,
      obvSignal: 50000,
    },
  };

  const sellTriggered = evaluateConditionOnBar(obvCrossUnderCond, currentBarSell, prevBarSell);
  if (!sellTriggered) {
    throw new Error('Expected Exit Trigger (OBV CROSSINGUNDER Signal) to evaluate to TRUE!');
  }
  console.log('  ✅ Sell Trigger (OBV CROSSINGUNDER Signal): PASSED\n');

  // -------------------------------------------------------------------------
  // Test 4: Strict Zero-Lookahead Bias Check in computeRollingIndicators
  // -------------------------------------------------------------------------
  console.log('Test 4: Verifying Zero-Lookahead Bias in rolling indicator computation...');

  // Generate 40 synthetic daily candles
  const simCandles: DailyCandle[] = [];
  let basePrice = 100;
  for (let i = 0; i < 40; i++) {
    const change = Math.sin(i * 0.4) * 2;
    basePrice = Math.max(50, basePrice + change);
    const dateStr = `2024-01-${String(i + 1).padStart(2, '0')}`;
    const vol = 1000 + (i % 5) * 500;
    simCandles.push({
      date: dateStr,
      open: parseFloat((basePrice - 0.5).toFixed(2)),
      high: parseFloat((basePrice + 1.5).toFixed(2)),
      low: parseFloat((basePrice - 1.5).toFixed(2)),
      close: parseFloat(basePrice.toFixed(2)),
      volume: vol,
    });
  }

  const fullIndicators = computeRollingIndicators(simCandles);

  // Check bar 25 against a slice of length 26 (indices 0..25)
  const targetIdx = 25;
  const slicedCandles = simCandles.slice(0, targetIdx + 1);
  const slicedIndicators = computeRollingIndicators(slicedCandles);

  const fullBar = fullIndicators[targetIdx];
  const slicedBar = slicedIndicators[targetIdx];

  console.log(`  Full run OBV at bar 25: ${fullBar.indicators.obv}`);
  console.log(`  Truncated run OBV at bar 25: ${slicedBar.indicators.obv}`);
  console.log(`  Full run OBV Signal at bar 25: ${fullBar.indicators.obvSignal}`);
  console.log(`  Truncated run OBV Signal at bar 25: ${slicedBar.indicators.obvSignal}`);

  if (fullBar.indicators.obv !== slicedBar.indicators.obv) {
    throw new Error(`Lookahead bias detected! OBV mismatch: ${fullBar.indicators.obv} vs ${slicedBar.indicators.obv}`);
  }
  if (fullBar.indicators.obvSignal !== slicedBar.indicators.obvSignal) {
    throw new Error(`Lookahead bias detected! OBV Signal mismatch: ${fullBar.indicators.obvSignal} vs ${slicedBar.indicators.obvSignal}`);
  }
  console.log('  ✅ STRICT ZERO-LOOKAHEAD BIAS CONFIRMED: future candles do not alter past OBV values!\n');

  // -------------------------------------------------------------------------
  // Test 5: Full Backtest Simulation using OBV Breakout Rules
  // -------------------------------------------------------------------------
  console.log('Test 5: Running Full Backtest Simulation with OBV Breakout strategy...');

  // Setup strategy rule:
  // BUY when OBV crosses above Signal AND Volume > AvgVolume
  // SELL when OBV crosses below Signal
  const obvStrategy: StrategyRule = {
    id: 'strat_obv_breakout',
    name: 'OBV & Volume Breakout Confirmation',
    action: 'BUY',
    sizingType: 'QTY',
    sizingValue: 10,
    entryConditions: [
      {
        id: 'obv_buy_cross',
        leftIndicator: 'obv',
        operator: 'CROSSINGOVER',
        rightType: 'indicator',
        rightIndicator: 'obvSignal',
      },
      {
        id: 'obv_buy_vol',
        connector: 'AND',
        leftIndicator: 'volume',
        operator: '>',
        rightType: 'indicator',
        rightIndicator: 'avgVolume',
      },
    ],
    exitConditions: [
      {
        id: 'obv_exit_cross',
        leftIndicator: 'obv',
        operator: 'CROSSINGUNDER',
        rightType: 'indicator',
        rightIndicator: 'obvSignal',
      },
    ],
    exitSizingType: 'DECREASE_PCT',
    exitSizingValue: 100,
    conditions: [],
    enabled: true,
  };

  const simBars = computeRollingIndicators(simCandles);

  const simulation = runSimulation(
    'TEST_STOCK',
    simBars,
    [obvStrategy],
    { initialCapital: 100000 }
  );

  console.log(`  Simulation Completed:`);
  console.log(`    Total Trades Executed: ${simulation.trades.length}`);
  console.log(`    Final Equity: ₹${simulation.finalEquity.toFixed(2)}`);
  console.log(`    Equity Curve Points: ${simulation.equityCurve.length}`);

  if (simulation.equityCurve.length !== simCandles.length) {
    throw new Error(`Expected equity curve length ${simCandles.length}, got ${simulation.equityCurve.length}`);
  }

  // Verify that bar indicators in equity curve contain valid obv and obvSignal
  const lastEquityPoint = simulation.equityCurve[simulation.equityCurve.length - 1];
  if (lastEquityPoint.indicators?.obv == null || lastEquityPoint.indicators?.obvSignal == null) {
    throw new Error('Equity curve points must include valid obv and obvSignal indicators!');
  }

  console.log(`    Last Equity Point OBV: ${lastEquityPoint.indicators.obv}, Signal: ${lastEquityPoint.indicators.obvSignal}`);
  console.log('  ✅ Full Backtest Simulation with OBV / Volume executed successfully!\n');

  console.log('====================================================');
  console.log('🎉 ALL 5 TESTS FOR INDICATOR 6 (OBV / VOLUME) PASSED!');
  console.log('====================================================');
}

runTests();
