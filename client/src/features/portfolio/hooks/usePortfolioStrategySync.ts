import { useState, useEffect, useRef } from 'react';
import { api } from '../../../services/api/client';
import type { StrategyRule } from '../components/StrategyBuilderModal';
import type { StrategyLogEntry } from '../components/StrategyLogsModal';
import { evaluateStockStrategies } from '../utils/strategyEvaluator';
import type { DailyExecutionEntry, IndicatorData } from '../components/dashboard/dashboardConfig';

export const getTodayDateKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getTodayUtcDateKey = () => new Date().toISOString().split('T')[0];

function getLocalStorageKey(pid: string | null, dateKey: string) {
  return `portfolio_strategy_executions_${pid || 'global'}_${dateKey}`;
}

function getLocalExecutions(pid: string | null, dateKey: string): Record<string, DailyExecutionEntry> {
  try {
    const saved = localStorage.getItem(getLocalStorageKey(pid, dateKey));
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function setLocalExecutions(
  pid: string | null,
  dateKey: string,
  map: Record<string, DailyExecutionEntry>
) {
  try {
    localStorage.setItem(getLocalStorageKey(pid, dateKey), JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

function getLocalLogStorageKey(pid: string | null, dateKey: string) {
  return `portfolio_strategy_logs_${pid || 'global'}_${dateKey}`;
}

function getLocalStrategyLogs(pid: string | null, dateKey: string): StrategyLogEntry[] {
  try {
    const saved = localStorage.getItem(getLocalLogStorageKey(pid, dateKey));
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Syncs portfolio strategies, polls server auto-executions every 60s, evaluates strategy signals
 * for table display, and handles manual signal execution.
 */
export function usePortfolioStrategySync({
  activePortfolioId,
  isStrategyBuilderModalOpen,
  livePrices,
  indicators,
  fetchData,
}: {
  activePortfolioId: string | null;
  isStrategyBuilderModalOpen: boolean;
  livePrices: Record<string, { price?: number; changePercent?: number }>;
  indicators: Record<string, IndicatorData>;
  fetchData: () => Promise<void>;
}) {
  const [executingSignalSymbol, setExecutingSignalSymbol] = useState<string | null>(null);
  const [portfolioStrategies, setPortfolioStrategies] = useState<StrategyRule[]>([]);

  const [todayExecutions, setTodayExecutions] = useState<Record<string, DailyExecutionEntry>>(() =>
    getLocalExecutions(activePortfolioId, getTodayUtcDateKey())
  );
  const todayExecutionsRef = useRef<Record<string, DailyExecutionEntry>>({});
  const loadedExecutionsPortfolioRef = useRef<string | null>(null);

  const [localStrategyLogs, setLocalStrategyLogs] = useState<StrategyLogEntry[]>(() =>
    getLocalStrategyLogs(activePortfolioId, getTodayDateKey())
  );

  // Sync active strategies whenever portfolio changes or builder closes
  useEffect(() => {
    let isMounted = true;
    const syncStrategies = async () => {
      try {
        const data = await api.get(`/api/strategies?portfolio_id=${activePortfolioId || ''}`);
        if (Array.isArray(data) && isMounted) {
          setPortfolioStrategies((data as StrategyRule[]).filter((r) => r.id !== 'rule-default'));
          return;
        }
      } catch {
        // fallback to localStorage
      }
      try {
        const saved = localStorage.getItem(`portfolio_strategies_${activePortfolioId || 'global'}`);
        if (saved && isMounted) {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setPortfolioStrategies((parsed as StrategyRule[]).filter((r) => r.id !== 'rule-default'));
            return;
          }
        }
        if (isMounted) setPortfolioStrategies([]);
      } catch {
        if (isMounted) setPortfolioStrategies([]);
      }
    };

    syncStrategies();
    return () => {
      isMounted = false;
    };
  }, [activePortfolioId, isStrategyBuilderModalOpen]);

  const syncTodayExecutions = async (pid: string | null): Promise<boolean> => {
    const today = getTodayUtcDateKey();
    if (!pid) {
      todayExecutionsRef.current = getLocalExecutions(null, today);
      setTodayExecutions(todayExecutionsRef.current);
      return false;
    }

    try {
      const res = await api.get(
        `/api/strategies/executions?portfolio_id=${encodeURIComponent(pid)}&date=${today}`
      );
      if (Array.isArray(res)) {
        const dbMap: Record<string, DailyExecutionEntry> = {};
        for (const item of res) {
          if (item?.symbol) {
            dbMap[item.symbol] = {
              action: item.action,
              quantity: Number(item.quantity),
              price: Number(item.price),
              timestamp: item.timestamp || Date.now(),
              strategyName: item.strategyName ?? null,
            };
          }
        }

        let hasNewExecution = false;
        if (loadedExecutionsPortfolioRef.current === pid) {
          for (const [sym, entry] of Object.entries(dbMap)) {
            const prev = todayExecutionsRef.current[sym];
            if (!prev || prev.timestamp !== entry.timestamp || prev.action !== entry.action) {
              hasNewExecution = true;
              break;
            }
          }
        } else {
          loadedExecutionsPortfolioRef.current = pid;
        }

        todayExecutionsRef.current = dbMap;
        setTodayExecutions(dbMap);
        setLocalExecutions(pid, today, dbMap);
        return hasNewExecution;
      }
    } catch {
      // Fallback to localStorage if endpoint unreachable
    }

    const fallback = getLocalExecutions(pid, today);
    todayExecutionsRef.current = fallback;
    setTodayExecutions(fallback);
    return false;
  };

  useEffect(() => {
    let isMounted = true;
    loadedExecutionsPortfolioRef.current = null;
    const loadExecutions = async () => {
      if (!isMounted) return;
      setLocalStrategyLogs(getLocalStrategyLogs(activePortfolioId, getTodayDateKey()));
      await syncTodayExecutions(activePortfolioId);
    };
    loadExecutions();
    return () => {
      isMounted = false;
    };
  }, [activePortfolioId]);

  // Poll server-side strategy executions every 60s so cron auto-executed trades update live
  useEffect(() => {
    if (!activePortfolioId) return;
    const intervalId = setInterval(async () => {
      const hasNew = await syncTodayExecutions(activePortfolioId);
      if (hasNew) {
        await fetchData();
      }
    }, 60_000);

    return () => clearInterval(intervalId);
  }, [activePortfolioId, fetchData]);

  const appendLocalStrategyLog = (
    pid: string | null,
    dateKey: string,
    entry: StrategyLogEntry
  ) => {
    setLocalStrategyLogs((prev) => {
      const exists = prev.some((item) => {
        if (item.id === entry.id) return true;
        if (entry.eventType === 'SIGNAL_TRIGGERED' || entry.eventType === 'ACTION_EXECUTED') {
          return (
            item.symbol === entry.symbol &&
            item.eventType === entry.eventType &&
            (item.signal || null) === (entry.signal || null) &&
            (item.eventDate || null) === (entry.eventDate || null)
          );
        }
        return false;
      });
      if (exists) return prev;
      const next = [...prev, entry];
      try {
        localStorage.setItem(getLocalLogStorageKey(pid, dateKey), JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  };

  const getStockStrategyEvaluation = (symbol: string) => {
    const livePrice = livePrices[symbol]?.price || 0;
    const changePercent = livePrices[symbol]?.changePercent || 0;
    return evaluateStockStrategies(portfolioStrategies, symbol, {
      livePrice,
      changePercent,
      indicators: indicators[symbol] || {},
    });
  };

  const handleExecuteStrategySignal = async (
    group: { symbol: string; livePrice?: number; avgBuyPrice?: number; netQty?: number; netCostBasis?: number },
    action: 'BUY' | 'SELL',
    matchedRule?: StrategyRule
  ) => {
    if (!activePortfolioId || executingSignalSymbol) return;

    const symbol = group.symbol;
    if (todayExecutions[symbol]) {
      alert(`Strategy action for ${symbol} has already been executed today.`);
      return;
    }

    const currentPrice = group.livePrice || livePrices[symbol]?.price || group.avgBuyPrice || 1;
    let qty = 1;
    const isSell = action === 'SELL';
    const sizingType = isSell
      ? matchedRule?.exitSizingType || matchedRule?.sizingType || 'DECREASE_PCT'
      : matchedRule?.entrySizingType || matchedRule?.sizingType || 'QTY';
    const rawSizingVal = isSell
      ? (matchedRule?.exitSizingValue !== undefined && matchedRule?.exitSizingValue !== ''
          ? matchedRule.exitSizingValue
          : (matchedRule?.sizingValue ?? 100))
      : (matchedRule?.entrySizingValue !== undefined && matchedRule?.entrySizingValue !== ''
          ? matchedRule.entrySizingValue
          : (matchedRule?.sizingValue ?? 1));
    const sizingVal = Number(rawSizingVal) || 0;

    if (sizingType === 'QTY' && sizingVal > 0) {
      qty = sizingVal;
    } else if (sizingType === 'VALUE' && sizingVal > 0 && currentPrice > 0) {
      qty = Math.max(1, Math.floor(sizingVal / currentPrice));
    } else if (sizingType === 'INCREASE_PCT' || sizingType === 'DECREASE_PCT') {
      if (isSell && sizingType === 'DECREASE_PCT' && sizingVal >= 100 && (group.netQty || 0) > 0) {
        qty = group.netQty || 0;
      } else if (sizingVal > 0) {
        qty = Math.max(1, Math.round(((group.netQty || 1) * sizingVal) / 100));
      }
    }

    if (action === 'SELL') {
      const available = group.netQty || 0;
      if (available <= 0) {
        alert(`Cannot execute SELL: No open shares available for ${symbol}.`);
        return;
      }
      qty = Math.min(qty, available);
    }

    setExecutingSignalSymbol(symbol);

    try {
      const today = getTodayUtcDateKey();
      const response = await api.post('/api/strategies/executions', {
        portfolio_id: activePortfolioId,
        strategy_id: matchedRule?.id || null,
        strategy_name: matchedRule?.name || null,
        symbol,
        action,
        quantity: qty,
        price: currentPrice,
        execution_date: today,
      });

      const executionRecord: DailyExecutionEntry = {
        action,
        quantity: qty,
        price: currentPrice,
        timestamp: response?.execution?.timestamp || Date.now(),
        strategyName: matchedRule?.name || null,
      };

      setTodayExecutions((prev) => {
        const next = { ...prev, [symbol]: executionRecord };
        todayExecutionsRef.current = next;
        setLocalExecutions(activePortfolioId, today, next);
        return next;
      });

      appendLocalStrategyLog(activePortfolioId, today, {
        id: `local-exec-${symbol}-${action}-${today}`,
        portfolioId: activePortfolioId,
        strategyId: matchedRule?.id || null,
        strategyName: matchedRule?.name || null,
        symbol,
        eventType: 'ACTION_EXECUTED',
        actionText: `Executed ${action} ${qty} ${qty === 1 ? 'share' : 'shares'}${matchedRule?.name ? ` (${matchedRule.name})` : ''}`,
        signal: action,
        eventDate: today,
        loggedAt: new Date(executionRecord.timestamp).toISOString(),
        metadata: { action, quantity: qty, price: currentPrice },
        source: response?.persisted ? 'db' : 'local',
      });

      await fetchData();
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      console.error('Failed to execute strategy action:', err);
      if (apiErr?.status === 409) {
        await syncTodayExecutions(activePortfolioId);
      }
      alert(`Failed to execute strategy ${action} for ${symbol}: ${apiErr?.message || 'Unknown error'}`);
    } finally {
      setExecutingSignalSymbol(null);
    }
  };

  return {
    portfolioStrategies,
    todayExecutions,
    localStrategyLogs,
    appendLocalStrategyLog,
    executingSignalSymbol,
    getStockStrategyEvaluation,
    handleExecuteStrategySignal,
  };
}
