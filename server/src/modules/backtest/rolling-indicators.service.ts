import {
  DailyCandle,
  computeEMASeries,
  computeRSISeries,
  detectRSIDivergenceSeries,
  computeMACDSeries,
  computeBollingerBandsSeries,
  computeVWAPSeries,
  computeOBVSeries,
} from '../prices/data-storage.service';
import { BarMarketData } from './types';

interface DailyBaselineState {
  date: string;
  close: number;
  avgGain: number;
  avgLoss: number;
  sum49: number | null;
  sum199: number | null;
  ema12: number | null;
  ema26: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbBandwidth: number | null;
  bbPercentB: number | null;
  vwap: number | null;
  avgVolume: number | null;
  obv: number | null;
  obvSignal: number | null;
  rsiDivergence: 'BULLISH' | 'BEARISH' | null;
  rsiBullishDiv: number;
  rsiBearishDiv: number;
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
  const dailyCloses: number[] = sortedDaily.map((d) => d.close);
  const dailyEma12 = computeEMASeries(dailyCloses, 12);
  const dailyEma26 = computeEMASeries(dailyCloses, 26);
  const dailyEma20 = computeEMASeries(dailyCloses, 20);
  const dailyEma50 = computeEMASeries(dailyCloses, 50);
  const dailyEma200 = computeEMASeries(dailyCloses, 200);
  const dailyRsiSeries = computeRSISeries(dailyCloses, 14);
  const dailyDivSeries = detectRSIDivergenceSeries(sortedDaily, dailyRsiSeries);
  const dailyMacdSeries = computeMACDSeries(dailyCloses, 12, 26, 9);
  const dailyBbSeries = computeBollingerBandsSeries(dailyCloses, 20, 2);
  const dailyVwapSeries = computeVWAPSeries(sortedDaily, 20);
  const dailyObvSeries = computeOBVSeries(sortedDaily, 20);

