import {
  computeVWAP,
  computeVWAPSeries,
  DailyCandle,
} from '../modules/prices/data-storage.service';
import { computeRollingIndicators } from '../modules/backtest/rolling-indicators.service';
import { evaluateConditionOnBar } from '../modules/backtest/signal-evaluator.service';
import { runSimulation } from '../modules/backtest/simulator.service';
import { BarMarketData, StrategyCondition, StrategyRule } from '../modules/backtest/types';

function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING INDICATOR 5: VWAP (VOLUME WEIGHTED AVERAGE PRICE)');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Mathematical Accuracy of VWAP & Session Reset
  // -------------------------------------------------------------------------
  console.log('Test 1: Mathematical Verification of VWAP & Typical Price weighting...');

  // 5 simple daily candles
  const testCandles: DailyCandle[] = [
    { date: '2024-01-01', open: 100, high: 105, low: 95, close: 100, volume: 1000 }, // TP = (105+95+100)/3 = 100, TPV = 100,000, Vol = 1000 -> VWAP = 100
    { date: '2024-01-02', open: 100, high: 110, low: 100, close: 105, volume: 2000 }, // TP = (110+100+105)/3 = 105, TPV = 210,000, cumTPV = 310,000, cumVol = 3000 -> VWAP = 310,000 / 3000 = 103.33
    { date: '2024-01-03', open: 105, high: 115, low: 105, close: 110, volume: 1000 }, // TP = (115+105+110)/3 = 110, TPV = 110,000, cumTPV = 420,000, cumVol = 4000 -> VWAP = 420,000 / 4000 = 105.00
  ];

  const series = computeVWAPSeries(testCandles, 20);
  const scalar = computeVWAP(testCandles, 20);

  console.log(`  Bar 0 VWAP: ${series.vwap[0]} (Expected: 100.00)`);
  console.log(`  Bar 1 VWAP: ${series.vwap[1]} (Expected: 103.33)`);
  console.log(`  Bar 2 VWAP: ${series.vwap[2]} (Expected: 105.00)`);

  if (series.vwap[0] !== 100 || Math.abs(series.vwap[1]! - 103.33) > 0.05 || series.vwap[2] !== 105) {
    throw new Error('VWAP calculations do not match expected volume-weighted typical price!');
  }

  // Check scalar matches last series element
  if (scalar.vwap !== series.vwap[2]) {
    throw new Error(`Scalar VWAP (${scalar.vwap}) does not match series tail (${series.vwap[2]})`);
  }
  console.log('  ✅ Mathematical calculation of volume-weighted Typical Price verified!\n');

  // Intraday Session Reset Check
  console.log('Test 1b: Verifying Intraday Session Reset between trading days...');
  const intradayCandles: DailyCandle[] = [
    // Day 1
    { date: '2024-01-01 09:15', open: 100, high: 102, low: 98, close: 100, volume: 1000 }, // TP = 100, VWAP = 100
    { date: '2024-01-01 10:15', open: 100, high: 112, low: 100, close: 106, volume: 2000 }, // TP = 106, cumTPV = 312,000 / 3000 = 104
    // Day 2 (should RESET at market open)
    { date: '2024-01-02 09:15', open: 110, high: 115, low: 105, close: 110, volume: 1500 }, // TP = 110, session reset -> VWAP = 110.00
  ];

  const intradaySeries = computeVWAPSeries(intradayCandles, 20);
  console.log(`  Day 1 Bar 1 VWAP: ${intradaySeries.vwap[0]}`);
  console.log(`  Day 1 Bar 2 VWAP: ${intradaySeries.vwap[1]}`);
  console.log(`  Day 2 Bar 1 VWAP: ${intradaySeries.vwap[2]} (Expected: 110.00, reset from day 1)`);

  if (intradaySeries.vwap[2] !== 110) {
    throw new Error(`Expected Intraday VWAP to reset to 110 on Day 2 open, got ${intradaySeries.vwap[2]}`);
  }
  console.log('  ✅ Intraday session VWAP resets cleanly across trading days!\n');

  // -------------------------------------------------------------------------
  // Test 2: Buy Trigger (Price crosses and sustains above VWAP on above-average volume)
  // -------------------------------------------------------------------------
  console.log('Test 2: Testing Buy Trigger (Price CROSSINGOVER VWAP + Volume > AvgVolume)...');

  const priceCrossVwapCond: StrategyCondition = {
    id: 'price_cross_vwap',
    leftIndicator: 'price',
    operator: 'CROSSINGOVER',
    rightType: 'indicator',
    rightIndicator: 'vwap',
  };

  const volumeAboveAvgCond: StrategyCondition = {
    id: 'vol_above_avg',
    leftIndicator: 'volume',
    operator: '>',
    rightType: 'indicator',
    rightIndicator: 'avgVolume',
  };

  // Bar t-1: Price = 98, below VWAP = 100
  const prevBarBuy: BarMarketData = {
    index: 20,
    date: '2024-01-20',
    open: 99,
    high: 99.5,
    low: 97.5,
    close: 98.0,
    volume: 5000,
    changePercent: -1.0,
    indicators: {
      rsi: 45,
      dma50: 100,
      dma200: 100,
      vwap: 100.0,
      avgVolume: 8000,
    },
  };

  // Bar t: Price crosses above VWAP (Price 102 > VWAP 100.5) on SURGE volume (15,000 > avg 8,000)
  const currentBarBuy: BarMarketData = {
    index: 21,
    date: '2024-01-21',
    open: 98.5,
    high: 103.0,
    low: 98.0,
    close: 102.0,
    volume: 15000, // Surge above 8,000 avg
    changePercent: 4.08,
    indicators: {
      rsi: 55,
      dma50: 100,
      dma200: 100,
      vwap: 100.5,
      avgVolume: 8000,
    },
  };

  const crossTriggered = evaluateConditionOnBar(priceCrossVwapCond, currentBarBuy, prevBarBuy);
  const volSurgeTriggered = evaluateConditionOnBar(volumeAboveAvgCond, currentBarBuy);

  if (!crossTriggered || !volSurgeTriggered) {
    throw new Error('Expected Buy Trigger to evaluate to TRUE when price crosses over VWAP with above-average volume!');
  }
  console.log('  ✅ Buy Trigger (Price CROSSINGOVER VWAP on above-average volume): PASSED');

  // Negative test: Price crosses over VWAP but on BELOW-average volume (should fail volume condition)
  const lowVolBar: BarMarketData = {
    ...currentBarBuy,
    volume: 4000, // Below 8,000 avg volume
  };
  const lowVolResult = evaluateConditionOnBar(volumeAboveAvgCond, lowVolBar);
  if (lowVolResult !== false) {
    throw new Error('Volume confirmation condition must fail when volume is below average volume!');
  }
  console.log('  ✅ Negative check (Low-volume breakout rejected): PASSED\n');

  // -------------------------------------------------------------------------
  // Test 3: Sell / Exit Trigger (Price drops and stays below VWAP)
  // -------------------------------------------------------------------------
  console.log('Test 3: Testing Sell / Exit Trigger (Price drops below VWAP)...');

  const priceCrossUnderVwapCond: StrategyCondition = {
    id: 'price_cross_under_vwap',
    leftIndicator: 'price',
    operator: 'CROSSINGUNDER',
    rightType: 'indicator',
    rightIndicator: 'vwap',
  };

  // Bar t-1: Price above VWAP (Price 110, VWAP 108)
  const prevBarExit: BarMarketData = {
    index: 30,
    date: '2024-02-01',
    open: 109,
    high: 111,
    low: 108.5,
    close: 110.0,
    volume: 10000,
    changePercent: 1.0,
    indicators: {
      rsi: 62,
      dma50: 100,
      dma200: 100,
      vwap: 108.0,
    },
  };

  // Bar t: Price drops below VWAP (Price 106.5, VWAP 107.8)
  const currentBarExit: BarMarketData = {
    index: 31,
    date: '2024-02-02',
    open: 109,
    high: 109.2,
    low: 106.0,
    close: 106.5,
    volume: 12000,
    changePercent: -3.18,
    indicators: {
      rsi: 51,
      dma50: 100,
      dma200: 100,
      vwap: 107.8,
    },
  };

  const exitTriggered = evaluateConditionOnBar(priceCrossUnderVwapCond, currentBarExit, prevBarExit);
  if (!exitTriggered) {
    throw new Error('Expected Exit signal when price drops and crosses under VWAP!');
  }
  console.log('  ✅ Sell / Exit Trigger (Price CROSSINGUNDER VWAP): PASSED\n');

  // -------------------------------------------------------------------------
  // Test 4: Rolling Indicators Integration
  // -------------------------------------------------------------------------
  console.log('Test 4: Verifying Rolling Indicators attach VWAP and AvgVolume...');

  const sampleCloses = [
    100, 102, 101, 103, 105, 104, 106, 108, 107, 109,
    111, 110, 112, 114, 113, 115, 117, 116, 118, 120,
    122, 121, 123, 125, 124, 126, 128, 127, 129, 131,
  ];

  const fullCandles: DailyCandle[] = sampleCloses.map((c, i) => {
    const day = (i + 1).toString().padStart(2, '0');
    return {
      date: `2024-01-${day}`,
      open: c - 1,
      high: c + 1.5,
      low: c - 1.5,
      close: c,
      volume: 10000 + (i % 5) * 2000,
    };
  });

  const barData = computeRollingIndicators(fullCandles);
  if (barData.length !== fullCandles.length) {
    throw new Error(`Expected ${fullCandles.length} bars, got ${barData.length}`);
  }

  const lastBar = barData[barData.length - 1];
  if (lastBar.indicators.vwap === null || lastBar.indicators.avgVolume === null) {
    throw new Error('Last bar must contain computed VWAP and AvgVolume!');
  }
  console.log(`  Bar ${lastBar.index} (${lastBar.date}): VWAP=${lastBar.indicators.vwap}, AvgVolume=${lastBar.indicators.avgVolume}, Vol=${lastBar.volume}`);
  console.log('  ✅ Rolling Indicators properly compute and attach VWAP and AvgVolume!\n');

  // -------------------------------------------------------------------------
  // Test 5: Full Backtest Simulation with VWAP Institutional Breakout Rule
  // -------------------------------------------------------------------------
  console.log('Test 5: Full Backtest Simulation with VWAP Institutional Breakout Rule...');

  // Build a 60-day price sequence: dip below VWAP, breakout above on high volume, run up, exit below VWAP
  const simPrices: number[] = [];
  const simVolumes: number[] = [];
  let price = 100;

  for (let i = 0; i < 60; i++) {
    if (i < 20) {
      price -= 0.3; // Base consolidation / downtrend below VWAP
      simVolumes.push(8000);
    } else if (i === 20) {
      price += 3.5; // Big breakout bar above VWAP
      simVolumes.push(30000); // 3.5x average volume surge!
    } else if (i < 40) {
      price += 0.8; // Continued uptrend above VWAP
      simVolumes.push(10000);
    } else {
      price -= 1.5; // Drop back below VWAP
      simVolumes.push(12000);
    }
    simPrices.push(parseFloat(price.toFixed(2)));
  }

  const simCandles: DailyCandle[] = simPrices.map((c, i) => {
    const day = (i + 1).toString().padStart(2, '0');
    return {
      date: `2024-03-${day}`,
      open: c - 0.5,
      high: c + 1.0,
      low: c - 1.0,
      close: c,
      volume: simVolumes[i],
    };
  });

  const simBars = computeRollingIndicators(simCandles);

  const vwapRule: StrategyRule = {
    id: 'test_vwap_rule',
    name: 'VWAP Institutional Breakout',
    scope: 'stock',
    targetSymbol: 'MOCK.NS',
    action: 'BUY',
    sizingType: 'QTY',
    sizingValue: 20,
    enabled: true,
    frequency: 'daily',
    entryConditions: [
      {
        id: 'entry_vwap_cross',
        leftIndicator: 'price',
        operator: 'CROSSINGOVER',
        rightType: 'indicator',
        rightIndicator: 'vwap',
      },
      {
        id: 'entry_vol_surge',
        connector: 'AND',
        leftIndicator: 'volume',
        operator: '>',
        rightType: 'indicator',
        rightIndicator: 'avgVolume',
      },
    ],
    exitConditions: [
      {
        id: 'exit_vwap_crossunder',
        leftIndicator: 'price',
        operator: 'CROSSINGUNDER',
        rightType: 'indicator',
        rightIndicator: 'vwap',
      },
    ],
    exitSizingType: 'DECREASE_PCT',
    exitSizingValue: 100,
    conditions: [],
  };

  const simulationResult = runSimulation(
    'MOCK.NS',
    simBars,
    [vwapRule],
    {
      initialCapital: 100000,
      nominalStartDate: '2024-03-01',
    }
  );

  console.log(`  Simulation Completed!`);
  console.log(`  Initial Capital: ₹100,000 | Final Equity: ₹${simulationResult.finalEquity.toFixed(2)}`);
  console.log(`  Total Trades Executed: ${simulationResult.trades.length}`);

  if (simulationResult.trades.length < 1) {
    throw new Error('Expected at least 1 trade from VWAP Institutional Breakout strategy!');
  }
  for (const t of simulationResult.trades) {
    console.log(`  Trade #${t.id}: ${t.action} @ ₹${t.entryPrice} on ${t.entryDate} -> Status: ${t.status}${t.exitDate ? ` Exit: ${t.exitDate} @ ₹${t.exitPrice} PnL: ₹${t.pnl}` : ''}`);
  }
  console.log('  ✅ End-to-end Backtest Simulation executed successfully!\n');

  console.log('====================================================');
  console.log('🎉 ALL 5 VWAP INDICATOR TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runTests();

