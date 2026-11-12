import { createServiceClient } from '../../config/supabase';
import type { LivePrice } from '../../shared/types';
import { calculatePortfolioStats } from '../calculations/pnl.service';
import { ensureHistoricalCandles, type DailyCandle } from '../prices/data-storage.service';
import { fetchPrices } from '../prices/prices.service';
import { computeRollingIndicators } from '../backtest/rolling-indicators.service';
import { evaluateRuleOnBar } from '../backtest/signal-evaluator.service';
import type { BarMarketData, StrategyRule } from '../backtest/types';
import {
  executeStrategyTrade,
  formatStrategyRow,
  getTodayUtcDate,
  isIndianSymbol,
  isMissingTableError,
  recordSignalTriggeredLog,
  type PersistedStrategyRule,
} from './strategy-execution.service';

export type MarketRegion = 'IN' | 'US';

export interface MarketStatus {
  open: boolean;
  market: MarketRegion;
  marketDate: string;
  minutesOfDay: number;
}

export interface PortfolioPositionSnapshot {
  netQty: number;
  avgBuyPrice: number;
}

export interface RuleMatchResult {
  action: 'BUY' | 'SELL';
  rule: PersistedStrategyRule;
  reason: string;
  overrideSizing?: {
    sizingType: 'QTY' | 'VALUE' | 'INCREASE_PCT' | 'DECREASE_PCT';
    sizingValue: number;
  };
}

export interface MonitorEvaluationSummary {
  skippedLocked?: boolean;
  evaluatedCandidates: number;
  openMarketSymbols: number;
  skippedClosedMarket: number;
  signalsTriggered: number;
  tradesExecuted: number;
  executedTrades: Array<{
    portfolioId: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    strategyName: string;
  }>;
  errors: string[];
}

const WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
const HISTORICAL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CachedHistoricalCandles {
  marketDate: string;
  fetchedAt: number;
  candles: DailyCandle[];
}

const historicalCandleCache = new Map<string, CachedHistoricalCandles>();
let isEvaluating = false;

export function getMarketForSymbol(symbol: string): MarketRegion {
  return isIndianSymbol(symbol) ? 'IN' : 'US';
}

function getZonedClockParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const byType: Record<string, string> = {};
  for (const part of parts) {
    byType[part.type] = part.value;
  }

  const hour = Number(byType.hour || 0);
  const minute = Number(byType.minute || 0);
  const marketDate = `${byType.year}-${byType.month}-${byType.day}`;

  return {
    weekday: byType.weekday || '',
    marketDate,
    minutesOfDay: hour * 60 + minute,
  };
}

/**
 * Checks whether the regular trading session is currently open for a symbol.
 * - India (*.NS, *.BO, ^NSE*, ^BSE*): Mon-Fri 09:15-15:30 IST (Asia/Kolkata)
 * - US / Global (other symbols): Mon-Fri 09:30-16:00 ET (America/New_York, DST-aware)
 */
export function isMarketOpenForSymbol(symbol: string, now: Date = new Date()): MarketStatus {
  const market = getMarketForSymbol(symbol);
  const timeZone = market === 'IN' ? 'Asia/Kolkata' : 'America/New_York';
  const { weekday, marketDate, minutesOfDay } = getZonedClockParts(now, timeZone);

  if (!WEEKDAYS.has(weekday)) {
    return { open: false, market, marketDate, minutesOfDay };
  }

  const openMinute = market === 'IN' ? 9 * 60 + 15 : 9 * 60 + 30;
  const closeMinute = market === 'IN' ? 15 * 60 + 30 : 16 * 60;

  return {
    open: minutesOfDay >= openMinute && minutesOfDay <= closeMinute,
    market,
    marketDate,
    minutesOfDay,
  };
}

