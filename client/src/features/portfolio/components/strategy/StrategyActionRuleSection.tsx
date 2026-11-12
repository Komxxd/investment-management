import React from 'react';
import { ArrowDownRight, ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import {
  LEFT_INDICATOR_OPTIONS,
  OPERATOR_OPTIONS,
  RIGHT_INDICATOR_OPTIONS,
  type ComparisonOperator,
  type IndicatorType,
  type SizingType,
  type StrategyCondition,
} from '../../utils/strategyConfig';

interface StrategyActionRuleSectionProps {
  mode: 'entry' | 'exit';
  sizingType: SizingType | '';
  sizingValue: number | '';
  currencySymbol: string;
  conditions: StrategyCondition[];
  onSizingTypeChange: (nextType: SizingType) => void;
  onSizingValueChange: (nextValue: number | '') => void;
  onAddCondition: () => void;
  onUpdateCondition: (id: string, updates: Partial<StrategyCondition>) => void;
  onRemoveCondition: (id: string) => void;
}

/**
 * Shared rule configuration section used for both Entry (BUY) and Exit (SELL) strategy rules.
 */
export const StrategyActionRuleSection: React.FC<StrategyActionRuleSectionProps> = ({
  mode,
  sizingType,
  sizingValue,
  currencySymbol,
  conditions,
  onSizingTypeChange,
  onSizingValueChange,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
}) => {
  const isEntry = mode === 'entry';
  const pctType: SizingType = isEntry ? 'INCREASE_PCT' : 'DECREASE_PCT';
  const pctLabel = isEntry ? 'INCREASE%' : 'DECREASE%';
  const sizingOptions: Array<{ type: SizingType; label: string }> = [
    { type: 'QTY', label: 'QTY' },
    { type: 'VALUE', label: 'VALUE' },
    { type: pctType, label: pctLabel },
  ];

  return (
    <div className="space-y-3.5 bg-surface p-3.5 rounded-lg border border-divider">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
          {isEntry ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-secondary" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5 text-secondary" />
          )}
          <span>{isEntry ? 'Position Entry (When to Buy)' : 'Position Exit (When to Sell)'}</span>
        </div>
        <span className="text-[10px] text-secondary">
          {isEntry
            ? 'Executes when no position is open or to scale in'
            : 'Executes when position is open to scale out or exit'}
        </span>
      </div>

      {/* Sizing */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-medium text-secondary">
          {isEntry ? 'BUY Sizing & Allocation' : 'SELL Sizing & Allocation'}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-0.5 bg-surface border border-divider rounded-lg">
            {sizingOptions.map(opt => (
              <button
                key={opt.type}
                type="button"
                onClick={() => onSizingTypeChange(opt.type)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  sizingType === opt.type
                    ? 'bg-primary text-surface font-semibold'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              value={sizingValue}
              onChange={e => onSizingValueChange(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Value"
              className="w-24 bg-surface border border-divider rounded-lg px-2.5 py-1 text-xs text-primary font-mono focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-secondary font-mono">
              {sizingType === 'QTY' && 'Shares'}
              {sizingType === 'VALUE' && currencySymbol}
              {sizingType === pctType && '%'}
            </span>
          </div>
        </div>
      </div>

      {/* Conditions List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-medium text-secondary">
            {isEntry ? 'Entry Conditions (IF)' : 'Exit Conditions (IF)'}
          </label>

          <button
            type="button"
            onClick={onAddCondition}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Condition</span>
          </button>
        </div>

        {conditions.length === 0 ? (
          <div className="p-3.5 border border-dashed border-divider rounded-lg text-center space-y-2 bg-surface-hover/30">
            <p className="text-xs text-secondary">
              {isEntry ? 'No entry conditions configured yet.' : 'No exit conditions configured yet.'}
            </p>
            <button
              type="button"
              onClick={onAddCondition}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary border border-divider rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEntry ? 'Add Entry Condition (e.g. RSI < 30)' : 'Add Exit Condition (e.g. RSI > 70)'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="space-y-1.5">
                {idx > 0 && (
                  <div className="flex items-center gap-2 pl-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCondition(cond.id, {
                          connector: cond.connector === 'OR' ? 'AND' : 'OR',
                        })
                      }
                      className="px-2 py-0.5 rounded text-[10px] font-mono border border-divider bg-surface text-secondary hover:text-primary transition-colors"
                    >
                      {cond.connector || 'AND'}
                    </button>
                    <div className="h-[1px] flex-1 bg-divider" />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 p-2 bg-surface border border-divider rounded-lg">
                  <select
                    value={cond.leftIndicator || ''}
                    onChange={e =>
                      onUpdateCondition(cond.id, { leftIndicator: e.target.value as IndicatorType })
                    }
                    className="bg-surface border border-divider rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-primary"
                  >
                    <option value="" disabled>Indicator</option>
                    {LEFT_INDICATOR_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={cond.operator || ''}
                    onChange={e =>
                      onUpdateCondition(cond.id, { operator: e.target.value as ComparisonOperator })
                    }
                    className="bg-surface border border-divider rounded-lg px-2 py-1 text-xs font-mono text-primary focus:outline-none focus:border-primary"
                  >
                    <option value="" disabled>Op</option>
                    {OPERATOR_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {cond.operator !== 'BULLISH_DIVERGENCE' && cond.operator !== 'BEARISH_DIVERGENCE' && (
                    <>
                      <div className="inline-flex items-center p-0.5 bg-surface border border-divider rounded">
                        <button
                          type="button"
                          onClick={() => onUpdateCondition(cond.id, { rightType: 'value' })}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            cond.rightType === 'value'
                              ? 'bg-primary text-surface font-semibold'
                              : 'text-secondary hover:text-primary'
                          }`}
                        >
                          Val
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateCondition(cond.id, { rightType: 'indicator' })}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            cond.rightType === 'indicator'
                              ? 'bg-primary text-surface font-semibold'
                              : 'text-secondary hover:text-primary'
                          }`}
                        >
                          Ind
                        </button>
                      </div>

                      {cond.rightType === 'value' ? (
                        <input
                          type="number"
                          value={cond.rightValue !== undefined && cond.rightValue !== null ? cond.rightValue : ''}
                          onChange={e =>
                            onUpdateCondition(cond.id, {
                              rightValue: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          placeholder="Value"
                          className="w-20 bg-surface border border-divider rounded-lg px-2 py-1 text-xs text-primary font-mono focus:outline-none focus:border-primary"
                        />
                      ) : (
                        <select
                          value={cond.rightIndicator || ''}
                          onChange={e =>
                            onUpdateCondition(cond.id, { rightIndicator: e.target.value as IndicatorType })
                          }
                          className="bg-surface border border-divider rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-primary"
                        >
                          <option value="" disabled>Indicator</option>
                          {RIGHT_INDICATOR_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveCondition(cond.id)}
                    className="ml-auto p-1 text-secondary hover:text-primary rounded transition-colors cursor-pointer"
                    title="Remove condition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

