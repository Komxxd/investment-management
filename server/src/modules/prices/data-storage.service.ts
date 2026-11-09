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
  ema20?: number | null;
  ema50?: number | null;
  ema200?: number | null;
  rsiDivergence?: 'BULLISH' | 'BEARISH' | null;
  rsiBullishDiv?: number | null;
  rsiBearishDiv?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  macdHist?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  bbBandwidth?: number | null;
  bbPercentB?: number | null;
  vwap?: number | null;
  avgVolume?: number | null;
  obv?: number | null;
  obvSignal?: number | null;
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
 * Compute the full historical RSI series for an array of closing prices.
 * Returns an array of identical length with null for index < period.
 */
export function computeRSISeries(closes: number[], period: number = 14): (number | null)[] {
  const n = closes.length;
  const result: (number | null)[] = new Array(n).fill(null);
  if (!closes || n < period + 1) return result;

  const changes: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    changes[i] = closes[i] - closes[i - 1];
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const c = changes[i];
    if (c > 0) avgGain += c;
    else avgLoss += Math.abs(c);
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    result[period] = avgGain === 0 ? 50 : 100;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = parseFloat(Math.min(100, Math.max(0, 100 - (100 / (1 + rs)))).toFixed(2));
  }

  for (let i = period + 1; i < n; i++) {
    const c = changes[i];
    const gain = c > 0 ? c : 0;
    const loss = c < 0 ? Math.abs(c) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result[i] = avgGain === 0 ? 50 : 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = parseFloat(Math.min(100, Math.max(0, 100 - (100 / (1 + rs)))).toFixed(2));
    }
  }

  return result;
}

export type RSIDivergenceType = 'BULLISH' | 'BEARISH' | null;

/**
 * Detects classical RSI Bullish and Bearish divergences across historical candles.
 * 
 * - Bullish Divergence: Price makes a Lower Low (or Close) while RSI makes a Higher Low.
 * - Bearish Divergence: Price makes a Higher High (or Close) while RSI makes a Lower High.
 * 
 * Guarantees strict zero lookahead bias by checking confirmed prior swing points.
 */
export function detectRSIDivergenceSeries(
  candles: DailyCandle[],
  rsiSeries: (number | null)[],
  minLookback: number = 3,
  maxLookback: number = 25
): RSIDivergenceType[] {
  const n = candles.length;
  const result: RSIDivergenceType[] = new Array(n).fill(null);
  if (n < maxLookback) return result;

  for (let i = maxLookback; i < n; i++) {
    const currRsi = rsiSeries[i];
    if (currRsi === null) continue;

    const currLow = candles[i].low ?? candles[i].close;
    const currHigh = candles[i].high ?? candles[i].close;

    // Check for Bullish Divergence:
    // Prior swing low j in [i - maxLookback, i - minLookback]
    let bullishFound = false;
    for (let j = i - minLookback; j >= i - maxLookback; j--) {
      const priorRsi = rsiSeries[j];
      if (priorRsi === null) continue;

      const priorLow = candles[j].low ?? candles[j].close;
      const isPriorPivotLow =
        j > 0 &&
        j < n - 1 &&
        priorLow <= (candles[j - 1].low ?? candles[j - 1].close) &&
        priorLow <= (candles[j + 1].low ?? candles[j + 1].close);

      if (isPriorPivotLow && priorRsi <= 42) {
        if (currLow < priorLow && currRsi > priorRsi + 1.0) {
          bullishFound = true;
          break;
        }
      }
    }

    if (bullishFound) {
      result[i] = 'BULLISH';
      continue;
    }

    // Check for Bearish Divergence:
    // Prior swing high j in [i - maxLookback, i - minLookback]
    let bearishFound = false;
    for (let j = i - minLookback; j >= i - maxLookback; j--) {
      const priorRsi = rsiSeries[j];
      if (priorRsi === null) continue;

      const priorHigh = candles[j].high ?? candles[j].close;
      const isPriorPivotHigh =
        j > 0 &&
        j < n - 1 &&
        priorHigh >= (candles[j - 1].high ?? candles[j - 1].close) &&
        priorHigh >= (candles[j + 1].high ?? candles[j + 1].close);

      if (isPriorPivotHigh && priorRsi >= 58) {
        if (currHigh > priorHigh && currRsi < priorRsi - 1.0) {
          bearishFound = true;
          break;
        }
      }
    }

    if (bearishFound) {
      result[i] = 'BEARISH';
    }
  }

  return result;
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
 * Compute Exponential Moving Average (EMA) of closing prices.
 * Multiplier k = 2 / (period + 1).
 * Seeded with SMA of first `period` closes.
 */
export function computeEMA(closes: number[], period: number): number | null {
  if (!closes || closes.length < period) return null;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }
  let ema = sum / period;
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] * k) + (ema * (1 - k));
  }
  return parseFloat(ema.toFixed(2));
}