async function getCachedHistoricalCandles(symbol: string, marketDate: string): Promise<DailyCandle[]> {
  const cached = historicalCandleCache.get(symbol);
  const nowMs = Date.now();
  if (
    cached &&
    cached.marketDate === marketDate &&
    nowMs - cached.fetchedAt < HISTORICAL_CACHE_TTL_MS
  ) {
    return cached.candles;
  }

  const candles = await ensureHistoricalCandles(symbol, {
    years: 1.5,
    timeframe: 'day',
  });
  historicalCandleCache.set(symbol, {
    marketDate,
    fetchedAt: nowMs,
    candles,
  });
  return candles;
}

/**
 * Builds today's live provisional BarMarketData and the prior completed day's BarMarketData
 * so all daily indicators (RSI, DMA, EMA, MACD, BB, VWAP, OBV) and crossovers evaluate accurately every minute.
 */
export function buildLiveBarsFromHistory(
  historicalCandles: DailyCandle[],
  liveQuote: LivePrice,
  marketDate: string
): { currentBar: BarMarketData; prevBar?: BarMarketData } | null {
  if (!liveQuote || typeof liveQuote.price !== 'number' || !Number.isFinite(liveQuote.price) || liveQuote.price <= 0) {
    return null;
  }

  const sortedHistory = [...historicalCandles].sort((a, b) => a.date.localeCompare(b.date));
  const priorCandles = sortedHistory.filter((c) => c.date < marketDate);
  const existingToday = sortedHistory.find((c) => c.date === marketDate);

  const livePrice = Number(liveQuote.price);
  const openPrice =
    existingToday?.open && existingToday.open > 0
      ? existingToday.open
      : liveQuote.previousClose && liveQuote.previousClose > 0
        ? liveQuote.previousClose
        : livePrice;

  const dayHigh = Math.max(
    livePrice,
    liveQuote.dayHigh && liveQuote.dayHigh > 0 ? liveQuote.dayHigh : 0,
    existingToday?.high && existingToday.high > 0 ? existingToday.high : 0
  );

  const lowCandidates = [
    livePrice,
    liveQuote.dayLow && liveQuote.dayLow > 0 ? liveQuote.dayLow : Infinity,
    existingToday?.low && existingToday.low > 0 ? existingToday.low : Infinity,
  ].filter((v) => Number.isFinite(v) && v > 0);
  const dayLow = lowCandidates.length > 0 ? Math.min(...lowCandidates) : livePrice;

  const volume =
    typeof liveQuote.volume === 'number' && liveQuote.volume > 0
      ? liveQuote.volume
      : existingToday?.volume || 0;

  const provisionalTodayCandle: DailyCandle = {
    date: marketDate,
    open: parseFloat(openPrice.toFixed(2)),
    high: parseFloat(dayHigh.toFixed(2)),
    low: parseFloat(dayLow.toFixed(2)),
    close: parseFloat(livePrice.toFixed(2)),
    volume,
  };

  const bars = computeRollingIndicators([...priorCandles, provisionalTodayCandle]);
  if (bars.length === 0) return null;

  const currentBar = { ...bars[bars.length - 1] };
  if (typeof liveQuote.changePercent === 'number' && Number.isFinite(liveQuote.changePercent)) {
    currentBar.changePercent = parseFloat(liveQuote.changePercent.toFixed(2));
  }

  const prevBar = bars.length >= 2 ? bars[bars.length - 2] : undefined;
  return { currentBar, prevBar };
}

/**
 * Evaluates prioritized portfolio strategies (stock-specific first, then global) on current + previous bars.
 */
