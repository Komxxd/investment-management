import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Plus, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../../services/api/client';

export type SizingType = 'QTY' | 'VALUE' | 'INCREASE_PCT' | 'DECREASE_PCT';
export type ActionType = 'BUY' | 'SELL' | 'ALERT';
export type IndicatorType = 'rsi' | 'dma50' | 'dma200' | 'price' | 'changePct';
export type ComparisonOperator = '<' | '>' | '<=' | '>=' | 'CROSSINGOVER' | 'CROSSINGUNDER' | '==';
export type LogicalConnector = 'AND' | 'OR';

export interface StrategyCondition {
  id: string;
  connector?: LogicalConnector;
  leftIndicator: IndicatorType | '';
  operator: ComparisonOperator | '';
  rightType: 'value' | 'indicator';
  rightValue?: number | '';
  rightIndicator?: IndicatorType | '';
}

export interface StrategyRule {
  id: string;
  name: string;
  scope: 'global' | 'stock';
  targetSymbol?: string;
  action?: ActionType | '';
  sizingType?: SizingType | '';
  sizingValue?: number | '';
  conditions: StrategyCondition[];
  enabled: boolean;
  createdAt: string;
  frequency: 'daily' | 'realtime';
}

interface StrategyBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  portfolioName?: string;
  stocks: Array<{ id: string; symbol: string; quantity: number; entry_price: number }>;
  indicators: Record<string, { rsi?: number | null; dma50?: number | null; dma200?: number | null }>;
  livePrices?: Record<string, { currentPrice?: number; changePercent?: number; name?: string }>;
  currencySymbol?: string;
}

export const BLANK_RULE: StrategyRule = {
  id: '',
  name: '',
  scope: 'global',
  targetSymbol: 'ALL',
  action: '',
  sizingType: '',
  sizingValue: '',
  conditions: [],
  enabled: true,
  createdAt: '',
  frequency: 'daily'
};

export function formatRuleFormula(rule: StrategyRule): string {
  const hasAction = !!rule.action;
  const hasSizing = !!rule.sizingType || (rule.sizingValue !== '' && rule.sizingValue !== undefined);
  const hasConditions = rule.conditions && rule.conditions.length > 0;

  if (!hasAction && !hasSizing && !hasConditions && !rule.name) {
    return 'Configure strategy parameters above to preview formula';
  }

  const action = rule.action || '[ACTION]';
  const target = rule.scope === 'global' ? 'ALL_PORTFOLIO' : (rule.targetSymbol || 'TARGET');
  
  let sizing = '';
  if (rule.sizingType === 'QTY') sizing = `QTY(${rule.sizingValue !== '' && rule.sizingValue !== undefined ? rule.sizingValue : '?'})`;
  else if (rule.sizingType === 'VALUE') sizing = `VALUE(${rule.sizingValue !== '' && rule.sizingValue !== undefined ? rule.sizingValue : '?'})`;
  else if (rule.sizingType === 'INCREASE_PCT') sizing = `INCREASE%(${rule.sizingValue !== '' && rule.sizingValue !== undefined ? rule.sizingValue : '?'})`;
  else if (rule.sizingType === 'DECREASE_PCT') sizing = `DECREASE%(${rule.sizingValue !== '' && rule.sizingValue !== undefined ? rule.sizingValue : '?'})`;
  else if (rule.sizingValue !== '' && rule.sizingValue !== undefined) sizing = `(${rule.sizingValue})`;
  else sizing = '[SIZING]';

  if (!hasConditions) {
    return `${action} ${target} ${sizing} IF [CONDITIONS]`;
  }

  const conditionsStr = rule.conditions.map((cond, idx) => {
    const conn = idx > 0 ? ` ${cond.connector || 'AND'} ` : '';
    
    let left = cond.leftIndicator ? cond.leftIndicator : '[INDICATOR]';
    if (cond.leftIndicator === 'rsi') left = 'RSI(day)';
    else if (cond.leftIndicator === 'dma50') left = 'DMA(50)';
    else if (cond.leftIndicator === 'dma200') left = 'DMA(200)';
    else if (cond.leftIndicator === 'price') left = 'PRICE';
    else if (cond.leftIndicator === 'changePct') left = 'CHANGE%';

    const op = cond.operator || '[OP]';
    
    let right = '';
    if (cond.rightType === 'indicator') {
      if (cond.rightIndicator === 'dma200') right = 'DMA(200)';
      else if (cond.rightIndicator === 'dma50') right = 'DMA(50)';
      else if (cond.rightIndicator === 'rsi') right = 'RSI(day)';
      else if (cond.rightIndicator === 'price') right = 'PRICE';
      else right = cond.rightIndicator ? cond.rightIndicator : '[INDICATOR]';
    } else {
      right = (cond.rightValue !== '' && cond.rightValue !== undefined) ? String(cond.rightValue) : '[VALUE]';
    }

    const opFormatted = (op === 'CROSSINGOVER' || op === 'CROSSINGUNDER') ? ` ${op} ` : op;
    return `${conn}${left}${opFormatted.startsWith(' ') ? '' : ' '}${opFormatted}${opFormatted.endsWith(' ') ? '' : ' '}${right}`;
  }).join('');

  return `${action} ${target} ${sizing} IF ${conditionsStr}`;
}

