import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface Candle {
  date: string; // YYYY-MM-DD for 1d, YYYY-MM-DD HH:mm for 60m
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type DailyCandle = Candle;
export type HourCandle = Candle;

export interface StockIndicatorResult {
  rsi: number | null;
  dma50: number | null;
  dma200: number | null;
  candlesCount?: number;
  lastUpdated?: string;
}

export interface HistoricalCandlesOptions {
  years?: number;      // e.g. 1, 2, 3
  startDate?: string;  // YYYY-MM-DD or YYYY-MM-DD HH:mm
  endDate?: string;    // YYYY-MM-DD or YYYY-MM-DD HH:mm
  warmupDays?: number; // buffer period for indicators
  force?: boolean;     // force re-fetch from network
}

// Storage directories
const DATA_DIR = path.resolve(__dirname, '../../../data');
const HOUR_DATA_DIR = path.resolve(__dirname, '../../../hourdata');

export function ensureDataDir(interval: '1d' | '60m' = '1d') {
  const dir = interval === '60m' ? HOUR_DATA_DIR : DATA_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getFilePath(symbol: string, interval: '1d' | '60m' = '1d'): string {
  const safe = symbol.replace(/[/\\:?*"<>|]/g, '_');
  const dir = interval === '60m' ? HOUR_DATA_DIR : DATA_DIR;
  return path.join(dir, `${safe}.json`);
}

/**
 * Format raw candle timestamp into standard market timezone string.
 * NSE / BSE (.NS, .BO) -> Asia/Kolkata (IST)
 * US stocks -> America/New_York (EST)
 */
export function formatCandleDate(
  rawDate: Date | string | number,
  symbol: string,
  interval: '1d' | '60m' = '1d'
): string {
  const d = new Date(rawDate);
  if (interval === '1d') {
    return d.toISOString().split('T')[0];
  }
  const timeZone = symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'Asia/Kolkata' : 'America/New_York';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const y = parts.find((p) => p.type === 'year')?.value || '1970';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const h = parts.find((p) => p.type === 'hour')?.value || '00';
  const min = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${y}-${m}-${day} ${h}:${min}`;
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

// =============================================================================
// DAILY CANDLE STORAGE (server/data)
// =============================================================================

export function readLocalCandles(symbol: string): DailyCandle[] {
  ensureDataDir('1d');
  const filePath = getFilePath(symbol, '1d');
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

export function writeLocalCandles(symbol: string, candles: DailyCandle[]): void {
  ensureDataDir('1d');
  const filePath = getFilePath(symbol, '1d');
  try {
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

export async function fetchYahooCandlesRange(
  symbol: string,
  period1: string | Date,
  period2?: string | Date
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

export async function ensureHistoricalCandles(
  symbol: string,
  options: HistoricalCandlesOptions = {}
): Promise<DailyCandle[]> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const warmupDays = options.warmupDays ?? 300;

  let targetStartDate: Date;
  if (options.startDate) {
    targetStartDate = new Date(options.startDate);
  } else if (options.years) {
    targetStartDate = new Date();
    targetStartDate.setFullYear(today.getFullYear() - options.years);
  } else {
    targetStartDate = new Date();
    targetStartDate.setFullYear(today.getFullYear() - 3);
  }

  const warmupStartDate = new Date(targetStartDate);
  warmupStartDate.setDate(warmupStartDate.getDate() - warmupDays);

  const targetStartStr = warmupStartDate.toISOString().split('T')[0];
  const targetEndStr = options.endDate || todayStr;

  const existing = options.force ? [] : readLocalCandles(symbol);

  if (existing.length === 0) {
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

  if (earliestDate > targetStartStr) {
    const olderCandles = await fetchYahooCandlesRange(symbol, targetStartStr, earliestDate);
    if (olderCandles.length > 0) {
      updated = [...olderCandles, ...updated];
    }
  }

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

// =============================================================================
// HOURLY (60m) CANDLE STORAGE (server/hourdata)
// =============================================================================

export function readLocalHourCandles(symbol: string): HourCandle[] {
  ensureDataDir('60m');
  const filePath = getFilePath(symbol, '60m');
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[DataStorage] Failed to read hourly ${filePath}:`, (err as Error).message);
    return [];
  }
}

export function writeLocalHourCandles(symbol: string, candles: HourCandle[]): void {
  ensureDataDir('60m');
  const filePath = getFilePath(symbol, '60m');
  try {
    const map = new Map<string, HourCandle>();
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
    console.error(`[DataStorage] Failed to write hourly ${filePath}:`, (err as Error).message);
  }
}

export async function fetchYahooHourCandlesRange(
  symbol: string,
  period1: string | Date,
  period2?: string | Date
): Promise<HourCandle[]> {
  try {
    const p1 = new Date(period1);
    // Bound period1 to max 725 days back (Yahoo 60m hard limit is 730 days)
    const maxPast = new Date(Date.now() - 725 * 24 * 60 * 60 * 1000);
    const safeP1 = p1 < maxPast ? maxPast : p1;
    const safeP2 = period2 ? new Date(period2) : new Date();

    const chartRes: any = await yahooFinance.chart(symbol, {
      period1: safeP1,
      period2: safeP2,
      interval: '60m',
    });

    const quotes = chartRes?.quotes || [];
    return quotes
      .filter((q: any) => q.close != null && isFinite(q.close) && q.close > 0)
      .map((q: any) => ({
        date: formatCandleDate(q.date, symbol, '60m'),
        open: parseFloat((q.open || q.close).toFixed(2)),
        high: parseFloat((q.high || q.close).toFixed(2)),
        low: parseFloat((q.low || q.close).toFixed(2)),
        close: parseFloat((q.close).toFixed(2)),
        volume: q.volume || 0,
      }));
  } catch (fetchErr) {
    console.warn(
      `[DataStorage] Network fetch failed for hourly ${symbol}:`,
      (fetchErr as Error).message
    );
    return [];
  }
}

export async function ensureHistoricalHourCandles(
  symbol: string,
  options: HistoricalCandlesOptions = {}
): Promise<HourCandle[]> {
  const today = new Date();
  const warmupDays = options.warmupDays ?? 45; // ~45 calendar days is ~200+ hourly candles for DMA200 warmup

  // Yahoo Finance 60m max lookback is 730 days (~2 years)
  const maxYears = Math.min(options.years ?? 2, 2);
  let targetStartDate: Date;

  if (options.startDate) {
    targetStartDate = new Date(options.startDate);
  } else {
    targetStartDate = new Date();
    targetStartDate.setFullYear(today.getFullYear() - maxYears);
  }

  const warmupStartDate = new Date(targetStartDate);
  warmupStartDate.setDate(warmupStartDate.getDate() - warmupDays);

  const maxAllowedPast = new Date(Date.now() - 725 * 24 * 60 * 60 * 1000);
  const safeWarmupStart = warmupStartDate < maxAllowedPast ? maxAllowedPast : warmupStartDate;
  const targetStartStr = safeWarmupStart.toISOString().split('T')[0];

  const targetEndDate = options.endDate ? new Date(options.endDate) : today;
  targetEndDate.setHours(23, 59, 59, 999);

  const existing = options.force ? [] : readLocalHourCandles(symbol);

  if (existing.length === 0) {
    const fetched = await fetchYahooHourCandlesRange(symbol, safeWarmupStart, targetEndDate);
    if (fetched.length > 0) {
      writeLocalHourCandles(symbol, fetched);
      return readLocalHourCandles(symbol);
    }
    return [];
  }

  let updated = [...existing];
  const earliestDateStr = existing[0].date.split(' ')[0];
  const latestDateStr = existing[existing.length - 1].date;

  // 1. Backfill older hourly data if needed
  if (earliestDateStr > targetStartStr && new Date(earliestDateStr) > maxAllowedPast) {
    const olderCandles = await fetchYahooHourCandlesRange(
      symbol,
      safeWarmupStart,
      earliestDateStr
    );
    if (olderCandles.length > 0) {
      updated = [...olderCandles, ...updated];
    }
  }

  // 2. Fetch recent delta if latest hourly candle is behind today
  const latestMs = new Date(latestDateStr).getTime();
  const targetEndMs = targetEndDate.getTime();
  const diffHours = (targetEndMs - latestMs) / (1000 * 60 * 60);

  if (diffHours > 2) {
    const deltaStart = new Date(latestMs - 24 * 60 * 60 * 1000);
    const newerCandles = await fetchYahooHourCandlesRange(symbol, deltaStart, targetEndDate);
    if (newerCandles.length > 0) {
      updated = [...updated, ...newerCandles];
    }
  }

  writeLocalHourCandles(symbol, updated);
  return readLocalHourCandles(symbol);
}

// =============================================================================
// STOCK INDICATOR SYNCING (PORTFOLIO OVERVIEW)
// =============================================================================

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

export const syncStockHistory = syncStockData;

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
