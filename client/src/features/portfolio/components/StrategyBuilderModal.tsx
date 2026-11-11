import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Check,
  Plus,
  Trash2,
  Loader2,
  Play,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
} from 'lucide-react';
import { api } from '../../../services/api/client';
import { BacktestModal } from './BacktestModal';
import type { StrategyLogEntry } from './StrategyLogsModal';

export type SizingType = 'QTY' | 'VALUE' | 'INCREASE_PCT' | 'DECREASE_PCT';
export type ActionType = 'BUY' | 'SELL' | 'ALERT';
export type IndicatorType =
  | 'rsi'
  | 'rsiBullishDiv'
  | 'rsiBearishDiv'
  | 'dma50'
  | 'dma200'
  | 'ema20'
  | 'ema50'
  | 'ema200'
  | 'macd'
  | 'macdSignal'
  | 'macdHist'
  | 'bbUpper'
  | 'bbMiddle'
  | 'bbLower'
  | 'bbBandwidth'
  | 'bbPercentB'
  | 'vwap'
  | 'volume'
  | 'avgVolume'
  | 'obv'
  | 'obvSignal'
  | 'price'
  | 'changePct';
export type ComparisonOperator =
  | '<'
  | '>'
  | '<='
  | '>='
  | 'CROSSINGOVER'
  | 'CROSSINGUNDER'
  | 'BULLISH_DIVERGENCE'
  | 'BEARISH_DIVERGENCE'
  | '==';
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
  portfolioId?: string;
  portfolio_id?: string;
  name: string;
  scope: 'global' | 'stock';
  targetSymbol?: string;
  action?: ActionType | '';
  sizingType?: SizingType | '';
  sizingValue?: number | '';
  conditions: StrategyCondition[];
  entryConditions?: StrategyCondition[];
  entrySizingType?: SizingType | '';
  entrySizingValue?: number | '';
  exitConditions?: StrategyCondition[];
  exitSizingType?: SizingType | '';
  exitSizingValue?: number | '';
  stopLossPct?: number | '';
  takeProfitPct?: number | '';
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
  indicators: Record<
    string,
    {
      rsi?: number | null;
      dma50?: number | null;
      dma200?: number | null;
      ema20?: number | null;
      ema50?: number | null;
      ema200?: number | null;
      macd?: number | null;
      macdSignal?: number | null;
      macdHist?: number | null;
      bbUpper?: number | null;
      bbMiddle?: number | null;
      bbLower?: number | null;
      bbBandwidth?: number | null;
      bbPercentB?: number | null;
      vwap?: number | null;
      avgVolume?: number | null;
      obv?: number | null;
      obvSignal?: number | null;
    }
  >;
  livePrices?: Record<string, { currentPrice?: number; changePercent?: number; name?: string }>;
  currencySymbol?: string;
  onLifecycleLog?: (entry: StrategyLogEntry) => void;
}

export const BLANK_RULE: StrategyRule = {
  id: '',
  name: '',
  scope: 'global',
  targetSymbol: 'ALL',
  action: 'BUY',
  sizingType: 'QTY',
  sizingValue: 10,
  conditions: [],
  entryConditions: [],
  entrySizingType: 'QTY',
  entrySizingValue: 10,
  exitConditions: [],
  exitSizingType: 'DECREASE_PCT',
  exitSizingValue: 100,
  stopLossPct: '',
  takeProfitPct: '',
  enabled: true,
  createdAt: '',
  frequency: 'daily'
};

export function normalizeRule(r: StrategyRule): StrategyRule {
  if (!r) return BLANK_RULE;

  const rawConditions: any = r.conditions;

  let entryConds: StrategyCondition[] = [];
  if (Array.isArray(r.entryConditions) && r.entryConditions.length > 0) {
    entryConds = r.entryConditions;
  } else if (rawConditions && Array.isArray(rawConditions.entry) && rawConditions.entry.length > 0) {
    entryConds = rawConditions.entry;
  } else if (r.action !== 'SELL' && Array.isArray(rawConditions) && rawConditions.length > 0) {
    entryConds = rawConditions;
  }

  let exitConds: StrategyCondition[] = [];
  if (Array.isArray(r.exitConditions) && r.exitConditions.length > 0) {
    exitConds = r.exitConditions;
  } else if (rawConditions && Array.isArray(rawConditions.exit) && rawConditions.exit.length > 0) {
    exitConds = rawConditions.exit;
  } else if (r.action === 'SELL' && Array.isArray(rawConditions) && rawConditions.length > 0) {
    exitConds = rawConditions;
  }

  const entrySizingType = r.entrySizingType || (rawConditions && rawConditions.entrySizingType) || r.sizingType || 'QTY';
  const entrySizingValue = r.entrySizingValue !== undefined && r.entrySizingValue !== '' 
    ? r.entrySizingValue 
    : (rawConditions && rawConditions.entrySizingValue !== undefined && rawConditions.entrySizingValue !== ''
        ? rawConditions.entrySizingValue
        : (r.sizingValue !== '' && r.sizingValue !== undefined ? r.sizingValue : 10));

  const exitSizingType = r.exitSizingType || (rawConditions && rawConditions.exitSizingType) || 'DECREASE_PCT';
  const exitSizingValue = r.exitSizingValue !== undefined && r.exitSizingValue !== ''
    ? r.exitSizingValue
    : (rawConditions && rawConditions.exitSizingValue !== undefined && rawConditions.exitSizingValue !== ''
        ? rawConditions.exitSizingValue
        : 100);

  const stopLossPct = r.stopLossPct ?? (rawConditions && rawConditions.stopLossPct) ?? '';
  const takeProfitPct = r.takeProfitPct ?? (rawConditions && rawConditions.takeProfitPct) ?? '';

  return {
    ...r,
    entryConditions: entryConds,
    entrySizingType,
    entrySizingValue,
    exitConditions: exitConds,
    exitSizingType,
    exitSizingValue,
    stopLossPct,
    takeProfitPct,
    conditions: entryConds.length > 0 ? entryConds : exitConds,
  };
}

