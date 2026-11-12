import { X, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  formatRuleFormula,
  type StrategyRule,
  type StrategyCondition,
} from '../../utils/strategyConfig';
import type { PortfolioBacktestConfigSummary } from './backtestResultsUtils';

interface BacktestConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioConfig: PortfolioBacktestConfigSummary | null;
  rule: StrategyRule;
  activeConfigRule: StrategyRule | null;
  entryConditionsList: StrategyCondition[];
  exitConditionsList: StrategyCondition[];
  resultSymbol: string;
  currencySymbol: string;
}

/**
 * Displays the portfolio SIP/lump-sum parameters or strategy rule conditions used for the simulation.
 */
export function BacktestConfigModal({
  isOpen,
  onClose,
  portfolioConfig,
  rule,
  activeConfigRule,
  entryConditionsList,
  exitConditionsList,
  resultSymbol,
  currencySymbol,
}: BacktestConfigModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-surface border border-divider rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4 text-primary">
        <div className="flex items-center justify-between pb-3 border-b border-divider">
          <h3 className="text-sm font-bold text-primary">
            {portfolioConfig ? 'Portfolio Backtest Configuration' : 'Strategy Configuration'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-secondary hover:text-primary rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {portfolioConfig ? (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-secondary block mb-1 font-medium">Portfolio</label>
                <div className="font-semibold text-primary">
                  {portfolioConfig.portfolioName || rule.name}
                </div>
              </div>
              <div>
                <label className="text-secondary block mb-1 font-medium">Strategy Type</label>
                <div className="font-bold text-primary">
                  {portfolioConfig.mode === 'SIP' ? 'Recurring Monthly SIP' : 'One-Time Lump Sum'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-surface border border-divider rounded-xl space-y-2">
              <div className="text-xs font-semibold text-primary">
                {portfolioConfig.mode === 'SIP' ? 'SIP Execution Schedule' : 'Capital Allocation'}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                {portfolioConfig.mode === 'SIP' ? (
                  <>
                    <div className="p-2 rounded-lg bg-background border border-divider">
                      <span className="text-secondary block text-[10px]">Monthly Amount</span>
                      <span className="font-bold font-mono text-primary">
                        {currencySymbol}
                        {Number(portfolioConfig.sipAmount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-divider">
                      <span className="text-secondary block text-[10px]">Execution Day</span>
                      <span className="font-bold font-mono text-primary">
                        Day {portfolioConfig.sipDay || 1}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-divider">
                      <span className="text-secondary block text-[10px]">Execution Time</span>
                      <span className="font-bold font-mono text-primary">
                        {portfolioConfig.sipTime || '09:15'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="p-2 rounded-lg bg-background border border-divider col-span-2 sm:col-span-3">
                    <span className="text-secondary block text-[10px]">Initial Lump Sum Capital</span>
                    <span className="font-bold font-mono text-primary">
                      {currencySymbol}
                      {Number(portfolioConfig.initialCapital || 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {portfolioConfig.constituents && portfolioConfig.constituents.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-secondary block font-medium">Portfolio Constituents</label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {portfolioConfig.constituents.map(c => {
                    const sym = typeof c === 'string' ? c : c.symbol;
                    return (
                      <span
                        key={sym}
                        className="px-2.5 py-1 rounded-lg bg-background border border-divider font-mono font-bold text-xs text-primary"
                      >
                        {sym}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-secondary block mb-1 font-medium">Strategy Name</label>
                <div className="font-semibold text-primary">
                  {activeConfigRule?.name || rule.name || 'Untitled Strategy'}
                </div>
              </div>
              <div>
                <label className="text-secondary block mb-1 font-medium">Target Stock</label>
                <div className="font-mono text-primary font-bold">{resultSymbol}</div>
              </div>
            </div>

            <div className="p-3 bg-surface border border-divider rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <ArrowUpRight className="w-3.5 h-3.5 text-secondary" />
                  <span>Entry Rule (BUY)</span>
                </div>
                <span className="text-[10px] font-mono text-secondary px-2 py-0.5 rounded bg-surface-hover border border-divider">
                  {activeConfigRule?.entrySizingType || 'QTY'} ({activeConfigRule?.entrySizingValue || 10})
                </span>
              </div>
              {entryConditionsList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {entryConditionsList.map((cond, idx) => (
                    <span
                      key={cond.id || idx}
                      className="px-2 py-1 rounded text-[11px] font-mono bg-surface-hover border border-divider text-primary"
                    >
                      {idx > 0 && (
                        <span className="text-secondary font-bold mr-1">
                          {cond.connector || 'AND'}
                        </span>
                      )}
                      {cond.leftIndicator?.toUpperCase()} {cond.operator}{' '}
                      {cond.rightType === 'indicator'
                        ? cond.rightIndicator?.toUpperCase()
                        : cond.rightValue}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-secondary italic">
                  No entry conditions (Direct Entry on signal)
                </p>
              )}
            </div>

            <div className="p-3 bg-surface border border-divider rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <ArrowDownRight className="w-3.5 h-3.5 text-secondary" />
                  <span>Exit Rule (SELL)</span>
                </div>
                <span className="text-[10px] font-mono text-secondary px-2 py-0.5 rounded bg-surface-hover border border-divider">
                  {activeConfigRule?.exitSizingType || 'DECREASE_PCT'} (
                  {activeConfigRule?.exitSizingValue ?? 100}%)
                </span>
              </div>
              {exitConditionsList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {exitConditionsList.map((cond, idx) => (
                    <span
                      key={cond.id || idx}
                      className="px-2 py-1 rounded text-[11px] font-mono bg-surface-hover border border-divider text-primary"
                    >
                      {idx > 0 && (
                        <span className="text-secondary font-bold mr-1">
                          {cond.connector || 'AND'}
                        </span>
                      )}
                      {cond.leftIndicator?.toUpperCase()} {cond.operator}{' '}
                      {cond.rightType === 'indicator'
                        ? cond.rightIndicator?.toUpperCase()
                        : cond.rightValue}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-secondary italic">No exit conditions configured</p>
              )}
            </div>

            <div>
              <label className="text-secondary block mb-1 font-medium">Unified Formula</label>
              <div className="p-2.5 bg-background border border-divider rounded-lg font-mono text-xs text-primary overflow-x-auto whitespace-nowrap">
                {formatRuleFormula(activeConfigRule || rule)}
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-primary text-surface text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