/**
 * Compute the full historical EMA series for an array of closing prices.
 * Returns an array of identical length with null for index < period - 1.
 */
export function computeEMASeries(closes: number[], period: number): (number | null)[] {
  const n = closes.length;
  const result: (number | null)[] = new Array(n).fill(null);
  if (n < period) return result;

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }
  let currentEma = sum / period;
  result[period - 1] = parseFloat(currentEma.toFixed(2));

  for (let i = period; i < n; i++) {
    currentEma = (closes[i] * k) + (currentEma * (1 - k));
    result[i] = parseFloat(currentEma.toFixed(2));
  }
  return result;
}

export interface MACDResult {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface MACDSeriesResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

/**
 * Computes the full historical MACD (12, 26, 9) series:
 * 1. Fast EMA (12) and Slow EMA (26) of closing prices.
 * 2. MACD Line = Fast EMA - Slow EMA.
 * 3. Signal Line = 9-period EMA of the MACD Line.
 * 4. Histogram = MACD Line - Signal Line.
 */
export function computeMACDSeries(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDSeriesResult {
  const n = closes.length;
  const macd: (number | null)[] = new Array(n).fill(null);
  const signal: (number | null)[] = new Array(n).fill(null);
  const histogram: (number | null)[] = new Array(n).fill(null);

  if (n < slowPeriod) {
    return { macd, signal, histogram };
  }

  const fastEma = computeEMASeries(closes, fastPeriod);
  const slowEma = computeEMASeries(closes, slowPeriod);

  // Compute MACD Line starting at index (slowPeriod - 1)
  const macdValues: { index: number; val: number }[] = [];
  for (let i = slowPeriod - 1; i < n; i++) {
    if (fastEma[i] !== null && slowEma[i] !== null) {
      const val = parseFloat((fastEma[i]! - slowEma[i]!).toFixed(2));
      macd[i] = val;
      macdValues.push({ index: i, val });
    }
  }

  // Compute Signal Line (9-period EMA of the valid MACD Line values)
  if (macdValues.length >= signalPeriod) {
    const kSig = 2 / (signalPeriod + 1);

    // Initial Signal is SMA of first `signalPeriod` MACD values
    let sum = 0;
    for (let j = 0; j < signalPeriod; j++) {
      sum += macdValues[j].val;
    }
    let currentSignal = sum / signalPeriod;

    const firstSignalBarIdx = macdValues[signalPeriod - 1].index;
    signal[firstSignalBarIdx] = parseFloat(currentSignal.toFixed(2));
    histogram[firstSignalBarIdx] = parseFloat(
      (macd[firstSignalBarIdx]! - signal[firstSignalBarIdx]!).toFixed(2)
    );

    for (let j = signalPeriod; j < macdValues.length; j++) {
      const barIdx = macdValues[j].index;
      currentSignal = macdValues[j].val * kSig + currentSignal * (1 - kSig);
      signal[barIdx] = parseFloat(currentSignal.toFixed(2));
      histogram[barIdx] = parseFloat((macd[barIdx]! - signal[barIdx]!).toFixed(2));
    }
  }

  return { macd, signal, histogram };
}

/**
 * Computes latest scalar MACD, Signal, and Histogram for an array of closing prices.
 */
export function computeMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const series = computeMACDSeries(closes, fastPeriod, slowPeriod, signalPeriod);
  const lastIdx = closes.length - 1;
  if (lastIdx < 0) return { macd: null, signal: null, histogram: null };
  return {
    macd: series.macd[lastIdx] ?? null,
    signal: series.signal[lastIdx] ?? null,
    histogram: series.histogram[lastIdx] ?? null,
  };
}

export interface BollingerBandsResult {
  upper: number | null;
  middle: number | null;
  lower: number | null;
  bandwidth: number | null;
  percentB: number | null;
}

export interface BollingerBandsSeriesResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
  bandwidth: (number | null)[];
  percentB: (number | null)[];
}

