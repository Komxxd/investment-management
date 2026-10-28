import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export type CandleTimeframe = 'day' | 'hour';
export type CandleInterval = '1d' | '60m';

export interface DailyCandle {
  date: string; // YYYY-MM-DD for day, YYYY-MM-DD HH:mm for hour
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export type Candle = DailyCandle;

export interface StockIndicatorResult {
  rsi: number | null;
  dma50: number | null;
  dma200: number | null;
  candlesCount?: number;
  lastUpdated?: string;
}

export interface HistoricalCandlesOptions {
  timeframe?: CandleTimeframe; // 'day' | 'hour', default is 'day'
  years?: number;              // e.g. 1, 2
  startDate?: string;          // YYYY-MM-DD
  endDate?: string;            // YYYY-MM-DD (defaults to today)
  warmupDays?: number;         // default 300 calendar days for daydata, 45 for hourdata
  force?: boolean;             // force re-fetch from network
}

// Directory structure: data/daydata and data/hourdata
function findServerDataDir(): string {
  let curr = __dirname;
  while (curr && curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, 'package.json')) && !curr.endsWith('node_modules')) {
      return path.join(curr, 'data');
    }
    curr = path.dirname(curr);
  }
  return path.resolve(__dirname, '../../../data');
}

const DATA_DIR = findServerDataDir();
const DAY_DATA_DIR = path.join(DATA_DIR, 'daydata');
const HOUR_DATA_DIR = path.join(DATA_DIR, 'hourdata');

/**
 * Ensures data directory structure exists:
 *   data/daydata
 *   data/hourdata
 *
 * Checks if any direct .json files exist in the root data/ folder.
 * If found, migrates them to data/daydata/ (so existing downloaded day data is preserved)
 * and deletes the direct .json file from root data/.
 */
export function ensureDataStorageStructure(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DAY_DATA_DIR)) {
    fs.mkdirSync(DAY_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(HOUR_DATA_DIR)) {
    fs.mkdirSync(HOUR_DATA_DIR, { recursive: true });
  }

  // Check for direct JSON files in root data/ and clean them up
  try {
    const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const directFilePath = path.join(DATA_DIR, entry.name);
        const dayFilePath = path.join(DAY_DATA_DIR, entry.name);

        // Migrate to daydata if not already present
        if (!fs.existsSync(dayFilePath)) {
          fs.copyFileSync(directFilePath, dayFilePath);
          console.log(`[DataStorage] Preserved existing day data: copied ${entry.name} to daydata/`);
        }

        // Delete direct file from root data folder
        fs.unlinkSync(directFilePath);
        console.log(`[DataStorage] Cleaned up direct file: deleted ${entry.name} from root data/`);
      }
    }
  } catch (err: any) {
    console.warn('[DataStorage] Cleanup check warning:', err.message);
  }
}

/**
 * Resolves the file path inside the correct timeframe subfolder.
 */
