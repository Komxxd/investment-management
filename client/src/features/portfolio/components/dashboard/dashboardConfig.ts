export interface DashboardOption {
  id: string;
  label: string;
}

export interface PortfolioFilterState {
  filterType: 'open' | 'closed' | 'all';
  searchSelectedSymbols: string[];
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
}

export interface DailyExecutionEntry {
  action: string;
  quantity: number;
  price: number;
  timestamp: number;
  strategyName?: string | null;
}

export interface Stock {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  entry_price: number;
  brokerage?: number;
  govt_tax?: number;
  entry_date: string;
}

export interface SoldStock {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  exit_price: number;
  brokerage?: number;
  govt_tax?: number;
  exit_date: string;
}

export interface IndicatorData {
  rsi: number | null;
  dma50: number | null;
  dma200: number | null;
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
  source?: string;
}

export const ALL_SUMMARY_STATS: DashboardOption[] = [
  { id: 'totalStocks', label: 'Total Stocks' },
  { id: 'maxNetInvested', label: 'Max Invested' },
  { id: 'netInvested', label: 'Net Invested' },
  { id: 'currentValue', label: 'Current Value' },
  { id: 'unrealizedPnL', label: 'Unrealized P&L' },
  { id: 'realizedPnL', label: 'Realized P&L' },
  { id: 'totalDividend', label: 'Total Dividend' },
  { id: 'brokerage', label: 'Total Brokerage & Tax' },
  { id: 'totalPnL', label: 'Total P&L' },
  { id: 'dayGain', label: 'Day Gain' },
  { id: 'xirr', label: 'XIRR' },
];

export const ALL_COLUMNS: DashboardOption[] = [
  { id: 'symbol', label: 'Symbol' },
  { id: 'netQty', label: 'Net Qty' },
  { id: 'avgBuyPrice', label: 'Avg Buy' },
  { id: 'netCostBasis', label: 'Invested' },
  { id: 'livePrice', label: 'Live Price' },
  { id: 'dma50', label: '50 DMA' },
  { id: 'dma200', label: '200 DMA' },
  { id: 'ema20', label: '20 EMA' },
  { id: 'ema50', label: '50 EMA' },
  { id: 'ema200', label: '200 EMA' },
  { id: 'rsi', label: 'RSI (14)' },
  { id: 'macd', label: 'MACD (12, 26, 9)' },
  { id: 'bollinger', label: 'Bollinger (20, 2)' },
  { id: 'vwap', label: 'VWAP' },
  { id: 'obv', label: 'OBV' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'currentValue', label: 'Current Value' },
  { id: 'unrealizedPnL', label: 'Unrealized PnL' },
  { id: 'unrealizedPnLPct', label: 'Unrealized %' },
  { id: 'realizedPnL', label: 'Realized PnL' },
  { id: 'realizedPnLPct', label: 'Realized %' },
  { id: 'totalDividend', label: 'Dividend' },
  { id: 'brokerage', label: 'Brokerage' },
  { id: 'govtTax', label: 'Govt Tax' },
  { id: 'totalPnL', label: 'Total PnL' },
  { id: 'totalPnLPct', label: 'Total PnL %' },
  { id: 'xirr', label: 'XIRR' },
  { id: 'portfolioWeight', label: '% Invested' },
  { id: 'currentValueWeight', label: '% Current Value' },
  { id: 'priceChange', label: 'Change' },
  { id: 'changePercent', label: 'Change %' },
  { id: 'dayHigh', label: 'Day High' },
  { id: 'dayLow', label: 'Day Low' },
  { id: '52wkHigh', label: '52W High' },
  { id: '52wkLow', label: '52W Low' },
  { id: 'marketCap', label: 'Mkt Cap' },
  { id: 'volume', label: 'Volume' },
  { id: 'avgVolume', label: 'Avg Volume (3M)' },
  { id: 'tradeValue', label: 'Trade Value' },
  { id: 'dayGain', label: 'Day Gain' },
  { id: 'dayGainPct', label: 'Day Gain %' },
];

export const INDICATOR_COLUMN_IDS = [
  'dma50',
  'dma200',
  'ema20',
  'ema50',
  'ema200',
  'rsi',
  'macd',
  'bollinger',
  'vwap',
  'obv',
] as const;

export const DEFAULT_VISIBLE_COLUMNS = new Set(
  ALL_COLUMNS.map((c) => c.id).filter(
    (id) => !(INDICATOR_COLUMN_IDS as readonly string[]).includes(id)
  )
);

/** Preferred neighbor columns after which newly added columns should be inserted. */
export const COLUMN_INSERT_ANCHORS: Record<string, string[]> = {
  unrealizedPnLPct: ['unrealizedPnL'],
  realizedPnLPct: ['realizedPnL'],
  totalPnLPct: ['totalPnL'],
  dma50: ['livePrice'],
  dma200: ['dma50', 'livePrice'],
  ema20: ['dma200', 'livePrice'],
  ema50: ['dma200', 'livePrice'],
  ema200: ['dma200', 'livePrice'],
  rsi: ['dma200', 'livePrice'],
  macd: ['rsi', 'dma200', 'livePrice'],
  bollinger: ['macd', 'rsi', 'livePrice'],
  vwap: ['bollinger', 'macd', 'livePrice'],
  obv: ['vwap', 'bollinger', 'livePrice'],
  strategy: ['rsi', 'livePrice'],
};