/**
 * Compute Bollinger Bands (20, 2) Series:
 * - Middle Band: 20-period Simple Moving Average (SMA).
 * - Standard Deviation: 20-period sample/population standard deviation.
 * - Upper Band = Middle + (multiplier * stdDev)
 * - Lower Band = Middle - (multiplier * stdDev)
 * - Bandwidth = ((Upper - Lower) / Middle) * 100
 * - %B = (Price - Lower) / (Upper - Lower)
 */
export function computeBollingerBandsSeries(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerBandsSeriesResult {
  const n = closes.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const middle: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  const bandwidth: (number | null)[] = new Array(n).fill(null);
  const percentB: (number | null)[] = new Array(n).fill(null);

  if (n < period) {
    return { upper, middle, lower, bandwidth, percentB };
  }

  let rollingSum = 0;
  for (let i = 0; i < period - 1; i++) {
    rollingSum += closes[i];
  }

  for (let i = period - 1; i < n; i++) {
    rollingSum += closes[i];
    if (i >= period) {
      rollingSum -= closes[i - period];
    }

    const mean = rollingSum / period;
    let sumSqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - mean;
      sumSqDiff += diff * diff;
    }

    const stdDev = Math.sqrt(sumSqDiff / period);
    const u = mean + (stdDevMultiplier * stdDev);
    const l = mean - (stdDevMultiplier * stdDev);
    const bandSpan = u - l;

    upper[i] = parseFloat(u.toFixed(2));
    middle[i] = parseFloat(mean.toFixed(2));
    lower[i] = parseFloat(l.toFixed(2));
    bandwidth[i] = mean > 0 ? parseFloat(((bandSpan / mean) * 100).toFixed(2)) : null;
    percentB[i] = bandSpan > 0 ? parseFloat(((closes[i] - l) / bandSpan).toFixed(2)) : null;
  }

  return { upper, middle, lower, bandwidth, percentB };
}

/**
 * Computes latest scalar Bollinger Bands for an array of closing prices.
 */
export function computeBollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerBandsResult {
  const series = computeBollingerBandsSeries(closes, period, stdDevMultiplier);
  const lastIdx = closes.length - 1;
  if (lastIdx < 0) {
    return { upper: null, middle: null, lower: null, bandwidth: null, percentB: null };
  }
  return {
    upper: series.upper[lastIdx] ?? null,
    middle: series.middle[lastIdx] ?? null,
    lower: series.lower[lastIdx] ?? null,
    bandwidth: series.bandwidth[lastIdx] ?? null,
    percentB: series.percentB[lastIdx] ?? null,
  };
}

export interface VWAPResult {
  vwap: number | null;
  avgVolume: number | null;
}

export interface VWAPSeriesResult {
  vwap: (number | null)[];
  avgVolume: (number | null)[];
}

