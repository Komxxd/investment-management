import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Layers,
  History,
  Briefcase,
  Search,
  Play,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Tag,
  Clock,
  ExternalLink,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  ArrowUpDown,
  X,
} from 'lucide-react';
import { api } from '../../../services/api/client';
import { usePortfolioContext } from '../hooks/PortfolioContext';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { BacktestModal } from '../components/BacktestModal';
import {
  StrategyBuilderModal,
  formatRuleFormula,
  normalizeRule,
  type StrategyRule,
} from '../components/StrategyBuilderModal';
import {
  formatStrategyLogAction,
  formatStrategyLogDatetime,
  renderStrategyLogBadge,
  type StrategyLogEntry,
  type StrategyLogEventType,
} from '../components/StrategyLogsModal';

type PageTab = 'strategies' | 'logs';
type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED';
type EventFilter = 'ALL' | StrategyLogEventType;

export function StrategyPage() {
  const navigate = useNavigate();
  const { portfolioId: urlPortfolioId } = useParams<{ portfolioId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { portfolios = [], stocks = [] } = usePortfolioContext();
  const { currencySymbol = '₹' } = useCurrency();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<PageTab>(tabParam === 'logs' ? 'logs' : 'strategies');

  useEffect(() => {
    if (tabParam === 'logs' || tabParam === 'strategies') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: PageTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(urlPortfolioId || 'ALL');
  useEffect(() => {
    setSelectedPortfolioId(urlPortfolioId || 'ALL');
  }, [urlPortfolioId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [eventFilter, setEventFilter] = useState<EventFilter>('ALL');
  const [focusedStrategyId, setFocusedStrategyId] = useState<string | null>(null);
  const [logsNewestFirst, setLogsNewestFirst] = useState(true);

  const [strategies, setStrategies] = useState<StrategyRule[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [togglingStrategyId, setTogglingStrategyId] = useState<string | null>(null);

  const [logs, setLogs] = useState<StrategyLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsMissingTable, setLogsMissingTable] = useState(false);
  const [localFallbackLogs, setLocalFallbackLogs] = useState<StrategyLogEntry[]>([]);

  const [builderState, setBuilderState] = useState<{
    isOpen: boolean;
    rule: StrategyRule | null;
    portfolioId: string;
  }>({
    isOpen: false,
    rule: null,
    portfolioId: urlPortfolioId || portfolios[0]?.id || '',
  });

  const [backtestTarget, setBacktestTarget] = useState<StrategyRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StrategyRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const collectLocalStrategyLogs = useCallback((): StrategyLogEntry[] => {
    const collected: StrategyLogEntry[] = [];
    const seen = new Set<string>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('portfolio_strategy_logs_')) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        for (const item of parsed) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            collected.push(item);
          }
        }
      }
    } catch {
      // ignore localStorage read errors
    }
    return collected;
  }, []);

  const persistLocalFallbackLog = useCallback((entry: StrategyLogEntry) => {
    setLocalFallbackLogs((prev) => {
      if (prev.some((item) => item.id === entry.id)) return prev;
      return [...prev, entry];
    });
    try {
      const dateKey = entry.eventDate || new Date().toISOString().split('T')[0];
      const key = `portfolio_strategy_logs_${entry.portfolioId || 'global'}_${dateKey}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const next = Array.isArray(existing) ? existing : [];
      if (!next.some((item: any) => item?.id === entry.id)) {
        next.push(entry);
        localStorage.setItem(key, JSON.stringify(next));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const loadStrategies = useCallback(async () => {
    setLoadingStrategies(true);
    try {
      const map = new Map<string, StrategyRule>();
      try {
        const data = await api.get('/api/strategies');
        if (Array.isArray(data)) {
          for (const raw of data) {
            if (!raw || raw.id === 'rule-default') continue;
            const norm = normalizeRule(raw);
            map.set(norm.id, norm);
          }
        }
      } catch (err) {
        console.warn('Could not load strategies from API, falling back to local cache:', err);
      }

      const localKeys = ['global', ...portfolios.map((p) => p.id)];
      for (const suffix of localKeys) {
        try {
          const raw = localStorage.getItem(`portfolio_strategies_${suffix}`);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) continue;
          for (const item of parsed) {
            if (!item || item.id === 'rule-default' || !item.id || map.has(item.id)) continue;
            map.set(item.id, normalizeRule(item));
          }
        } catch {
          // ignore
        }
      }

      setStrategies(Array.from(map.values()));
    } finally {
      setLoadingStrategies(false);
    }
  }, [portfolios]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    setLocalFallbackLogs(collectLocalStrategyLogs());
    try {
      const query =
        selectedPortfolioId !== 'ALL'
          ? `?portfolio_id=${encodeURIComponent(selectedPortfolioId)}`
          : '';
      const res = await api.get(`/api/strategies/logs${query}`);
      if (Array.isArray(res?.logs)) {
        setLogs(res.logs);
        setLogsMissingTable(Boolean(res?.missingTable));
      } else {
        setLogs([]);
        setLogsMissingTable(Boolean(res?.missingTable));
      }
    } catch (err) {
      console.warn('Could not load strategy execution logs from API:', err);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [selectedPortfolioId, collectLocalStrategyLogs]);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const portfolioNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of portfolios) {
      map.set(p.id, p.name);
    }
    return map;
  }, [portfolios]);

  const getRulePortfolioId = (rule: StrategyRule): string | null => {
    const pid = rule.portfolioId || (rule as any).portfolio_id;
    return pid && portfolioNameMap.has(pid) ? pid : null;
  };

  const handleToggleRule = async (rule: StrategyRule) => {
    if (togglingStrategyId) return;
    const newStatus = !rule.enabled;
    const contextPortfolioId =
      getRulePortfolioId(rule) ||
      (selectedPortfolioId !== 'ALL' ? selectedPortfolioId : portfolios[0]?.id || null);

    setTogglingStrategyId(rule.id);
    setStrategies((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled: newStatus } : r))
    );

    const buildFallbackToggleEntry = (): StrategyLogEntry => {
      const eventType: StrategyLogEventType = newStatus ? 'STRATEGY_RESUMED' : 'STRATEGY_PAUSED';
      const now = new Date();
      return {
        id: `local-${eventType.toLowerCase()}-${rule.id}-${Date.now()}`,
        portfolioId: getRulePortfolioId(rule) || contextPortfolioId || undefined,
        strategyId: rule.id,
        strategyName: rule.name || 'Untitled Strategy',
        symbol: rule.targetSymbol || 'ALL',
        eventType,
        actionText: newStatus
          ? `Strategy "${rule.name || 'Untitled Strategy'}" resumed`
          : `Strategy "${rule.name || 'Untitled Strategy'}" paused`,
        eventDate: now.toISOString().split('T')[0],
        loggedAt: now.toISOString(),
        source: 'local',
      };
    };

    try {
      if (!rule.id.startsWith('local-')) {
        const updated = await api.put(`/api/strategies/${rule.id}`, {
          enabled: newStatus,
          portfolio_id_context: contextPortfolioId,
        });
        if (updated?.lifecycleLog && updated?.lifecycleLogPersisted === false) {
          persistLocalFallbackLog(updated.lifecycleLog);
        }
      } else {
        persistLocalFallbackLog(buildFallbackToggleEntry());
      }
      await loadLogs();
    } catch (err) {
      console.error('Failed to toggle strategy:', err);
      persistLocalFallbackLog(buildFallbackToggleEntry());
      await loadLogs();
    } finally {
      setTogglingStrategyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (!deleteTarget.id.startsWith('local-')) {
        await api.delete(`/api/strategies/${deleteTarget.id}`);
      }
      const targetPid = getRulePortfolioId(deleteTarget) || 'global';
      for (const suffix of [targetPid, 'global']) {
        try {
          const key = `portfolio_strategies_${suffix}`;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localStorage.setItem(
              key,
              JSON.stringify(parsed.filter((r: any) => r?.id !== deleteTarget.id))
            );
          }
        } catch {
          // ignore
        }
      }
      setStrategies((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      if (focusedStrategyId === deleteTarget.id) {
        setFocusedStrategyId(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete strategy:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenCreateModal = () => {
    const defaultPid =
      selectedPortfolioId !== 'ALL'
        ? selectedPortfolioId
        : urlPortfolioId || portfolios[0]?.id || '';
    setBuilderState({
      isOpen: true,
      rule: null,
      portfolioId: defaultPid,
    });
  };

  const handleOpenEditModal = (rule: StrategyRule) => {
    const pid =
      getRulePortfolioId(rule) ||
      (selectedPortfolioId !== 'ALL' ? selectedPortfolioId : urlPortfolioId || portfolios[0]?.id || '');
    setBuilderState({
      isOpen: true,
      rule,
      portfolioId: pid,
    });
  };

  const filteredStrategies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return strategies.filter((strat) => {
      const pid = getRulePortfolioId(strat);
      if (selectedPortfolioId !== 'ALL' && pid !== null && pid !== selectedPortfolioId) {
        return false;
      }
      if (statusFilter === 'ACTIVE' && !strat.enabled) return false;
      if (statusFilter === 'PAUSED' && strat.enabled) return false;

      if (!q) return true;
      const formula = formatRuleFormula(strat).toLowerCase();
      const portName = (pid ? portfolioNameMap.get(pid) : 'global')?.toLowerCase() || '';
      return (
        (strat.name || '').toLowerCase().includes(q) ||
        (strat.targetSymbol || '').toLowerCase().includes(q) ||
        formula.includes(q) ||
        portName.includes(q)
      );
    });
  }, [strategies, selectedPortfolioId, statusFilter, searchQuery, portfolioNameMap]);

  const groupedStrategies = useMemo(() => {
    const groups: { portfolioId: string | null; label: string; items: StrategyRule[] }[] = [];
    const globalItems = filteredStrategies.filter((s) => !getRulePortfolioId(s));
    if (globalItems.length > 0) {
      groups.push({ portfolioId: null, label: 'Global Strategies (All Portfolios)', items: globalItems });
    }

    for (const p of portfolios) {
      if (selectedPortfolioId !== 'ALL' && p.id !== selectedPortfolioId) continue;
      const items = filteredStrategies.filter((s) => getRulePortfolioId(s) === p.id);
      if (items.length > 0) {
        groups.push({ portfolioId: p.id, label: p.name, items });
      }
    }
    return groups;
  }, [filteredStrategies, portfolios, selectedPortfolioId]);

  const mergedLogs = useMemo(() => {
    const items = [...logs];
    const seenIds = new Set(items.map((l) => l.id));

    for (const localItem of localFallbackLogs) {
      if (seenIds.has(localItem.id)) continue;
      if (
        selectedPortfolioId !== 'ALL' &&
        localItem.portfolioId &&
        localItem.portfolioId !== selectedPortfolioId
      ) {
        continue;
      }
      if (localItem.eventType === 'STRATEGY_PAUSED' || localItem.eventType === 'STRATEGY_RESUMED') {
        const localTs = localItem.loggedAt ? new Date(localItem.loggedAt).getTime() : 0;
        const matchedDb = items.some(
          (item) =>
            item.source === 'db' &&
            item.eventType === localItem.eventType &&
            item.strategyId === localItem.strategyId &&
            Math.abs(new Date(item.loggedAt).getTime() - localTs) < 10000
        );
        if (matchedDb) continue;
      }
      items.push(localItem);
    }

    const q = searchQuery.trim().toLowerCase();
    const filtered = items.filter((entry) => {
      if (focusedStrategyId && entry.strategyId !== focusedStrategyId) return false;
      if (eventFilter !== 'ALL' && entry.eventType !== eventFilter) return false;
      if (!q) return true;
      return (
        (entry.symbol || '').toLowerCase().includes(q) ||
        (entry.strategyName || '').toLowerCase().includes(q) ||
        (entry.actionText || '').toLowerCase().includes(q)
      );
    });

    filtered.sort((a, b) => {
      const ta = a.loggedAt ? new Date(a.loggedAt).getTime() : 0;
      const tb = b.loggedAt ? new Date(b.loggedAt).getTime() : 0;
      return logsNewestFirst ? tb - ta : ta - tb;
    });

    return filtered;
  }, [logs, localFallbackLogs, selectedPortfolioId, focusedStrategyId, eventFilter, searchQuery, logsNewestFirst]);

  const activeCount = useMemo(() => strategies.filter((s) => s.enabled).length, [strategies]);
  const pausedCount = strategies.length - activeCount;

  const builderStocks = useMemo(() => {
    if (builderState.portfolioId) {
      const scoped = stocks.filter((s) => s.portfolio_id === builderState.portfolioId);
      if (scoped.length > 0) return scoped;
    }
    return stocks;
  }, [stocks, builderState.portfolioId]);

  const backtestStocks = useMemo(() => {
    if (!backtestTarget) return stocks;
    const pid = getRulePortfolioId(backtestTarget);
    if (pid) {
      const scoped = stocks.filter((s) => s.portfolio_id === pid);
      if (scoped.length > 0) return scoped;
    }
    return stocks;
  }, [backtestTarget, stocks]);

  return (
    <div className="flex-1 w-full bg-background text-primary py-4 sm:py-6 space-y-5">
      {/* Header & Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-divider">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-primary">Strategy</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-surface-hover text-secondary border border-divider">
              {strategies.length} {strategies.length === 1 ? 'Rule' : 'Rules'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {activeCount} Active
            </span>
            {pausedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                {pausedCount} Paused
              </span>
            )}
          </div>
          <p className="text-xs text-secondary mt-1">
            Create indicator-driven BUY/SELL strategies, pause or resume automation, backtest rules, and audit execution logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sub-tab Switcher */}
          <div className="flex items-center p-1 bg-surface border border-divider rounded-xl">
            <button
              type="button"
              onClick={() => handleTabChange('strategies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'strategies'
                  ? 'bg-primary text-background shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-surface-hover'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Strategies</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'strategies'
                    ? 'bg-background/25 text-background font-bold'
                    : 'bg-surface-hover text-secondary border border-divider'
                }`}
              >
                {strategies.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-primary text-background shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-surface-hover'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Execution Logs</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'logs'
                    ? 'bg-background/25 text-background font-bold'
                    : 'bg-surface-hover text-secondary border border-divider'
                }`}
              >
                {mergedLogs.length}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Strategy</span>
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Portfolio Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setSelectedPortfolioId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedPortfolioId === 'ALL'
                ? 'bg-primary text-background'
                : 'bg-surface border border-divider text-secondary hover:text-primary hover:bg-surface-hover'
            }`}
          >
            All Portfolios
          </button>

          {portfolios.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPortfolioId(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                selectedPortfolioId === p.id
                  ? 'bg-primary text-background'
                  : 'bg-surface border border-divider text-secondary hover:text-primary hover:bg-surface-hover'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        {/* Search & Secondary Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'strategies'
                  ? 'Search strategies, symbol, indicator...'
                  : 'Search logs by stock, strategy, action...'
              }
              className="w-full pl-8 pr-7 py-1.5 bg-surface border border-divider rounded-lg text-xs text-primary placeholder:text-tertiary focus:outline-none focus:border-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeTab === 'strategies' ? (
            <div className="flex items-center p-0.5 bg-surface border border-divider rounded-lg text-[11px]">
              {(['ALL', 'ACTIVE', 'PAUSED'] as StatusFilter[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-surface-hover text-primary'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Paused'}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as EventFilter)}
                className="bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Events</option>
                <option value="STRATEGY_STARTED">Started</option>
                <option value="STRATEGY_PAUSED">Paused</option>
                <option value="STRATEGY_RESUMED">Resumed</option>
                <option value="SIGNAL_TRIGGERED">Signal</option>
                <option value="ACTION_EXECUTED">Action</option>
              </select>

              <button
                type="button"
                onClick={() => setLogsNewestFirst((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-divider bg-surface hover:bg-surface-hover text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
                title="Toggle chronological order"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{logsNewestFirst ? 'Newest' : 'Oldest'}</span>
              </button>

              <button
                type="button"
                onClick={loadLogs}
                disabled={loadingLogs}
                className="p-1.5 rounded-lg border border-divider bg-surface hover:bg-surface-hover text-secondary hover:text-primary transition-colors disabled:opacity-50 cursor-pointer"
                title="Refresh logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'strategies' ? (
        loadingStrategies ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-secondary">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">Loading strategies...</span>
          </div>
        ) : strategies.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-2xl border border-divider bg-surface space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-surface-hover text-primary flex items-center justify-center mx-auto border border-divider">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-primary">No Strategies Created Yet</h3>
              <p className="text-xs text-secondary leading-relaxed">
                Build your first dual-action BUY/SELL indicator strategy to generate live signals, execute daily trades, and inspect lifecycle logs.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Strategy</span>
            </button>
          </div>
        ) : groupedStrategies.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-divider bg-surface space-y-2">
            <AlertCircle className="w-8 h-8 text-secondary mx-auto opacity-40" />
            <h4 className="text-sm font-semibold text-primary">No strategies match your filters</h4>
            <p className="text-xs text-secondary">
              Try clearing your search query or switching portfolio/status filters.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedStrategies.map((group) => (
              <div key={group.portfolioId || 'global'} className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-divider">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-surface-hover border border-divider">
                      <Briefcase className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                      <span>{group.label}</span>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface border border-divider text-secondary">
                        {group.items.length} {group.items.length === 1 ? 'strategy' : 'strategies'}
                      </span>
                    </h2>
                  </div>

                  {group.portfolioId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/portfolio/${group.portfolioId}`)}
                      className="text-xs text-secondary hover:text-primary flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Open Portfolio</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.items.map((strategy) => {
                    const formula = formatRuleFormula(strategy);
                    const targetSymbol = strategy.targetSymbol || 'ALL';
                    const entryConds =
                      strategy.entryConditions && strategy.entryConditions.length > 0
                        ? strategy.entryConditions
                        : strategy.conditions || [];
                    const exitConds = strategy.exitConditions || [];
                    const isToggling = togglingStrategyId === strategy.id;

                    return (
                      <div
                        key={strategy.id}
                        className="p-4 sm:p-5 rounded-2xl border border-divider bg-surface hover:border-divider-hover transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-primary truncate">
                                {strategy.name || 'Untitled Strategy'}
                              </h3>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-hover border border-divider text-primary">
                                  <Tag className="w-2.5 h-2.5 text-secondary" />
                                  <span>{strategy.scope === 'global' ? 'Global (ALL)' : targetSymbol}</span>
                                </span>
                                {strategy.frequency && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-hover border border-divider text-secondary uppercase">
                                    {strategy.frequency}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isToggling}
                              onClick={() => handleToggleRule(strategy)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors shrink-0 cursor-pointer disabled:opacity-60 ${
                                strategy.enabled
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
                              }`}
                              title={strategy.enabled ? 'Click to pause strategy' : 'Click to resume strategy'}
                            >
                              {isToggling ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : strategy.enabled ? (
                                <PlayCircle className="w-3 h-3" />
                              ) : (
                                <PauseCircle className="w-3 h-3" />
                              )}
                              <span>{strategy.enabled ? 'Active' : 'Paused'}</span>
                            </button>
                          </div>

                          <div className="p-2.5 rounded-xl bg-background border border-divider text-xs font-mono text-secondary leading-relaxed line-clamp-3">
                            {formula}
                          </div>

                          {(entryConds.length > 0 ||
                            exitConds.length > 0 ||
                            strategy.stopLossPct ||
                            strategy.takeProfitPct) && (
                            <div className="flex flex-wrap gap-1">
                              {entryConds.map((cond, idx) => (
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
                              {exitConds.map((cond, idx) => (
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
                              {strategy.stopLossPct && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 border border-rose-500/20 text-rose-400">
                                  SL -{strategy.stopLossPct}%
                                </span>
                              )}
                              {strategy.takeProfitPct && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                  TP +{strategy.takeProfitPct}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-divider flex items-center justify-between gap-2">
                          <span className="text-[10px] text-tertiary flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            <span>
                              {strategy.createdAt
                                ? new Date(strategy.createdAt).toLocaleDateString()
                                : 'Saved'}
                            </span>
                          </span>

                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setFocusedStrategyId(strategy.id);
                                handleTabChange('logs');
                              }}
                              className="px-2.5 py-1 rounded-lg border border-divider bg-surface hover:bg-surface-hover text-[11px] font-medium text-secondary hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                              title="View lifecycle & signal logs for this strategy"
                            >
                              <History className="w-3 h-3" />
                              <span>Logs</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setBacktestTarget(normalizeRule(strategy))}
                              className="px-2.5 py-1 rounded-lg bg-primary text-background hover:opacity-90 text-[11px] font-semibold transition-opacity flex items-center gap-1 cursor-pointer"
                              title="Backtest this strategy"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Test</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(strategy)}
                              className="p-1.5 rounded-lg border border-divider bg-surface hover:bg-surface-hover text-secondary hover:text-primary transition-colors cursor-pointer"
                              title="Edit strategy"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(strategy)}
                              className="p-1.5 rounded-lg border border-divider bg-surface hover:bg-danger/10 text-secondary hover:text-danger transition-colors cursor-pointer"
                              title="Delete strategy"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Execution Logs Tab */
        <div className="bg-surface border border-divider rounded-2xl overflow-hidden">
          {focusedStrategyId && (
            <div className="px-4 py-2 bg-primary/5 border-b border-divider flex items-center justify-between text-xs">
              <span className="text-secondary">
                Filtered to strategy:{' '}
                <strong className="text-primary">
                  {strategies.find((s) => s.id === focusedStrategyId)?.name || focusedStrategyId}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setFocusedStrategyId(null)}
                className="text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                Show all strategies
              </button>
            </div>
          )}

          {logsMissingTable && (
            <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/25 text-xs text-amber-300">
              Run the <code className="font-mono font-semibold">strategy_logs</code> SQL in Supabase to persist pause/resume &amp; signal logs across sessions; locally cached events and derived strategy/execution history are shown below.
            </div>
          )}

          {loadingLogs && mergedLogs.length === 0 ? (
            <div className="py-16 flex items-center justify-center gap-2 text-xs text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading execution logs...</span>
            </div>
          ) : mergedLogs.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-2">
              <History className="w-8 h-8 text-tertiary mx-auto opacity-50" />
              <p className="text-xs font-semibold text-primary">No execution logs found</p>
              <p className="text-[11px] text-tertiary">
                Logs are captured when a strategy starts, pauses, resumes, receives a BUY/SELL signal, or executes a trade.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-background/70 border-b border-divider">
                  <tr className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">
                    <th className="py-2.5 px-4 border-r border-divider/60 whitespace-nowrap">
                      Datetime
                    </th>
                    <th className="py-2.5 px-4 border-r border-divider/60 whitespace-nowrap">
                      Portfolio
                    </th>
                    <th className="py-2.5 px-4 border-r border-divider/60 whitespace-nowrap">
                      Symbol
                    </th>
                    <th className="py-2.5 px-4">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider/60 text-xs">
                  {mergedLogs.map((entry) => {
                    const portLabel = entry.portfolioId
                      ? portfolioNameMap.get(entry.portfolioId) || 'Portfolio'
                      : 'Global';
                    return (
                      <tr key={entry.id} className="hover:bg-surface-hover/40 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-[11px] text-secondary whitespace-nowrap border-r border-divider/60">
                          {formatStrategyLogDatetime(entry.loggedAt)}
                        </td>
                        <td className="py-2.5 px-4 text-secondary whitespace-nowrap border-r border-divider/60">
                          {portLabel}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-primary whitespace-nowrap border-r border-divider/60">
                          {entry.symbol || 'ALL'}
                        </td>
                        <td className="py-2.5 px-4 text-primary">
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            {renderStrategyLogBadge(entry)}
                            <span className="text-xs text-primary">
                              {formatStrategyLogAction(entry, currencySymbol)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Strategy Modal */}
      <StrategyBuilderModal
        isOpen={builderState.isOpen}
        onClose={() => setBuilderState((prev) => ({ ...prev, isOpen: false }))}
        portfolioId={builderState.portfolioId}
        portfolioName={
          builderState.portfolioId
            ? portfolioNameMap.get(builderState.portfolioId) || 'Portfolio'
            : 'Global'
        }
        stocks={builderStocks}
        indicators={{}}
        currencySymbol={currencySymbol}
        initialRule={builderState.rule}
        initialTab="builder"
        onStrategiesChanged={() => {
          loadStrategies();
          loadLogs();
        }}
        onLifecycleLog={(entry) => {
          persistLocalFallbackLog(entry);
        }}
      />

      {/* Backtest Modal */}
      {backtestTarget && (
        <BacktestModal
          isOpen={Boolean(backtestTarget)}
          onClose={() => setBacktestTarget(null)}
          rule={backtestTarget}
          stocks={backtestStocks}
          currencySymbol={currencySymbol}
          portfolioId={getRulePortfolioId(backtestTarget) || urlPortfolioId || portfolios[0]?.id}
          onBacktestCompleted={() => setBacktestTarget(null)}
        />
      )}

      {/* Delete Strategy Confirmation */}
      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Strategy"
        message={`Are you sure you want to delete "${deleteTarget?.name || 'this strategy'}"? Existing historical execution logs will be preserved.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        isDestructive
      />
    </div>
  );
}
