import { api } from '../../../services/api/client';
import type { StrategyRule } from '../components/StrategyBuilderModal';

export interface BacktestTrade {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entryDate: string;
  entryPrice: number;
  exitDate?: string;
  exitPrice?: number;
  qty: number;
  totalCost: number;
  totalProceeds?: number;
  pnl?: number;
  pnlPercent?: number;
  holdingPeriodDays?: number;
  status: 'OPEN' | 'CLOSED';
  entryReason: string;
  exitReason?: string;
}

export interface BarIndicators {
  rsi: number | null;
  dma50: number | null;
  dma200: number | null;
}

export interface InitialInvestmentInfo {
  date: string;
  action?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  invested: number;
  qty: number;
  execPrice: number;
  cashRemaining: number;
  initialCapital: number;
  changePercent?: number;
  indicators?: BarIndicators;
}

export interface DailyEquityPoint {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  changePercent?: number;
  indicators?: BarIndicators;
  equity: number;
  cash: number;
  holdingsValue: number;
  heldQty: number;
  stockClose: number;
  benchmarkEquity: number;
  drawdownPercent: number;
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

export interface BacktestRequest {
  symbol: string;
  rules: StrategyRule[];
  strategyId?: string;
  years?: number;
  startDate?: string;
  endDate?: string;
  initialCapital?: number;
  slippagePct?: number;
  feePct?: number;
}

/**
 * Executes a full backtest on the backend for a given symbol and set of strategy rules.
 */
export async function runBacktest(request: BacktestRequest): Promise<BacktestResponse> {
  return api.post('/api/backtest/run', request);
}

export interface BacktestDataRange {
  symbol: string;
  totalCandles: number;
  warmupBars: number;
  dataStartDate: string;
  dataEndDate: string;
  backtestableStartDate: string;
  backtestableEndDate: string;
  availableDates: string[];
}

/**
 * Retrieves the available historical candle range and the backtestable window
 * excluding the warmup buffer for a given symbol.
 */
export async function getBacktestDataRange(symbol: string): Promise<BacktestDataRange> {
  return api.get(`/api/backtest/data-range?symbol=${encodeURIComponent(symbol)}`);
}
