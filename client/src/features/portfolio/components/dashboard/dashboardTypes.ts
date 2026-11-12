import type { IndicatorData } from './dashboardConfig';

export interface LivePriceData {
  symbol?: string;
  name?: string;
  price: number;
  change?: number;
  changePercent?: number;
  currency?: string;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  volume?: number;
  avgVolume?: number;
  dma50?: number;
  dma200?: number;
}

export interface FifoHistoryEvent {
  id?: string;
  type: 'BUY' | 'BONUS' | 'SPLIT' | 'DIVIDEND' | string;
  date: string;
  qty: number;
  price?: number;
  brokerage?: number;
  govtTax?: number;
}

export interface FifoMatchedSell {
  sellId: string;
  type?: 'SELL' | 'DIVIDEND' | string;
  exit_date: string;
  quantity: number;
  exit_price: number;
  proceeds: number;
  brokerage?: number;
  govtTax?: number;
  realizedPnL: number;
}

export interface FifoBuyLot {
  buy: {
    id: string;
    entry_date: string;
    [key: string]: unknown;
  };
  buyQty: number;
  soldQty: number;
  remainingQty: number;
  entryPrice: number;
  cost: number;
  unrealizedPnL: number;
  unrealizedPct: number;
  realizedPnL: number;
  status: 'CLOSED' | 'PARTIALLY_SOLD' | 'OPEN' | string;
  history?: FifoHistoryEvent[];
  matchedSells: FifoMatchedSell[];
}

export interface SymbolGroup {
  symbol: string;
  netQty: number;
  totalBoughtQty: number;
  totalSoldQty: number;
  avgBuyPrice: number;
  netCostBasis: number;
  totalBuyCost: number;
  currentValue: number;
  livePrice: number;
  liveData?: LivePriceData;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  realizedPnL: number;
  realizedPnLPct: number;
  totalDividend: number;
  brokerage: number;
  govtTax: number;
  totalPnL: number;
  totalPnLPct: number;
  xirr: number;
  fifoBuyLots: FifoBuyLot[];
  cashFlows?: Array<{ date: number; amount: number }>;
  events: Array<{
    type: string;
    date: number;
    totalShares?: number;
    totalAmount?: number;
    raw: {
      entry_date?: string;
      exit_date?: string;
      quantity: number;
      entry_price?: number;
      exit_price?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export type IndicatorsMap = Record<string, IndicatorData>;
export type LivePricesMap = Record<string, LivePriceData>;