/**
 * Compute Volume Weighted Average Price (VWAP) Series:
 * - Typical Price (TP) = (High + Low + Close) / 3
 * - If intraday (hourly / timestamp present): resets cumulative (TP * Vol) and Vol daily at the start of each session.
 * - If daily: computes rolling 20-period VWAP = sum(TP * Vol, 20) / sum(Vol, 20) with cumulative warmup.
 * - Also computes 20-period average volume for above-average volume confirmation.
 */
export function computeVWAPSeries(
  candles: DailyCandle[],
  rollingPeriod: number = 20
): VWAPSeriesResult {
  const n = candles.length;
  const vwap: (number | null)[] = new Array(n).fill(null);
  const avgVolume: (number | null)[] = new Array(n).fill(null);

  if (n === 0) return { vwap, avgVolume };

  // Check if candles are intraday (contain hour/minute or multiple bars per day)
  let isIntraday = false;
  if (n > 1) {
    const day0 = candles[0].date.split(' ')[0].split('T')[0];
    const day1 = candles[1].date.split(' ')[0].split('T')[0];
    if (day0 === day1 || candles[0].date.includes(':')) {
      isIntraday = true;
    }
  }

  // 20-period rolling volume average
  let volSum = 0;
  for (let i = 0; i < n; i++) {
    volSum += candles[i].volume || 0;
    if (i >= rollingPeriod) {
      volSum -= candles[i - rollingPeriod].volume || 0;
    }
    const count = Math.min(i + 1, rollingPeriod);
    avgVolume[i] = Math.round(volSum / count);
  }

  if (isIntraday) {
    // Intraday Session VWAP (resets each day)
    let currentDay = '';
    let cumTPV = 0;
    let cumVol = 0;

    for (let i = 0; i < n; i++) {
      const c = candles[i];
      const barDay = c.date.split(' ')[0].split('T')[0];

      if (barDay !== currentDay) {
        currentDay = barDay;
        cumTPV = 0;
        cumVol = 0;
      }

      const high = c.high ?? c.close;
      const low = c.low ?? c.close;
      const tp = (high + low + c.close) / 3;
      const vol = c.volume || 0;

      cumTPV += tp * vol;
      cumVol += vol;

      if (cumVol > 0) {
        vwap[i] = parseFloat((cumTPV / cumVol).toFixed(2));
      } else {
        vwap[i] = parseFloat(c.close.toFixed(2));
      }
    }
  } else {
    // Daily Rolling 20-period VWAP (anchored institutional monthly cycle)
    for (let i = 0; i < n; i++) {
      const startIdx = Math.max(0, i - rollingPeriod + 1);
      let sumTPV = 0;
      let sumVol = 0;

      for (let j = startIdx; j <= i; j++) {
        const c = candles[j];
        const high = c.high ?? c.close;
        const low = c.low ?? c.close;
        const tp = (high + low + c.close) / 3;
        const vol = c.volume || 0;

        sumTPV += tp * vol;
        sumVol += vol;
      }

      if (sumVol > 0) {
        vwap[i] = parseFloat((sumTPV / sumVol).toFixed(2));
      } else {
        vwap[i] = parseFloat(candles[i].close.toFixed(2));
      }
    }
  }

  return { vwap, avgVolume };
}

/**
 * Computes latest scalar VWAP and AvgVolume for an array of candles.
 */
export function computeVWAP(
  candles: DailyCandle[],
  rollingPeriod: number = 20
): VWAPResult {
  const series = computeVWAPSeries(candles, rollingPeriod);
  const lastIdx = candles.length - 1;
  if (lastIdx < 0) return { vwap: null, avgVolume: null };
  return {
    vwap: series.vwap[lastIdx] ?? null,
    avgVolume: series.avgVolume[lastIdx] ?? null,
  };
}

export interface OBVResult {
  obv: number | null;
  obvSignal: number | null;
}

