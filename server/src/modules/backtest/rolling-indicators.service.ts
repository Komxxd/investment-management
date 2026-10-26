import { DailyCandle } from '../prices/data-storage.service';
import { BarMarketData } from './types';

/**
 * Computes rolling technical indicators (RSI-14, DMA50, DMA200, daily change %)
 * chronologically across an array of daily candles in O(N) time.
 *
 * Guarantees STRICT zero-lookahead bias: bar at index `t` only uses data up to `t`.
 */
export function computeRollingIndicators(candles: DailyCandle[]): BarMarketData[] {
  if (!candles || candles.length === 0) return [];

  const n = candles.length;
  const result: BarMarketData[] = new Array(n);

  // Rolling SMA accumulators
  let sum50 = 0;
  let sum200 = 0;

  // Wilder's RSI accumulators
  const rsiPeriod = 14;
  let avgGain = 0;
  let avgLoss = 0;

  // Pre-accumulate first 14 changes for RSI seed
  const gains: number[] = new Array(n).fill(0);
  const losses: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const prevClose = i > 0 ? candles[i - 1].close : c.open;
    const changePct = i > 0 && prevClose > 0 
      ? parseFloat((((c.close - prevClose) / prevClose) * 100).toFixed(2))
      : 0;

    // Track gains & losses for Wilder's RSI
    if (i > 0) {
      const diff = c.close - prevClose;
      gains[i] = diff > 0 ? diff : 0;
      losses[i] = diff < 0 ? Math.abs(diff) : 0;
    }

    // 1. Calculate Wilder's RSI(14)
    let rsi: number | null = null;
    if (i === rsiPeriod) {
      // Seed with simple average of first 14 gains and losses
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
      // Wilder's exponential smoothing
      avgGain = (avgGain * (rsiPeriod - 1) + gains[i]) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + losses[i]) / rsiPeriod;

      if (avgLoss === 0) {
        rsi = avgGain === 0 ? 50 : 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi = parseFloat(Math.min(100, Math.max(0, 100 - (100 / (1 + rs)))).toFixed(2));
      }
    }

    // 2. Calculate Rolling 50-day SMA
    sum50 += c.close;
    if (i >= 50) {
      sum50 -= candles[i - 50].close;
    }
    const dma50 = i >= 49 ? parseFloat((sum50 / 50).toFixed(2)) : null;

    // 3. Calculate Rolling 200-day SMA
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
