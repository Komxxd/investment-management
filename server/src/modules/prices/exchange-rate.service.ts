import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// In-memory exchange rate cache with 5-minute TTL
const rateCache: Map<string, { rate: number; timestamp: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getExchangeRate(from: string = 'USD', to: string = 'INR'): Promise<number> {
  from = from.toUpperCase();
  to = to.toUpperCase();

  if (from === to) {
    return 1;
  }

  const cacheKey = `${from}${to}`;
  const now = Date.now();
  const cached = rateCache.get(cacheKey);

  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.rate;
  }

  try {
    // Yahoo Finance currency pair format: USDINR=X
    const symbol = `${from}${to}=X`;
    const quote = await yahooFinance.quote(symbol);
    
    if (quote && (quote as any).regularMarketPrice) {
      const rate = (quote as any).regularMarketPrice;
      rateCache.set(cacheKey, { rate, timestamp: now });
      rateCache.set(`${to}${from}`, { rate: 1 / rate, timestamp: now });
      return rate;
    }
  } catch (error) {
    console.error(`Failed to fetch exchange rate for ${from} to ${to}:`, error);
  }

  // Fallback to cached inverse if available, or return 1 as a safe fallback
  const inverseCached = rateCache.get(`${to}${from}`);
  if (inverseCached) {
    return 1 / inverseCached.rate;
  }
  
  return 1;
}
