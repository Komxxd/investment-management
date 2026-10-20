import {
  syncStockData,
  syncStockHistory,
  syncMultipleStocks,
  StockIndicatorResult,
  computeWildersRSI,
  computeSMA,
} from './data-storage.service';

export interface IndicatorResult {
  rsi: number | null;   // RSI(14) in range [0, 100]
  dma50: number | null; // 50-day simple moving average of closing prices
  dma200: number | null;// 200-day simple moving average of closing prices
  candlesCount?: number;
  lastUpdated?: string;
  source?: string;
}

/**
 * Fetch technical indicators for multiple symbols using the local incremental data store.
 */
export async function fetchIndicators(
  symbols: string[],
  requestedIndicators: string[] = ['rsi', 'dma50', 'dma200'],
  force: boolean = false
): Promise<Record<string, IndicatorResult>> {
  if (!symbols || symbols.length === 0) return {};

  const synced = await syncMultipleStocks(symbols, force);
  const result: Record<string, IndicatorResult> = {};

  for (const [sym, data] of Object.entries(synced)) {
    result[sym] = {
      rsi: requestedIndicators.includes('rsi') ? data.rsi : null,
      dma50: requestedIndicators.includes('dma50') ? data.dma50 : null,
      dma200: requestedIndicators.includes('dma200') ? data.dma200 : null,
      candlesCount: data.candlesCount,
      lastUpdated: data.lastUpdated,
      source: 'local_incremental_cache',
    };
  }

  return result;
}

export { syncStockData, syncStockHistory, syncMultipleStocks };
