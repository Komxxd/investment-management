import React from 'react';
import { Loader2, Play, Trash2 } from 'lucide-react';
import { formatRuleFormula, normalizeRule, type StrategyRule } from '../../utils/strategyConfig';

interface SavedStrategiesTabProps {
  apiNotice: string | null;
  isLoading: boolean;
  savedRules: StrategyRule[];
  onCreateNew: () => void;
  onToggleRuleStatus: (id: string) => void;
  onBacktestRule: (rule: StrategyRule) => void;
  onEditRule: (rule: StrategyRule) => void;
  onDeleteRule: (id: string) => void;
}

/**
 * Saved strategies list view inside StrategyBuilderModal.
 */
export const SavedStrategiesTab: React.FC<SavedStrategiesTabProps> = ({
  apiNotice,
  isLoading,
  savedRules,
  onCreateNew,
  onToggleRuleStatus,
  onBacktestRule,
  onEditRule,
  onDeleteRule,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div>
          <h3 className="text-xs sm:text-sm font-medium text-primary mb-0.5">Saved Strategies</h3>
          <p className="text-[10px] sm:text-xs text-secondary">
            Active dual-action rules monitored for entry and exit signals.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="px-2.5 py-1 text-xs font-medium text-secondary hover:text-primary border border-divider rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
        >
          + New
        </button>
      </div>

      {apiNotice && (
        <div className="p-2.5 rounded-lg border border-divider bg-surface-hover/60 text-[11px] text-secondary">
          {apiNotice}
        </div>
      )}

      {isLoading ? (
        <div className="p-8 flex flex-col items-center justify-center gap-2 text-xs text-secondary">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span>Loading strategies...</span>
        </div>
      ) : savedRules.length === 0 ? (
        <div className="p-8 text-center text-xs text-secondary border border-divider rounded-lg">
          No strategies saved yet. Click &quot;+ New&quot; to build your first dual-action strategy.
        </div>
      ) : (
        <div className="space-y-2">
          {savedRules.map(rule => {
            const entryCount = rule.entryConditions?.length ?? 0;
            const exitCount = rule.exitConditions?.length ?? 0;
            return (
              <div
                key={rule.id}
                className="p-3 rounded-lg border border-divider bg-surface flex items-start justify-between gap-3"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-medium text-primary truncate">{rule.name}</span>
                    <span className="text-[10px] text-secondary font-mono px-1.5 py-0.5 rounded bg-surface-hover border border-divider">
                      {rule.scope === 'global' ? 'Global' : rule.targetSymbol || 'All'}
                    </span>
                    {entryCount > 0 && (
                      <span className="text-[10px] text-secondary font-mono px-1.5 py-0.5 rounded bg-surface-hover border border-divider">
                        BUY: {entryCount} cond
                      </span>
                    )}
                    {(exitCount > 0 || rule.stopLossPct || rule.takeProfitPct) && (
                      <span className="text-[10px] text-secondary font-mono px-1.5 py-0.5 rounded bg-surface-hover border border-divider">
                        SELL: {exitCount} cond{rule.stopLossPct ? ` · SL -${rule.stopLossPct}%` : ''}
                        {rule.takeProfitPct ? ` · TP +${rule.takeProfitPct}%` : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-secondary truncate">
                    {formatRuleFormula(rule)}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleRuleStatus(rule.id)}
                    className={`px-2 py-1 rounded text-[10px] font-medium border border-divider transition-colors cursor-pointer ${
                      rule.enabled
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    {rule.enabled ? 'Active' : 'Paused'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onBacktestRule(rule)}
                    className="px-2 py-1 text-xs text-secondary hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                    title="Backtest this strategy"
                  >
                    <Play className="w-3 h-3 fill-current text-primary" />
                    <span>Test</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onEditRule(normalizeRule(rule))}
                    className="px-2 py-1 text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteRule(rule.id)}
                    className="p-1 text-secondary hover:text-primary transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

