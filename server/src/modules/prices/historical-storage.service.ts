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

// Directory where contiguous JSON candles are saved per symbol
const DATA_DIR = path.resolve(__dirname, '../../../data/historical');

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
 * Read candles from local disk.
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
    console.warn(`[HistoricalStorage] Failed to read ${filePath}:`, (err as Error).message);
    return [];
  }
}

/**
 * Write candles to local disk.
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
    console.error(`[HistoricalStorage] Failed to write ${filePath}:`, (err as Error).message);
  }
}

/**
 * Sync stock history incrementally:
 * 1. Read existing candles from local disk.
 * 2. If recent candle exists (today or yesterday/weekend), use local cache.
 * 3. Otherwise, fetch missing delta from Yahoo Finance and append to disk.
 * 4. Compute RSI(14), DMA50, DMA200.
 */
export async function syncStockHistory(symbol: string, force: boolean = false): Promise<StockIndicatorResult> {
  const existing = force ? [] : readLocalCandles(symbol);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  let needsFetch = force || existing.length === 0;

  if (!needsFetch && existing.length > 0) {
    const lastCandle = existing[existing.length - 1];
    const lastDate = new Date(lastCandle.date);
    const diffHours = (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

    // If last candle was within the last 20 hours, or if it's Sunday and last candle is Friday (approx 48-72h)
    // consider it up-to-date
    if (lastCandle.date === todayStr || diffHours < 18) {
      needsFetch = false;
    } else {
      needsFetch = true;
    }
  }

  if (needsFetch) {
    try {
      let period1: Date;
      if (existing.length > 0 && !force) {
        // Delta fetch: start 2 days before the last known date to ensure no gap
        const lastCandle = existing[existing.length - 1];
        period1 = new Date(lastCandle.date);
        period1.setDate(period1.getDate() - 2);
      } else {
        // Full initial fetch: 1.5 years (~550 days) to have plenty of candles for DMA200 and RSI(14)
        period1 = new Date();
        period1.setDate(today.getDate() - 550);
      }

      const chartRes: any = await yahooFinance.chart(symbol, {
        period1: period1.toISOString().split('T')[0],
        period2: todayStr,
        interval: '1d',
      });

      const quotes = chartRes?.quotes || [];
      const newCandles: DailyCandle[] = quotes
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

      if (newCandles.length > 0) {
        // Merge with existing and save to contiguous JSON
        const merged = [...existing, ...newCandles];
        writeLocalCandles(symbol, merged);
      }
    } catch (fetchErr) {
      console.warn(`[HistoricalStorage] Network fetch failed for ${symbol}:`, (fetchErr as Error).message);
      // Fallback: continue with existing candles if available
    }
  }

  // Load final candles from disk
  const allCandles = readLocalCandles(symbol);
  const closes = allCandles.map((c) => c.close);

  return {
    rsi: computeWildersRSI(closes, 14),
    dma50: computeSMA(closes, 50),
    dma200: computeSMA(closes, 200),
    candlesCount: allCandles.length,
    lastUpdated: allCandles.length > 0 ? allCandles[allCandles.length - 1].date : undefined,
  };
}

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
      result[sym] = await syncStockHistory(sym, force);
    } catch (err) {
      console.error(`[HistoricalStorage] Error syncing ${sym}:`, err);
      result[sym] = { rsi: null, dma50: null, dma200: null };
    }
  }

  return result;
}
