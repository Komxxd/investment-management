import {
  syncStockData,
  syncStockHistory,
  syncMultipleStocks,
  StockIndicatorResult,
  computeWildersRSI,
  computeRSISeries,
  detectRSIDivergenceSeries,
  computeSMA,
  computeEMA,
  computeEMASeries,
  computeMACD,
  computeMACDSeries,
  MACDResult,
  MACDSeriesResult,
  computeBollingerBands,
  computeBollingerBandsSeries,
  BollingerBandsResult,
  BollingerBandsSeriesResult,
  computeVWAP,
  computeVWAPSeries,
  VWAPResult,
  VWAPSeriesResult,
  computeOBV,
  computeOBVSeries,
  OBVResult,
  OBVSeriesResult,
  IndicatorCalculationOptions,
} from './data-storage.service';

export interface IndicatorResult {
  rsi: number | null;   // RSI(14) in range [0, 100]
  dma50: number | null; // 50-day simple moving average of closing prices
  dma200: number | null;// 200-day simple moving average of closing prices
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
  source?: string;
}

/**
 * Fetch technical indicators for multiple symbols using the local incremental data store.
 */
export async function fetchIndicators(
  symbols: string[],
  requestedIndicators: string[] = [
    'rsi',
    'dma50',
    'dma200',
    'ema20',
    'ema50',
    'ema200',
    'rsiDivergence',
    'macd',
    'macdSignal',
    'macdHist',
    'bbUpper',
    'bbMiddle',
    'bbLower',
    'bbBandwidth',
    'bbPercentB',
    'vwap',
    'avgVolume',
    'obv',
    'obvSignal',
  ],
  force: boolean = false,
  options: IndicatorCalculationOptions = {}
): Promise<Record<string, IndicatorResult>> {
  if (!symbols || symbols.length === 0) return {};

  const synced = await syncMultipleStocks(symbols, force, undefined, 'day', options);
  const result: Record<string, IndicatorResult> = {};

  for (const [sym, data] of Object.entries(synced)) {
    result[sym] = {
      rsi: requestedIndicators.includes('rsi') ? data.rsi : null,
      dma50: requestedIndicators.includes('dma50') ? data.dma50 : null,
      dma200: requestedIndicators.includes('dma200') ? data.dma200 : null,
      ema20: requestedIndicators.includes('ema20') ? (data.ema20 ?? null) : null,
      ema50: requestedIndicators.includes('ema50') ? (data.ema50 ?? null) : null,
      ema200: requestedIndicators.includes('ema200') ? (data.ema200 ?? null) : null,
      rsiDivergence: data.rsiDivergence ?? null,
      rsiBullishDiv: data.rsiBullishDiv ?? 0,
      rsiBearishDiv: data.rsiBearishDiv ?? 0,
      macd: requestedIndicators.includes('macd') ? (data.macd ?? null) : null,
      macdSignal: requestedIndicators.includes('macdSignal') ? (data.macdSignal ?? null) : null,
      macdHist: requestedIndicators.includes('macdHist') ? (data.macdHist ?? null) : null,
      bbUpper: requestedIndicators.includes('bbUpper') ? (data.bbUpper ?? null) : null,
      bbMiddle: requestedIndicators.includes('bbMiddle') ? (data.bbMiddle ?? null) : null,
      bbLower: requestedIndicators.includes('bbLower') ? (data.bbLower ?? null) : null,
      bbBandwidth: requestedIndicators.includes('bbBandwidth') ? (data.bbBandwidth ?? null) : null,
      bbPercentB: requestedIndicators.includes('bbPercentB') ? (data.bbPercentB ?? null) : null,
      vwap: requestedIndicators.includes('vwap') ? (data.vwap ?? null) : null,
      avgVolume: requestedIndicators.includes('avgVolume') ? (data.avgVolume ?? null) : null,
      obv: requestedIndicators.includes('obv') ? (data.obv ?? null) : null,
      obvSignal: requestedIndicators.includes('obvSignal') ? (data.obvSignal ?? null) : null,
      candlesCount: data.candlesCount,
      lastUpdated: data.lastUpdated,
      source: 'local_incremental_cache',
    };
  }

  return result;
}

export {
  syncStockData,
  syncStockHistory,
  syncMultipleStocks,
  computeEMA,
  computeEMASeries,
  computeRSISeries,
  detectRSIDivergenceSeries,
  computeMACD,
  computeMACDSeries,
  computeBollingerBands,
  computeBollingerBandsSeries,
  computeVWAP,
  computeVWAPSeries,
  computeOBV,
  computeOBVSeries,
};
