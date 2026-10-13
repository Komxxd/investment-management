import YahooFinance from 'yahoo-finance2';
import type { CorporateEvent, DividendEvent, SplitEvent } from '../../shared/types';

const yahooFinance = new YahooFinance();

/**
 * Fetch corporate actions (dividends + splits) for a single symbol.
 */
export async function fetchCorporateActions(symbol: string): Promise<{ dividends: DividendEvent[]; splits: SplitEvent[] }> {
  const result = await yahooFinance.chart(symbol, { period1: '1990-01-01' });

  let dividends: DividendEvent[] = [];
  let splits: SplitEvent[] = [];

  if (result && result.events) {
    if (result.events.dividends) {
      dividends = Object.values(result.events.dividends).map(d => ({
        date: d.date,
        amount: d.amount,
      }));
    }
    if (result.events.splits) {
      splits = Object.values(result.events.splits).map(s => ({
        date: s.date,
        numerator: s.numerator,
        denominator: s.denominator,
        splitRatio: s.splitRatio,
      }));
    }
  }

  dividends.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  splits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { dividends, splits };
}

/**
 * Fetch corporate events for a single symbol as a flat array.
 */
export async function fetchSymbolEvents(symbol: string): Promise<CorporateEvent[]> {
  try {
    const result = await yahooFinance.chart(symbol, { period1: '1990-01-01' });
    const events: CorporateEvent[] = [];

    if (result && result.events) {
      if (result.events.dividends) {
        events.push(...Object.values(result.events.dividends).map(d => ({
          symbol,
          type: 'DIVIDEND' as const,
          date: d.date,
          amount: d.amount,
        })));
      }
      if (result.events.splits) {
        events.push(...Object.values(result.events.splits).map(s => ({
          symbol,
          type: 'SPLIT' as const,
          date: s.date,
          numerator: s.numerator,
          denominator: s.denominator,
          splitRatio: s.splitRatio,
        })));
      }
    }

    return events;
  } catch (err) {
    console.error(`Failed to fetch corporate actions for ${symbol}:`, err);
    return [];
  }
}

/**
 * Fetch corporate events for multiple symbols at once.
 */
export async function fetchBulkEvents(symbols: string[]): Promise<CorporateEvent[]> {
  const allResults = await Promise.all(symbols.map(fetchSymbolEvents));
  return allResults.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
