import { DailyCandle } from '../prices/data-storage.service';
import { BarMarketData } from './types';

interface DailyBaselineState {
  date: string;
  close: number;
  avgGain: number;
  avgLoss: number;
  sum49: number | null;
  sum199: number | null;
  count: number;
}

/**
 * Computes live, provisional Daily Indicators (RSI-14, DMA-50, DMA-200, Day Change %)
 * evaluated intraday on each hourly (60m) candle.
 *
 * 1. Pre-calculates daily rolling Wilder's RSI and moving averages across dailyCandles.
 * 2. For each hourly bar on Day D, evaluates its provisional Daily RSI against Day D-1's
 *    baseline state without mutating the daily accumulator between hours.
 * 3. Guarantees strict zero-lookahead bias: bar at index t only uses completed prior
 *    daily history and the current bar's own price.
 */
function computeProvisionalDailyIndicators(
  hourlyCandles: DailyCandle[],
  dailyCandles: DailyCandle[]
): BarMarketData[] {
  const rsiPeriod = 14;
  const sortedDaily = [...dailyCandles].sort((a, b) => a.date.localeCompare(b.date));
  const nDaily = sortedDaily.length;

  // 1. Pre-calculate rolling daily baselines at the close of each day
  const dailyStateByDate = new Map<string, DailyBaselineState>();
  let avgGain = 0;
  let avgLoss = 0;
  const dailyCloses: number[] = [];

  for (let i = 0; i < nDaily; i++) {
    const d = sortedDaily[i];
    dailyCloses.push(d.close);

    if (i > 0) {
      const diff = d.close - sortedDaily[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      if (i === rsiPeriod) {
        let sumG = 0;
        let sumL = 0;
        for (let j = 1; j <= rsiPeriod; j++) {
          const df = sortedDaily[j].close - sortedDaily[j - 1].close;
          sumG += df > 0 ? df : 0;
          sumL += df < 0 ? Math.abs(df) : 0;
        }
        avgGain = sumG / rsiPeriod;
        avgLoss = sumL / rsiPeriod;
      } else if (i > rsiPeriod) {
        avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
        avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
      }
    }

    if (i >= rsiPeriod) {
      const sum49 =
        dailyCloses.length >= 49
          ? dailyCloses.slice(-49).reduce((acc, val) => acc + val, 0)
          : null;
      const sum199 =
        dailyCloses.length >= 199
          ? dailyCloses.slice(-199).reduce((acc, val) => acc + val, 0)
          : null;

      dailyStateByDate.set(d.date, {
        date: d.date,
        close: d.close,
        avgGain,
        avgLoss,
        sum49,
        sum199,
        count: i + 1,
      });
    }
  }

  const dailyDates = sortedDaily.map((d) => d.date);

  // Binary search to find the latest daily candle strictly before targetDateStr (Day D-1)
  function getPrevDailyBaseline(targetDateStr: string): DailyBaselineState | null {
    let low = 0;
    let high = dailyDates.length - 1;
    let bestIdx = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (dailyDates[mid] < targetDateStr) {
        bestIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestIdx === -1) return null;
    return dailyStateByDate.get(dailyDates[bestIdx]) || null;
  }

  // 2. For each hourly bar, compute provisional daily indicators
  const result: BarMarketData[] = new Array(hourlyCandles.length);

  for (let i = 0; i < hourlyCandles.length; i++) {
    const c = hourlyCandles[i];
    const barDay = c.date.includes(' ') ? c.date.split(' ')[0] : c.date.split('T')[0];
    const baseline = getPrevDailyBaseline(barDay);

    let rsi: number | null = null;
    let dma50: number | null = null;
    let dma200: number | null = null;
    let changePct = 0;

    if (baseline) {
      const p = c.close;
      const diff = p - baseline.close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      changePct =
        baseline.close > 0
          ? parseFloat((((p - baseline.close) / baseline.close) * 100).toFixed(2))
          : 0;

      // Provisional Wilder's RSI(14)
      const provAvgGain = (baseline.avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
      const provAvgLoss = (baseline.avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;

      if (provAvgLoss === 0) {
        rsi = provAvgGain === 0 ? 50 : 100;
      } else {
        const rs = provAvgGain / provAvgLoss;
        rsi = parseFloat(Math.min(100, Math.max(0, 100 - (100 / (1 + rs)))).toFixed(2));
      }

      // Provisional Daily DMA50
      if (baseline.sum49 != null && baseline.count >= 49) {
        dma50 = parseFloat(((baseline.sum49 + p) / 50).toFixed(2));
      }

      // Provisional Daily DMA200
      if (baseline.sum199 != null && baseline.count >= 199) {
        dma200 = parseFloat(((baseline.sum199 + p) / 200).toFixed(2));
      }
    } else {
      // Fallback for bars before daily warmup is reached
      const prevClose = i > 0 ? hourlyCandles[i - 1].close : c.open;
      changePct =
        prevClose > 0
          ? parseFloat((((c.close - prevClose) / prevClose) * 100).toFixed(2))
          : 0;
    }

    result[i] = {
      index: i,
      date: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      changePercent: changePct,
      indicators: {
        rsi,
        dma50,
        dma200,
      },
    };
  }

  return result;
}

/**
 * Computes rolling technical indicators (RSI-14, DMA50, DMA200, daily change %).
 *
 * If `dailyCandles` is provided, calculates live provisional Daily indicators on each intraday bar.
 * Otherwise, calculates standard rolling indicators across the provided candle array.
 *
 * Guarantees STRICT zero-lookahead bias.
 */
export function computeRollingIndicators(
  candles: DailyCandle[],
  dailyCandles?: DailyCandle[]
): BarMarketData[] {
  if (!candles || candles.length === 0) return [];

  // If daily history is supplied, compute provisional daily indicators on hourly candles!
  if (dailyCandles && dailyCandles.length >= 15) {
    return computeProvisionalDailyIndicators(candles, dailyCandles);
  }

  // Standard single-timeframe rolling computation
  const n = candles.length;
  const result: BarMarketData[] = new Array(n);

  let sum50 = 0;
  let sum200 = 0;

  const rsiPeriod = 14;
  let avgGain = 0;
  let avgLoss = 0;

  const gains: number[] = new Array(n).fill(0);
  const losses: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const prevClose = i > 0 ? candles[i - 1].close : c.open;
    const changePct =
      i > 0 && prevClose > 0
        ? parseFloat((((c.close - prevClose) / prevClose) * 100).toFixed(2))
        : 0;

    if (i > 0) {
      const diff = c.close - prevClose;
      gains[i] = diff > 0 ? diff : 0;
      losses[i] = diff < 0 ? Math.abs(diff) : 0;
    }

    let rsi: number | null = null;
    if (i === rsiPeriod) {
      let sumG = 0;
      let sumL = 0;
      for (let j = 1; j <= rsiPeriod; j++) {
        sumG += gains[j];
        sumL += losses[j];
      }
      avgGain = sumG / rsiPeriod;
      avgLoss = sumL / rsiPeriod;

      if (avgLoss === 0) {
        rsi = avgGain === 0 ? 50 : 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi = parseFloat(Math.min(100, Math.max(0, 100 - (100 / (1 + rs)))).toFixed(2));
      }
    } else if (i > rsiPeriod) {
      avgGain = (avgGain * (rsiPeriod - 1) + gains[i]) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + losses[i]) / rsiPeriod;

      if (avgLoss === 0) {
        rsi = avgGain === 0 ? 50 : 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi = parseFloat(Math.min(100, Math.max(0, 100 - (100 / (1 + rs)))).toFixed(2));
      }
    }

    sum50 += c.close;
    if (i >= 50) {
      sum50 -= candles[i - 50].close;
    }
    const dma50 = i >= 49 ? parseFloat((sum50 / 50).toFixed(2)) : null;

    sum200 += c.close;
    if (i >= 200) {
      sum200 -= candles[i - 200].close;
    }
    const dma200 = i >= 199 ? parseFloat((sum200 / 200).toFixed(2)) : null;

    result[i] = {
      index: i,
      date: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      changePercent: changePct,
      indicators: {
        rsi,
        dma50,
        dma200,
      },
    };
  }

  return result;
}