  for (let i = 0; i < nDaily; i++) {
    const d = sortedDaily[i];

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
        dailyCloses.length >= 49 && i >= 48
          ? dailyCloses.slice(Math.max(0, i - 48), i + 1).reduce((acc, val) => acc + val, 0)
          : null;
      const sum199 =
        dailyCloses.length >= 199 && i >= 198
          ? dailyCloses.slice(Math.max(0, i - 198), i + 1).reduce((acc, val) => acc + val, 0)
          : null;

      dailyStateByDate.set(d.date, {
        date: d.date,
        close: d.close,
        avgGain,
        avgLoss,
        sum49,
        sum199,
        ema12: dailyEma12[i],
        ema26: dailyEma26[i],
        ema20: dailyEma20[i],
        ema50: dailyEma50[i],
        ema200: dailyEma200[i],
        macd: dailyMacdSeries.macd[i],
        macdSignal: dailyMacdSeries.signal[i],
        macdHist: dailyMacdSeries.histogram[i],
        bbUpper: dailyBbSeries.upper[i],
        bbMiddle: dailyBbSeries.middle[i],
        bbLower: dailyBbSeries.lower[i],
        bbBandwidth: dailyBbSeries.bandwidth[i],
        bbPercentB: dailyBbSeries.percentB[i],
        vwap: dailyVwapSeries.vwap[i],
        avgVolume: dailyVwapSeries.avgVolume[i],
        obv: dailyObvSeries.obv[i],
        obvSignal: dailyObvSeries.obvSignal[i],
        rsiDivergence: dailyDivSeries[i] || null,
        rsiBullishDiv: dailyDivSeries[i] === 'BULLISH' ? 1 : 0,
        rsiBearishDiv: dailyDivSeries[i] === 'BEARISH' ? 1 : 0,
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
  const hourlyVwapSeries = computeVWAPSeries(hourlyCandles, 20);
  const hourlyObvSeries = computeOBVSeries(hourlyCandles, 20);
  const result: BarMarketData[] = new Array(hourlyCandles.length);

  for (let i = 0; i < hourlyCandles.length; i++) {
    const c = hourlyCandles[i];
    const barDay = c.date.includes(' ') ? c.date.split(' ')[0] : c.date.split('T')[0];
    const baseline = getPrevDailyBaseline(barDay);

    let rsi: number | null = null;
    let dma50: number | null = null;
    let dma200: number | null = null;
    let ema20: number | null = null;
    let ema50: number | null = null;
    let ema200: number | null = null;
    let macd: number | null = null;
    let macdSignal: number | null = null;
    let macdHist: number | null = null;
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

      // Provisional Daily EMA20
      if (baseline.ema20 != null) {
        const k20 = 2 / (20 + 1);
        ema20 = parseFloat(((p * k20) + (baseline.ema20 * (1 - k20))).toFixed(2));
      }

      // Provisional Daily EMA50
      if (baseline.ema50 != null) {
        const k50 = 2 / (50 + 1);
        ema50 = parseFloat(((p * k50) + (baseline.ema50 * (1 - k50))).toFixed(2));
      }

      // Provisional Daily EMA200
      if (baseline.ema200 != null) {
        const k200 = 2 / (200 + 1);
        ema200 = parseFloat(((p * k200) + (baseline.ema200 * (1 - k200))).toFixed(2));
      }

      // Provisional Daily MACD (12, 26, 9)
      if (baseline.ema12 != null && baseline.ema26 != null) {
        const k12 = 2 / (12 + 1);
        const k26 = 2 / (26 + 1);
        const provEma12 = p * k12 + baseline.ema12 * (1 - k12);
        const provEma26 = p * k26 + baseline.ema26 * (1 - k26);
        macd = parseFloat((provEma12 - provEma26).toFixed(2));
        if (baseline.macdSignal != null) {
          const kSig = 2 / (9 + 1);
          macdSignal = parseFloat((macd * kSig + baseline.macdSignal * (1 - kSig)).toFixed(2));
          macdHist = parseFloat((macd - macdSignal).toFixed(2));
        }
      } else {
        macd = baseline.macd;
        macdSignal = baseline.macdSignal;
        macdHist = baseline.macdHist;
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
        ema20,
        ema50,
        ema200,
        macd,
        macdSignal,
        macdHist,
        bbUpper: baseline ? baseline.bbUpper : null,
        bbMiddle: baseline ? baseline.bbMiddle : null,
        bbLower: baseline ? baseline.bbLower : null,
        bbBandwidth: baseline ? baseline.bbBandwidth : null,
        bbPercentB: baseline ? baseline.bbPercentB : null,
        vwap: hourlyVwapSeries.vwap[i] ?? (baseline ? baseline.vwap : null),
        avgVolume: hourlyVwapSeries.avgVolume[i] ?? (baseline ? baseline.avgVolume : null),
        obv: hourlyObvSeries.obv[i] ?? (baseline ? baseline.obv : null),
        obvSignal: hourlyObvSeries.obvSignal[i] ?? (baseline ? baseline.obvSignal : null),
        rsiDivergence: baseline ? baseline.rsiDivergence : null,
        rsiBullishDiv: baseline ? baseline.rsiBullishDiv : 0,
        rsiBearishDiv: baseline ? baseline.rsiBearishDiv : 0,
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

  const closes = candles.map((c) => c.close);
  const ema20Series = computeEMASeries(closes, 20);
  const ema50Series = computeEMASeries(closes, 50);
  const ema200Series = computeEMASeries(closes, 200);
  const rsiSeries = computeRSISeries(closes, 14);
  const divSeries = detectRSIDivergenceSeries(candles, rsiSeries);
  const macdSeries = computeMACDSeries(closes, 12, 26, 9);
  const bbSeries = computeBollingerBandsSeries(closes, 20, 2);
  const vwapSeries = computeVWAPSeries(candles, 20);
  const obvSeries = computeOBVSeries(candles, 20);

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
        ema20: ema20Series[i],
        ema50: ema50Series[i],
        ema200: ema200Series[i],
        macd: macdSeries.macd[i],
        macdSignal: macdSeries.signal[i],
        macdHist: macdSeries.histogram[i],
        bbUpper: bbSeries.upper[i],
        bbMiddle: bbSeries.middle[i],
        bbLower: bbSeries.lower[i],
        bbBandwidth: bbSeries.bandwidth[i],
        bbPercentB: bbSeries.percentB[i],
        vwap: vwapSeries.vwap[i],
        avgVolume: vwapSeries.avgVolume[i],
        obv: obvSeries.obv[i],
        obvSignal: obvSeries.obvSignal[i],
        rsiDivergence: divSeries[i] || null,
        rsiBullishDiv: divSeries[i] === 'BULLISH' ? 1 : 0,
        rsiBearishDiv: divSeries[i] === 'BEARISH' ? 1 : 0,
      },
    };
  }

  return result;
}
