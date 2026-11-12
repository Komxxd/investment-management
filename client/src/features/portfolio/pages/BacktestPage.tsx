import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, Layers, Search } from 'lucide-react';
import { usePortfolioContext } from '../hooks/PortfolioContext';
import type { Portfolio } from '../hooks/usePortfolioData';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { BacktestModal } from '../components/BacktestModal';
import { PortfolioBacktestModal } from '../components/PortfolioBacktestModal';
import {
  formatRuleFormula,
  normalizeRule,
  type StrategyRule,
} from '../utils/strategyConfig';
import {
  loadAllBacktestStrategies,
  seedSampleBacktestStrategies,
  type StrategyWithLegacyPortfolio,
} from '../components/backtest/backtestPresets';
import { BacktestPortfoliosTab } from '../components/backtest/BacktestPortfoliosTab';
import {
  BacktestStrategiesTab,
  type BacktestStrategyGroup,
} from '../components/backtest/BacktestStrategiesTab';

export function BacktestPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { portfolios = [], stocks = [], setIsCreateModalOpen } = usePortfolioContext();
  const { currencySymbol = '₹' } = useCurrency();

  const currentTabParam = searchParams.get('tab');
  const activeMainTab: 'portfolios' | 'strategies' =
    currentTabParam === 'strategies' ? 'strategies' : 'portfolios';

  const handleTabChange = (tab: 'portfolios' | 'strategies') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const [strategies, setStrategies] = useState<StrategyRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isBacktestModalOpen, setIsBacktestModalOpen] = useState<boolean>(false);
  const [activeStrategyToTest, setActiveStrategyToTest] = useState<StrategyRule | null>(null);

  const [portfolioBacktestConfig, setPortfolioBacktestConfig] = useState<{
    portfolio: Portfolio;
    mode: 'SIP' | 'ONE_TIME';
  } | null>(null);

  const refreshStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await loadAllBacktestStrategies(portfolios, stocks);
      setStrategies(loaded);
    } finally {
      setLoading(false);
    }
  }, [portfolios, stocks]);

  useEffect(() => {
    let cancelled = false;
    loadAllBacktestStrategies(portfolios, stocks)
      .then(loaded => {
        if (!cancelled) {
          setStrategies(loaded);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [portfolios, stocks]);

  const portfolioNameMap = useMemo(() => {
    const map = new Map<string, string>();
    portfolios.forEach(p => map.set(p.id, p.name));
    return map;
  }, [portfolios]);

  const filteredPortfolios = useMemo(() => {
    if (!searchQuery.trim()) return portfolios;
    const q = searchQuery.toLowerCase();
    return portfolios.filter(p => p.name.toLowerCase().includes(q));
  }, [portfolios, searchQuery]);

  const filteredStrategies = useMemo(() => {
    return strategies.filter(strat => {
      const stratPortId =
        strat.portfolioId || (strat as StrategyWithLegacyPortfolio).portfolio_id || null;
      if (selectedPortfolioId !== 'ALL' && stratPortId !== selectedPortfolioId) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = strat.name?.toLowerCase().includes(q);
        const symbolMatch = strat.targetSymbol?.toLowerCase().includes(q);
        const formulaMatch = formatRuleFormula(strat).toLowerCase().includes(q);
        const portfolioMatch = (portfolioNameMap.get(stratPortId || '') || '')
          .toLowerCase()
          .includes(q);
        return nameMatch || symbolMatch || formulaMatch || portfolioMatch;
      }

      return true;
    });
  }, [strategies, selectedPortfolioId, searchQuery, portfolioNameMap]);

  const groupedStrategies = useMemo(() => {
    const groups: BacktestStrategyGroup[] = [];

    portfolios.forEach(p => {
      const items = filteredStrategies.filter(
        s => (s.portfolioId || (s as StrategyWithLegacyPortfolio).portfolio_id) === p.id
      );
      if (items.length > 0 || selectedPortfolioId === p.id) {
        groups.push({
          portfolioId: p.id,
          portfolioName: p.name,
          items,
        });
      }
    });

    if (groups.length === 0 && filteredStrategies.length > 0) {
      groups.push({
        portfolioId: null,
        portfolioName: 'General Strategies',
        items: filteredStrategies,
      });
    }

    return groups;
  }, [filteredStrategies, portfolios, selectedPortfolioId]);

  const handleOpenBacktest = (rule: StrategyRule) => {
    setActiveStrategyToTest(normalizeRule(rule));
    setIsBacktestModalOpen(true);
  };

  const handleOpenPortfolioBacktest = (
    portfolio: Portfolio,
    mode: 'SIP' | 'ONE_TIME' = 'SIP'
  ) => {
    setPortfolioBacktestConfig({ portfolio, mode });
  };

  const targetPortfolioStocks = useMemo(() => {
    if (!activeStrategyToTest) return stocks;
    const rulePortId =
      activeStrategyToTest.portfolioId ||
      (activeStrategyToTest as StrategyWithLegacyPortfolio).portfolio_id;
    if (rulePortId) {
      const portStocks = stocks.filter(s => s.portfolio_id === rulePortId);
      if (portStocks.length > 0) return portStocks;
    }
    return stocks;
  }, [activeStrategyToTest, stocks]);

  const handleLoadSampleStrategies = async () => {
    const targetPortId = portfolios[0]?.id || null;
    await seedSampleBacktestStrategies(targetPortId, stocks);
    await refreshStrategies();
  };

  return (
    <div className="flex-1 w-full bg-background text-primary py-4 sm:py-6 space-y-6">
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

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={
                activeMainTab === 'portfolios' ? 'Filter portfolios...' : 'Filter strategies...'
              }
              className="w-full pl-9 pr-3 py-1.5 bg-surface border border-divider rounded-lg text-xs text-primary focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
      </div>

      {activeMainTab === 'portfolios' && (
        <BacktestPortfoliosTab
          portfolios={portfolios}
          filteredPortfolios={filteredPortfolios}
          onOpenCreatePortfolio={() => setIsCreateModalOpen(true)}
          onOpenPortfolioBacktest={handleOpenPortfolioBacktest}
        />
      )}

      {activeMainTab === 'strategies' && (
        <BacktestStrategiesTab
          portfolios={portfolios}
          strategies={strategies}
          filteredStrategies={filteredStrategies}
          groupedStrategies={groupedStrategies}
          selectedPortfolioId={selectedPortfolioId}
          onSelectPortfolioId={setSelectedPortfolioId}
          loading={loading}
          onLoadSampleStrategies={handleLoadSampleStrategies}
          onOpenBacktest={handleOpenBacktest}
        />
      )}

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

      {isBacktestModalOpen && activeStrategyToTest && (
        <BacktestModal
          isOpen={isBacktestModalOpen}
          onClose={() => setIsBacktestModalOpen(false)}
          rule={activeStrategyToTest}
          stocks={targetPortfolioStocks}
          currencySymbol={currencySymbol}
          portfolioId={
            activeStrategyToTest.portfolioId ||
            (activeStrategyToTest as StrategyWithLegacyPortfolio).portfolio_id
          }
          onBacktestCompleted={() => {
            setIsBacktestModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
