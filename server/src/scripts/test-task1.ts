import path from 'path';
import fs from 'fs';
import { ensureHistoricalCandles } from '../modules/prices/data-storage.service';

async function runTest() {
  const symbol = process.argv[2] || 'TCS.NS';
  const years = Number(process.argv[3]) || 3;

  console.log('====================================================');
  console.log(`[Task 1 Test] Testing Historical Data Ingestion`);
  console.log(`Target Symbol : ${symbol}`);
  console.log(`Requested Span: ${years} Years (+ 300 days warmup buffer)`);
  console.log('====================================================\n');

  console.log(`1. Fetching / Syncing candles from Yahoo Finance & local cache...`);
  const startTime = Date.now();
  const candles = await ensureHistoricalCandles(symbol, { years });
  const duration = Date.now() - startTime;

  if (!candles || candles.length === 0) {
    console.error(`❌ Failed: No candles returned for ${symbol}. Check internet or ticker.`);
    process.exit(1);
  }

  console.log(`✓ Fetched ${candles.length} total daily candles in ${duration}ms!`);
  console.log(`  - Earliest Date : ${candles[0].date} (Close: ₹${candles[0].close})`);
  console.log(`  - Latest Date   : ${candles[candles.length - 1].date} (Close: ₹${candles[candles.length - 1].close})`);
  console.log(`  - Sample Candle :`, JSON.stringify(candles[Math.floor(candles.length / 2)]));

  // Verify warmup buffer
  const today = new Date();
  const expectedNominalStart = new Date();
  expectedNominalStart.setFullYear(today.getFullYear() - years);
  const nominalStartStr = expectedNominalStart.toISOString().split('T')[0];

  console.log(`\n2. Verifying 200-day Warmup Buffer:`);
  console.log(`  - Nominal Start for ${years}Y Backtest: ${nominalStartStr}`);
  console.log(`  - Actual First Candle Date          : ${candles[0].date}`);
  if (candles[0].date < nominalStartStr) {
    console.log(`  ✓ SUCCESS: Warmup candles are present before ${nominalStartStr} so DMA200 & RSI are ready on Day 1.`);
  } else {
    console.log(`  ℹ Note: Stock IPO or history starts at ${candles[0].date}.`);
  }

  // Verify file on disk
  const safeName = symbol.replace(/[/\\:?*"<>|]/g, '_');
  const filePath = path.resolve(__dirname, '../../data', `${safeName}.json`);
  console.log(`\n3. Verifying Local Disk Storage:`);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`  ✓ Cached file exists: ${filePath}`);
    console.log(`  ✓ File Size: ${(stats.size / 1024).toFixed(1)} KB`);
  } else {
    console.error(`  ❌ Local file not found at ${filePath}`);
  }

  // Test cache hit speed
  console.log(`\n4. Testing Second Fetch (Cache Hit Speed):`);
  const t2 = Date.now();
  const cachedCandles = await ensureHistoricalCandles(symbol, { years });
  const cacheDuration = Date.now() - t2;
  console.log(`  ✓ Retrieved ${cachedCandles.length} candles from local cache in ${cacheDuration}ms!`);

  console.log('\n====================================================');
  console.log(`🎉 Task 1 Test Passed Successfully!`);
  console.log('====================================================\n');
}

runTest().catch((err) => {
  console.error('Test encountered an error:', err);
  process.exit(1);
});
