import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  FlaskConical,
  Layers,
  Play,
  Sparkles,
} from 'lucide-react';
import type { Portfolio, Stock } from '../../hooks/usePortfolioData';
import { formatRuleFormula, type StrategyRule } from '../../utils/strategyConfig';
import {
  buildStarterSampleStrategies,
  resolveStrategyPortfolioId,
} from '../../utils/strategyStorage';

type LauncherSource = 'saved' | 'templates';

interface BacktestStrategyLauncherProps {
  portfolios: Portfolio[];
  stocks: Stock[];
  strategies: StrategyRule[];
  loadingStrategies: boolean;
  selectedPortfolioId: string;
  searchQuery: string;
  onRunStrategyBacktest: (rule: StrategyRule, portfolioId: string | null) => void;
}

export function BacktestStrategyLauncher({
  portfolios,
  stocks,
  strategies,
  loadingStrategies,
  selectedPortfolioId,
  searchQuery,
  onRunStrategyBacktest,
}: BacktestStrategyLauncherProps) {
  const [sourceMode, setSourceMode] = useState<LauncherSource>('saved');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');

  const portfolioNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of portfolios) {
      map.set(p.id, p.name);
    }
    return map;
  }, [portfolios]);

  const knownPortfolioIds = useMemo(
    () => new Set(portfolios.map((p) => p.id)),
    [portfolios]
  );

  const filteredSavedStrategies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return strategies.filter((rule) => {
      const ownerId = resolveStrategyPortfolioId(rule, knownPortfolioIds);
      const matchesPortfolio =
        selectedPortfolioId === 'ALL' ||
        ownerId === selectedPortfolioId ||
        ownerId === null;
      if (!matchesPortfolio) return false;
      if (!query) return true;
      const formula = formatRuleFormula(rule).toLowerCase();
      return (
        rule.name.toLowerCase().includes(query) ||
        (rule.targetSymbol || '').toLowerCase().includes(query) ||
        formula.includes(query)
      );
    });
  }, [strategies, knownPortfolioIds, selectedPortfolioId, searchQuery]);

  const templateStrategies = useMemo(() => {
    const targetPortId = selectedPortfolioId === 'ALL' ? null : selectedPortfolioId;
    const allTemplates = buildStarterSampleStrategies(targetPortId, stocks, {
      enabled: false,
      idPrefix: 'template-sim',
    });
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allTemplates;
    return allTemplates.filter((rule) => {
      const formula = formatRuleFormula(rule).toLowerCase();
      return (
        rule.name.toLowerCase().includes(query) ||
        (rule.targetSymbol || '').toLowerCase().includes(query) ||
        formula.includes(query)
      );
    });
  }, [selectedPortfolioId, stocks, searchQuery]);

  const activeList =
    sourceMode === 'saved' ? filteredSavedStrategies : templateStrategies;

  const selectedRule = useMemo(() => {
    if (activeList.length === 0) return null;
    return activeList.find((r) => r.id === selectedRuleId) ?? activeList[0];
  }, [activeList, selectedRuleId]);

  const manageStrategiesHref =
    selectedPortfolioId !== 'ALL'
      ? `/portfolio/${selectedPortfolioId}/strategy`
      : '/strategy';

  const handleLaunch = () => {
    if (!selectedRule) return;
    const ownerPortfolioId =
      sourceMode === 'saved'
        ? resolveStrategyPortfolioId(selectedRule, knownPortfolioIds)
        : selectedPortfolioId === 'ALL'
          ? null
          : selectedPortfolioId;
    onRunStrategyBacktest(selectedRule, ownerPortfolioId);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
            <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
            <span>Strategy Simulation Launcher</span>
          </h2>
          <p className="text-xs sm:text-sm text-secondary mt-0.5">
            Select a saved rule or test a built-in indicator template in-memory without modifying live automation.
          </p>
        </div>

        <Link
          to={manageStrategiesHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80 px-3 py-1.5 rounded-lg border border-divider bg-surface hover:bg-surface-hover transition-colors self-start sm:self-auto"
        >
          <span>Manage Strategies</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="rounded-2xl border border-divider bg-surface p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-divider pb-3">
          <div className="inline-flex items-center p-1 rounded-xl bg-background border border-divider self-start">
            <button
              type="button"
              onClick={() => setSourceMode('saved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                sourceMode === 'saved'
                  ? 'bg-primary text-background shadow-xs'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Saved Strategies ({filteredSavedStrategies.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('templates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                sourceMode === 'templates'
                  ? 'bg-primary text-background shadow-xs'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Built-in Templates ({templateStrategies.length})</span>
            </button>
          </div>

          <span className="text-[11px] text-secondary">
            {sourceMode === 'saved'
              ? 'Live rules loaded from Strategy Manager (read-only launcher)'
              : 'Ephemeral indicator presets — never persisted unless created in Strategy Manager'}
          </span>
        </div>

        {sourceMode === 'saved' && loadingStrategies ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 h-44 rounded-xl bg-surface-hover/50 animate-pulse border border-divider" />
            <div className="lg:col-span-7 h-44 rounded-xl bg-surface-hover/50 animate-pulse border border-divider" />
          </div>
        ) : activeList.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-dashed border-divider bg-background/50 space-y-3">
            <p className="text-xs sm:text-sm font-semibold text-primary">
              {sourceMode === 'saved'
                ? searchQuery.trim()
                  ? 'No saved strategies match your search filter.'
                  : 'No saved strategies found for this portfolio scope.'
                : 'No built-in templates match your search filter.'}
            </p>
            <p className="text-xs text-secondary max-w-md mx-auto">
              {sourceMode === 'saved'
                ? 'Switch to Built-in Templates to run an indicator simulation immediately, or create custom rules in Strategy Manager.'
                : 'Clear your search query to browse all 7 indicator simulation presets.'}
            </p>
            {sourceMode === 'saved' && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSourceMode('templates')}
                  className="px-3.5 py-2 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Try Built-in Templates</span>
                </button>
                <Link
                  to={manageStrategiesHref}
                  className="px-3.5 py-2 rounded-xl border border-divider bg-surface hover:bg-surface-hover text-primary text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Go to Strategy Manager</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Selector list */}
            <div className="lg:col-span-5 space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {activeList.map((rule) => {
                const isSelected = selectedRule?.id === rule.id;
                const ownerId =
                  sourceMode === 'saved'
                    ? resolveStrategyPortfolioId(rule, knownPortfolioIds)
                    : null;
                const scopeLabel =
                  sourceMode === 'templates'
                    ? 'Template'
                    : ownerId
                      ? portfolioNameMap.get(ownerId) || 'Portfolio'
                      : 'Global';

                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => setSelectedRuleId(rule.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-divider bg-background/60 hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-primary truncate">
                        {rule.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border border-divider bg-surface text-secondary">
                        {rule.scope === 'global' ? 'ALL' : rule.targetSymbol || 'SYMBOL'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-secondary">
                      <span>{scopeLabel}</span>
                      <span>•</span>
                      <span className="capitalize">{rule.frequency}</span>
                      {sourceMode === 'saved' && (
                        <>
                          <span>•</span>
                          <span className={rule.enabled ? 'text-emerald-500 font-medium' : 'text-secondary'}>
                            {rule.enabled ? 'Active' : 'Paused'}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Simulation configuration preview */}
            {selectedRule && (
              <div className="lg:col-span-7 rounded-xl border border-divider bg-background/70 p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                        {sourceMode === 'saved' ? 'Selected Strategy' : 'In-Memory Template'}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-primary mt-0.5">
                        {selectedRule.name}
                      </h3>
                    </div>

                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-divider bg-surface text-primary">
                      Target: {selectedRule.scope === 'global' ? 'Portfolio / Any Symbol' : selectedRule.targetSymbol || 'RELIANCE.NS'}
                    </span>
                  </div>

                  <div className="rounded-lg border border-divider bg-surface p-3">
                    <div className="text-[11px] font-semibold text-secondary mb-1">
                      Signal Rule Formula
                    </div>
                    <p className="text-xs font-mono text-primary leading-relaxed break-words">
                      {formatRuleFormula(selectedRule)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-secondary">
                    <span className="px-2 py-1 rounded-md bg-surface border border-divider">
                      Entry Rules: {(selectedRule.entryConditions?.length ?? selectedRule.conditions?.length ?? 0)}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-surface border border-divider">
                      Exit Rules: {selectedRule.exitConditions?.length ?? 0}
                    </span>
                    {selectedRule.stopLossPct ? (
                      <span className="px-2 py-1 rounded-md bg-surface border border-divider">
                        Stop Loss: -{selectedRule.stopLossPct}%
                      </span>
                    ) : null}
                    {selectedRule.takeProfitPct ? (
                      <span className="px-2 py-1 rounded-md bg-surface border border-divider">
                        Take Profit: +{selectedRule.takeProfitPct}%
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-divider">
                  <span className="text-[11px] text-secondary">
                    Configure date range &amp; starting capital in the simulation modal.
                  </span>
                  <button
                    type="button"
                    onClick={handleLaunch}
                    className="px-4 py-2 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Strategy Backtest</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