export function formatRuleFormula(rule: StrategyRule): string {
  if (!rule) return 'Configure Entry (BUY) and Exit (SELL) parameters above to preview formula';

  const formatConds = (conds: StrategyCondition[]) => {
    return conds.map((cond, idx) => {
      const conn = idx > 0 ? ` ${cond.connector || 'AND'} ` : '';

      let left = cond.leftIndicator ? cond.leftIndicator : '[INDICATOR]';
      if (cond.leftIndicator === 'rsi') left = 'RSI(day)';
      else if (cond.leftIndicator === 'rsiBullishDiv') left = 'RSI Bullish Div';
      else if (cond.leftIndicator === 'rsiBearishDiv') left = 'RSI Bearish Div';
      else if (cond.leftIndicator === 'dma50') left = 'DMA(50)';
      else if (cond.leftIndicator === 'dma200') left = 'DMA(200)';
      else if (cond.leftIndicator === 'ema20') left = 'EMA(20)';
      else if (cond.leftIndicator === 'ema50') left = 'EMA(50)';
      else if (cond.leftIndicator === 'ema200') left = 'EMA(200)';
      else if (cond.leftIndicator === 'macd') left = 'MACD(12,26)';
      else if (cond.leftIndicator === 'macdSignal') left = 'MACD Signal(9)';
      else if (cond.leftIndicator === 'macdHist') left = 'MACD Hist';
      else if (cond.leftIndicator === 'bbUpper') left = 'BB Upper(20,2)';
      else if (cond.leftIndicator === 'bbMiddle') left = 'BB Middle(20)';
      else if (cond.leftIndicator === 'bbLower') left = 'BB Lower(20,2)';
      else if (cond.leftIndicator === 'bbBandwidth') left = 'BB Bandwidth%';
      else if (cond.leftIndicator === 'bbPercentB') left = 'BB %B';
      else if (cond.leftIndicator === 'vwap') left = 'VWAP';
      else if (cond.leftIndicator === 'volume') left = 'VOLUME';
      else if (cond.leftIndicator === 'avgVolume') left = 'AVG VOL(20)';
      else if (cond.leftIndicator === 'obv') left = 'OBV';
      else if (cond.leftIndicator === 'obvSignal') left = 'OBV Signal(20)';
      else if (cond.leftIndicator === 'price') left = 'PRICE';
      else if (cond.leftIndicator === 'changePct') left = 'CHANGE%';

      const op = cond.operator || '[OP]';
      if (op === 'BULLISH_DIVERGENCE') {
        return `${conn}${left} HAS BULLISH DIVERGENCE`;
      }
      if (op === 'BEARISH_DIVERGENCE') {
        return `${conn}${left} HAS BEARISH DIVERGENCE`;
      }

      let right = '';
      if (cond.rightType === 'indicator') {
        if (cond.rightIndicator === 'dma200') right = 'DMA(200)';
        else if (cond.rightIndicator === 'dma50') right = 'DMA(50)';
        else if (cond.rightIndicator === 'ema200') right = 'EMA(200)';
        else if (cond.rightIndicator === 'ema50') right = 'EMA(50)';
        else if (cond.rightIndicator === 'ema20') right = 'EMA(20)';
        else if (cond.rightIndicator === 'macd') right = 'MACD(12,26)';
        else if (cond.rightIndicator === 'macdSignal') right = 'MACD Signal(9)';
        else if (cond.rightIndicator === 'macdHist') right = 'MACD Hist';
        else if (cond.rightIndicator === 'bbUpper') right = 'BB Upper(20,2)';
        else if (cond.rightIndicator === 'bbMiddle') right = 'BB Middle(20)';
        else if (cond.rightIndicator === 'bbLower') right = 'BB Lower(20,2)';
        else if (cond.rightIndicator === 'bbBandwidth') right = 'BB Bandwidth%';
        else if (cond.rightIndicator === 'bbPercentB') right = 'BB %B';
        else if (cond.rightIndicator === 'vwap') right = 'VWAP';
        else if (cond.rightIndicator === 'volume') right = 'VOLUME';
        else if (cond.rightIndicator === 'avgVolume') right = 'AVG VOL(20)';
        else if (cond.rightIndicator === 'obv') right = 'OBV';
        else if (cond.rightIndicator === 'obvSignal') right = 'OBV Signal(20)';
        else if (cond.rightIndicator === 'rsi') right = 'RSI(day)';
        else if (cond.rightIndicator === 'price') right = 'PRICE';
        else right = cond.rightIndicator ? cond.rightIndicator : '[INDICATOR]';
      } else {
        right = (cond.rightValue !== '' && cond.rightValue !== undefined) ? String(cond.rightValue) : '[VALUE]';
      }

      const opFormatted = (op === 'CROSSINGOVER' || op === 'CROSSINGUNDER') ? ` ${op} ` : op;
      return `${conn}${left}${opFormatted.startsWith(' ') ? '' : ' '}${opFormatted}${opFormatted.endsWith(' ') ? '' : ' '}${right}`;
    }).join('');
  };

  const formatSizing = (sType?: string, sVal?: any) => {
    if (sType === 'QTY') return `QTY(${sVal !== '' && sVal !== undefined ? sVal : '?'})`;
    if (sType === 'VALUE') return `VALUE(${sVal !== '' && sVal !== undefined ? sVal : '?'})`;
    if (sType === 'INCREASE_PCT') return `INCREASE%(${sVal !== '' && sVal !== undefined ? sVal : '?'})`;
    if (sType === 'DECREASE_PCT') return `DECREASE%(${sVal !== '' && sVal !== undefined ? sVal : '?'})`;
    if (sVal !== '' && sVal !== undefined) return `(${sVal})`;
    return '[SIZING]';
  };

  const norm = normalizeRule(rule);
  const target = norm.scope === 'global' ? 'ALL_PORTFOLIO' : (norm.targetSymbol || 'TARGET');
  const entryConds = norm.entryConditions || [];
  const exitConds = norm.exitConditions || [];

  const parts: string[] = [];

  const hasEntry = entryConds.length > 0 || (norm.entrySizingValue !== '' && norm.entrySizingValue !== undefined && norm.entrySizingValue !== null);
  if (hasEntry) {
    const entrySizing = formatSizing(norm.entrySizingType, norm.entrySizingValue);
    const condStr = entryConds.length > 0 ? ` IF ${formatConds(entryConds)}` : '';
    parts.push(`BUY ${target} ${entrySizing}${condStr}`);
  }

  const hasExit = exitConds.length > 0 || (norm.stopLossPct !== '' && norm.stopLossPct !== undefined && norm.stopLossPct !== null) || (norm.takeProfitPct !== '' && norm.takeProfitPct !== undefined && norm.takeProfitPct !== null);
  if (hasExit) {
    const exitSizing = formatSizing(norm.exitSizingType, norm.exitSizingValue);
    const condStr = exitConds.length > 0 ? ` IF ${formatConds(exitConds)}` : '';
    let riskStr = '';
    if (norm.stopLossPct) riskStr += ` [SL -${norm.stopLossPct}%]`;
    if (norm.takeProfitPct) riskStr += ` [TP +${norm.takeProfitPct}%]`;
    parts.push(`SELL ${exitSizing}${condStr}${riskStr}`);
  }

  if (parts.length > 0) {
    return parts.join(' | ');
  }

  return 'Configure Entry (BUY) and Exit (SELL) parameters above to preview formula';
}

