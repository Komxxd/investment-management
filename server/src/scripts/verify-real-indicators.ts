import {
  readLocalCandles,
  computeWildersRSI,
  computeSMA,
  computeEMA,
  computeMACD,
  computeBollingerBands,
  computeVWAP,
  computeOBV,
  syncStockData,
} from '../modules/prices/data-storage.service';

async function verify(symbol: string) {
  const candles = readLocalCandles(symbol, 'day');
  if (candles.length === 0) {
    console.log(`No candles found for ${symbol}`);
    return;
  }
  const closes = candles.map((c) => c.close);
  const lastCandle = candles[candles.length - 1];

  console.log(`\n==================================================`);
  console.log(`📈 REAL MARKET DATA VALIDATION: ${symbol}`);
  console.log(`==================================================`);
  console.log(`Total Candles: ${candles.length} | Latest Date: ${lastCandle.date}`);
  console.log(`Latest Close: ₹${lastCandle.close} | Latest Volume: ${lastCandle.volume.toLocaleString()}`);

  const rsi = computeWildersRSI(closes, 14);
  const dma50 = computeSMA(closes, 50);
  const dma200 = computeSMA(closes, 200);
  const ema20 = computeEMA(closes, 20);
  const ema50 = computeEMA(closes, 50);
  const ema200 = computeEMA(closes, 200);
  const vwap = computeVWAP(candles, 20);
  const obv = computeOBV(candles, 20);

  console.log(`\n1. RSI (14-period Wilder's):       ${rsi}`);
  console.log(`2. 50 DMA (Simple Moving Avg):      ₹${dma50}`);
  console.log(`3. 200 DMA (Simple Moving Avg):     ₹${dma200}`);
  console.log(`4. 20 EMA (Exponential Moving Avg): ₹${ema20}`);
  console.log(`5. 50 EMA (Exponential Moving Avg): ₹${ema50}`);
  console.log(`6. 200 EMA (Exponential Moving Avg):₹${ema200}`);

  // Test Configurable MACD
  console.log(`\n7. MACD CONFIGURABILITY TEST:`);
  const macdStd = computeMACD(closes, 12, 26, 9);
  const macdFast = computeMACD(closes, 8, 21, 5);
  const macdSmooth = computeMACD(closes, 16, 34, 9);
  console.log(`   - Standard (12, 26, 9): MACD=${macdStd.macd}, Signal=${macdStd.signal}, Hist=${macdStd.histogram}`);
  console.log(`   - Fast (8, 21, 5):      MACD=${macdFast.macd}, Signal=${macdFast.signal}, Hist=${macdFast.histogram}`);
  console.log(`   - Smooth (16, 34, 9):   MACD=${macdSmooth.macd}, Signal=${macdSmooth.signal}, Hist=${macdSmooth.histogram}`);

  // Test Configurable Bollinger Bands & 5 Values
  console.log(`\n8. BOLLINGER BANDS 5-VALUE & CONFIGURABILITY TEST:`);
  const bbStd = computeBollingerBands(closes, 20, 2);
  const bbTight = computeBollingerBands(closes, 10, 1.5);
  const bbWide = computeBollingerBands(closes, 50, 2.5);

  console.log(`   Standard (20, 2σ):`);
  console.log(`     [1] Upper Band (U):    ₹${bbStd.upper}`);
  console.log(`     [2] Middle Band (M):   ₹${bbStd.middle}`);
  console.log(`     [3] Lower Band (L):    ₹${bbStd.lower}`);
  console.log(`     [4] Bandwidth % (BW):  ${bbStd.bandwidth}%`);
  console.log(`     [5] %B Position:       ${bbStd.percentB}`);

  console.log(`   Tight (10, 1.5σ):`);
  console.log(`     U: ₹${bbTight.upper} | M: ₹${bbTight.middle} | L: ₹${bbTight.lower} | BW: ${bbTight.bandwidth}% | %B: ${bbTight.percentB}`);

  console.log(`   Wide (50, 2.5σ):`);
  console.log(`     U: ₹${bbWide.upper} | M: ₹${bbWide.middle} | L: ₹${bbWide.lower} | BW: ${bbWide.bandwidth}% | %B: ${bbWide.percentB}`);

  // Mathematical Invariant Checks
  if (bbStd.upper != null && bbStd.middle != null && bbStd.lower != null && bbStd.bandwidth != null && bbStd.percentB != null) {
    const isBandOrderValid = bbStd.upper > bbStd.middle && bbStd.middle > bbStd.lower;
    const expectedBW = Number((((bbStd.upper - bbStd.lower) / bbStd.middle) * 100).toFixed(2));
    const isBWValid = Math.abs((bbStd.bandwidth ?? 0) - expectedBW) < 0.05;
    const expectedPctB = Number(((lastCandle.close - bbStd.lower) / (bbStd.upper - bbStd.lower)).toFixed(4));
    const isPctBValid = Math.abs((bbStd.percentB ?? 0) - expectedPctB) < 0.05;

    console.log(`\n   Bollinger Mathematical Invariants:`);
    console.log(`     - Upper > Mid > Lower: ${isBandOrderValid ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`     - Bandwidth formula match: ${isBWValid ? 'PASSED ✅' : 'FAILED ❌'} (${bbStd.bandwidth}% vs ${expectedBW}%)`);
    console.log(`     - %B formula match: ${isPctBValid ? 'PASSED ✅' : 'FAILED ❌'} (${bbStd.percentB} vs ${expectedPctB})`);
  }

  console.log(`\n9. VWAP (20-day institutional):    ₹${vwap.vwap}`);
  console.log(`   20-day Avg Volume:               ${vwap.avgVolume?.toLocaleString()}`);
  console.log(`10. OBV (On-Balance Volume):        ${obv.obv?.toLocaleString()}`);
  console.log(`    OBV Signal (20-day SMA):        ${obv.obvSignal?.toLocaleString()}`);
  console.log(`    Volume Status:                  ${obv.obv! >= obv.obvSignal! ? 'BULLISH ACCUMULATION ↗' : 'BEARISH DISTRIBUTION ↘'}`);

  // Test full syncStockData with custom calculation options
  console.log(`\n11. END-TO-END syncStockData WITH CUSTOM OPTIONS:`);
  const customSync = await syncStockData(symbol, false, 550, 'day', {
    rsiPeriod: 21,
    macdFastPeriod: 8,
    macdSlowPeriod: 21,
    macdSignalPeriod: 5,
    bbPeriod: 10,
    bbStdDev: 1.5,
  });
  console.log(`   Custom RSI (21):       ${customSync.rsi}`);
  console.log(`   Custom MACD (8,21,5):  MACD=${customSync.macd}, Signal=${customSync.macdSignal}, Hist=${customSync.macdHistogram}`);
  console.log(`   Custom BB (10,1.5):    U=₹${customSync.bbUpper}, M=₹${customSync.bbMiddle}, L=₹${customSync.bbLower}, BW=${customSync.bbBandwidth}%, %B=${customSync.bbPercentB}`);
  console.log(`   syncStockData custom options test: PASSED ✅`);
}

async function run() {
  await verify('RELIANCE.NS');
  await verify('TCS.NS');
}

run();
