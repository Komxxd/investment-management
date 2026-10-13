import YahooFinance from 'yahoo-finance2';
import { Stock, SoldStock } from '../../shared/types';

const yahooFinance = new YahooFinance();

export interface HistoricalDataPoint {
  date: number; // Unix timestamp
  value: number;
  invested: number;
  pnlPercent?: number;
  pnl?: number;
}

export async function calculateHistoricalPerformance(
  stocks: Stock[],
  soldStocks: SoldStock[],
  startDate: Date,
  endDate: Date = new Date()
): Promise<HistoricalDataPoint[]> {
  const symbols = [...new Set([...stocks.map(s => s.symbol), ...soldStocks.map(s => s.symbol)])];
  
  if (symbols.length === 0) {
    return [];
  }

  // Fetch historical data for all symbols
  const historicalData: Record<string, any[]> = {};
  
  await Promise.all(symbols.map(async (symbol) => {
    try {
      const result = await yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      });
      historicalData[symbol] = result.quotes || [];
    } catch (e) {
      console.warn(`Failed to fetch historical data for ${symbol}:`, e);
      historicalData[symbol] = [];
    }
  }));

  // Build a timeline of all days from start to end
  const timeline: number[] = [];
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    timeline.push(current.getTime());
    current.setDate(current.getDate() + 1);
  }

  // Pre-process transactions to find active quantity and cost basis per symbol per day
  // To do this efficiently, we track events.
  
  interface TxEvent {
    date: number;
    symbol: string;
    type: 'buy' | 'sell';
    qty: number;
    price: number;
    brokerage?: number;
    govtTax?: number;
  }
  
  const txEvents: TxEvent[] = [];
  stocks.forEach(s => {
    if (Number(s.entry_price) > 0) {
      txEvents.push({
        date: new Date(s.entry_date).getTime(),
        symbol: s.symbol,
        type: 'buy',
        qty: Number(s.quantity),
        price: Number(s.entry_price),
        brokerage: Number(s.brokerage || 0),
        govtTax: Number(s.govt_tax || 0)
      });
    }
  });
  soldStocks.forEach(s => {
    txEvents.push({
      date: new Date(s.exit_date).getTime(),
      symbol: s.symbol,
      type: 'sell',
      qty: Number(s.quantity),
      price: Number(s.exit_price),
      brokerage: Number(s.brokerage || 0),
      govtTax: Number(s.govt_tax || 0)
    });
  });

  txEvents.sort((a, b) => a.date - b.date);

  // Map historical data by date string for easy lookup
  // We forward-fill prices if a day is missing (e.g. weekend)
  const priceMaps: Record<string, Record<string, number>> = {};
  symbols.forEach(symbol => {
    priceMaps[symbol] = {};
    let lastPrice = 0; // We'll keep track of the last known price to forward fill
    
    // We actually need to iterate through the timeline to forward fill properly
    let dataIdx = 0;
    const data = historicalData[symbol];
    
    timeline.forEach(time => {
      const dateStr = new Date(time).toISOString().split('T')[0];
      
      // Advance data index if we have data for this day or earlier
      while (dataIdx < data.length) {
        // Compare calendar dates (YYYY-MM-DD) instead of strict timestamps to avoid timezone shifts
        const yDateStr = new Date(data[dataIdx].date).toISOString().split('T')[0];
        
        if (yDateStr <= dateStr) {
          lastPrice = data[dataIdx].close;
          dataIdx++;
        } else {
          break;
        }
      }
      
      priceMaps[symbol][dateStr] = lastPrice;
    });
  });

  // Calculate daily portfolio value
  const result: HistoricalDataPoint[] = [];
  
  const activeLots: Record<string, { qty: number, price: number }[]> = {};
  symbols.forEach(s => activeLots[s] = []);
  
  let txIdx = 0;
  let cumulativeRealizedPnL = 0;
  let cumulativeBrokerage = 0;
  let cumulativeGovtTax = 0;
  let runningMaxNetInvested = 0;
  let currentInvested = 0;

  timeline.forEach(time => {
    // Process any transactions that happened up to this day
    while (txIdx < txEvents.length && txEvents[txIdx].date <= time + 86400000 - 1) {
      const tx = txEvents[txIdx];
      
      cumulativeBrokerage += tx.brokerage || 0;
      cumulativeGovtTax += tx.govtTax || 0;
      
      if (tx.type === 'buy') {
        activeLots[tx.symbol].push({ qty: tx.qty, price: tx.price });
        const buyCost = (tx.qty * tx.price) + (tx.brokerage || 0) + (tx.govtTax || 0);
        currentInvested += buyCost;
        if (currentInvested > runningMaxNetInvested) runningMaxNetInvested = currentInvested;
      } else {
        const sellProceeds = (tx.qty * tx.price) - (tx.brokerage || 0) - (tx.govtTax || 0);
        currentInvested -= sellProceeds;
        
        // FIFO sell
        let qtyToSell = tx.qty;
        while (qtyToSell > 0 && activeLots[tx.symbol].length > 0) {
          if (activeLots[tx.symbol][0].qty <= qtyToSell) {
            const lot = activeLots[tx.symbol][0];
            cumulativeRealizedPnL += (tx.price - lot.price) * lot.qty;
            qtyToSell -= lot.qty;
            activeLots[tx.symbol].shift();
          } else {
            const lot = activeLots[tx.symbol][0];
            cumulativeRealizedPnL += (tx.price - lot.price) * qtyToSell;
            lot.qty -= qtyToSell;
            qtyToSell = 0;
          }
        }
      }
      txIdx++;
    }

    // Now calculate total value and invested for this day
    let dailyValue = 0;
    let dailyInvested = 0;
    const dateStr = new Date(time).toISOString().split('T')[0];

    symbols.forEach(symbol => {
      const lots = activeLots[symbol];
      if (lots.length > 0) {
        const totalQty = lots.reduce((sum, lot) => sum + lot.qty, 0);
        const costBasis = lots.reduce((sum, lot) => sum + (lot.qty * lot.price), 0);
        
        const price = priceMaps[symbol][dateStr] || 0;
        
        // If price is 0 (meaning we haven't seen any historical price yet for this symbol),
        // we fallback to the cost basis so it doesn't show a 100% loss.
        const currentVal = price > 0 ? totalQty * price : costBasis;
        
        dailyValue += currentVal;
        dailyInvested += costBasis;
      }
    });

    // Calculate PnL Percentage
    const dailyUnrealizedPnL = dailyValue - dailyInvested;
    const dailyTotalPnL = dailyUnrealizedPnL + cumulativeRealizedPnL - cumulativeBrokerage - cumulativeGovtTax;
    const pnlPercent = runningMaxNetInvested > 0 ? (dailyTotalPnL / runningMaxNetInvested) * 100 : 0;

    // Only add to result if there's an active portfolio or we've started tracking
    // To avoid leading zeroes, we can skip days before the first transaction
    if (dailyInvested > 0 || txIdx > 0) {
      result.push({
        date: time,
        value: dailyValue,
        invested: dailyInvested,
        pnlPercent,
        pnl: dailyTotalPnL
      });
    }
  });

  return result;
}