const CATEGORIES = [
  { id: 'builder', name: 'Strategy Builder' },
  { id: 'active', name: 'Saved Strategies' }
];

export function StrategyBuilderModal({
  isOpen,
  onClose,
  portfolioId,
  stocks = [],
  indicators = {},
  livePrices = {},
  currencySymbol = '₹',
  onLifecycleLog,
}: StrategyBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<string>('builder');
  const [actionTab, setActionTab] = useState<'entry' | 'exit'>('entry');
  const navigate = useNavigate();

  const storageKey = `portfolio_strategies_${portfolioId || 'global'}`;



  const [currentRule, setCurrentRule] = useState<StrategyRule>(() => BLANK_RULE);

  const [savedRules, setSavedRules] = useState<StrategyRule[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((r: any) => r.id !== 'rule-default').map(normalizeRule);
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
  const [isBacktestOpen, setIsBacktestOpen] = useState(false);
  const [backtestTargetRule, setBacktestTargetRule] = useState<StrategyRule | null>(null);

  // Load strategies from backend with localStorage fallback
  const loadStrategies = async () => {
    setIsLoading(true);
    setApiNotice(null);
    try {
      const data = await api.get(`/api/strategies?portfolio_id=${portfolioId || ''}`);
      if (Array.isArray(data)) {
        const cleaned = data.filter((r: any) => r.id !== 'rule-default').map(normalizeRule);
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
          setSavedRules(parsed.filter((r: any) => r.id !== 'rule-default').map(normalizeRule));
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
    const entryConds = currentRule.entryConditions || [];
    const exitConds = currentRule.exitConditions || [];
    const entrySizingType = currentRule.entrySizingType || currentRule.sizingType || 'QTY';
    const entrySizingValue = currentRule.entrySizingValue !== '' && currentRule.entrySizingValue !== undefined ? Number(currentRule.entrySizingValue) : 10;
    const exitSizingType = currentRule.exitSizingType || 'DECREASE_PCT';
    const exitSizingValue = currentRule.exitSizingValue !== '' && currentRule.exitSizingValue !== undefined ? Number(currentRule.exitSizingValue) : 100;
    const stopLossPct = currentRule.stopLossPct !== '' && currentRule.stopLossPct !== undefined && currentRule.stopLossPct !== null ? Number(currentRule.stopLossPct) : null;
    const takeProfitPct = currentRule.takeProfitPct !== '' && currentRule.takeProfitPct !== undefined && currentRule.takeProfitPct !== null ? Number(currentRule.takeProfitPct) : null;

    const structuredConditions = {
      entry: entryConds,
      exit: exitConds,
      entrySizingType,
      entrySizingValue,
      exitSizingType,
      exitSizingValue,
      stopLossPct: stopLossPct ?? '',
      takeProfitPct: takeProfitPct ?? '',
    };

    const payload = {
      portfolio_id: isGlobal ? null : portfolioId,
      portfolio_id_context: portfolioId,
      name: currentRule.name.trim() || 'Untitled Strategy',
      scope: currentRule.scope || 'global',
      target_symbol: currentRule.targetSymbol || 'ALL',
      action: 'BUY',
      sizing_type: entrySizingType,
      sizing_value: entrySizingValue,
      conditions: structuredConditions,
      entryConditions: entryConds,
      entrySizingType,
      entrySizingValue,
      exitConditions: exitConds,
      exitSizingType,
      exitSizingValue,
      stopLossPct,
      takeProfitPct,
      enabled: currentRule.enabled ?? true,
      frequency: currentRule.frequency || 'daily'
    };

    let savedRule: any = null;
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
    } catch (err: any) {
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
      setTimeout(() => {
        setSaveSuccess(false);
        setActiveTab('active');
      }, 700);
    }

    setIsSaving(false);
  };

  const currentConditions = actionTab === 'entry'
    ? (currentRule.entryConditions || [])
    : (currentRule.exitConditions || []);

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

    setCurrentRule(prev => {
      if (actionTab === 'entry') {
        const nextEntry = [...(prev.entryConditions || []), newCond];
        return {
          ...prev,
          entryConditions: nextEntry,
          conditions: nextEntry,
        };
      } else {
        const nextExit = [...(prev.exitConditions || []), newCond];
        return {
          ...prev,
          exitConditions: nextExit,
        };
      }
    });
  };

  const handleRemoveCondition = (id: string) => {
    setCurrentRule(prev => {
      if (actionTab === 'entry') {
        const nextEntry = (prev.entryConditions || []).filter(c => c.id !== id);
        return {
          ...prev,
          entryConditions: nextEntry,
          conditions: nextEntry,
        };
      } else {
        const nextExit = (prev.exitConditions || []).filter(c => c.id !== id);
        return {
          ...prev,
          exitConditions: nextExit,
        };
      }
    });
  };

  const handleUpdateCondition = (id: string, updates: Partial<StrategyCondition>) => {
    setCurrentRule(prev => {
      if (actionTab === 'entry') {
        const nextEntry = (prev.entryConditions || []).map(c => c.id === id ? { ...c, ...updates } : c);
        return {
          ...prev,
          entryConditions: nextEntry,
          conditions: nextEntry,
        };
      } else {
        const nextExit = (prev.exitConditions || []).map(c => c.id === id ? { ...c, ...updates } : c);
        return {
          ...prev,
          exitConditions: nextExit,
        };
      }
    });
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
      } else if (onLifecycleLog) {
        onLifecycleLog(buildLocalToggleEntry());
      }
    } catch (err) {
      console.error('Failed to toggle strategy on server', err);
      if (onLifecycleLog) {
        onLifecycleLog(buildLocalToggleEntry());
      }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl sm:max-w-3xl h-[88vh] md:h-[640px] max-h-[calc(100vh-2rem)] bg-surface border border-divider rounded-xl shadow-2xl flex flex-col overflow-hidden text-primary">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-divider shrink-0 bg-surface">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-primary">Strategy Builder</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              Dual-Action: Buy & Sell
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
          
          {/* Left Column: Categories List */}
          <div className="w-28 sm:w-40 md:w-44 shrink-0 flex flex-col min-h-0 pr-2 sm:pr-4 border-r border-divider">
            <h3 className="text-xs sm:text-sm font-medium text-primary mb-2 sm:mb-3 px-2 sm:px-3">Navigation</h3>
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
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-primary mb-0.5">Dual-Action Strategy</h3>
                    <p className="text-[10px] sm:text-xs text-secondary">
                      Configure both Entry (BUY) and Exit (SELL) conditions in a single unified trading strategy.
                    </p>
                  </div>
                  {(currentRule.name || (currentRule.entryConditions && currentRule.entryConditions.length > 0) || (currentRule.exitConditions && currentRule.exitConditions.length > 0) || currentRule.stopLossPct || currentRule.takeProfitPct) && (
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
                      placeholder="e.g. RSI Dip Buy & Momentum Exit"
                      className="w-full bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">
                      Target Stock Scope
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

                {/* Sub-tab Switcher: Entry (BUY) vs Exit (SELL) */}
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

                {/* ===================== TAB A: ENTRY (BUY) ===================== */}
                {actionTab === 'entry' && (
                  <div className="space-y-3.5 bg-surface p-3.5 rounded-lg border border-divider">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <ArrowUpRight className="w-3.5 h-3.5 text-secondary" />
                        <span>Position Entry (When to Buy)</span>
                      </div>
                      <span className="text-[10px] text-secondary">
                        Executes when no position is open or to scale in
                      </span>
                    </div>

                    {/* Entry Sizing */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-secondary">
                        BUY Sizing & Allocation
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center p-0.5 bg-surface border border-divider rounded-lg">
                          <button
                            type="button"
                            onClick={() => setCurrentRule(prev => ({ ...prev, entrySizingType: 'QTY' }))}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              (currentRule.entrySizingType || currentRule.sizingType || 'QTY') === 'QTY'
                                ? 'bg-primary text-surface font-semibold'
                                : 'text-secondary hover:text-primary'
                            }`}
                          >
                            QTY
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentRule(prev => ({ ...prev, entrySizingType: 'VALUE' }))}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              (currentRule.entrySizingType || currentRule.sizingType) === 'VALUE'
                                ? 'bg-primary text-surface font-semibold'
                                : 'text-secondary hover:text-primary'
                            }`}
                          >
                            VALUE
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentRule(prev => ({ ...prev, entrySizingType: 'INCREASE_PCT' }))}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              (currentRule.entrySizingType || currentRule.sizingType) === 'INCREASE_PCT'
                                ? 'bg-primary text-surface font-semibold'
                                : 'text-secondary hover:text-primary'
                            }`}
                          >
                            INCREASE%
                          </button>
                        </div>

                        {/* Sizing Value */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            value={currentRule.entrySizingValue !== undefined && currentRule.entrySizingValue !== null ? currentRule.entrySizingValue : (currentRule.sizingValue || '')}
                            onChange={e => setCurrentRule(prev => ({ ...prev, entrySizingValue: e.target.value === '' ? '' : Number(e.target.value) }))}
                            placeholder="Value"
                            className="w-24 bg-surface border border-divider rounded-lg px-2.5 py-1 text-xs text-primary font-mono focus:outline-none focus:border-primary"
                          />
                          <span className="text-xs text-secondary font-mono">
                            {(currentRule.entrySizingType || currentRule.sizingType || 'QTY') === 'QTY' && 'Shares'}
                            {(currentRule.entrySizingType || currentRule.sizingType) === 'VALUE' && currencySymbol}
                            {(currentRule.entrySizingType || currentRule.sizingType) === 'INCREASE_PCT' && '%'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Entry Conditions List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-medium text-secondary">
                          Entry Conditions (IF)
                        </label>

                        <button
                          type="button"
                          onClick={handleAddCondition}
                          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Condition</span>
                        </button>
                      </div>

                      {(currentRule.entryConditions || []).length === 0 ? (
                        <div className="p-3.5 border border-dashed border-divider rounded-lg text-center space-y-2 bg-surface-hover/30">
                          <p className="text-xs text-secondary">No entry conditions configured yet.</p>
                          <button
                            type="button"
                            onClick={handleAddCondition}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary border border-divider rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Entry Condition (e.g. RSI &lt; 30)</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(currentRule.entryConditions || []).map((cond, idx) => (
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

                              <div className="flex flex-wrap items-center gap-2 p-2 bg-surface border border-divider rounded-lg">
                                {/* Left Indicator */}
                                <select
                                  value={cond.leftIndicator || ''}
                                  onChange={e => handleUpdateCondition(cond.id, { leftIndicator: e.target.value as any })}
                                  className="bg-surface border border-divider rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-primary"
                                >
                                  <option value="" disabled>Indicator</option>
                                  <option value="rsi">RSI(14, day)</option>
                                  <option value="rsiBullishDiv">RSI Bullish Divergence</option>
                                  <option value="rsiBearishDiv">RSI Bearish Divergence</option>
                                  <option value="dma50">DMA(50)</option>
                                  <option value="dma200">DMA(200)</option>
                                  <option value="ema20">EMA(20)</option>
                                  <option value="ema50">EMA(50)</option>
                                  <option value="ema200">EMA(200)</option>
                                  <option value="macd">MACD Line (12, 26)</option>
                                  <option value="macdSignal">MACD Signal (9)</option>
                                  <option value="macdHist">MACD Histogram</option>
                                  <option value="bbUpper">BB Upper (20, 2)</option>
                                  <option value="bbMiddle">BB Middle (20 SMA)</option>
                                  <option value="bbLower">BB Lower (20, 2)</option>
                                  <option value="bbBandwidth">BB Bandwidth %</option>
                                  <option value="bbPercentB">BB %B</option>
                                  <option value="vwap">VWAP</option>
                                  <option value="volume">Candle Volume</option>
                                  <option value="avgVolume">20-Period Avg Volume</option>
                                  <option value="obv">OBV (On-Balance Volume)</option>
                                  <option value="obvSignal">OBV Signal (20 SMA)</option>
                                  <option value="price">Current Price</option>
                                  <option value="changePct">Day Change %</option>
                                </select>

                                {/* Operator */}
                                <select
                                  value={cond.operator || ''}
                                  onChange={e => handleUpdateCondition(cond.id, { operator: e.target.value as any })}
                                  className="bg-surface border border-divider rounded-lg px-2 py-1 text-xs font-mono text-primary focus:outline-none focus:border-primary"
                                >
                                  <option value="" disabled>Op</option>
                                  <option value="<">&lt;</option>
                                  <option value=">">&gt;</option>
                                  <option value="<=">&lt;=</option>
                                  <option value=">=">&gt;=</option>
                                  <option value="CROSSINGOVER">CROSSINGOVER</option>
                                  <option value="CROSSINGUNDER">CROSSINGUNDER</option>
                                  <option value="BULLISH_DIVERGENCE">BULLISH DIVERGENCE</option>
                                  <option value="BEARISH_DIVERGENCE">BEARISH DIVERGENCE</option>
                                  <option value="==">==</option>
                                </select>

                                {cond.operator !== 'BULLISH_DIVERGENCE' && cond.operator !== 'BEARISH_DIVERGENCE' && (
                                  <>
                                    {/* Right Type Toggle */}
                                    <div className="inline-flex items-center p-0.5 bg-surface border border-divider rounded">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateCondition(cond.id, { rightType: 'value' })}
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
                                        onClick={() => handleUpdateCondition(cond.id, { rightType: 'indicator' })}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                          cond.rightType === 'indicator'
                                            ? 'bg-primary text-surface font-semibold'
                                            : 'text-secondary hover:text-primary'
                                        }`}
                                      >
                                        Ind
                                      </button>
                                    </div>

                                    {/* Right Value or Select */}
                                    {cond.rightType === 'value' ? (
                                      <input
                                        type="number"
                                        value={cond.rightValue !== undefined && cond.rightValue !== null ? cond.rightValue : ''}
                                        onChange={e => handleUpdateCondition(cond.id, { rightValue: e.target.value === '' ? '' : Number(e.target.value) })}
                                        placeholder="Value"
                                        className="w-20 bg-surface border border-divider rounded-lg px-2 py-1 text-xs text-primary font-mono focus:outline-none focus:border-primary"
                                      />
                                    ) : (
                                      <select
                                        value={cond.rightIndicator || ''}
                                        onChange={e => handleUpdateCondition(cond.id, { rightIndicator: e.target.value as any })}
                                        className="bg-surface border border-divider rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-primary"
                                      >
                                        <option value="" disabled>Indicator</option>
                                        <option value="dma200">DMA(200)</option>
                                        <option value="dma50">DMA(50)</option>
                                        <option value="ema200">EMA(200)</option>
                                        <option value="ema50">EMA(50)</option>
                                        <option value="ema20">EMA(20)</option>
                                        <option value="macd">MACD Line (12, 26)</option>
                                        <option value="macdSignal">MACD Signal (9)</option>
                                        <option value="macdHist">MACD Histogram</option>
                                        <option value="bbUpper">BB Upper (20, 2)</option>
                                        <option value="bbMiddle">BB Middle (20 SMA)</option>
                                        <option value="bbLower">BB Lower (20, 2)</option>
                                        <option value="bbBandwidth">BB Bandwidth %</option>
                                        <option value="bbPercentB">BB %B</option>
                                        <option value="vwap">VWAP</option>
                                        <option value="volume">Candle Volume</option>
                                        <option value="avgVolume">20-Period Avg Volume</option>
                                        <option value="obv">OBV (On-Balance Volume)</option>
                                        <option value="obvSignal">OBV Signal (20 SMA)</option>
                                        <option value="rsi">RSI(14)</option>
                                        <option value="price">Current Price</option>
                                      </select>
                                    )}
                                  </>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRemoveCondition(cond.id)}
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
                )}

                {/* ===================== TAB B: EXIT (SELL) ===================== */}
                {actionTab === 'exit' && (
                  <div className="space-y-3.5 bg-surface p-3.5 rounded-lg border border-divider">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <ArrowDownRight className="w-3.5 h-3.5 text-secondary" />
                        <span>Position Exit (When to Sell)</span>
                      </div>
                      <span className="text-[10px] text-secondary">
                        Executes when position is open to scale out or exit
                      </span>
                    </div>

                    {/* Exit Sizing */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-secondary">
                        SELL Sizing & Allocation
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center p-0.5 bg-surface border border-divider rounded-lg">
                          <button
                            type="button"
                            onClick={() => setCurrentRule(prev => ({ ...prev, exitSizingType: 'QTY' }))}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              currentRule.exitSizingType === 'QTY'
                                ? 'bg-primary text-surface font-semibold'
                                : 'text-secondary hover:text-primary'
                            }`}
                          >
                            QTY
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentRule(prev => ({ ...prev, exitSizingType: 'VALUE' }))}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              currentRule.exitSizingType === 'VALUE'
                                ? 'bg-primary text-surface font-semibold'
                                : 'text-secondary hover:text-primary'
                            }`}
                          >
                            VALUE
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentRule(prev => ({ ...prev, exitSizingType: 'DECREASE_PCT' }))}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              (currentRule.exitSizingType || 'DECREASE_PCT') === 'DECREASE_PCT'
                                ? 'bg-primary text-surface font-semibold'
                                : 'text-secondary hover:text-primary'
                            }`}
                          >
                            DECREASE%
                          </button>
                        </div>

                        {/* Sizing Value */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            value={currentRule.exitSizingValue !== undefined && currentRule.exitSizingValue !== null ? currentRule.exitSizingValue : 100}
                            onChange={e => setCurrentRule(prev => ({ ...prev, exitSizingValue: e.target.value === '' ? '' : Number(e.target.value) }))}
                            placeholder="Value"
                            className="w-24 bg-surface border border-divider rounded-lg px-2.5 py-1 text-xs text-primary font-mono focus:outline-none focus:border-primary"
                          />
                          <span className="text-xs text-secondary font-mono">
                            {currentRule.exitSizingType === 'QTY' && 'Shares'}
                            {currentRule.exitSizingType === 'VALUE' && currencySymbol}
                            {(currentRule.exitSizingType || 'DECREASE_PCT') === 'DECREASE_PCT' && '%'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Exit Conditions List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-medium text-secondary">
                          Exit Conditions (IF)
                        </label>

                        <button
                          type="button"
                          onClick={handleAddCondition}
                          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Condition</span>
                        </button>
                      </div>

                      {(currentRule.exitConditions || []).length === 0 ? (
                        <div className="p-3.5 border border-dashed border-divider rounded-lg text-center space-y-2 bg-surface-hover/30">
                          <p className="text-xs text-secondary">No exit conditions configured yet.</p>
                          <button
                            type="button"
                            onClick={handleAddCondition}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary border border-divider rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Exit Condition (e.g. RSI &gt; 70)</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(currentRule.exitConditions || []).map((cond, idx) => (
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

                              <div className="flex flex-wrap items-center gap-2 p-2 bg-surface border border-divider rounded-lg">
                                {/* Left Indicator */}
                                <select
                                  value={cond.leftIndicator || ''}
                                  onChange={e => handleUpdateCondition(cond.id, { leftIndicator: e.target.value as any })}
                                  className="bg-surface border border-divider rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-primary"
                                >
                                  <option value="" disabled>Indicator</option>
                                  <option value="rsi">RSI(14, day)</option>
                                  <option value="rsiBullishDiv">RSI Bullish Divergence</option>
                                  <option value="rsiBearishDiv">RSI Bearish Divergence</option>
                                  <option value="dma50">DMA(50)</option>
                                  <option value="dma200">DMA(200)</option>
                                  <option value="ema20">EMA(20)</option>
                                  <option value="ema50">EMA(50)</option>
                                  <option value="ema200">EMA(200)</option>
                                  <option value="macd">MACD Line (12, 26)</option>
                                  <option value="macdSignal">MACD Signal (9)</option>
                                  <option value="macdHist">MACD Histogram</option>
                                  <option value="bbUpper">BB Upper (20, 2)</option>
                                  <option value="bbMiddle">BB Middle (20 SMA)</option>
                                  <option value="bbLower">BB Lower (20, 2)</option>
                                  <option value="bbBandwidth">BB Bandwidth %</option>
                                  <option value="bbPercentB">BB %B</option>
                                  <option value="vwap">VWAP</option>
                                  <option value="volume">Candle Volume</option>
                                  <option value="avgVolume">20-Period Avg Volume</option>
                                  <option value="obv">OBV (On-Balance Volume)</option>
                                  <option value="obvSignal">OBV Signal (20 SMA)</option>
                                  <option value="price">Current Price</option>
                                  <option value="changePct">Day Change %</option>
                                </select>

                                {/* Operator */}
                                <select
                                  value={cond.operator || ''}
                                  onChange={e => handleUpdateCondition(cond.id, { operator: e.target.value as any })}
                                  className="bg-surface border border-divider rounded-lg px-2 py-1 text-xs font-mono text-primary focus:outline-none focus:border-primary"
                                >
                                  <option value="" disabled>Op</option>
                                  <option value="<">&lt;</option>
                                  <option value=">">&gt;</option>
                                  <option value="<=">&lt;=</option>
                                  <option value=">=">&gt;=</option>
                                  <option value="CROSSINGOVER">CROSSINGOVER</option>
                                  <option value="CROSSINGUNDER">CROSSINGUNDER</option>
                                  <option value="BULLISH_DIVERGENCE">BULLISH DIVERGENCE</option>
                                  <option value="BEARISH_DIVERGENCE">BEARISH DIVERGENCE</option>
                                  <option value="==">==</option>
                                </select>

                                {cond.operator !== 'BULLISH_DIVERGENCE' && cond.operator !== 'BEARISH_DIVERGENCE' && (
                                  <>
                                    {/* Right Type Toggle */}
                                    <div className="inline-flex items-center p-0.5 bg-surface border border-divider rounded">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateCondition(cond.id, { rightType: 'value' })}
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
                                        onClick={() => handleUpdateCondition(cond.id, { rightType: 'indicator' })}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                          cond.rightType === 'indicator'
                                            ? 'bg-primary text-surface font-semibold'
                                            : 'text-secondary hover:text-primary'
                                        }`}
                                      >
                                        Ind
                                      </button>
                                    </div>

                                    {/* Right Value or Select */}
                                    {cond.rightType === 'value' ? (
                                      <input
                                        type="number"
                                        value={cond.rightValue !== undefined && cond.rightValue !== null ? cond.rightValue : ''}
                                        onChange={e => handleUpdateCondition(cond.id, { rightValue: e.target.value === '' ? '' : Number(e.target.value) })}
                                        placeholder="Value"
                                        className="w-20 bg-surface border border-divider rounded-lg px-2 py-1 text-xs text-primary font-mono focus:outline-none focus:border-primary"
                                      />
                                    ) : (
                                      <select
                                        value={cond.rightIndicator || ''}
                                        onChange={e => handleUpdateCondition(cond.id, { rightIndicator: e.target.value as any })}
                                        className="bg-surface border border-divider rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-primary"
                                      >
                                        <option value="" disabled>Indicator</option>
                                        <option value="dma200">DMA(200)</option>
                                        <option value="dma50">DMA(50)</option>
                                        <option value="ema200">EMA(200)</option>
                                        <option value="ema50">EMA(50)</option>
                                        <option value="ema20">EMA(20)</option>
                                        <option value="macd">MACD Line (12, 26)</option>
                                        <option value="macdSignal">MACD Signal (9)</option>
                                        <option value="macdHist">MACD Histogram</option>
                                        <option value="bbUpper">BB Upper (20, 2)</option>
                                        <option value="bbMiddle">BB Middle (20 SMA)</option>
                                        <option value="bbLower">BB Lower (20, 2)</option>
                                        <option value="bbBandwidth">BB Bandwidth %</option>
                                        <option value="bbPercentB">BB %B</option>
                                        <option value="vwap">VWAP</option>
                                        <option value="volume">Candle Volume</option>
                                        <option value="avgVolume">20-Period Avg Volume</option>
                                        <option value="obv">OBV (On-Balance Volume)</option>
                                        <option value="obvSignal">OBV Signal (20 SMA)</option>
                                        <option value="rsi">RSI(14)</option>
                                        <option value="price">Current Price</option>
                                      </select>
                                    )}
                                  </>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRemoveCondition(cond.id)}
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
                )}

                {/* Clean Dual-Action Formula Preview */}
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

            {/* TAB 2: SAVED STRATEGIES */}
            {activeTab === 'active' && (
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
                    onClick={() => {
                      setCurrentRule(BLANK_RULE);
                      setActionTab('entry');
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
                    No strategies saved yet. Click "+ New" to build your first dual-action strategy.
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
                                {rule.scope === 'global' ? 'Global' : (rule.targetSymbol || 'All')}
                              </span>
                              {entryCount > 0 && (
                                <span className="text-[10px] text-secondary font-mono px-1.5 py-0.5 rounded bg-surface-hover border border-divider">
                                  BUY: {entryCount} cond
                                </span>
                              )}
                              {(exitCount > 0 || rule.stopLossPct || rule.takeProfitPct) && (
                                <span className="text-[10px] text-secondary font-mono px-1.5 py-0.5 rounded bg-surface-hover border border-divider">
                                  SELL: {exitCount} cond{rule.stopLossPct ? ` · SL -${rule.stopLossPct}%` : ''}{rule.takeProfitPct ? ` · TP +${rule.takeProfitPct}%` : ''}
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
                                setBacktestTargetRule(rule);
                                setIsBacktestOpen(true);
                              }}
                              className="px-2 py-1 text-xs text-secondary hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                              title="Backtest this strategy"
                            >
                              <Play className="w-3 h-3 fill-current text-primary" />
                              <span>Test</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCurrentRule(normalizeRule(rule));
                                setActionTab('entry');
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
                      );
                    })}
                  </div>
                )}
              </div>
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

      {/* Strategy Backtest Modal */}
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
