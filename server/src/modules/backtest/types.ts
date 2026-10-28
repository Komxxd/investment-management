import { DailyCandle } from '../prices/data-storage.service';

export type IndicatorType = 'price' | 'changePct' | 'rsi' | 'dma50' | 'dma200';

export interface StrategyCondition {
  id: string;
  leftIndicator: IndicatorType;
  operator: '<' | '<=' | '>' | '>=' | '==' | 'CROSSINGOVER' | 'CROSSINGUNDER';
  rightType: 'value' | 'indicator';
  rightValue?: number | string;
  rightIndicator?: IndicatorType;
  connector?: 'AND' | 'OR';
}

export interface StrategyRule {
  id?: string;
  name?: string;
  scope?: 'global' | 'stock';
  targetSymbol?: string;
  action: 'BUY' | 'SELL';
  sizingType: 'QTY' | 'VALUE' | 'INCREASE_PCT' | 'DECREASE_PCT';
  sizingValue: number | string;
  conditions: StrategyCondition[];
  enabled?: boolean;
  frequency?: string;
}

export interface BarIndicators {
  rsi: number | null;
  dma50: number | null;
  dma200: number | null;
}

export interface BarMarketData {
  index: number;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePercent: number; // Daily % change from previous close
  indicators: BarIndicators;
}

export interface BacktestSignal {
  barIndex: number;
  date: string;
  action: 'BUY' | 'SELL';
  price: number; // Bar close price when signal triggered
  reason: string;
  ruleName?: string;
  rule?: StrategyRule;
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate?: string;
  exitPrice?: number;
  qty: number;
  totalCost: number;
  totalProceeds?: number;
  pnl?: number;            // Realized profit / loss in currency (₹)
  pnlPercent?: number;     // Realized profit / loss in %
  holdingPeriodDays?: number;
  status: 'OPEN' | 'CLOSED';
  entryReason: string;
  exitReason?: string;
}

export interface InitialInvestmentInfo {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  invested: number;
  qty: number;
  execPrice: number;
  cashRemaining: number;
  initialCapital: number;
}

export interface DailyEquityPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  equity: number;
  cash: number;
  holdingsValue: number;
  heldQty: number;
  stockClose: number;
  benchmarkEquity: number;  // Buy & hold benchmark performance from initial capital
  drawdownPercent: number;  // % drawdown from all-time-high equity up to this day
}

export interface SimulationOptions {
  initialCapital?: number;   // Default 100,000
  slippagePct?: number;      // e.g. 0.0005 (0.05%)
  feePct?: number;           // Transaction cost / tax fee percentage (e.g. 0.001 = 0.1%)
  nominalStartDate?: string; // Backtest simulation start date (skips warmup bars)
  nominalEndDate?: string;   // Backtest simulation end date
}

export interface SimulationResult {
  symbol: string;
  initialCapital: number;
  finalEquity: number;
  cash: number;
  holdingsValue: number;
  heldQty: number;
  initialInvestment?: InitialInvestmentInfo;
  trades: BacktestTrade[];
  equityCurve: DailyEquityPoint[];
}

export interface BacktestSummaryMetrics {
  initialCapital: number;
  finalEquity: number;
  netProfit: number;
  totalReturnPct: number;
  cagrPct: number;
  benchmarkReturnPct: number;
  benchmarkCagrPct: number;
  alphaPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  profitFactor: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  totalTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgTradePnl: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number | null;
  marketExposurePct: number;
  tradingDays: number;
  startDate: string;
  endDate: string;
}

export interface BacktestResponse {
  symbol: string;
  summary: BacktestSummaryMetrics;
  initialInvestment?: InitialInvestmentInfo;
  trades: BacktestTrade[];
  equityCurve: DailyEquityPoint[];
}



