import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Play,
  Briefcase,
  Layers,
  Search,
  Plus,
  Clock,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Loader2,
  Tag,
  X,
  Repeat,
  Coins,
} from 'lucide-react';
import { usePortfolioContext } from '../hooks/PortfolioContext';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { api } from '../../../services/api/client';
import { BacktestModal } from '../components/BacktestModal';
import { PortfolioBacktestModal } from '../components/PortfolioBacktestModal';
import {
  formatRuleFormula,
  normalizeRule,
  type StrategyRule,
} from '../components/StrategyBuilderModal';

export function BacktestPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { portfolios = [], stocks = [], setIsCreateModalOpen } = usePortfolioContext();
  const { currencySymbol = '₹' } = useCurrency();

  // Secondary Tab State: 'portfolios' | 'strategies'
  const currentTabParam = searchParams.get('tab');
  const [activeMainTab, setActiveMainTab] = useState<'portfolios' | 'strategies'>(
    currentTabParam === 'strategies' ? 'strategies' : 'portfolios'
  );

  useEffect(() => {
    if (currentTabParam === 'strategies' || currentTabParam === 'portfolios') {
      setActiveMainTab(currentTabParam);
    }
  }, [currentTabParam]);

  const handleTabChange = (tab: 'portfolios' | 'strategies') => {
    setActiveMainTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const [strategies, setStrategies] = useState<StrategyRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Backtest Modal state (for individual strategies)
  const [isBacktestModalOpen, setIsBacktestModalOpen] = useState<boolean>(false);
  const [activeStrategyToTest, setActiveStrategyToTest] = useState<StrategyRule | null>(null);

  // Portfolio Backtest Modal state (for SIP and One-Time entire portfolio backtesting)
  const [portfolioBacktestConfig, setPortfolioBacktestConfig] = useState<{
    portfolio: any;
    mode: 'SIP' | 'ONE_TIME';
  } | null>(null);

  // Load all saved strategies from both backend and local storage
  const loadStrategies = async () => {
    setLoading(true);
    try {
      let serverStrategies: StrategyRule[] = [];
      try {
        const data = await api.get('/api/strategies');
        if (Array.isArray(data)) {
          serverStrategies = data.filter((s: any) => s && s.id !== 'rule-default');
        }
      } catch (err) {
        console.warn('Could not fetch strategies from server, reading local storage', err);
      }

      // Helper to associate unassigned strategies with their appropriate portfolio
      const resolvePortfolioId = (strat: any): string | undefined => {
        const directId = strat.portfolioId || strat.portfolio_id;
        if (directId && portfolios.some((p) => p.id === directId)) {
          return directId;
        }
        if (strat.targetSymbol && stocks.length > 0) {
          const matchedStock = stocks.find((st) => st.symbol === strat.targetSymbol);
          if (matchedStock && matchedStock.portfolio_id) {
            return matchedStock.portfolio_id;
          }
        }
        return portfolios[0]?.id || undefined;
      };

      // Map by ID to prevent duplicates
      const strategiesMap = new Map<string, StrategyRule>();
      serverStrategies.forEach((s) => {
        if (s && s.id) {
          strategiesMap.set(s.id, {
            ...normalizeRule(s),
            portfolioId: resolvePortfolioId(s),
          });
        }
      });

      // Check localStorage for each portfolio
      portfolios.forEach((p) => {
        try {
          const raw = localStorage.getItem(`portfolio_strategies_${p.id}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((s: any) => {
                if (s && s.id && s.id !== 'rule-default') {
                  if (!strategiesMap.has(s.id)) {
                    strategiesMap.set(s.id, {
                      ...normalizeRule(s),
                      portfolioId: s.portfolioId || s.portfolio_id || p.id,
                    });
                  }
                }
              });
            }
          }
        } catch {}
      });

      // Check global strategies in localStorage and assign to appropriate portfolio
      try {
        const raw = localStorage.getItem('portfolio_strategies_global');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((s: any) => {
              if (s && s.id && s.id !== 'rule-default' && !strategiesMap.has(s.id)) {
                strategiesMap.set(s.id, {
                  ...normalizeRule(s),
                  portfolioId: resolvePortfolioId(s),
                });
              }
            });
          }
        }
      } catch {}

      setStrategies(Array.from(strategiesMap.values()));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, [portfolios, stocks]);

  // Create a quick lookup for portfolio names
  const portfolioNameMap = useMemo(() => {
    const map = new Map<string, string>();
    portfolios.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [portfolios]);

  // Filter portfolios by search query
  const filteredPortfolios = useMemo(() => {
    if (!searchQuery.trim()) return portfolios;
    const q = searchQuery.toLowerCase();
    return portfolios.filter((p) => p.name.toLowerCase().includes(q));
  }, [portfolios, searchQuery]);

  // Filter strategies by portfolio and search query
  const filteredStrategies = useMemo(() => {
    return strategies.filter((strat) => {
      // Filter by portfolio
      const stratPortId = strat.portfolioId || (strat as any).portfolio_id || null;
      if (selectedPortfolioId !== 'ALL' && stratPortId !== selectedPortfolioId) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = strat.name?.toLowerCase().includes(q);
        const symbolMatch = strat.targetSymbol?.toLowerCase().includes(q);
        const formulaMatch = formatRuleFormula(strat).toLowerCase().includes(q);
        const portfolioMatch = (portfolioNameMap.get(stratPortId || '') || '').toLowerCase().includes(q);
        return nameMatch || symbolMatch || formulaMatch || portfolioMatch;
      }

      return true;
    });
  }, [strategies, selectedPortfolioId, searchQuery, portfolioNameMap]);

  // Group filtered strategies by portfolio
  const groupedStrategies = useMemo(() => {
    const groups: Array<{
      portfolioId: string | null;
      portfolioName: string;
      items: StrategyRule[];
    }> = [];

    portfolios.forEach((p) => {
      const items = filteredStrategies.filter(
        (s) => (s.portfolioId || (s as any).portfolio_id) === p.id
      );
      if (items.length > 0 || selectedPortfolioId === p.id) {
        groups.push({
          portfolioId: p.id,
          portfolioName: p.name,
          items,
        });
      }
    });

    // Fallback if no portfolios exist yet
    if (groups.length === 0 && filteredStrategies.length > 0) {
      groups.push({
        portfolioId: null,
        portfolioName: 'General Strategies',
        items: filteredStrategies,
      });
    }

    return groups;
  }, [filteredStrategies, portfolios, selectedPortfolioId]);

  // Handle opening backtest modal for a selected strategy
  const handleOpenBacktest = (rule: StrategyRule) => {
    setActiveStrategyToTest(normalizeRule(rule));
    setIsBacktestModalOpen(true);
  };

  // Handle opening portfolio backtest modal (SIP or One-Time)
  const handleOpenPortfolioBacktest = (portfolio: any, mode: 'SIP' | 'ONE_TIME' = 'SIP') => {
    setPortfolioBacktestConfig({ portfolio, mode });
  };

  // Stocks for the backtest modal
  const targetPortfolioStocks = useMemo(() => {
    if (!activeStrategyToTest) return stocks;
    const rulePortId = activeStrategyToTest.portfolioId || (activeStrategyToTest as any).portfolio_id;
    if (rulePortId) {
      const portStocks = stocks.filter((s) => s.portfolio_id === rulePortId);
      if (portStocks.length > 0) return portStocks;
    }
    return stocks;
  }, [activeStrategyToTest, stocks]);

  // Helper to load sample preset strategies if none exist
  const handleLoadSampleStrategies = async () => {
    const targetPortId = portfolios[0]?.id || null;
    const samples: StrategyRule[] = [
      {
        id: `rule-sample-rsi-${Date.now()}`,
        name: 'RSI Oversold Mean Reversion',
        scope: 'stock',
        targetSymbol: stocks[0]?.symbol || 'RELIANCE.NS',
        action: 'BUY',
        sizingType: 'QTY',
        sizingValue: 10,
        enabled: true,
        frequency: 'daily',
        createdAt: new Date().toISOString(),
        conditions: [
          {
            id: 'c1',
            leftIndicator: 'rsi',
            operator: '<',
            rightType: 'value',
            rightValue: 30,
          },
        ],
        portfolioId: targetPortId || undefined,
      },
      {
        id: `rule-sample-golden-${Date.now() + 1}`,
        name: 'Golden Cross (50/200 DMA)',
        scope: 'stock',
        targetSymbol: stocks[1]?.symbol || 'TCS.NS',
        action: 'BUY',
        sizingType: 'QTY',
        sizingValue: 15,
        enabled: true,
        frequency: 'daily',
        createdAt: new Date().toISOString(),
        conditions: [
          {
            id: 'c2',
            leftIndicator: 'dma50',
            operator: 'CROSSINGOVER',
            rightType: 'indicator',
            rightIndicator: 'dma200',
          },
        ],
        portfolioId: targetPortId || undefined,
      },
    ];

    try {
      for (const s of samples) {
        await api.post('/api/strategies', {
          name: s.name,
          portfolio_id: targetPortId,
          scope: s.scope,
          target_symbol: s.targetSymbol,
          action: s.action,
          sizing_type: s.sizingType,
          sizing_value: s.sizingValue,
          conditions: s.conditions,
          enabled: s.enabled,
          frequency: s.frequency,
        });
      }
    } catch {
      const key = `portfolio_strategies_${targetPortId || 'global'}`;
      try {
        localStorage.setItem(key, JSON.stringify(samples));
      } catch {}
    }

    loadStrategies();
  };

  return (
    <div className="flex-1 w-full bg-background text-primary py-4 sm:py-6 space-y-6">
      {/* Top Banner & Secondary Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-divider">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-bold text-primary">
              {activeMainTab === 'portfolios' ? 'Portfolios' : 'Saved Strategies'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-surface-hover text-secondary border border-divider">
              {activeMainTab === 'portfolios'
                ? `${portfolios.length} ${portfolios.length === 1 ? 'Portfolio' : 'Portfolios'}`
                : `${strategies.length} ${strategies.length === 1 ? 'Strategy' : 'Strategies'}`}
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            {activeMainTab === 'portfolios'
              ? 'Select any portfolio to launch a historical backtest.'
              : 'View saved strategies grouped by portfolio and execute historical simulation backtests.'}
          </p>
        </div>

        {/* Secondary Tab Control: Portfolio | Strategies */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-surface border border-divider rounded-xl">
            <button
              onClick={() => handleTabChange('portfolios')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeMainTab === 'portfolios'
                  ? 'bg-primary text-background shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-surface-hover'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Portfolio</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeMainTab === 'portfolios'
                    ? 'bg-background/25 text-background font-bold'
                    : 'bg-surface-hover text-secondary border border-divider'
                }`}
              >
                {portfolios.length}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('strategies')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeMainTab === 'strategies'
                  ? 'bg-primary text-background shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-surface-hover'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Strategies</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeMainTab === 'strategies'
                    ? 'bg-background/25 text-background font-bold'
                    : 'bg-surface-hover text-secondary border border-divider'
                }`}
              >
                {strategies.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeMainTab === 'portfolios' ? 'Filter portfolios...' : 'Filter strategies...'}
              className="w-full pl-9 pr-3 py-1.5 bg-surface border border-divider rounded-lg text-xs text-primary focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PORTFOLIO VIEW                                                     */}
      {/* ========================================================================= */}
      {activeMainTab === 'portfolios' && (
        <div className="space-y-6">
          {portfolios.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-2xl border border-divider bg-surface space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-surface-hover text-primary flex items-center justify-center mx-auto border border-divider">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-primary">No Portfolios Found</h3>
                <p className="text-xs text-secondary leading-relaxed">
                  You have not created any portfolios yet. Create your first portfolio to start backtesting.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Portfolio</span>
              </button>
            </div>
          ) : filteredPortfolios.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-divider bg-surface space-y-2">
              <AlertCircle className="w-8 h-8 text-secondary mx-auto opacity-40" />
              <h4 className="text-sm font-semibold text-primary">No portfolios match your search</h4>
              <p className="text-xs text-secondary">Try searching for a different portfolio name.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPortfolios.map((portfolio) => (
                <div
                  key={portfolio.id}
                  className="p-4 sm:p-5 rounded-2xl border border-divider bg-surface hover:border-divider-hover hover:shadow-md transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-surface-hover border border-divider text-primary shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <h3
                      className="text-sm font-bold text-primary truncate"
                      title={portfolio.name}
                    >
                      {portfolio.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenPortfolioBacktest(portfolio, 'SIP')}
                      className="px-3 py-1.5 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity flex items-center gap-1.5 cursor-pointer"
                      title="Backtest monthly SIP"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>SIP</span>
                    </button>
                    <button
                      onClick={() => handleOpenPortfolioBacktest(portfolio, 'ONE_TIME')}
                      className="px-3 py-1.5 rounded-xl border border-divider bg-background hover:bg-surface-hover text-secondary hover:text-primary text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Backtest one-time lump sum investment"
                    >
                      <Coins className="w-3.5 h-3.5 text-primary" />
                      <span>One-Time</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STRATEGIES VIEW                                                    */}
      {/* ========================================================================= */}
      {activeMainTab === 'strategies' && (
        <div className="space-y-6">
          {/* Portfolio Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedPortfolioId('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedPortfolioId === 'ALL'
                  ? 'bg-primary text-background'
                  : 'bg-surface border border-divider text-secondary hover:text-primary hover:bg-surface-hover'
              }`}
            >
              All Portfolios ({strategies.length})
            </button>

            {portfolios.map((p) => {
              const count = strategies.filter(
                (s) => (s.portfolioId || (s as any).portfolio_id) === p.id
              ).length;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPortfolioId(p.id)}
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

          {/* Loading State */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-secondary">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">Loading saved strategies...</span>
            </div>
          ) : strategies.length === 0 ? (
            /* Empty State */
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
                onClick={handleLoadSampleStrategies}
                className="px-4 py-2 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Load Sample Strategies</span>
              </button>
            </div>
          ) : filteredStrategies.length === 0 ? (
            /* Filter Empty State */
            <div className="p-12 text-center rounded-2xl border border-divider bg-surface space-y-2">
              <AlertCircle className="w-8 h-8 text-secondary mx-auto opacity-40" />
              <h4 className="text-sm font-semibold text-primary">No strategies match your filter</h4>
              <p className="text-xs text-secondary">Try adjusting your search query or portfolio filter.</p>
            </div>
          ) : (
            /* Grouped Strategy Cards by Portfolio */
            <div className="space-y-8">
              {groupedStrategies.map((group) => {
                if (group.items.length === 0) return null;

                return (
                  <div key={group.portfolioId || 'global'} className="space-y-3">
                    {/* Portfolio Group Header */}
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

                    {/* Strategy Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.items.map((strategy) => {
                        const formula = formatRuleFormula(strategy);
                        const targetSymbol = strategy.targetSymbol || 'ALL';
                        const hasConditions = strategy.conditions && strategy.conditions.length > 0;

                        return (
                          <div
                            key={strategy.id}
                            className="p-4 sm:p-5 rounded-2xl border border-divider bg-surface hover:border-divider-hover hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                          >
                            {/* Card Header */}
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

                              {/* Strategy Formula Box */}
                              <div className="p-2.5 rounded-xl bg-background border border-divider text-xs font-mono text-secondary leading-relaxed line-clamp-3">
                                {formula}
                              </div>

                              {/* Condition Tags */}
                              {hasConditions && (
                                <div className="flex flex-wrap gap-1">
                                  {(strategy.entryConditions && strategy.entryConditions.length > 0 ? strategy.entryConditions : strategy.conditions).map((cond, idx) => (
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

                            {/* Card Footer: Metadata & Backtest Action */}
                            <div className="pt-3 border-t border-divider flex items-center justify-between gap-3">
                              <span className="text-[10px] text-tertiary flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {strategy.createdAt
                                    ? new Date(strategy.createdAt).toLocaleDateString()
                                    : 'Daily'}
                                </span>
                              </span>

                              {/* Option to Backtest */}
                              <button
                                onClick={() => handleOpenBacktest(strategy)}
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
      )}

      {/* Portfolio Backtest Modal (SIP / One-Time) */}
      {portfolioBacktestConfig && (
        <PortfolioBacktestModal
          isOpen={Boolean(portfolioBacktestConfig)}
          onClose={() => setPortfolioBacktestConfig(null)}
          portfolio={portfolioBacktestConfig.portfolio}
          initialMode={portfolioBacktestConfig.mode}
          stocks={stocks}
          currencySymbol={currencySymbol}
        />
      )}

      {/* Backtest Modal Dialog */}
      {isBacktestModalOpen && activeStrategyToTest && (
        <BacktestModal
          isOpen={isBacktestModalOpen}
          onClose={() => setIsBacktestModalOpen(false)}
          rule={activeStrategyToTest}
          stocks={targetPortfolioStocks}
          currencySymbol={currencySymbol}
          portfolioId={activeStrategyToTest.portfolioId || (activeStrategyToTest as any).portfolio_id}
          onBacktestCompleted={() => {
            setIsBacktestModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
