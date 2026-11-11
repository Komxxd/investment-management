import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  History,
  RefreshCw,
  Loader2,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../../services/api/client';
import type { StrategyRule } from './StrategyBuilderModal';

export type StrategyLogEventType =
  | 'STRATEGY_STARTED'
  | 'STRATEGY_PAUSED'
  | 'STRATEGY_RESUMED'
  | 'SIGNAL_TRIGGERED'
  | 'ACTION_EXECUTED';

export interface StrategyLogEntry {
  id: string;
  portfolioId?: string;
  strategyId?: string | null;
  strategyName?: string | null;
  symbol: string;
  eventType: StrategyLogEventType;
  actionText: string;
  signal?: string | null;
  eventDate?: string | null;
  loggedAt: string;
  metadata?: Record<string, any>;
  source?: string;
}

interface StrategyLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  symbol: string | null;
  currencySymbol: string;
  strategies?: StrategyRule[];
  fallbackLocalLogs?: StrategyLogEntry[];
}

export const StrategyLogsModal: React.FC<StrategyLogsModalProps> = ({
  isOpen,
  onClose,
  portfolioId,
  symbol,
  currencySymbol,
  strategies = [],
  fallbackLocalLogs = [],
}) => {
  const [logs, setLogs] = useState<StrategyLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingTable, setMissingTable] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!isOpen || !symbol) return;

    if (!portfolioId) {
      setLogs([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `/api/strategies/logs?portfolio_id=${encodeURIComponent(portfolioId)}&symbol=${encodeURIComponent(symbol)}`
      );
      if (Array.isArray(res?.logs)) {
        setLogs(res.logs);
        setMissingTable(Boolean(res?.missingTable));
      } else if (Array.isArray(res)) {
        setLogs(res);
        setMissingTable(false);
      } else {
        setLogs([]);
        setMissingTable(Boolean(res?.missingTable));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load execution logs.');
    } finally {
      setLoading(false);
    }
  }, [isOpen, portfolioId, symbol]);

  useEffect(() => {
    if (isOpen && symbol) {
      loadLogs();
    }
  }, [isOpen, symbol, loadLogs]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const mergedLogs = useMemo(() => {
    if (!symbol) return [];
    const items = [...logs];

    // Ensure applicable strategies without a DB log still display when started or paused (e.g. legacy / local fallback)
    const seenStartIds = new Set(
      items
        .filter((item) => item.eventType === 'STRATEGY_STARTED' && item.strategyId)
        .map((item) => String(item.strategyId))
    );
    const seenPausedIds = new Set(
      items
        .filter((item) => item.eventType === 'STRATEGY_PAUSED' && item.strategyId)
        .map((item) => String(item.strategyId))
    );

    for (const strat of strategies) {
      if (!strat || strat.id === 'rule-default') continue;
      const applies =
        strat.scope === 'global' ||
        strat.targetSymbol === 'ALL' ||
        strat.targetSymbol === symbol;
      if (!applies) continue;

      const createdAt = (strat as any).createdAt || (strat as any).created_at;
      if (createdAt && !seenStartIds.has(String(strat.id))) {
        items.push({
          id: `local-start-${strat.id}`,
          portfolioId,
          strategyId: strat.id,
          strategyName: strat.name,
          symbol,
          eventType: 'STRATEGY_STARTED',
          actionText: `Strategy "${strat.name || 'Untitled Strategy'}" started`,
          loggedAt: createdAt,
          source: 'local',
        });
      }

      const updatedAt = (strat as any).updatedAt || (strat as any).updated_at;
      if (strat.enabled === false && updatedAt && !seenPausedIds.has(String(strat.id))) {
        items.push({
          id: `local-pause-${strat.id}`,
          portfolioId,
          strategyId: strat.id,
          strategyName: strat.name,
          symbol: strat.targetSymbol || symbol,
          eventType: 'STRATEGY_PAUSED',
          actionText: `Strategy "${strat.name || 'Untitled Strategy'}" paused`,
          loggedAt: updatedAt,
          source: 'local',
        });
      }
    }

    // Merge local session signal/execution/lifecycle fallback logs when not yet present in DB results
    const seenIds = new Set(items.map((item) => item.id));
    const seenSignals = new Set(
      items
        .filter((item) => item.eventType === 'SIGNAL_TRIGGERED')
        .map((item) => `${item.eventDate || ''}:${item.signal || ''}`)
    );
    const seenExecutions = new Set(
      items
        .filter((item) => item.eventType === 'ACTION_EXECUTED')
        .map((item) => `${item.eventDate || ''}:${item.signal || ''}`)
    );

    for (const localItem of fallbackLocalLogs) {
      if (localItem.symbol !== symbol && localItem.symbol !== 'ALL') continue;
      if (seenIds.has(localItem.id)) continue;

      const key = `${localItem.eventDate || ''}:${localItem.signal || ''}`;
      if (localItem.eventType === 'SIGNAL_TRIGGERED' && seenSignals.has(key)) continue;
      if (localItem.eventType === 'ACTION_EXECUTED' && seenExecutions.has(key)) continue;

      if (localItem.eventType === 'STRATEGY_PAUSED' || localItem.eventType === 'STRATEGY_RESUMED') {
        const localTs = localItem.loggedAt ? new Date(localItem.loggedAt).getTime() : 0;
        const alreadyInDb = items.some(
          (item) =>
            item.source === 'db' &&
            item.eventType === localItem.eventType &&
            item.strategyId === localItem.strategyId &&
            Math.abs(new Date(item.loggedAt).getTime() - localTs) < 10000
        );
        if (alreadyInDb) continue;
      }

      items.push(localItem);
    }

    const eventRank: Record<string, number> = {
      STRATEGY_STARTED: 0,
      SIGNAL_TRIGGERED: 1,
      ACTION_EXECUTED: 2,
      STRATEGY_PAUSED: 3,
      STRATEGY_RESUMED: 4,
    };

    items.sort((a, b) => {
      const timeA = a.loggedAt ? new Date(a.loggedAt).getTime() : 0;
      const timeB = b.loggedAt ? new Date(b.loggedAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (eventRank[a.eventType] ?? 9) - (eventRank[b.eventType] ?? 9);
    });

    return items;
  }, [logs, strategies, fallbackLocalLogs, symbol, portfolioId]);

  if (!isOpen || !symbol) return null;

  const formatDatetime = (isoString: string) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderEventBadge = (entry: StrategyLogEntry) => {
    if (entry.eventType === 'STRATEGY_STARTED') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-[10px] font-semibold uppercase tracking-wide shrink-0">
          <PlayCircle className="w-3 h-3" />
          Started
        </span>
      );
    }

    if (entry.eventType === 'STRATEGY_PAUSED') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 text-[10px] font-semibold uppercase tracking-wide shrink-0">
          <PauseCircle className="w-3 h-3" />
          Paused
        </span>
      );
    }

    if (entry.eventType === 'STRATEGY_RESUMED') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[10px] font-semibold uppercase tracking-wide shrink-0">
          <RotateCcw className="w-3 h-3" />
          Resumed
        </span>
      );
    }

    if (entry.eventType === 'SIGNAL_TRIGGERED') {
      const isSell = entry.signal === 'SELL';
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
            isSell
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          }`}
        >
          <Zap className="w-3 h-3" />
          Signal
        </span>
      );
    }

    const isSellAction = entry.signal === 'SELL' || entry.metadata?.action === 'SELL';
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
          isSellAction
            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        }`}
      >
        <CheckCircle2 className="w-3 h-3" />
        Action
      </span>
    );
  };

  const formatActionDescription = (entry: StrategyLogEntry) => {
    const price = Number(entry.metadata?.price);
    if (
      (entry.eventType === 'SIGNAL_TRIGGERED' || entry.eventType === 'ACTION_EXECUTED') &&
      Number.isFinite(price) &&
      price > 0
    ) {
      const formattedPrice = price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${entry.actionText} @ ${currencySymbol}${formattedPrice}`;
    }
    return entry.actionText;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface border border-divider rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-divider bg-background/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <History className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-primary truncate">
                  Strategy Execution Logs
                </h2>
                <span className="px-2 py-0.5 rounded bg-surface-hover border border-divider text-[11px] font-mono font-semibold text-primary">
                  {symbol}
                </span>
              </div>
              <p className="text-[11px] text-tertiary truncate">
                Strategy start, pause/resume, signal arrival, and executed trade actions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-hover border border-transparent hover:border-divider transition-colors disabled:opacity-50"
              title="Refresh logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-hover border border-transparent hover:border-divider transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notices */}
        {missingTable && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/25 text-[11px] text-amber-300">
            Run the <code className="font-mono font-semibold">strategy_logs</code> SQL in Supabase to persist signal logs across devices; local session &amp; existing strategy/trade history are shown below.
          </div>
        )}

        {error && (
          <div className="px-4 py-2 bg-danger/10 border-b border-danger/25 text-xs text-danger">
            {error}
          </div>
        )}

        {/* Table Body */}
        <div className="overflow-y-auto flex-1">
          {loading && mergedLogs.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading execution logs...</span>
            </div>
          ) : mergedLogs.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <History className="w-7 h-7 text-tertiary mx-auto mb-2 opacity-60" />
              <p className="text-xs font-medium text-secondary">
                No strategy logs recorded yet for {symbol}
              </p>
              <p className="text-[11px] text-tertiary mt-1">
                Logs are captured when a strategy starts, when a BUY/SELL signal triggers, and when an action executes.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-background/95 backdrop-blur-xs border-b border-divider z-10">
                <tr className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">
                  <th className="py-2.5 px-4 w-[210px] border-r border-divider/60">
                    Datetime
                  </th>
                  <th className="py-2.5 px-4">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider/60 text-xs">
                {mergedLogs.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-surface-hover/50 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-[11px] text-secondary whitespace-nowrap border-r border-divider/60 align-top">
                      {formatDatetime(entry.loggedAt)}
                    </td>
                    <td className="py-2.5 px-4 text-primary align-top">
                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        {renderEventBadge(entry)}
                        <span className="text-xs text-primary leading-relaxed">
                          {formatActionDescription(entry)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-divider bg-background/40 flex items-center justify-between text-[11px] text-tertiary">
          <span>{mergedLogs.length} {mergedLogs.length === 1 ? 'entry' : 'entries'}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-md border border-divider bg-surface hover:bg-surface-hover text-xs font-medium text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