export function evaluatePortfolioRulesOnBars(
  rules: PersistedStrategyRule[],
  currentBar: BarMarketData,
  prevBar: BarMarketData | undefined,
  position: PortfolioPositionSnapshot
): RuleMatchResult | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;

    // 1. Position-level Stop Loss / Take Profit checks
    if (position.netQty > 0 && position.avgBuyPrice > 0) {
      const pnlPct = ((currentBar.close - position.avgBuyPrice) / position.avgBuyPrice) * 100;
      const sl = Number(rule.stopLossPct);
      if (
        rule.stopLossPct !== '' &&
        rule.stopLossPct !== undefined &&
        Number.isFinite(sl) &&
        sl > 0 &&
        pnlPct <= -Math.abs(sl)
      ) {
        return {
          action: 'SELL',
          rule,
          reason: `Stop Loss Hit (${pnlPct.toFixed(2)}% <= -${Math.abs(sl)}%)`,
          overrideSizing: { sizingType: 'DECREASE_PCT', sizingValue: 100 },
        };
      }

      const tp = Number(rule.takeProfitPct);
      if (
        rule.takeProfitPct !== '' &&
        rule.takeProfitPct !== undefined &&
        Number.isFinite(tp) &&
        tp > 0 &&
        pnlPct >= Math.abs(tp)
      ) {
        return {
          action: 'SELL',
          rule,
          reason: `Take Profit Hit (+${pnlPct.toFixed(2)}% >= +${Math.abs(tp)}%)`,
          overrideSizing: { sizingType: 'DECREASE_PCT', sizingValue: 100 },
        };
      }
    }

    // 2. Entry / Exit condition evaluation (split dual entry/exit rules to match signal-evaluator expectations)
    const entryConds =
      rule.entryConditions && rule.entryConditions.length > 0
        ? rule.entryConditions
        : rule.action !== 'SELL' && Array.isArray(rule.conditions)
          ? rule.conditions
          : [];

    const exitConds =
      rule.exitConditions && rule.exitConditions.length > 0
        ? rule.exitConditions
        : rule.action === 'SELL' && Array.isArray(rule.conditions)
          ? rule.conditions
          : [];

    if (position.netQty > 0 && exitConds.length > 0) {
      const exitEval = evaluateRuleOnBar(
        { ...rule, action: 'SELL', conditions: exitConds },
        currentBar,
        prevBar
      );
      if (exitEval.matched && exitEval.action === 'SELL') {
        return {
          action: 'SELL',
          rule,
          reason: exitEval.reason,
        };
      }
    }

    if (entryConds.length > 0) {
      const entryEval = evaluateRuleOnBar(
        { ...rule, action: 'BUY', conditions: entryConds },
        currentBar,
        prevBar
      );
      if (entryEval.matched && entryEval.action === 'BUY') {
        return {
          action: 'BUY',
          rule,
          reason: entryEval.reason,
        };
      }
    }
  }

  return null;
}

/**
 * Computes trade share quantity using action-appropriate sizing (entrySizing on BUY, exitSizing on SELL).
 */
export function computeTradeQuantity(
  action: 'BUY' | 'SELL',
  rule: StrategyRule,
  price: number,
  netQty: number,
  overrideSizing?: { sizingType: 'QTY' | 'VALUE' | 'INCREASE_PCT' | 'DECREASE_PCT'; sizingValue: number }
): number {
  const sizingType = overrideSizing
    ? overrideSizing.sizingType
    : action === 'SELL'
      ? rule.exitSizingType || rule.sizingType || 'DECREASE_PCT'
      : rule.entrySizingType || rule.sizingType || 'QTY';

  const rawVal = overrideSizing
    ? overrideSizing.sizingValue
    : action === 'SELL'
      ? (rule.exitSizingValue !== undefined && rule.exitSizingValue !== ''
          ? rule.exitSizingValue
          : (rule.sizingValue ?? 100))
      : (rule.entrySizingValue !== undefined && rule.entrySizingValue !== ''
          ? rule.entrySizingValue
          : (rule.sizingValue ?? 1));

  const sizingVal = Number(rawVal) || 0;
  let qty = 1;

  if (sizingType === 'QTY') {
    qty = sizingVal > 0 ? sizingVal : 1;
  } else if (sizingType === 'VALUE') {
    qty = sizingVal > 0 && price > 0 ? Math.max(1, Math.floor(sizingVal / price)) : 1;
  } else if (sizingType === 'INCREASE_PCT' || sizingType === 'DECREASE_PCT') {
    if (action === 'SELL' && sizingType === 'DECREASE_PCT' && sizingVal >= 100 && netQty > 0) {
      qty = netQty;
    } else {
      qty = sizingVal > 0 ? Math.max(1, Math.round(((netQty || 1) * sizingVal) / 100)) : 1;
    }
  }

  if (action === 'SELL') {
    if (netQty <= 0) return 0;
    qty = Math.min(qty, netQty);
  }

  return qty > 0 && Number.isFinite(qty) ? qty : 0;
}

