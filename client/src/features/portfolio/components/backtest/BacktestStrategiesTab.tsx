import { useNavigate } from 'react-router-dom';
import {
  Play,
  Briefcase,
  Layers,
  Clock,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Loader2,
  Tag,
} from 'lucide-react';
import { formatRuleFormula, type StrategyRule } from '../../utils/strategyConfig';
import type { Portfolio } from '../../hooks/usePortfolioData';
import type { StrategyWithLegacyPortfolio } from './backtestPresets';

export interface BacktestStrategyGroup {
  portfolioId: string | null;
  portfolioName: string;
  items: StrategyRule[];
}

interface BacktestStrategiesTabProps {
  portfolios: Portfolio[];
  strategies: StrategyRule[];
  filteredStrategies: StrategyRule[];
  groupedStrategies: BacktestStrategyGroup[];
  selectedPortfolioId: string;
  onSelectPortfolioId: (id: string) => void;
  loading: boolean;
  onLoadSampleStrategies: () => void;
  onOpenBacktest: (rule: StrategyRule) => void;
}

/**
 * Renders the saved strategies view with portfolio filter pills and grouped strategy cards.
 */
export function BacktestStrategiesTab({
  portfolios,
  strategies,
  filteredStrategies,
  groupedStrategies,
  selectedPortfolioId,
  onSelectPortfolioId,
  loading,
  onLoadSampleStrategies,
  onOpenBacktest,
}: BacktestStrategiesTabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => onSelectPortfolioId('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            selectedPortfolioId === 'ALL'
              ? 'bg-primary text-background'
              : 'bg-surface border border-divider text-secondary hover:text-primary hover:bg-surface-hover'
          }`}
        >
          All Portfolios ({strategies.length})
        </button>

        {portfolios.map(p => {
          const count = strategies.filter(
            s => ((s as StrategyWithLegacyPortfolio).portfolioId || (s as StrategyWithLegacyPortfolio).portfolio_id) === p.id
          ).length;
          return (
            <button
              key={p.id}
              onClick={() => onSelectPortfolioId(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                selectedPortfolioId === p.id
                  ? 'bg-primary text-background'
                  : 'bg-surface border border-divider text-secondary hover:text-primary hover:bg-surface-hover'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>{p.name}</span>
              <span className="opacity-75 font-mono text-[11px]">({count})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-secondary">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs">Loading saved strategies...</span>
        </div>
      ) : strategies.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl border border-divider bg-surface space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-surface-hover text-primary flex items-center justify-center mx-auto border border-divider">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-primary">No Saved Strategies Found</h3>
            <p className="text-xs text-secondary leading-relaxed">
              You do not have any saved strategies in your portfolios yet. Create a strategy in your portfolio, or load sample strategies below to start backtesting.
            </p>
          </div>
          <button
            onClick={onLoadSampleStrategies}
            className="px-4 py-2 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample Strategies</span>
          </button>
        </div>
      ) : filteredStrategies.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-divider bg-surface space-y-2">
          <AlertCircle className="w-8 h-8 text-secondary mx-auto opacity-40" />
          <h4 className="text-sm font-semibold text-primary">No strategies match your filter</h4>
          <p className="text-xs text-secondary">Try adjusting your search query or portfolio filter.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedStrategies.map(group => {
            if (group.items.length === 0) return null;

            return (
              <div key={group.portfolioId || 'global'} className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-divider">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-surface-hover border border-divider text-secondary">
                      <Briefcase className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                        <span>{group.portfolioName}</span>
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface border border-divider text-secondary">
                          {group.items.length} {group.items.length === 1 ? 'strategy' : 'strategies'}
                        </span>
                      </h2>
                    </div>
                  </div>

                  {group.portfolioId && (
                    <button
                      onClick={() => navigate(`/portfolio/${group.portfolioId}`)}
                      className="text-xs text-secondary hover:text-primary flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>View Portfolio</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map(strategy => {
                    const formula = formatRuleFormula(strategy);
                    const targetSymbol = strategy.targetSymbol || 'ALL';
                    const hasConditions = strategy.conditions && strategy.conditions.length > 0;

                    return (
                      <div
                        key={strategy.id}
                        className="p-4 sm:p-5 rounded-2xl border border-divider bg-surface hover:border-divider-hover hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-primary line-clamp-1">
                                {strategy.name || 'Untitled Strategy'}
                              </h3>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-hover border border-divider text-primary">
                                  <Tag className="w-2.5 h-2.5 text-secondary" />
                                  <span>{targetSymbol}</span>
                                </span>
                                {strategy.action && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                      strategy.action === 'BUY'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-rose-500/10 text-rose-400'
                                    }`}
                                  >
                                    {strategy.action} {strategy.sizingType || 'QTY'} ({strategy.sizingValue || 10})
                                  </span>
                                )}
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                                strategy.enabled
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-surface-hover text-secondary border border-divider'
                              }`}
                            >
                              {strategy.enabled ? 'Active' : 'Paused'}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-background border border-divider text-xs font-mono text-secondary leading-relaxed line-clamp-3">
                            {formula}
                          </div>

                          {hasConditions && (
                            <div className="flex flex-wrap gap-1">
                              {(strategy.entryConditions && strategy.entryConditions.length > 0
                                ? strategy.entryConditions
                                : strategy.conditions
                              ).map((cond, idx) => (
                                <span
                                  key={`entry-${cond.id || idx}`}
                                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-hover border border-divider text-secondary"
                                >
                                  BUY: {cond.leftIndicator?.toUpperCase()} {cond.operator}{' '}
                                  {cond.rightType === 'indicator'
                                    ? cond.rightIndicator?.toUpperCase()
                                    : cond.rightValue}
                                </span>
                              ))}
                              {strategy.exitConditions?.map((cond, idx) => (
                                <span
                                  key={`exit-${cond.id || idx}`}
                                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-hover border border-divider text-secondary"
                                >
                                  SELL: {cond.leftIndicator?.toUpperCase()} {cond.operator}{' '}
                                  {cond.rightType === 'indicator'
                                    ? cond.rightIndicator?.toUpperCase()
                                    : cond.rightValue}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-divider flex items-center justify-between gap-3">
                          <span className="text-[10px] text-tertiary flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {strategy.createdAt
                                ? new Date(strategy.createdAt).toLocaleDateString()
                                : 'Daily'}
                            </span>
                          </span>

                          <button
                            onClick={() => onOpenBacktest(strategy)}
                            className="px-3.5 py-1.5 rounded-lg bg-primary text-background hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Backtest</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