export function getFilePath(symbol: string, timeframe: CandleTimeframe = 'day'): string {
  const safe = symbol.replace(/[/\\:?*"<>|]/g, '_');
  const targetDir = timeframe === 'hour' ? HOUR_DATA_DIR : DAY_DATA_DIR;
  return path.join(targetDir, `${safe}.json`);
}

/**
 * Formats a Date object into standard string based on timeframe and local exchange hours.
 */
export function formatCandleDate(d: Date, symbol: string, timeframe: CandleTimeframe = 'day'): string {
  if (timeframe === 'day') {
    return d.toISOString().split('T')[0];
  }
  // For hourdata: format as YYYY-MM-DD HH:mm in local exchange market time
  const isIndian = symbol.endsWith('.NS') || symbol.endsWith('.BO');
  const tz = isIndian ? 'Asia/Kolkata' : 'America/New_York';
  const datePart = d.toLocaleDateString('en-CA', { timeZone: tz });
  const timePart = d.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

/**
 * Compute 14-period Wilder's smoothed RSI from closing prices.
 */
export function computeWildersRSI(closes: number[], period: number = 14): number | null {
  if (!closes || closes.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  if (changes.length < period) return null;

  // Seed with simple average of first `period` gains and losses
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const c = changes[i];
    if (c > 0) avgGain += c;
    else avgLoss += Math.abs(c);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's exponential smoothing for the rest
  for (let i = period; i < changes.length; i++) {
    const c = changes[i];
    const gain = c > 0 ? c : 0;
    const loss = c < 0 ? Math.abs(c) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return parseFloat(Math.min(100, Math.max(0, rsi)).toFixed(2));
}

/**
 * Compute Simple Moving Average.
 */
export function computeSMA(closes: number[], period: number): number | null {
  if (!closes || closes.length < period) return null;
  const slice = closes.slice(-period);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return parseFloat((sum / period).toFixed(2));
}

/**
 * Read candles from local data storage disk in the proper timeframe folder.
 */
export function readLocalCandles(symbol: string, timeframe: CandleTimeframe = 'day'): DailyCandle[] {
  ensureDataStorageStructure();
  const filePath = getFilePath(symbol, timeframe);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[DataStorage] Failed to read ${filePath}:`, (err as Error).message);
    return [];
  }
}

/**
 * Write candles to local data storage disk in the proper timeframe folder.
 */
export function writeLocalCandles(
  symbol: string,
  candles: DailyCandle[],
  timeframe: CandleTimeframe = 'day'
): void {
  ensureDataStorageStructure();
  const filePath = getFilePath(symbol, timeframe);
  try {
    // Sort oldest first and deduplicate by date
    const map = new Map<string, DailyCandle>();
    for (const c of candles) {
      if (c && c.date && c.close != null && isFinite(c.close)) {
        map.set(c.date, c);
      }
    }
    const sorted = Array.from(map.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[DataStorage] Failed to write ${filePath}:`, (err as Error).message);
  }
}

/**
 * Fetch a range of candles from Yahoo Finance (1d for day, 60m for hour).
 */
export async function fetchYahooCandlesRange(
  symbol: string,
  period1: string | Date,
  period2: string | Date,
  timeframe: CandleTimeframe = 'day'
): Promise<DailyCandle[]> {
  try {
    const interval: CandleInterval = timeframe === 'hour' ? '60m' : '1d';
    const chartRes: any = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval,
    });

    const quotes = chartRes?.quotes || [];
    return quotes
      .filter((q: any) => q.close != null && isFinite(q.close) && q.close > 0)
      .map((q: any) => {
        const d = new Date(q.date);
        return {
          date: formatCandleDate(d, symbol, timeframe),
          open: parseFloat((q.open || q.close).toFixed(2)),
          high: parseFloat((q.high || q.close).toFixed(2)),
          low: parseFloat((q.low || q.close).toFixed(2)),
          close: parseFloat((q.close).toFixed(2)),
          volume: q.volume || 0,
        };
      });
  } catch (fetchErr) {
    console.warn(
      `[DataStorage] Network fetch failed for ${symbol} (${period1} to ${period2}, ${timeframe}):`,
      (fetchErr as Error).message
    );
    return [];
  }
}

/**
 * Ensure historical candles are present in local disk storage for the requested range
 * under data/daydata or data/hourdata, including an automatic warmup buffer.
 *
 * Automatically fetches missing earlier or later candles from Yahoo Finance and merges them.
 */
export async function ensureHistoricalCandles(
  symbol: string,
  options: HistoricalCandlesOptions = {}
): Promise<DailyCandle[]> {
  ensureDataStorageStructure();

  const timeframe: CandleTimeframe = options.timeframe || 'day';
  const today = new Date();
  const todayStr = formatCandleDate(today, symbol, timeframe);
  const defaultWarmup = timeframe === 'hour' ? 45 : 300;
  const warmupDays = options.warmupDays ?? defaultWarmup;

  // Determine requested start date
  let targetStartDate: Date;
  if (options.startDate) {
    targetStartDate = new Date(options.startDate);
  } else if (options.years) {
    targetStartDate = new Date();
    targetStartDate.setFullYear(today.getFullYear() - options.years);
  } else {
    // Default: 2 years for hourly (Yahoo 60m limit is 730d), 3 years for daily
    targetStartDate = new Date();
    targetStartDate.setFullYear(today.getFullYear() - (timeframe === 'hour' ? 2 : 3));
  }

  // Prepend warmup days so DMA200 and RSI14 are available from Day 1 of the backtest
  const warmupStartDate = new Date(targetStartDate);
  warmupStartDate.setDate(warmupStartDate.getDate() - warmupDays);

  // If hourly, Yahoo Finance limits 60m data to within the last 730 days (~2 years)
  if (timeframe === 'hour') {
    const maxLookbackMs = 720 * 24 * 60 * 60 * 1000;
    const earliestAllowed = new Date(today.getTime() - maxLookbackMs);
    if (warmupStartDate < earliestAllowed) {
      warmupStartDate.setTime(earliestAllowed.getTime());
    }
  }

  const targetStartStr = formatCandleDate(warmupStartDate, symbol, timeframe);
  const targetEndStr = options.endDate
    ? formatCandleDate(new Date(options.endDate), symbol, timeframe)
    : todayStr;

  const existing = options.force ? [] : readLocalCandles(symbol, timeframe);

  if (existing.length === 0) {
    // Full initial fetch
    const fetched = await fetchYahooCandlesRange(symbol, targetStartStr, targetEndStr, timeframe);
    if (fetched.length > 0) {
      writeLocalCandles(symbol, fetched, timeframe);
      return readLocalCandles(symbol, timeframe);
    }
    return [];
  }

  let updated = [...existing];
  const earliestDate = existing[0].date;
  const latestDate = existing[existing.length - 1].date;

  // 1. Backfill older data if requested range starts earlier than what we have
  if (earliestDate > targetStartStr) {
    const olderCandles = await fetchYahooCandlesRange(symbol, targetStartStr, earliestDate, timeframe);
    if (olderCandles.length > 0) {
      updated = [...olderCandles, ...updated];
    }
  }

  // 2. Fetch recent delta if latest candle is behind targetEndStr
  const latestMs = new Date(latestDate).getTime();
  const targetEndMs = new Date(targetEndStr).getTime();
  const diffHours = (targetEndMs - latestMs) / (1000 * 60 * 60);
  const minDiffHours = timeframe === 'hour' ? 2 : 18;

  if (diffHours > minDiffHours && latestDate < targetEndStr) {
    const deltaStart = new Date(latestDate);
    deltaStart.setDate(deltaStart.getDate() - 2);
    const newerCandles = await fetchYahooCandlesRange(
      symbol,
      formatCandleDate(deltaStart, symbol, timeframe),
      targetEndStr,
      timeframe
    );
    if (newerCandles.length > 0) {
      updated = [...updated, ...newerCandles];
    }
  }

  writeLocalCandles(symbol, updated, timeframe);
  return readLocalCandles(symbol, timeframe);
}

/**
 * Sync stock data incrementally:
 * 1. Read existing candles from local disk.
 * 2. If recent candle exists (today or yesterday/weekend), use local cache.
 * 3. Otherwise, fetch missing delta from Yahoo Finance and append to disk.
 * 4. Compute RSI(14), DMA50, DMA200.
 */
export async function syncStockData(
  symbol: string,
  force: boolean = false,
  lookbackDays: number = 550,
  timeframe: CandleTimeframe = 'day'
): Promise<StockIndicatorResult> {
  const years = Math.max(1.5, parseFloat((lookbackDays / 365).toFixed(1)));
  const candles = await ensureHistoricalCandles(symbol, { years, force, timeframe });
  const closes = candles.map((c) => c.close);

  return {
    rsi: computeWildersRSI(closes, 14),
    dma50: computeSMA(closes, 50),
    dma200: computeSMA(closes, 200),
    candlesCount: candles.length,
    lastUpdated: candles.length > 0 ? candles[candles.length - 1].date : undefined,
  };
}

// Alias for backward compatibility
export const syncStockHistory = syncStockData;

/**
 * Batch sync with progress callback.
 */
export async function syncMultipleStocks(
  symbols: string[],
  force: boolean = false,
  onProgress?: (info: { current: number; total: number; symbol: string; percent: number }) => void,
  timeframe: CandleTimeframe = 'day'
): Promise<Record<string, StockIndicatorResult>> {
  const result: Record<string, StockIndicatorResult> = {};
  const total = symbols.length;

  for (let i = 0; i < total; i++) {
    const sym = symbols[i];
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        symbol: sym,
        percent: Math.round(((i + 1) / total) * 100),
      });
    }

    try {
      result[sym] = await syncStockData(sym, force, 550, timeframe);
    } catch (err) {
      console.error(`[DataStorage] Error syncing ${sym}:`, err);
      result[sym] = { rsi: null, dma50: null, dma200: null };
    }
  }

  return result;
}