export interface OBVSeriesResult {
  obv: (number | null)[];
  obvSignal: (number | null)[];
}

/**
 * Computes On-Balance Volume (OBV) and 20-period OBV Signal (SMA):
 * - OBV[0] = volume[0]
 * - OBV[i] = OBV[i-1] + volume[i] if close[i] > close[i-1]
 * - OBV[i] = OBV[i-1] - volume[i] if close[i] < close[i-1]
 * - OBV[i] = OBV[i-1] if close[i] == close[i-1]
 * - OBV Signal is 20-period SMA of OBV.
 */
export function computeOBVSeries(
  candles: DailyCandle[],
  signalPeriod: number = 20
): OBVSeriesResult {
  const n = candles.length;
  const obv: (number | null)[] = new Array(n).fill(null);
  const obvSignal: (number | null)[] = new Array(n).fill(null);

  if (n === 0) return { obv, obvSignal };

  obv[0] = candles[0].volume || 0;
  for (let i = 1; i < n; i++) {
    const prevClose = candles[i - 1].close;
    const curClose = candles[i].close;
    const vol = candles[i].volume || 0;
    const prevObv = obv[i - 1]!;

    if (curClose > prevClose) {
      obv[i] = prevObv + vol;
    } else if (curClose < prevClose) {
      obv[i] = prevObv - vol;
    } else {
      obv[i] = prevObv;
    }
  }

  // Compute 20-period rolling SMA of OBV as the Signal Line
  let sumObv = 0;
  for (let i = 0; i < n; i++) {
    sumObv += obv[i]!;
    if (i >= signalPeriod) {
      sumObv -= obv[i - signalPeriod]!;
    }
    if (i >= signalPeriod - 1) {
      obvSignal[i] = Math.round(sumObv / signalPeriod);
    }
  }

  return { obv, obvSignal };
}

/**
 * Computes latest scalar OBV and OBV Signal for an array of candles.
 */
export function computeOBV(
  candles: DailyCandle[],
  signalPeriod: number = 20
): OBVResult {
  const series = computeOBVSeries(candles, signalPeriod);
  const lastIdx = candles.length - 1;
  if (lastIdx < 0) return { obv: null, obvSignal: null };
  return {
    obv: series.obv[lastIdx] ?? null,
    obvSignal: series.obvSignal[lastIdx] ?? null,
  };
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
  const rsiSeries = computeRSISeries(closes, 14);
  const divSeries = detectRSIDivergenceSeries(candles, rsiSeries);
  const lastIdx = candles.length - 1;
  const currentDiv = lastIdx >= 0 ? divSeries[lastIdx] : null;
  const macdRes = computeMACD(closes, 12, 26, 9);
  const bbRes = computeBollingerBands(closes, 20, 2);
  const vwapRes = computeVWAP(candles, 20);
  const obvRes = computeOBV(candles, 20);

  return {
    rsi: computeWildersRSI(closes, 14),
    dma50: computeSMA(closes, 50),
    dma200: computeSMA(closes, 200),
    ema20: computeEMA(closes, 20),
    ema50: computeEMA(closes, 50),
    ema200: computeEMA(closes, 200),
    rsiDivergence: currentDiv,
    rsiBullishDiv: currentDiv === 'BULLISH' ? 1 : 0,
    rsiBearishDiv: currentDiv === 'BEARISH' ? 1 : 0,
    macd: macdRes.macd,
    macdSignal: macdRes.signal,
    macdHist: macdRes.histogram,
    bbUpper: bbRes.upper,
    bbMiddle: bbRes.middle,
    bbLower: bbRes.lower,
    bbBandwidth: bbRes.bandwidth,
    bbPercentB: bbRes.percentB,
    vwap: vwapRes.vwap,
    avgVolume: vwapRes.avgVolume,
    obv: obvRes.obv,
    obvSignal: obvRes.obvSignal,
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