const CATEGORIES = [
  { id: 'builder', name: 'Global Strategy' },
  { id: 'active', name: 'Saved Strategies' }
];

export function StrategyBuilderModal({
  isOpen,
  onClose,
  portfolioId,
  stocks = [],
  indicators = {},
  livePrices = {},
  currencySymbol = '₹'
}: StrategyBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<string>('builder');
  
  const storageKey = `portfolio_strategies_${portfolioId || 'global'}`;

  const [currentRule, setCurrentRule] = useState<StrategyRule>(() => BLANK_RULE);

  const [savedRules, setSavedRules] = useState<StrategyRule[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((r: any) => r.id !== 'rule-default');
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);

  // Load strategies from backend with localStorage fallback
  const loadStrategies = async () => {
    setIsLoading(true);
    setApiNotice(null);
    try {
      const data = await api.get(`/api/strategies?portfolio_id=${portfolioId || ''}`);
      if (Array.isArray(data)) {
        const cleaned = data.filter((r: any) => r.id !== 'rule-default');
        setSavedRules(cleaned);
        try {
          localStorage.setItem(storageKey, JSON.stringify(cleaned));
        } catch {}
        setIsLoading(false);
        return;
      } else if (data && data.warning) {
        setApiNotice(data.warning);
      }
    } catch (err: any) {
      console.warn('Could not load strategies from server, using local storage cache', err);
    } finally {
      setIsLoading(false);
    }

    // Fallback to localStorage if API unavailable
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedRules(parsed.filter((r: any) => r.id !== 'rule-default'));
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      loadStrategies();
    }
  }, [isOpen, portfolioId]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedRules));
    } catch (e) {
      console.error('Failed to save strategies locally', e);
    }
  }, [savedRules, storageKey]);

  const uniqueSymbols = useMemo(() => {
    return Array.from(new Set(stocks.map(s => s.symbol).filter(Boolean))).sort();
  }, [stocks]);

  const handleCopyFormula = () => {
    const formula = formatRuleFormula(currentRule);
    navigator.clipboard.writeText(formula);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveRule = async () => {
    setIsSaving(true);
    setApiNotice(null);

    const isGlobal = currentRule.scope === 'global' || !portfolioId;
    const payload = {
      portfolio_id: isGlobal ? null : portfolioId,
      name: currentRule.name.trim() || 'Untitled Strategy',
      scope: currentRule.scope || 'global',
      target_symbol: currentRule.targetSymbol || 'ALL',
      action: currentRule.action || 'BUY',
      sizing_type: currentRule.sizingType || 'QTY',
      sizing_value: currentRule.sizingValue !== '' && currentRule.sizingValue !== undefined ? Number(currentRule.sizingValue) : null,
      conditions: currentRule.conditions || [],
      enabled: currentRule.enabled ?? true,
      frequency: currentRule.frequency || 'daily'
    };

    let savedRule: StrategyRule | null = null;
    try {
      const isExisting = currentRule.id && savedRules.some(r => r.id === currentRule.id);
      if (isExisting && !currentRule.id.startsWith('local-')) {
        savedRule = await api.put(`/api/strategies/${currentRule.id}`, payload);
      } else {
        savedRule = await api.post('/api/strategies', payload);
      }
    } catch (err: any) {
      console.warn('API save failed, saving locally', err);
      savedRule = {
        ...currentRule,
        id: currentRule.id || `local-${Date.now()}`,
        name: currentRule.name.trim() || 'Untitled Strategy',
        createdAt: currentRule.createdAt || new Date().toISOString()
      };
      setApiNotice('Saved locally. Run the Supabase SQL script to enable database sync.');
    }

    if (savedRule) {
      const finalRule = savedRule;
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
      setTimeout(() => {
        setSaveSuccess(false);
        setActiveTab('active');
      }, 700);
    }

    setIsSaving(false);
  };

  const handleAddCondition = () => {
    const newCond: StrategyCondition = {
      id: `cond-${Date.now()}`,
      connector: currentRule.conditions.length > 0 ? 'AND' : undefined,
      leftIndicator: '',
      operator: '',
      rightType: 'value',
      rightValue: '',
      rightIndicator: '',
    };
    setCurrentRule(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCond]
    }));
  };

  const handleRemoveCondition = (id: string) => {
    setCurrentRule(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== id)
    }));
  };

  const handleUpdateCondition = (id: string, updates: Partial<StrategyCondition>) => {
    setCurrentRule(prev => ({
      ...prev,
      conditions: prev.conditions.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const handleDeleteSavedRule = async (id: string) => {
    setSavedRules(prev => prev.filter(r => r.id !== id));
    if (currentRule.id === id) {
      setCurrentRule(BLANK_RULE);
    }
    try {
      if (!id.startsWith('local-')) {
        await api.delete(`/api/strategies/${id}`);
      }
    } catch (err) {
      console.error('Failed to delete strategy on server', err);
    }
  };

  const handleToggleRuleStatus = async (id: string) => {
    const target = savedRules.find(r => r.id === id);
    if (!target) return;
    const newStatus = !target.enabled;

    setSavedRules(prev => prev.map(r => r.id === id ? { ...r, enabled: newStatus } : r));

    try {
      if (!id.startsWith('local-')) {
        await api.put(`/api/strategies/${id}`, { enabled: newStatus });
      }
    } catch (err) {
      console.error('Failed to toggle strategy on server', err);
    }
  };

  // Only render after all hooks are evaluated
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog Matching Indices Setting & Indicators UI */}
      <div className="relative w-full max-w-2xl sm:max-w-3xl h-[85vh] md:h-[540px] max-h-[calc(100vh-2rem)] bg-surface border border-divider rounded-xl shadow-2xl flex flex-col overflow-hidden text-primary">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-divider shrink-0 bg-surface">
          <h2 className="text-base sm:text-lg font-semibold text-primary">Strategy Builder</h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 -mr-1 sm:-mr-2 text-secondary hover:text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Body (Two Column Layout matching SettingsModal & AddIndicatorsModal) */}
        <div className="p-4 sm:p-6 overflow-hidden flex-1 flex flex-row gap-3 sm:gap-6 min-h-0 bg-surface">
          
          {/* Left Column: Categories List */}
          <div className="w-28 sm:w-40 md:w-48 shrink-0 flex flex-col min-h-0 pr-2 sm:pr-4 border-r border-divider">
            <h3 className="text-xs sm:text-sm font-medium text-primary mb-2 sm:mb-3 px-2 sm:px-3">Categories</h3>
            <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1 pb-4">
              {CATEGORIES.map(cat => {
                const isActive = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id)}
                    className={`text-left px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-secondary hover:bg-surface-hover hover:text-primary'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Tab Content */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto pr-1 pb-2">
            
            {/* TAB 1: BUILDER */}
            {activeTab === 'builder' && (
              <div className="space-y-4">
                
                {/* Section Header */}
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-primary mb-0.5 sm:mb-1">Global Strategy</h3>
                    <p className="text-[10px] sm:text-xs text-secondary">
                      Configure signal-based portfolio conditions and monitoring rules.
                    </p>
                  </div>
                  {(currentRule.name || currentRule.action || currentRule.sizingType || (currentRule.sizingValue !== '' && currentRule.sizingValue !== undefined) || currentRule.conditions.length > 0) && (
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
                    <label className="block text-xs font-medium text-secondary mb-1">
                      Strategy Name
                    </label>
                    <input
                      type="text"
                      value={currentRule.name}
                      onChange={e => setCurrentRule(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Portfolio Dip & Momentum"
                      className="w-full bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">
                      Target Scope
                    </label>
                    <select
                      value={currentRule.scope === 'global' ? 'ALL' : (currentRule.targetSymbol || 'ALL')}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'ALL') {
                          setCurrentRule(prev => ({ ...prev, scope: 'global', targetSymbol: 'ALL' }));
                        } else {
                          setCurrentRule(prev => ({ ...prev, scope: 'stock', targetSymbol: val }));
                        }
                      }}
                      className="w-full bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="ALL">All Portfolio Holdings (Global)</option>
                      {uniqueSymbols.map(sym => (
                        <option key={sym} value={sym}>{sym}</option>
                      ))}
                      {currentRule.scope === 'stock' && currentRule.targetSymbol && !uniqueSymbols.includes(currentRule.targetSymbol) && (
                        <option value={currentRule.targetSymbol}>{currentRule.targetSymbol} (Closed / Inactive)</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Action & Sizing Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-secondary">
                    Action & Sizing
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Action Selector */}
                    <div className="inline-flex items-center p-0.5 bg-surface border border-divider rounded-lg">
                      <button
                        type="button"
                        onClick={() => setCurrentRule(prev => ({ ...prev, action: prev.action === 'BUY' ? '' : 'BUY' }))}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          currentRule.action === 'BUY'
                            ? 'bg-primary text-surface font-semibold'
                            : 'text-secondary hover:text-primary'
                        }`}
                      >
                        BUY
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentRule(prev => ({ ...prev, action: prev.action === 'SELL' ? '' : 'SELL' }))}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          currentRule.action === 'SELL'
                            ? 'bg-primary text-surface font-semibold'
                            : 'text-secondary hover:text-primary'
                        }`}
                      >
                        SELL
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentRule(prev => ({ ...prev, action: prev.action === 'ALERT' ? '' : 'ALERT' }))}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          currentRule.action === 'ALERT'
                            ? 'bg-primary text-surface font-semibold'
                            : 'text-secondary hover:text-primary'
                        }`}
                      >
                        ALERT
                      </button>
                    </div>

                    {/* Sizing Selector */}
                    <div className="inline-flex items-center p-0.5 bg-surface border border-divider rounded-lg">
                      <button
                        type="button"
                        onClick={() => setCurrentRule(prev => ({ ...prev, sizingType: prev.sizingType === 'QTY' ? '' : 'QTY' }))}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          currentRule.sizingType === 'QTY'
                            ? 'bg-primary text-surface font-semibold'
                            : 'text-secondary hover:text-primary'
                        }`}
                      >
                        QTY
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentRule(prev => ({ ...prev, sizingType: prev.sizingType === 'VALUE' ? '' : 'VALUE' }))}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          currentRule.sizingType === 'VALUE'
                            ? 'bg-primary text-surface font-semibold'
                            : 'text-secondary hover:text-primary'
                        }`}
                      >
                        VALUE
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentRule(prev => ({ ...prev, sizingType: prev.sizingType === 'INCREASE_PCT' ? '' : 'INCREASE_PCT' }))}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          currentRule.sizingType === 'INCREASE_PCT'
                            ? 'bg-primary text-surface font-semibold'
                            : 'text-secondary hover:text-primary'
                        }`}
                      >
                        INCREASE%
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentRule(prev => ({ ...prev, sizingType: prev.sizingType === 'DECREASE_PCT' ? '' : 'DECREASE_PCT' }))}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          currentRule.sizingType === 'DECREASE_PCT'
                            ? 'bg-primary text-surface font-semibold'
                            : 'text-secondary hover:text-primary'
                        }`}
                      >
                        DECREASE%
                      </button>
                    </div>

                    {/* Sizing Input */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        value={currentRule.sizingValue !== undefined && currentRule.sizingValue !== null ? currentRule.sizingValue : ''}
                        onChange={e => setCurrentRule(prev => ({ ...prev, sizingValue: e.target.value === '' ? '' : Number(e.target.value) }))}
                        placeholder="Value"
                        className="w-20 bg-surface border border-divider rounded-lg px-2.5 py-1 text-xs text-primary font-mono focus:outline-none focus:border-primary"
                      />
                      <span className="text-xs text-secondary font-mono">
                        {currentRule.sizingType === 'QTY' && 'Qty'}
                        {currentRule.sizingType === 'VALUE' && currencySymbol}
                        {(currentRule.sizingType === 'INCREASE_PCT' || currentRule.sizingType === 'DECREASE_PCT') && '%'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conditions Block */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-secondary">
                      Conditions (IF)
                    </label>

                    <button
                      type="button"
                      onClick={handleAddCondition}
                      className="text-xs font-medium text-secondary hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Condition</span>
                    </button>
                  </div>

                  {currentRule.conditions.length === 0 ? (
                    <div className="p-4 border border-dashed border-divider rounded-lg text-center space-y-2">
                      <p className="text-xs text-secondary">No conditions configured yet.</p>
                      <button
                        type="button"
                        onClick={handleAddCondition}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary border border-divider rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Condition</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentRule.conditions.map((cond, idx) => (
                        <div key={cond.id} className="space-y-1.5">
                          {idx > 0 && (
                            <div className="flex items-center gap-2 pl-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateCondition(cond.id, {
                                  connector: cond.connector === 'OR' ? 'AND' : 'OR'
                                })}
                                className="px-2 py-0.5 rounded text-[10px] font-mono border border-divider bg-surface text-secondary hover:text-primary transition-colors"
                              >
                                {cond.connector || 'AND'}
                              </button>
                              <div className="h-[1px] flex-1 bg-divider" />
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-surface border border-divider rounded-lg">
                            {/* Left Indicator */}
                            <select
                              value={cond.leftIndicator || ''}
                              onChange={e => handleUpdateCondition(cond.id, { leftIndicator: e.target.value as any })}
                              className="bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-primary"
                            >
                              <option value="" disabled>Select Indicator</option>
                              <option value="rsi">RSI(14, day)</option>
                              <option value="dma50">DMA(50)</option>
                              <option value="dma200">DMA(200)</option>
                              <option value="price">Current Price</option>
                              <option value="changePct">Day Change %</option>
                            </select>

                            {/* Operator */}
                            <select
                              value={cond.operator || ''}
                              onChange={e => handleUpdateCondition(cond.id, { operator: e.target.value as any })}
                              className="bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs font-mono text-primary focus:outline-none focus:border-primary"
                            >
                              <option value="" disabled>Select Operator</option>
                              <option value="<">&lt;</option>
                              <option value=">">&gt;</option>
                              <option value="<=">&lt;=</option>
                              <option value=">=">&gt;=</option>
                              <option value="CROSSINGOVER">CROSSINGOVER</option>
                              <option value="CROSSINGUNDER">CROSSINGUNDER</option>
                              <option value="==">==</option>
                            </select>

                            {/* Right Type Toggle */}
                            <div className="inline-flex items-center p-0.5 bg-surface border border-divider rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleUpdateCondition(cond.id, { rightType: 'value' })}
                                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                                  cond.rightType === 'value'
                                    ? 'bg-primary text-surface font-semibold'
                                    : 'text-secondary hover:text-primary'
                                }`}
                              >
                                Value
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateCondition(cond.id, { rightType: 'indicator' })}
                                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                                  cond.rightType === 'indicator'
                                    ? 'bg-primary text-surface font-semibold'
                                    : 'text-secondary hover:text-primary'
                                }`}
                              >
                                Indicator
                              </button>
                            </div>

                            {/* Right Value or Select */}
                            {cond.rightType === 'value' ? (
                              <input
                                type="number"
                                value={cond.rightValue !== undefined && cond.rightValue !== null ? cond.rightValue : ''}
                                onChange={e => handleUpdateCondition(cond.id, { rightValue: e.target.value === '' ? '' : Number(e.target.value) })}
                                placeholder="Value"
                                className="w-20 bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs text-primary font-mono focus:outline-none focus:border-primary"
                              />
                            ) : (
                              <select
                                value={cond.rightIndicator || ''}
                                onChange={e => handleUpdateCondition(cond.id, { rightIndicator: e.target.value as any })}
                                className="bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-primary"
                              >
                                <option value="" disabled>Select Indicator</option>
                                <option value="dma200">DMA(200)</option>
                                <option value="dma50">DMA(50)</option>
                                <option value="rsi">RSI(14)</option>
                                <option value="price">Current Price</option>
                              </select>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveCondition(cond.id)}
                              className="ml-auto p-1.5 text-secondary hover:text-primary rounded transition-colors cursor-pointer"
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

                {/* Clean Formula Preview */}
                <div className="p-3 bg-surface border border-divider rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-secondary text-xs">
                    <span className="font-medium text-primary">Formula Preview</span>
                    <button
                      type="button"
                      onClick={handleCopyFormula}
                      className="text-secondary hover:text-primary text-[11px] transition-colors"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-2.5 bg-surface-hover/50 rounded border border-divider font-mono text-xs text-primary overflow-x-auto whitespace-nowrap">
                    {formatRuleFormula(currentRule)}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: ACTIVE STRATEGIES */}
            {activeTab === 'active' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-primary mb-0.5 sm:mb-1">Saved Strategies</h3>
                    <p className="text-[10px] sm:text-xs text-secondary">
                      Active rules monitored for signals.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentRule(BLANK_RULE);
                      setActiveTab('builder');
                    }}
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
                    No strategies saved yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedRules.map(rule => (
                      <div
                        key={rule.id}
                        className="p-3 rounded-lg border border-divider bg-surface flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-medium text-primary truncate">{rule.name}</span>
                            <span className="text-[10px] text-secondary font-mono">
                              ({rule.scope === 'global' ? 'Global' : (rule.targetSymbol || 'All')})
                            </span>
                          </div>
                          <div className="text-xs font-mono text-secondary truncate">
                            {formatRuleFormula(rule)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleRuleStatus(rule.id)}
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
                            onClick={() => {
                              setCurrentRule(rule);
                              setActiveTab('builder');
                            }}
                            className="px-2 py-1 text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSavedRule(rule.id)}
                            className="p-1 text-secondary hover:text-primary transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer Matching Indices Setting & Indicators UI */}
        <div className="px-6 py-3.5 border-t border-divider bg-surface flex items-center justify-between shrink-0">
          <div className="text-xs text-secondary">
            {savedRules.filter(r => r.enabled).length} active rule(s)
          </div>

          <div className="flex items-center gap-3">
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
    </div>,
    document.body
  );
}
