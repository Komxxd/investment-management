import { createServiceClient } from '../../config/supabase';
import { fetchSymbolEvents } from './corporate-actions.service';
import type { CorporateEvent } from '../../shared/types';

/**
 * Sync corporate actions for all portfolios that have auto_sync enabled.
 * This is called by the cron endpoint.
 */
export async function syncCorporateActions(): Promise<{ totalAdded: number }> {
  const supabase = createServiceClient();

  const { data: portfolios, error: portError } = await supabase
    .from('portfolios')
    .select('id, user_id, auto_sync_corporate_actions')
    .eq('auto_sync_corporate_actions', true);

  if (portError) throw portError;
  if (!portfolios || portfolios.length === 0) {
    return { totalAdded: 0 };
  }

  let totalAdded = 0;

  for (const portfolio of portfolios) {
    const { data: stocks, error: stocksError } = await supabase
      .from('stocks')
      .select('symbol, entry_date')
      .eq('portfolio_id', portfolio.id)
      .gt('entry_price', 0);

    if (stocksError || !stocks || stocks.length === 0) continue;

    const uniqueSymbols = [...new Set(stocks.map((s: any) => s.symbol))];

    // Find earliest buy date per symbol
    const firstBuyDates: Record<string, number> = {};
    stocks.forEach((s: any) => {
      const t = new Date(s.entry_date).getTime();
      if (!firstBuyDates[s.symbol] || t < firstBuyDates[s.symbol]) {
        firstBuyDates[s.symbol] = t;
      }
    });

    // Fetch all corporate events
    const allResults = await Promise.all(uniqueSymbols.map(fetchSymbolEvents));
    const allEvents = allResults.flat();

    // Get existing corporate action records
    const { data: existingActions } = await supabase
      .from('stocks')
      .select('symbol, entry_price, quantity, entry_date')
      .eq('portfolio_id', portfolio.id)
      .lt('entry_price', 0);

    const existingRecords = existingActions || [];

    const isAlreadyAdded = (event: CorporateEvent) => {
      const eventDateString = new Date(event.date).toISOString().split('T')[0];
      return existingRecords.some((ex: any) => {
        if (ex.symbol !== event.symbol) return false;
        const exDateString = new Date(ex.entry_date).toISOString().split('T')[0];
        if (exDateString !== eventDateString) return false;

        if (event.type === 'DIVIDEND' && ex.entry_price === -2) {
          return Number(ex.quantity) === event.amount;
        }
        if (event.type === 'SPLIT' && ex.entry_price === -1) {
          const ratio = (event.numerator ?? 1) / (event.denominator ?? 1);
          return Number(ex.quantity) === ratio;
        }
        return false;
      });
    };

    const inserts: any[] = [];
    for (const event of allEvents) {
      const firstBuy = firstBuyDates[event.symbol];
      if (!firstBuy) continue;

      const actionDate = new Date(event.date).getTime();
      if (actionDate < firstBuy) continue;
      if (isAlreadyAdded(event)) continue;

      let entryPrice = 0;
      let quantity = 0;
      if (event.type === 'DIVIDEND') {
        entryPrice = -2;
        quantity = event.amount ?? 0;
      } else {
        entryPrice = -1;
        quantity = (event.numerator ?? 1) / (event.denominator ?? 1);
      }

      inserts.push({
        portfolio_id: portfolio.id,
        user_id: portfolio.user_id,
        symbol: event.symbol,
        quantity,
        entry_price: entryPrice,
        entry_date: new Date(event.date).toISOString().split('T')[0],
        brokerage: 0,
        govt_tax: 0,
      });
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from('stocks').insert(inserts);
      if (!insertError) {
        totalAdded += inserts.length;
      } else {
        console.error('Error inserting actions for portfolio:', portfolio.id, insertError);
      }
    }
  }

  return { totalAdded };
}
