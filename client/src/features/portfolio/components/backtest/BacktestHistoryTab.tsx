import { useMemo } from 'react';
import {
  Activity,
  ArrowUpRight,
  Calendar,
  Clock,
  FlaskConical,
  History,
  Trash2,
} from 'lucide-react';
import type {
  BacktestHistoryEntry,
  BacktestRunKind,
} from './backtestSessionStorage';

interface BacktestHistoryTabProps {
  entries: BacktestHistoryEntry[];
  selectedPortfolioId: string;
  searchQuery: string;
  currencySymbol: string;
  onOpenEntry: (entry: BacktestHistoryEntry) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
  onSwitchToSimulations: () => void;
}

const KIND_META: Record<
  BacktestRunKind,
  { label: string; badgeClass: string }
> = {
  PORTFOLIO_SIP: {
    label: 'Portfolio SIP',
    badgeClass: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  },
  PORTFOLIO_ONE_TIME: {
    label: 'Portfolio One-Time',
    badgeClass: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  },
  STRATEGY: {
    label: 'Strategy Backtest',
    badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
};

function formatSignedMoney(value: number, currencySymbol: string): string {
  const absFormatted = Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (value > 0) return `+${currencySymbol}${absFormatted}`;
  if (value < 0) return `-${currencySymbol}${absFormatted}`;
  return `${currencySymbol}${absFormatted}`;
}

function formatSignedPct(value: number): string {
  const formatted = Math.abs(value).toFixed(2);
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `-${formatted}%`;
  return `${formatted}%`;
}

function formatRunDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function BacktestHistoryTab({
  entries,
  selectedPortfolioId,
  searchQuery,
  currencySymbol,
  onOpenEntry,
  onDeleteEntry,
  onClearHistory,
  onSwitchToSimulations,
}: BacktestHistoryTabProps) {
  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesPortfolio =
        selectedPortfolioId === 'ALL' || entry.portfolioId === selectedPortfolioId;
      if (!matchesPortfolio) return false;
      if (!query) return true;
      return (
        entry.title.toLowerCase().includes(query) ||
        entry.symbol.toLowerCase().includes(query) ||
        (entry.portfolioName || '').toLowerCase().includes(query) ||
        KIND_META[entry.kind].label.toLowerCase().includes(query)
      );
    });
  }, [entries, selectedPortfolioId, searchQuery]);

  if (entries.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center rounded-2xl border border-divider bg-surface space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-surface-hover text-primary flex items-center justify-center mx-auto border border-divider">
          <History className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-bold text-primary">
            No Recent Simulations Saved
          </h3>
          <p className="text-xs text-secondary leading-relaxed">
            Completed Portfolio SIP, One-Time Allocation, and Strategy Backtests appear here automatically so you can compare returns and reopen full equity reports anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={onSwitchToSimulations}
          className="px-4 py-2 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Run a Simulation</span>
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
            <History className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
            <span>Recent Simulation Results</span>
          </h2>
          <p className="text-xs sm:text-sm text-secondary mt-0.5">
            Stored locally in this browser (up to 12 most recent runs). Click any run to inspect its full chart and trade ledger.
          </p>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-divider bg-surface transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear History</span>
        </button>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="p-6 text-center rounded-2xl border border-dashed border-divider bg-surface space-y-2">
          <p className="text-xs sm:text-sm font-semibold text-primary">
            No historical runs match your current portfolio or search filter.
          </p>
          <p className="text-xs text-secondary">
            Switch portfolio filter to &ldquo;All Portfolios&rdquo; or clear the search input to view all {entries.length} saved simulation{entries.length === 1 ? '' : 's'}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const meta = KIND_META[entry.kind];
            const isPositive = entry.netProfit >= 0;

            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-divider bg-surface p-4 sm:p-5 hover:border-primary/40 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left metadata */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-background border border-divider text-primary">
                        {entry.symbol}
                      </span>
                      {entry.portfolioName && (
                        <span className="text-[11px] text-secondary truncate">
                          • {entry.portfolioName}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-primary truncate">
                      {entry.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary">
                      {(entry.startDate || entry.endDate) && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {entry.startDate || 'Start'} → {entry.endDate || 'End'}
                          </span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span>
                          {entry.totalTrades} trade{entry.totalTrades === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Ran {formatRunDate(entry.createdAt)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right metrics & actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left sm:text-right">
                      <div className="px-2.5 py-1.5 rounded-lg bg-background border border-divider">
                        <div className="text-[10px] uppercase tracking-wider text-secondary">
                          Return
                        </div>
                        <div
                          className={`text-xs sm:text-sm font-bold ${
                            entry.totalReturnPct >= 0
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {formatSignedPct(entry.totalReturnPct)}
                        </div>
                      </div>

                      <div className="px-2.5 py-1.5 rounded-lg bg-background border border-divider">
                        <div className="text-[10px] uppercase tracking-wider text-secondary">
                          Net Profit
                        </div>
                        <div
                          className={`text-xs sm:text-sm font-bold ${
                            isPositive ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {formatSignedMoney(entry.netProfit, currencySymbol)}
                        </div>
                      </div>

                      <div className="px-2.5 py-1.5 rounded-lg bg-background border border-divider">
                        <div className="text-[10px] uppercase tracking-wider text-secondary">
                          CAGR
                        </div>
                        <div
                          className={`text-xs sm:text-sm font-bold ${
                            entry.cagrPct >= 0
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {formatSignedPct(entry.cagrPct)}
                        </div>
                      </div>

                      <div className="px-2.5 py-1.5 rounded-lg bg-background border border-divider">
                        <div className="text-[10px] uppercase tracking-wider text-secondary">
                          Max DD
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-rose-500">
                          -{Math.abs(entry.maxDrawdownPct).toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenEntry(entry)}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold transition-opacity inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Open Report</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry.id)}
                        title="Remove run from history"
                        aria-label={`Delete ${entry.title} from history`}
                        className="p-2 rounded-xl border border-divider bg-background hover:bg-rose-500/10 text-secondary hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

