import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2, Copy } from 'lucide-react';
import { api } from '../../../services/api/client';
import { BacktestModal } from './BacktestModal';
import type { StrategyLogEntry } from './StrategyLogsModal';
import {
  BLANK_RULE,
  formatRuleFormula,
  normalizeRule,
  type SizingType,
  type StrategyCondition,
  type StrategyRule,
} from '../utils/strategyConfig';
import { StrategyActionRuleSection } from './strategy/StrategyActionRuleSection';
import { SavedStrategiesTab } from './strategy/SavedStrategiesTab';

export type {
  SizingType,
  ActionType,
  IndicatorType,
  ComparisonOperator,
  LogicalConnector,
  StrategyCondition,
  StrategyRule,
} from '../utils/strategyConfig';

interface StrategyBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  portfolioName?: string;
  stocks: Array<{ id: string; symbol: string; quantity: number; entry_price: number }>;
  indicators: Record<string, unknown>;
  livePrices?: Record<string, { currentPrice?: number; changePercent?: number; name?: string }>;
  currencySymbol?: string;
  onLifecycleLog?: (entry: StrategyLogEntry) => void;
  initialRule?: StrategyRule | null;
  initialTab?: 'builder' | 'active';
  onStrategiesChanged?: () => void;
}

const CATEGORIES = [
  { id: 'builder', name: 'Strategy Builder' },
  { id: 'active', name: 'Saved Strategies' },
];

