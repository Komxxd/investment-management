import { calculateXIRR } from './xirr.service';
import { fetchPrices } from '../prices/prices.service';
import type { Stock, SoldStock, LivePrice } from '../../shared/types';

export interface PortfolioSummaryStats {
  totalStocks: number;
  maxNetInvested: number;
  totalInvestment: number;
  totalCurrentValue: number;
  totalUnrealizedPnL: number;
  unrealizedPnLPercent: number;
  totalRealizedPnL: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalDayGain: number;
  totalDayGainPercent: number;
  totalDividend: number;
  totalBrokerage: number;
  totalGovtTax: number;
  xirr: number;
}

export function calculatePortfolioStats(
  stocks: Stock[],
  soldStocks: SoldStock[],
  livePrices: Record<string, LivePrice>,
  usdToInrRate: number = 1
) {
  const allSymbols = [...new Set([
    ...stocks.map(s => s.symbol),
    ...soldStocks.map(s => s.symbol),
  ])].sort();

  let totalInvestment = 0;
  let totalCurrentValue = 0;
  let totalUnrealizedPnL = 0;
  let totalRealizedPnL = 0;
  let totalBrokerage = 0;
  let totalGovtTax = 0;
  let totalStocks = 0;
  let totalDividend = 0;
  let totalDayGain = 0;
  const allTransactions: { date: number; amount: number; activeInvestedDelta: number }[] = [];

  const symbolGroups = allSymbols.map(symbol => {
    const buys = stocks.filter(s => s.symbol === symbol);
    const sells = soldStocks.filter(s => s.symbol === symbol);

    // totalBoughtQty is computed after FIFO processing to include bonus/split adjustments
    const totalSoldQty = sells.reduce((sum, s) => sum + Number(s.quantity), 0);

    const events: { type: 'BUY' | 'BONUS' | 'SPLIT' | 'DIVIDEND' | 'SELL'; date: number; raw: any }[] = [];
    
    buys.forEach(b => {
      if (Number(b.entry_price) === 0) events.push({ type: 'BONUS', date: new Date(b.entry_date).getTime(), raw: b });
      else if (Number(b.entry_price) === -1) events.push({ type: 'SPLIT', date: new Date(b.entry_date).getTime(), raw: b });
      else if (Number(b.entry_price) === -2) events.push({ type: 'DIVIDEND', date: new Date(b.entry_date).getTime(), raw: b });
      else events.push({ type: 'BUY', date: new Date(b.entry_date).getTime(), raw: b });
    });
    sells.forEach(s => events.push({ type: 'SELL', date: new Date(s.exit_date).getTime(), raw: s }));

    events.sort((a, b) => a.date - b.date || (a.type === 'SELL' ? 1 : -1));

    const openLots: any[] = [];
    const stockCashFlows: { date: number; amount: number; activeInvestedDelta: number }[] = [];
    let stockTotalDividend = 0;
    
    events.forEach(ev => {
      if (ev.type === 'BUY') {
        const b = ev.raw as Stock;
        const qty = Number(b.quantity);
        const price = Number(b.entry_price);
        openLots.push({
          id: b.id,
          buy: b,
          originalDate: b.entry_date,
          originalQty: qty,
          originalPrice: price,
          buyQty: qty,
          entryPrice: price,
          cost: qty * price,
          remainingQty: qty,
          soldQty: 0,
          realizedPnL: 0,
          history: [{ id: b.id, type: 'BUY', date: b.entry_date, qty, price, brokerage: Number(b.brokerage || 0), govtTax: Number(b.govt_tax || 0) }],
          matchedSells: []
        });

        stockCashFlows.push({
          date: new Date(b.entry_date).getTime(),
          amount: -((qty * price) + Number(b.brokerage || 0) + Number(b.govt_tax || 0)),
          activeInvestedDelta: qty * price
        });
      } else if (ev.type === 'SELL') {
        const s = ev.raw as SoldStock;
        let needed = Number(s.quantity);
        const exitPrice = Number(s.exit_price);
        
        const sellCashFlow = {
          date: new Date(s.exit_date).getTime(),
          amount: (needed * exitPrice) - Number(s.brokerage || 0) - Number(s.govt_tax || 0),
          activeInvestedDelta: 0
        };
        stockCashFlows.push(sellCashFlow);
        
        for (const lot of openLots) {
          if (needed <= 0) break;
          if (lot.remainingQty <= 0) continue;
          
          const takeQty = Math.min(needed, lot.remainingQty);
          const proceeds = takeQty * exitPrice;
          
          const allocatedBrokerage = (takeQty / Number(s.quantity)) * Number(s.brokerage || 0);
          const allocatedGovtTax = (takeQty / Number(s.quantity)) * Number(s.govt_tax || 0);

          const realPnL = takeQty * (exitPrice - lot.entryPrice);
          sellCashFlow.activeInvestedDelta -= (takeQty * lot.entryPrice);
          
          lot.matchedSells.push({
            sellId: s.id,
            exit_date: s.exit_date,
            quantity: takeQty,
            exit_price: exitPrice,
            proceeds,
            realizedPnL: realPnL,
            brokerage: allocatedBrokerage,
            govtTax: allocatedGovtTax
          });
          
          lot.soldQty += takeQty;
          lot.remainingQty -= takeQty;
          lot.realizedPnL += realPnL;
          needed -= takeQty;
        }
      } else if (ev.type === 'BONUS') {
        const b = ev.raw as Stock;
        const bonusQty = Number(b.quantity);
        const totalOpen = openLots.reduce((sum, lot) => sum + lot.remainingQty, 0);
        
        (ev as any).totalShares = totalOpen;
        if (totalOpen > 0) {
          openLots.forEach(lot => {
            if (lot.remainingQty > 0) {
              const share = bonusQty * (lot.remainingQty / totalOpen);
              lot.buyQty += share;
              lot.remainingQty += share;
              lot.entryPrice = lot.cost / lot.buyQty;
              lot.history.push({ id: b.id, type: 'BONUS', date: b.entry_date, qty: share });
            }
          });
        }
      } else if (ev.type === 'SPLIT') {
        const b = ev.raw as Stock;
        const multiplier = Number(b.quantity);
        const totalOpen = openLots.reduce((sum, lot) => sum + lot.remainingQty, 0);
        
        (ev as any).totalShares = totalOpen;
        openLots.forEach(lot => {
          if (lot.remainingQty > 0) {
            lot.buyQty *= multiplier;
            lot.remainingQty *= multiplier;
            lot.entryPrice = lot.cost / lot.buyQty;
            lot.history.push({ id: b.id, type: 'SPLIT', date: b.entry_date, qty: multiplier });
          }
        });
      } else if (ev.type === 'DIVIDEND') {
        const b = ev.raw as Stock;
        const dividendPerShare = Number(b.quantity);
        let totalDividendReceived = 0;
        let eligibleShares = 0;
        
        openLots.forEach(lot => {
          if (lot.remainingQty > 0) {
            eligibleShares += lot.remainingQty;
            const dividendAmount = lot.remainingQty * dividendPerShare;
            totalDividendReceived += dividendAmount;
            lot.realizedPnL += dividendAmount;
            
            lot.matchedSells.push({
              sellId: b.id,
              type: 'DIVIDEND',
              exit_date: b.entry_date,
              quantity: lot.remainingQty,
              exit_price: dividendPerShare,
              proceeds: dividendAmount,
              realizedPnL: dividendAmount
            });
          }
        });
        
        (ev as any).totalShares = eligibleShares;
        (ev as any).totalAmount = totalDividendReceived;
        
        if (totalDividendReceived > 0) {
          stockTotalDividend += totalDividendReceived;
          stockCashFlows.push({ date: new Date(b.entry_date).getTime(), amount: totalDividendReceived, activeInvestedDelta: 0 });
        }
      }
    });

    const fallbackPrice = buys.length > 0 ? Number(buys[buys.length - 1].entry_price) : 0;
    const livePrice = livePrices[symbol]?.price !== undefined ? livePrices[symbol].price : fallbackPrice;

    const fifoBuyLots = openLots.map(lot => {
      const status = lot.remainingQty === lot.originalQty ? 'OPEN' : (lot.remainingQty > 0 ? 'PARTIALLY_SOLD' : 'CLOSED');
      const unrealized = lot.remainingQty > 0 ? (lot.remainingQty * livePrice) - (lot.remainingQty * lot.entryPrice) : 0;
      const unrealizedPct = lot.remainingQty > 0 && lot.entryPrice > 0 ? (unrealized / (lot.remainingQty * lot.entryPrice)) * 100 : 0;
      return { ...lot, status, unrealized, unrealizedPct };
    });

    const netQty = openLots.reduce((sum, lot) => sum + lot.remainingQty, 0);
    const totalBoughtQty = openLots.reduce((sum, lot) => sum + lot.buyQty, 0);
    const netCostBasis = openLots.reduce((sum, lot) => sum + (lot.remainingQty * lot.entryPrice), 0);
    const avgBuyPrice = netQty > 0 ? netCostBasis / netQty : 0;
    const currentValue = netQty * livePrice;
    
    const unrealizedPnL = currentValue - netCostBasis;
    const unrealizedPnLPct = netCostBasis > 0 ? (unrealizedPnL / netCostBasis) * 100 : 0;

    const realizedPnL = openLots.reduce((sum, lot) => sum + lot.realizedPnL, 0);
    const totalInvestedForRealized = openLots.reduce((sum, lot) => sum + (lot.buyQty * lot.entryPrice), 0);
    const realizedPnLPct = totalInvestedForRealized > 0 ? (realizedPnL / totalInvestedForRealized) * 100 : 0;

    const symBrokerage = buys.reduce((sum, b) => sum + Number(b.brokerage || 0), 0) + sells.reduce((sum, s) => sum + Number(s.brokerage || 0), 0);
    const symGovtTax = buys.reduce((sum, b) => sum + Number(b.govt_tax || 0), 0) + sells.reduce((sum, s) => sum + Number(s.govt_tax || 0), 0);

    const totalPnL = unrealizedPnL + realizedPnL - symBrokerage - symGovtTax;
    const totalPnLPct = netCostBasis > 0 ? (totalPnL / netCostBasis) * 100 : 0;

    const dayGain = livePrices[symbol]?.change !== undefined ? (livePrices[symbol].change! * netQty) : 0;
    const previousCloseValue = currentValue - dayGain;

    const xirrCashFlows = stockCashFlows.map(cf => ({ date: cf.date, amount: cf.amount }));
    if (currentValue > 0 || xirrCashFlows.length > 0) {
      xirrCashFlows.push({ date: Date.now(), amount: currentValue });
    }
    const xirr = calculateXIRR(xirrCashFlows);

    const currency = livePrices[symbol]?.currency || 'INR';
    const convRate = currency.toUpperCase() === 'USD' ? usdToInrRate : 1;

    if (netQty > 0) {
      totalStocks++;
      totalInvestment += netCostBasis * convRate;
      totalCurrentValue += currentValue * convRate;
      totalUnrealizedPnL += unrealizedPnL * convRate;
      totalDayGain += dayGain * convRate;
    }
    totalRealizedPnL += realizedPnL * convRate;
    totalBrokerage += symBrokerage * convRate;
    totalGovtTax += symGovtTax * convRate;
    totalDividend += stockTotalDividend * convRate;

    stockCashFlows.forEach(cf => {
      allTransactions.push({ 
        date: cf.date, 
        amount: cf.amount * convRate, 
        activeInvestedDelta: cf.activeInvestedDelta * convRate 
      });
    });

    return {
      symbol,
      netQty,
      avgBuyPrice,
      netCostBasis,
      livePrice,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPct,
      realizedPnL,
      realizedPnLPct,
      totalDividend: stockTotalDividend,
      brokerage: symBrokerage,
      govtTax: symGovtTax,
      totalPnL,
      totalPnLPct,
      xirr,
      fifoBuyLots,
      totalBoughtQty,
      totalSoldQty,
      liveData: livePrices[symbol] || null,
      events,
      cashFlows: stockCashFlows
    };
  });

  allTransactions.sort((a, b) => a.date - b.date);
  let maxNetInvested = 0;
  let currentInvested = 0;
  allTransactions.forEach(tx => {
    currentInvested += tx.activeInvestedDelta;
    if (currentInvested > maxNetInvested) maxNetInvested = currentInvested;
  });

  const homeXirrCashFlows = allTransactions.map(t => ({ date: t.date, amount: t.amount }));
  if (totalCurrentValue > 0 || homeXirrCashFlows.length > 0) {
    homeXirrCashFlows.push({ date: Date.now(), amount: totalCurrentValue });
  }
  const xirr = calculateXIRR(homeXirrCashFlows);

  const totalPnL = totalUnrealizedPnL + totalRealizedPnL - totalBrokerage - totalGovtTax;
  const totalPnLPercent = maxNetInvested > 0 ? (totalPnL / maxNetInvested) * 100 : 0;
  const unrealizedPnLPercent = totalInvestment > 0 ? (totalUnrealizedPnL / totalInvestment) * 100 : 0;
  const totalPreviousClose = totalCurrentValue - totalDayGain;
  const totalDayGainPercent = totalPreviousClose > 0 ? (totalDayGain / totalPreviousClose) * 100 : 0;

  const summary: PortfolioSummaryStats = {
    totalStocks,
    maxNetInvested,
    totalInvestment,
    totalCurrentValue,
    totalUnrealizedPnL,
    unrealizedPnLPercent,
    totalRealizedPnL,
    totalPnL,
    totalPnLPercent,
    totalDayGain,
    totalDayGainPercent,
    totalDividend,
    totalBrokerage,
    totalGovtTax,
    xirr
  };

  return { summary, symbolGroups };
}
