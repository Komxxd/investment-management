import YahooFinance from 'yahoo-finance2';
import { EventEmitter } from 'events';
import type { LivePrice } from '../../shared/types';

const yahooFinance = new YahooFinance();

// In-memory price cache with 30-second TTL
const priceCache: Map<string, { data: LivePrice; timestamp: number }> = new Map();
const CACHE_TTL_MS = 30_000;

export const priceEvents = new EventEmitter();

// Track which symbols are actively being watched by clients
const activeSymbols = new Map<string, number>();

// Register interest in a symbol (increases reference count)
export function watchSymbols(symbols: string[]) {
  symbols.forEach(sym => {
    activeSymbols.set(sym, (activeSymbols.get(sym) || 0) + 1);
  });
}

// Unregister interest in a symbol
export function unwatchSymbols(symbols: string[]) {
  symbols.forEach(sym => {
    const count = activeSymbols.get(sym) || 0;
    if (count <= 1) {
      activeSymbols.delete(sym);
    } else {
      activeSymbols.set(sym, count - 1);
    }
  });
}

/**
 * Fetch live prices for an array of symbols.
 * Uses an in-memory cache to avoid hammering Yahoo for every user.
 */
export async function fetchPrices(symbols: string[]): Promise<Record<string, LivePrice>> {
  const now = Date.now();
  const result: Record<string, LivePrice> = {};
  const uncached: string[] = [];

  // Check cache first
  for (const symbol of symbols) {
    const cached = priceCache.get(symbol);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      result[symbol] = cached.data;
    } else {
      uncached.push(symbol);
    }
  }

  // Fetch uncached symbols from Yahoo
  if (uncached.length > 0) {
    try {
      const quotes = await yahooFinance.quote(uncached);
      const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

      for (const q of quotesArray) {
        if (q && q.symbol && q.regularMarketPrice) {
          const priceData: LivePrice = {
            price: q.regularMarketPrice,
            name: q.shortName || q.longName || (q as any).shortname || (q as any).longname || q.symbol,
            currency: (q as any).currency || undefined,
            change: q.regularMarketChange,
            changePercent: q.regularMarketChangePercent,
            dayHigh: q.regularMarketDayHigh,
            dayLow: q.regularMarketDayLow,
            fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: q.fiftyTwoWeekLow,
            marketCap: q.marketCap,
            volume: q.regularMarketVolume,
            avgVolume: q.averageDailyVolume3Month,
            previousClose: q.regularMarketPreviousClose,
          };

          result[q.symbol] = priceData;
          priceCache.set(q.symbol, { data: priceData, timestamp: now });
        }
      }
    } catch (err) {
      console.error('Yahoo Finance quote error:', err);
    }
  }

  return result;
}

// Global polling loop for active SSE connections
setInterval(async () => {
  const symbolsToFetch = Array.from(activeSymbols.keys());
  if (symbolsToFetch.length > 0) {
    const prices = await fetchPrices(symbolsToFetch);
    priceEvents.emit('prices_updated', prices);
  }
}, 30_000); // Poll every 30s

export async function searchStocks(query: string) {
  const results = await yahooFinance.search(query);
  return results.quotes.map((q: any) => ({
    symbol: q.symbol,
    name: q.shortname || q.longname || q.symbol,
    exchange: q.exchange,
    assetType: q.quoteType
  }));
}