export function StrategyBuilderModal({
  isOpen,
  onClose,
  portfolioId,
  stocks = [],
  currencySymbol = '₹',
  onLifecycleLog,
  initialRule,
  initialTab,
  onStrategiesChanged,
}: StrategyBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<string>('builder');
  const [actionTab, setActionTab] = useState<'entry' | 'exit'>('entry');
  const storageKey = `portfolio_strategies_${portfolioId || 'global'}`;

  const [currentRule, setCurrentRule] = useState<StrategyRule>(() => BLANK_RULE);
  const [savedRules, setSavedRules] = useState<StrategyRule[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return (parsed as StrategyRule[]).filter(r => r.id !== 'rule-default').map(normalizeRule);
        }
      }
    } catch {
      // ignore invalid cache
    }
    return [];
  });

  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [isBacktestOpen, setIsBacktestOpen] = useState(false);
  const [backtestTargetRule, setBacktestTargetRule] = useState<StrategyRule | null>(null);

  const loadStrategies = useCallback(async () => {
    setIsLoading(true);
    setApiNotice(null);
    try {
      const data = await api.get(`/api/strategies?portfolio_id=${portfolioId || ''}`);
      if (Array.isArray(data)) {
        const cleaned = (data as StrategyRule[]).filter(r => r.id !== 'rule-default').map(normalizeRule);
        setSavedRules(cleaned);
        try {
          localStorage.setItem(storageKey, JSON.stringify(cleaned));
        } catch {
          // ignore storage quota errors
        }
        setIsLoading(false);
        return;
      } else if (data && data.warning) {
        setApiNotice(data.warning);
      }
    } catch (err: unknown) {
      console.warn('Could not load strategies from server, using local storage cache', err);
    } finally {
      setIsLoading(false);
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedRules((parsed as StrategyRule[]).filter(r => r.id !== 'rule-default').map(normalizeRule));
        }
      }
    } catch {
      // ignore invalid cache
    }
  }, [portfolioId, storageKey]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      void loadStrategies();
      if (initialTab) setActiveTab(initialTab);
      if (initialRule !== undefined) {
        setCurrentRule(initialRule ? normalizeRule(initialRule) : BLANK_RULE);
        setActionTab('entry');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, loadStrategies, initialRule, initialTab]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedRules));
    } catch (e) {
      console.error('Failed to save strategies locally', e);
    }
  }, [savedRules, storageKey]);

  const uniqueSymbols = useMemo(
    () => Array.from(new Set(stocks.map(s => s.symbol).filter(Boolean))).sort(),
    [stocks]
  );

  const handleCopyFormula = () => {
    navigator.clipboard.writeText(formatRuleFormula(currentRule));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveRule = async () => {
    setIsSaving(true);
    setApiNotice(null);

    const isGlobal = currentRule.scope === 'global' || !portfolioId;
    const entryConds = currentRule.entryConditions || [];
    const exitConds = currentRule.exitConditions || [];
    const entrySizingType = currentRule.entrySizingType || currentRule.sizingType || 'QTY';
    const entrySizingValue =
      currentRule.entrySizingValue !== '' && currentRule.entrySizingValue !== undefined
        ? Number(currentRule.entrySizingValue)
        : 10;
    const exitSizingType = currentRule.exitSizingType || 'DECREASE_PCT';
    const exitSizingValue =
      currentRule.exitSizingValue !== '' && currentRule.exitSizingValue !== undefined
        ? Number(currentRule.exitSizingValue)
        : 100;
    const stopLossPct =
      currentRule.stopLossPct !== '' && currentRule.stopLossPct !== undefined && currentRule.stopLossPct !== null
        ? Number(currentRule.stopLossPct)
        : null;
    const takeProfitPct =
      currentRule.takeProfitPct !== '' && currentRule.takeProfitPct !== undefined && currentRule.takeProfitPct !== null
        ? Number(currentRule.takeProfitPct)
        : null;

    const payload = {
      portfolio_id: isGlobal ? null : portfolioId,
      portfolio_id_context: portfolioId,
      name: currentRule.name.trim() || 'Untitled Strategy',
      scope: currentRule.scope || 'global',
      target_symbol: currentRule.targetSymbol || 'ALL',
      action: 'BUY',
      sizing_type: entrySizingType,
      sizing_value: entrySizingValue,
      conditions: {
        entry: entryConds,
        exit: exitConds,
        entrySizingType,
        entrySizingValue,
        exitSizingType,
        exitSizingValue,
        stopLossPct: stopLossPct ?? '',
        takeProfitPct: takeProfitPct ?? '',
      },
      entryConditions: entryConds,
      entrySizingType,
      entrySizingValue,
      exitConditions: exitConds,
      exitSizingType,
      exitSizingValue,
      stopLossPct,
      takeProfitPct,
      enabled: currentRule.enabled ?? true,
      frequency: currentRule.frequency || 'daily',
    };

    let savedRule: (StrategyRule & { lifecycleLog?: StrategyLogEntry; lifecycleLogPersisted?: boolean }) | null;
    try {
      const isExisting = currentRule.id && savedRules.some(r => r.id === currentRule.id);
      if (isExisting && !currentRule.id.startsWith('local-')) {
        savedRule = await api.put(`/api/strategies/${currentRule.id}`, payload);
        if (savedRule?.lifecycleLog && savedRule?.lifecycleLogPersisted === false && onLifecycleLog) {
          onLifecycleLog(savedRule.lifecycleLog);
        }
      } else {
        savedRule = await api.post('/api/strategies', payload);
      }
    } catch (err: unknown) {
      console.warn('API save failed, saving locally', err);
      savedRule = {
        ...currentRule,
        id: currentRule.id || `local-${Date.now()}`,
        name: currentRule.name.trim() || 'Untitled Strategy',
        createdAt: currentRule.createdAt || new Date().toISOString(),
        entryConditions: entryConds,
        entrySizingType,
        entrySizingValue,
        exitConditions: exitConds,
        exitSizingType,
        exitSizingValue,
        stopLossPct: stopLossPct ?? '',
        takeProfitPct: takeProfitPct ?? '',
        conditions: entryConds.length > 0 ? entryConds : exitConds,
      };
      setApiNotice('Saved locally. Database sync will happen automatically.');
    }

    if (savedRule) {
      const finalRule = normalizeRule(savedRule);
      setSavedRules(prev => {
        const existingIdx = prev.findIndex(r => r.id === finalRule.id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = finalRule;
          return next;
        }
        return [finalRule, ...prev];
      });

      setCurrentRule(finalRule);
      setSaveSuccess(true);
      onStrategiesChanged?.();
      setTimeout(() => {
        setSaveSuccess(false);
        setActiveTab('active');
      }, 700);
    }

    setIsSaving(false);
  };

  const currentConditions =
    actionTab === 'entry' ? currentRule.entryConditions || [] : currentRule.exitConditions || [];

  const updateActiveConditions = (transform: (list: StrategyCondition[]) => StrategyCondition[]) => {
    setCurrentRule(prev => {
      if (actionTab === 'entry') {
        const nextEntry = transform(prev.entryConditions || []);
        return { ...prev, entryConditions: nextEntry, conditions: nextEntry };
      }
      return { ...prev, exitConditions: transform(prev.exitConditions || []) };
    });
  };

  const handleAddCondition = () => {
    const newCond: StrategyCondition = {
      id: `cond-${Date.now()}`,
      connector: currentConditions.length > 0 ? 'AND' : undefined,
      leftIndicator: '',
      operator: '',
      rightType: 'value',
      rightValue: '',
      rightIndicator: '',
    };
    updateActiveConditions(list => [...list, newCond]);
  };

  const handleRemoveCondition = (id: string) =>
    updateActiveConditions(list => list.filter(c => c.id !== id));

  const handleUpdateCondition = (id: string, updates: Partial<StrategyCondition>) =>
    updateActiveConditions(list => list.map(c => (c.id === id ? { ...c, ...updates } : c)));

  const handleDeleteSavedRule = async (id: string) => {
    setSavedRules(prev => prev.filter(r => r.id !== id));
    if (currentRule.id === id) setCurrentRule(BLANK_RULE);
    try {
      if (!id.startsWith('local-')) await api.delete(`/api/strategies/${id}`);
      onStrategiesChanged?.();
    } catch (err) {
      console.error('Failed to delete strategy on server', err);
    }
  };

  const handleToggleRuleStatus = async (id: string) => {
    const target = savedRules.find(r => r.id === id);
    if (!target) return;
    const newStatus = !target.enabled;

    setSavedRules(prev => prev.map(r => (r.id === id ? { ...r, enabled: newStatus } : r)));

    const buildLocalToggleEntry = (): StrategyLogEntry => {
      const eventType = newStatus ? 'STRATEGY_RESUMED' : 'STRATEGY_PAUSED';
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return {
        id: `local-${eventType.toLowerCase()}-${id}-${Date.now()}`,
        portfolioId,
        strategyId: id,
        strategyName: target.name || 'Untitled Strategy',
        symbol: target.targetSymbol || 'ALL',
        eventType,
        actionText: newStatus
          ? `Strategy "${target.name || 'Untitled Strategy'}" resumed`
          : `Strategy "${target.name || 'Untitled Strategy'}" paused`,
        eventDate: `${y}-${m}-${d}`,
        loggedAt: now.toISOString(),
        source: 'local',
      };
    };

    try {
      if (!id.startsWith('local-')) {
        const updated = await api.put(`/api/strategies/${id}`, {
          enabled: newStatus,
          portfolio_id_context: portfolioId,
        });
        if (updated?.lifecycleLog && updated?.lifecycleLogPersisted === false && onLifecycleLog) {
          onLifecycleLog(updated.lifecycleLog);
        }
        onStrategiesChanged?.();
      } else {
        onLifecycleLog?.(buildLocalToggleEntry());
        onStrategiesChanged?.();
      }
    } catch (err) {
      console.error('Failed to toggle strategy on server', err);
      onLifecycleLog?.(buildLocalToggleEntry());
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-2xl sm:max-w-3xl h-[88vh] md:h-[640px] max-h-[calc(100vh-2rem)] bg-surface border border-divider rounded-xl shadow-2xl flex flex-col overflow-hidden text-primary">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-divider shrink-0 bg-surface">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-primary">Strategy Builder</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              Dual-Action: Buy &amp; Sell
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 -mr-1 sm:-mr-2 text-secondary hover:text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-hidden flex-1 flex flex-row gap-3 sm:gap-6 min-h-0 bg-surface">
          <div className="w-28 sm:w-40 md:w-44 shrink-0 flex flex-col min-h-0 pr-2 sm:pr-4 border-r border-divider">
            <h3 className="text-xs sm:text-sm font-medium text-primary mb-2 sm:mb-3 px-2 sm:px-3">Navigation</h3>
            <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1 pb-4">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`text-left px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap ${
                    activeTab === cat.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-secondary hover:bg-surface-hover hover:text-primary'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto pr-1 pb-2">
            {activeTab === 'builder' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-primary mb-0.5">Dual-Action Strategy</h3>
                    <p className="text-[10px] sm:text-xs text-secondary">
                      Configure both Entry (BUY) and Exit (SELL) conditions in a single unified trading strategy.
                    </p>
                  </div>
                  {(currentRule.name ||
                    (currentRule.entryConditions && currentRule.entryConditions.length > 0) ||
                    (currentRule.exitConditions && currentRule.exitConditions.length > 0) ||
                    currentRule.stopLossPct ||
                    currentRule.takeProfitPct) && (
                    <button
                      type="button"
                      onClick={() => setCurrentRule(BLANK_RULE)}
                      className="text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Scope & Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">Strategy Name</label>
                    <input
                      type="text"
                      value={currentRule.name}
                      onChange={e => setCurrentRule(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. RSI Dip Buy & Momentum Exit"
                      className="w-full bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">Target Stock Scope</label>
                    <select
                      value={currentRule.scope === 'global' ? 'ALL' : currentRule.targetSymbol || 'ALL'}
                      onChange={e => {
                        const val = e.target.value;
                        setCurrentRule(prev =>
                          val === 'ALL'
                            ? { ...prev, scope: 'global', targetSymbol: 'ALL' }
                            : { ...prev, scope: 'stock', targetSymbol: val }
                        );
                      }}
                      className="w-full bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="ALL">All Portfolio Holdings (Global)</option>
                      {uniqueSymbols.map(sym => (
                        <option key={sym} value={sym}>{sym}</option>
                      ))}
                      {currentRule.scope === 'stock' &&
                        currentRule.targetSymbol &&
                        !uniqueSymbols.includes(currentRule.targetSymbol) && (
                          <option value={currentRule.targetSymbol}>
                            {currentRule.targetSymbol} (Closed / Inactive)
                          </option>
                        )}
                    </select>
                  </div>
                </div>

                {/* Entry vs Exit Tabs */}
                <div className="flex items-center gap-2 border-b border-divider pb-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActionTab('entry')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      actionTab === 'entry'
                        ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                        : 'text-secondary hover:text-primary hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    <span>Entry Rule (BUY)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface border border-divider font-mono">
                      {currentRule.entryConditions?.length ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionTab('exit')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      actionTab === 'exit'
                        ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                        : 'text-secondary hover:text-primary hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    <span>Exit Rule (SELL)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface border border-divider font-mono">
                      {currentRule.exitConditions?.length ?? 0}
                    </span>
                  </button>
                </div>

                {actionTab === 'entry' ? (
                  <StrategyActionRuleSection
                    mode="entry"
                    sizingType={(currentRule.entrySizingType || currentRule.sizingType || 'QTY') as SizingType}
                    sizingValue={
                      currentRule.entrySizingValue !== undefined && currentRule.entrySizingValue !== null
                        ? currentRule.entrySizingValue
                        : currentRule.sizingValue || ''
                    }
                    currencySymbol={currencySymbol}
                    conditions={currentRule.entryConditions || []}
                    onSizingTypeChange={nextType =>
                      setCurrentRule(prev => ({ ...prev, entrySizingType: nextType }))
                    }
                    onSizingValueChange={nextValue =>
                      setCurrentRule(prev => ({ ...prev, entrySizingValue: nextValue }))
                    }
                    onAddCondition={handleAddCondition}
                    onUpdateCondition={handleUpdateCondition}
                    onRemoveCondition={handleRemoveCondition}
                  />
                ) : (
                  <StrategyActionRuleSection
                    mode="exit"
                    sizingType={(currentRule.exitSizingType || 'DECREASE_PCT') as SizingType}
                    sizingValue={
                      currentRule.exitSizingValue !== undefined && currentRule.exitSizingValue !== null
                        ? currentRule.exitSizingValue
                        : 100
                    }
                    currencySymbol={currencySymbol}
                    conditions={currentRule.exitConditions || []}
                    onSizingTypeChange={nextType =>
                      setCurrentRule(prev => ({ ...prev, exitSizingType: nextType }))
                    }
                    onSizingValueChange={nextValue =>
                      setCurrentRule(prev => ({ ...prev, exitSizingValue: nextValue }))
                    }
                    onAddCondition={handleAddCondition}
                    onUpdateCondition={handleUpdateCondition}
                    onRemoveCondition={handleRemoveCondition}
                  />
                )}

                {/* Formula Preview */}
                <div className="p-3 bg-surface border border-divider rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-secondary text-xs">
                    <span className="font-medium text-primary">Unified Strategy Formula</span>
                    <button
                      type="button"
                      onClick={handleCopyFormula}
                      className="text-secondary hover:text-primary text-[11px] transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-surface-hover/50 rounded border border-divider font-mono text-xs text-primary overflow-x-auto whitespace-nowrap">
                    {formatRuleFormula(currentRule)}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'active' && (
              <SavedStrategiesTab
                apiNotice={apiNotice}
                isLoading={isLoading}
                savedRules={savedRules}
                onCreateNew={() => {
                  setCurrentRule(BLANK_RULE);
                  setActionTab('entry');
                  setActiveTab('builder');
                }}
                onToggleRuleStatus={handleToggleRuleStatus}
                onBacktestRule={rule => {
                  setBacktestTargetRule(rule);
                  setIsBacktestOpen(true);
                }}
                onEditRule={rule => {
                  setCurrentRule(rule);
                  setActionTab('entry');
                  setActiveTab('builder');
                }}
                onDeleteRule={handleDeleteSavedRule}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-divider bg-surface flex items-center justify-between shrink-0">
          <div className="text-xs text-secondary">
            {savedRules.filter(r => r.enabled).length} active strategy rule(s)
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-secondary hover:text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveRule}
              className="px-5 py-2 rounded-lg bg-primary hover:opacity-90 disabled:opacity-50 text-surface text-xs font-semibold shadow transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-surface" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3] text-surface" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save Strategy</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {isBacktestOpen && backtestTargetRule && (
        <BacktestModal
          isOpen={isBacktestOpen}
          onClose={() => setIsBacktestOpen(false)}
          rule={backtestTargetRule}
          stocks={stocks}
          currencySymbol={currencySymbol}
          portfolioId={portfolioId}
          onBacktestCompleted={() => {
            setIsBacktestOpen(false);
            onClose();
          }}
        />
      )}
    </div>,
    document.body
  );
}