function resolveApplicableRules(
  userRules: PersistedStrategyRule[],
  portfolioId: string,
  symbol: string
): PersistedStrategyRule[] {
  const upperSymbol = symbol.toUpperCase();
  const portfolioScoped = userRules.filter(
    (r) => r.enabled && (r.portfolioId === null || r.portfolioId === portfolioId)
  );

  const stockRules = portfolioScoped.filter(
    (r) => r.scope === 'stock' && r.targetSymbol?.trim().toUpperCase() === upperSymbol
  );
  const globalRules = portfolioScoped.filter(
    (r) => r.scope !== 'stock' || r.targetSymbol?.trim().toUpperCase() === 'ALL'
  );

  return [...stockRules, ...globalRules];
}

/**
 * Evaluates all active strategies across users during active Indian & US market hours
 * and automatically creates BUY/SELL lots + daily execution locks + audit logs.
 */
export async function evaluateAndExecuteActiveStrategies(options?: {
  userId?: string;
  ignoreMarketHours?: boolean;
  now?: Date;
}): Promise<MonitorEvaluationSummary> {
  const summary: MonitorEvaluationSummary = {
    evaluatedCandidates: 0,
    openMarketSymbols: 0,
    skippedClosedMarket: 0,
    signalsTriggered: 0,
    tradesExecuted: 0,
    executedTrades: [],
    errors: [],
  };

  if (isEvaluating) {
    return { ...summary, skippedLocked: true };
  }

  isEvaluating = true;

  try {
    const supabase = createServiceClient();
    const now = options?.now || new Date();
    const ignoreMarketHours = Boolean(options?.ignoreMarketHours);
    const todayUtc = getTodayUtcDate();

    let stratQuery = supabase.from('portfolio_strategies').select('*').eq('enabled', true);
    if (options?.userId) {
      stratQuery = stratQuery.eq('user_id', options.userId);
    }

    const { data: rawStrategies, error: stratErr } = await stratQuery;
    if (stratErr) {
      if (isMissingTableError(stratErr)) return summary;
      throw new Error(stratErr.message || 'Failed to load active strategies');
    }

    if (!rawStrategies || rawStrategies.length === 0) {
      return summary;
    }

    const parsedStrategies = rawStrategies.map(formatStrategyRow);
    const userIds = Array.from(new Set(parsedStrategies.map((s) => s.userId).filter(Boolean)));
    if (userIds.length === 0) return summary;

    const { data: portfolios, error: portErr } = await supabase
      .from('portfolios')
      .select('id, user_id, name')
      .in('user_id', userIds)
      .is('deleted_at', null);

    if (portErr) {
      throw new Error(portErr.message || 'Failed to load active portfolios');
    }

    if (!portfolios || portfolios.length === 0) {
      return summary;
    }

    const portfolioIds = portfolios.map((p: any) => p.id);

    const [stocksRes, soldRes, execRes] = await Promise.all([
      supabase.from('stocks').select('*').in('portfolio_id', portfolioIds),
      supabase.from('sold_stocks').select('*').in('portfolio_id', portfolioIds),
      supabase
        .from('strategy_executions')
        .select('portfolio_id, symbol')
        .in('portfolio_id', portfolioIds)
        .eq('execution_date', todayUtc),
    ]);

    if (stocksRes.error) throw new Error(stocksRes.error.message);
    if (soldRes.error) throw new Error(soldRes.error.message);
    if (execRes.error && !isMissingTableError(execRes.error)) {
      throw new Error(execRes.error.message);
    }

    const stocksByPortfolio = new Map<string, any[]>();
    for (const row of stocksRes.data || []) {
      const list = stocksByPortfolio.get(row.portfolio_id) || [];
      list.push(row);
      stocksByPortfolio.set(row.portfolio_id, list);
    }

    const soldByPortfolio = new Map<string, any[]>();
    for (const row of soldRes.data || []) {
      const list = soldByPortfolio.get(row.portfolio_id) || [];
      list.push(row);
      soldByPortfolio.set(row.portfolio_id, list);
    }

    const executedTodaySet = new Set<string>();
    for (const row of execRes.data || []) {
      if (row.portfolio_id && row.symbol) {
        executedTodaySet.add(`${row.portfolio_id}:${String(row.symbol).trim().toUpperCase()}`);
      }
    }

    const strategiesByUser = new Map<string, PersistedStrategyRule[]>();
    for (const s of parsedStrategies) {
      const list = strategiesByUser.get(s.userId) || [];
      list.push(s);
      strategiesByUser.set(s.userId, list);
    }

    interface CandidateEval {
      userId: string;
      portfolioId: string;
      symbol: string;
      marketDate: string;
      position: PortfolioPositionSnapshot;
      rules: PersistedStrategyRule[];
    }

    const candidates: CandidateEval[] = [];
    const symbolMarketDateMap = new Map<string, string>();

    for (const portfolio of portfolios) {
      const userRules = strategiesByUser.get(portfolio.user_id) || [];
      if (userRules.length === 0) continue;

      const portStocks = stocksByPortfolio.get(portfolio.id) || [];
      const portSoldStocks = soldByPortfolio.get(portfolio.id) || [];
      const pnlStats = calculatePortfolioStats(portStocks, portSoldStocks, {});

      const positionBySymbol = new Map<string, PortfolioPositionSnapshot>();
      const candidateSymbols = new Set<string>();

      for (const group of pnlStats.symbolGroups || []) {
        const sym = String(group.symbol || '').trim().toUpperCase();
        if (!sym) continue;
        const netQty = Number(group.netQty) || 0;
        positionBySymbol.set(sym, {
          netQty,
          avgBuyPrice: Number(group.avgBuyPrice) || 0,
        });
        if (netQty > 0) {
          candidateSymbols.add(sym);
        }
      }

      // Also include explicit portfolio stock-scoped targets (allows initiating a fresh BUY from 0 shares)
      for (const rule of userRules) {
        if (
          rule.scope === 'stock' &&
          rule.portfolioId === portfolio.id &&
          rule.targetSymbol &&
          rule.targetSymbol.trim().toUpperCase() !== 'ALL'
        ) {
          candidateSymbols.add(rule.targetSymbol.trim().toUpperCase());
        }
      }

      for (const sym of candidateSymbols) {
        if (executedTodaySet.has(`${portfolio.id}:${sym}`)) {
          continue;
        }

        const marketStatus = isMarketOpenForSymbol(sym, now);
        if (!ignoreMarketHours && !marketStatus.open) {
          summary.skippedClosedMarket++;
          continue;
        }

        const rules = resolveApplicableRules(userRules, portfolio.id, sym);
        if (rules.length === 0) continue;

        symbolMarketDateMap.set(sym, marketStatus.marketDate);
        candidates.push({
          userId: portfolio.user_id,
          portfolioId: portfolio.id,
          symbol: sym,
          marketDate: marketStatus.marketDate,
          position: positionBySymbol.get(sym) || { netQty: 0, avgBuyPrice: 0 },
          rules,
        });
      }
    }

    summary.evaluatedCandidates = candidates.length;
    const openSymbols = Array.from(symbolMarketDateMap.keys());
    summary.openMarketSymbols = openSymbols.length;

    if (candidates.length === 0 || openSymbols.length === 0) {
      return summary;
    }

    // Batch fetch live quotes for open-market symbols only
    const livePrices = await fetchPrices(openSymbols);

    // Build live indicator snapshots per unique symbol with bounded concurrency
    const barsBySymbol = new Map<string, { currentBar: BarMarketData; prevBar?: BarMarketData }>();
    const chunkSize = 4;
    for (let i = 0; i < openSymbols.length; i += chunkSize) {
      const batch = openSymbols.slice(i, i + chunkSize);
      await Promise.all(
        batch.map(async (sym) => {
          const quote = livePrices[sym];
          if (!quote || !quote.price || quote.price <= 0) return;

          try {
            const marketDate = symbolMarketDateMap.get(sym) || todayUtc;
            const history = await getCachedHistoricalCandles(sym, marketDate);
            const built = buildLiveBarsFromHistory(history, quote, marketDate);
            if (built) {
              barsBySymbol.set(sym, built);
            }
          } catch (err: any) {
            summary.errors.push(`${sym} bar build failed: ${err.message}`);
          }
        })
      );
    }

    // Evaluate and execute matching strategies per portfolio & symbol
    for (const candidate of candidates) {
      const execKey = `${candidate.portfolioId}:${candidate.symbol}`;
      if (executedTodaySet.has(execKey)) continue;

      const bars = barsBySymbol.get(candidate.symbol);
      const quote = livePrices[candidate.symbol];
      if (!bars || !quote || !quote.price || quote.price <= 0) continue;

      const match = evaluatePortfolioRulesOnBars(
        candidate.rules,
        bars.currentBar,
        bars.prevBar,
        candidate.position
      );

      if (!match) continue;

      const qty = computeTradeQuantity(
        match.action,
        match.rule,
        quote.price,
        candidate.position.netQty,
        match.overrideSizing
      );

      if (qty <= 0) continue;

      summary.signalsTriggered++;

      try {
        await recordSignalTriggeredLog(supabase, {
          userId: candidate.userId,
          portfolioId: candidate.portfolioId,
          strategyId: match.rule.id,
          strategyName: match.rule.name,
          symbol: candidate.symbol,
          signal: match.action,
          price: quote.price,
          eventDate: todayUtc,
          automated: true,
          reason: match.reason,
        });

        const result = await executeStrategyTrade(supabase, {
          userId: candidate.userId,
          portfolioId: candidate.portfolioId,
          strategyId: match.rule.id,
          strategyName: match.rule.name,
          symbol: candidate.symbol,
          action: match.action,
          quantity: qty,
          price: quote.price,
          executionDate: todayUtc,
          automated: true,
          reason: match.reason,
        });

        executedTodaySet.add(execKey);

        if (!result.alreadyExecuted) {
          summary.tradesExecuted++;
          summary.executedTrades.push({
            portfolioId: candidate.portfolioId,
            symbol: candidate.symbol,
            action: match.action,
            quantity: qty,
            price: quote.price,
            strategyName: match.rule.name,
          });
        }
      } catch (execErr: any) {
        summary.errors.push(`${candidate.symbol} (${candidate.portfolioId}): ${execErr.message}`);
      }
    }

    if (summary.tradesExecuted > 0 || summary.errors.length > 0) {
      console.log(
        `[StrategyCron] Executed ${summary.tradesExecuted} trade(s) across ${summary.openMarketSymbols} open symbol(s).` +
          (summary.errors.length > 0 ? ` Errors: ${summary.errors.join(' | ')}` : '')
      );
    }

    return summary;
  } finally {
    isEvaluating = false;
  }
}
