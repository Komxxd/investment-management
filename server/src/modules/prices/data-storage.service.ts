import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface DailyCandle {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockIndicatorResult {
  rsi: number | null;
  dma50: number | null;
  dma200: number | null;
  candlesCount?: number;
  lastUpdated?: string;
}

export interface HistoricalCandlesOptions {
  years?: number;      // e.g. 1, 3, 5
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD (defaults to today)
  warmupDays?: number; // default 300 calendar days (~200 trading bars for DMA200)
  force?: boolean;     // force re-fetch from network
}

// Directory where contiguous JSON candles are saved per symbol
const DATA_DIR = path.resolve(__dirname, '../../../data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(symbol: string): string {
  // Sanitize symbol for filename: e.g. RELIANCE.NS -> RELIANCE.NS.json
  const safe = symbol.replace(/[/\\:?*"<>|]/g, '_');
  return path.join(DATA_DIR, `${safe}.json`);
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
 * Read candles from local data storage disk.
 */
export function readLocalCandles(symbol: string): DailyCandle[] {
  ensureDataDir();
  const filePath = getFilePath(symbol);
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
 * Write candles to local data storage disk.
 */
export function writeLocalCandles(symbol: string, candles: DailyCandle[]): void {
  ensureDataDir();
  const filePath = getFilePath(symbol);
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
 * Fetch a range of daily candles from Yahoo Finance.
 */
export async function fetchYahooCandlesRange(
  symbol: string,
  period1: string,
  period2: string
): Promise<DailyCandle[]> {
  try {
    const chartRes: any = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: '1d',
    });

    const quotes = chartRes?.quotes || [];
    return quotes
      .filter((q: any) => q.close != null && isFinite(q.close) && q.close > 0)
      .map((q: any) => {
        const d = new Date(q.date);
        return {
          date: d.toISOString().split('T')[0],
          open: parseFloat((q.open || q.close).toFixed(2)),
          high: parseFloat((q.high || q.close).toFixed(2)),
          low: parseFloat((q.low || q.close).toFixed(2)),
          close: parseFloat((q.close).toFixed(2)),
          volume: q.volume || 0,
        };
      });
  } catch (fetchErr) {
    console.warn(
      `[DataStorage] Network fetch failed for ${symbol} (${period1} to ${period2}):`,
      (fetchErr as Error).message
    );
    return [];
  }
}

/**
 * Ensure historical daily candles are present in local disk storage for the requested range,
 * including an automatic indicator warmup buffer (default 300 calendar days ~ 200 trading days).
 *
 * Automatically fetches missing earlier or later candles from Yahoo Finance and merges them.
 */
export async function ensureHistoricalCandles(
  symbol: string,
  options: HistoricalCandlesOptions = {}
): Promise<DailyCandle[]> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const warmupDays = options.warmupDays ?? 300;

  // Determine requested start date
  let targetStartDate: Date;
  if (options.startDate) {
    targetStartDate = new Date(options.startDate);
  } else if (options.years) {
    targetStartDate = new Date();
    targetStartDate.setFullYear(today.getFullYear() - options.years);
  } else {
    // Default 3 years if not specified
    targetStartDate = new Date();
    targetStartDate.setFullYear(today.getFullYear() - 3);
  }

  // Prepend warmup days so DMA200 and RSI14 are available from Day 1 of the backtest
  const warmupStartDate = new Date(targetStartDate);
  warmupStartDate.setDate(warmupStartDate.getDate() - warmupDays);

  const targetStartStr = warmupStartDate.toISOString().split('T')[0];
  const targetEndStr = options.endDate || todayStr;

  const existing = options.force ? [] : readLocalCandles(symbol);

  if (existing.length === 0) {
    // Full initial fetch
    const fetched = await fetchYahooCandlesRange(symbol, targetStartStr, targetEndStr);
    if (fetched.length > 0) {
      writeLocalCandles(symbol, fetched);
      return readLocalCandles(symbol);
    }
    return [];
  }

  let updated = [...existing];
  const earliestDate = existing[0].date;
  const latestDate = existing[existing.length - 1].date;

  // 1. Backfill older data if requested range starts earlier than what we have
  if (earliestDate > targetStartStr) {
    const olderCandles = await fetchYahooCandlesRange(symbol, targetStartStr, earliestDate);
    if (olderCandles.length > 0) {
      updated = [...olderCandles, ...updated];
    }
  }

  // 2. Fetch recent delta if latest candle is behind targetEndStr
  const latestMs = new Date(latestDate).getTime();
  const targetEndMs = new Date(targetEndStr).getTime();
  const diffHours = (targetEndMs - latestMs) / (1000 * 60 * 60);

  if (diffHours > 18 && latestDate < targetEndStr) {
    const deltaStart = new Date(latestDate);
    deltaStart.setDate(deltaStart.getDate() - 2);
    const newerCandles = await fetchYahooCandlesRange(
      symbol,
      deltaStart.toISOString().split('T')[0],
      targetEndStr
    );
    if (newerCandles.length > 0) {
      updated = [...updated, ...newerCandles];
    }
  }

  writeLocalCandles(symbol, updated);
  return readLocalCandles(symbol);
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
  lookbackDays: number = 550
): Promise<StockIndicatorResult> {
  const years = Math.max(1.5, parseFloat((lookbackDays / 365).toFixed(1)));
  const candles = await ensureHistoricalCandles(symbol, { years, force });
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
  onProgress?: (info: { current: number; total: number; symbol: string; percent: number }) => void
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
      result[sym] = await syncStockData(sym, force);
    } catch (err) {
      console.error(`[DataStorage] Error syncing ${sym}:`, err);
      result[sym] = { rsi: null, dma50: null, dma200: null };
    }
  }

  return result;
}

