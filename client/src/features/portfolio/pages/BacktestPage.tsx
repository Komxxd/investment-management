import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  FlaskConical,
  History,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { usePortfolioContext } from '../hooks/PortfolioContext';
import type { Portfolio } from '../hooks/usePortfolioData';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { BacktestModal } from '../components/BacktestModal';
import { PortfolioBacktestModal } from '../components/PortfolioBacktestModal';
import { BacktestPortfoliosTab } from '../components/backtest/BacktestPortfoliosTab';
import { BacktestStrategyLauncher } from '../components/backtest/BacktestStrategyLauncher';
import { BacktestHistoryTab } from '../components/backtest/BacktestHistoryTab';
import {
  activateBacktestHistorySession,
  clearBacktestHistory,
  deleteBacktestHistoryEntry,
  loadBacktestHistory,
  type BacktestHistoryEntry,
} from '../components/backtest/backtestSessionStorage';
import type { StrategyRule } from '../utils/strategyConfig';
import { loadSavedStrategies } from '../utils/strategyStorage';

type BacktestPageTab = 'simulations' | 'results';

export function BacktestPage() {
  const { portfolioId: urlPortfolioId } = useParams<{ portfolioId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { portfolios, stocks, setIsCreateModalOpen } = usePortfolioContext();
  const { currencySymbol } = useCurrency();

  const tabParam = searchParams.get('tab');
  const activeMainTab: BacktestPageTab =
    tabParam === 'results' ? 'results' : 'simulations';

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    urlPortfolioId || 'ALL'
  );
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setSelectedPortfolioId(urlPortfolioId || 'ALL');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [urlPortfolioId]);

  const [searchQuery, setSearchQuery] = useState('');

  const [strategies, setStrategies] = useState<StrategyRule[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoadingStrategies(true);
        return loadSavedStrategies(portfolios);
      })
      .then((loaded) => {
        if (!cancelled) {
          setStrategies(loaded);
          setLoadingStrategies(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingStrategies(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [portfolios]);

  const [historyEntries, setHistoryEntries] = useState<BacktestHistoryEntry[]>(() =>
    loadBacktestHistory()
  );

  const refreshHistory = useCallback(() => {
    setHistoryEntries(loadBacktestHistory());
  }, []);

  // Strategy simulation modal state
  const [activeRuleForBacktest, setActiveRuleForBacktest] =
    useState<StrategyRule | null>(null);
  const [activeBacktestPortfolioId, setActiveBacktestPortfolioId] = useState<
    string | null
  >(null);

  // Portfolio simulation modal state
  const [portfolioBacktestTarget, setPortfolioBacktestTarget] = useState<{
    portfolio: Portfolio;
    mode: 'SIP' | 'ONE_TIME';
  } | null>(null);

  const handleTabChange = (tab: BacktestPageTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const handleSelectPortfolio = (id: string) => {
    setSelectedPortfolioId(id);
  };

  const filteredPortfolios = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return portfolios.filter((p) => {
      const matchesScope =
        selectedPortfolioId === 'ALL' || p.id === selectedPortfolioId;
      if (!matchesScope) return false;
      if (!query) return true;
      return p.name.toLowerCase().includes(query);
    });
  }, [portfolios, selectedPortfolioId, searchQuery]);

  const handleOpenStrategyBacktest = (
    rule: StrategyRule,
    ownerPortfolioId: string | null
  ) => {
    const effectivePortfolioId =
      ownerPortfolioId ||
      (selectedPortfolioId !== 'ALL' ? selectedPortfolioId : null);
    setActiveBacktestPortfolioId(effectivePortfolioId);
    setActiveRuleForBacktest(rule);
  };

  const handleOpenPortfolioBacktest = (
    portfolio: Portfolio,
    mode: 'SIP' | 'ONE_TIME'
  ) => {
    setPortfolioBacktestTarget({ portfolio, mode });
  };

  const handleOpenHistoryEntry = (entry: BacktestHistoryEntry) => {
    activateBacktestHistorySession(entry);
    const resultsPath = entry.portfolioId
      ? `/portfolio/${entry.portfolioId}/backtest/results`
      : '/backtest/results';
    navigate(resultsPath, { state: entry.session });
  };

  const handleDeleteHistoryEntry = (id: string) => {
    setHistoryEntries(deleteBacktestHistoryEntry(id));
  };

  const handleClearHistory = () => {
    clearBacktestHistory();
    setHistoryEntries([]);
  };

  const manageStrategiesHref =
    selectedPortfolioId !== 'ALL'
      ? `/portfolio/${selectedPortfolioId}/strategy`
      : '/strategy';

  const modalStocks = useMemo(() => {
    if (!activeBacktestPortfolioId) return stocks;
    const scoped = stocks.filter(
      (s) => s.portfolio_id === activeBacktestPortfolioId
    );
    return scoped.length > 0 ? scoped : stocks;
  }, [activeBacktestPortfolioId, stocks]);

  const portfolioBacktestStocks = useMemo(() => {
    if (!portfolioBacktestTarget) return stocks;
    return stocks.filter(
      (s) => s.portfolio_id === portfolioBacktestTarget.portfolio.id
    );
  }, [portfolioBacktestTarget, stocks]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
            Backtest Studio
          </h1>
          <p className="text-xs sm:text-sm text-secondary mt-1">
            Run historical SIP, one-time allocation, and indicator strategy simulations, then inspect saved result reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {historyEntries.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenHistoryEntry(historyEntries[0])}
              className="px-3.5 py-2 rounded-xl border border-divider bg-surface hover:bg-surface-hover text-xs font-semibold text-primary transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-secondary" />
              <span>Latest Report</span>
            </button>
          )}
          <Link
            to={manageStrategiesHref}
            className="px-3.5 py-2 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold transition-opacity inline-flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Strategy Manager</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Navigation Tabs & Search/Filter Controls */}
      <div className="rounded-2xl border border-divider bg-surface p-3 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Segmented Page Tabs */}
          <div className="inline-flex items-center p-1 rounded-xl bg-background border border-divider self-start">
            <button
              type="button"
              onClick={() => handleTabChange('simulations')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeMainTab === 'simulations'
                  ? 'bg-primary text-background shadow-xs'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Run Simulations</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('results')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeMainTab === 'results'
                  ? 'bg-primary text-background shadow-xs'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Recent Results ({historyEntries.length})</span>
            </button>
          </div>

          {/* Search input */}
          <div className="relative w-full lg:w-80">
            <Search className="w-3.5 h-3.5 text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeMainTab === 'simulations'
                  ? 'Search portfolios, strategies, or symbols...'
                  : 'Search simulation history...'
              }
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-background border border-divider text-xs text-primary placeholder:text-secondary focus:outline-none focus:border-primary transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Portfolio Scope Pills */}
        {portfolios.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-divider">
            <span className="text-[11px] font-medium text-secondary mr-1">
              Scope:
            </span>
            <button
              type="button"
              onClick={() => handleSelectPortfolio('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedPortfolioId === 'ALL'
                  ? 'bg-primary text-background'
                  : 'bg-background border border-divider text-secondary hover:text-primary'
              }`}
            >
              All Portfolios
            </button>
            {portfolios.map((portfolio) => (
              <button
                key={portfolio.id}
                type="button"
                onClick={() => handleSelectPortfolio(portfolio.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedPortfolioId === portfolio.id
                    ? 'bg-primary text-background'
                    : 'bg-background border border-divider text-secondary hover:text-primary'
                }`}
              >
                {portfolio.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      {activeMainTab === 'simulations' ? (
        <div className="space-y-8">
          <BacktestPortfoliosTab
            portfolios={portfolios}
            filteredPortfolios={filteredPortfolios}
            onOpenCreatePortfolio={() => setIsCreateModalOpen(true)}
            onOpenPortfolioBacktest={handleOpenPortfolioBacktest}
          />

          <BacktestStrategyLauncher
            portfolios={portfolios}
            stocks={stocks}
            strategies={strategies}
            loadingStrategies={loadingStrategies}
            selectedPortfolioId={selectedPortfolioId}
            searchQuery={searchQuery}
            onRunStrategyBacktest={handleOpenStrategyBacktest}
          />
        </div>
      ) : (
        <BacktestHistoryTab
          entries={historyEntries}
          selectedPortfolioId={selectedPortfolioId}
          searchQuery={searchQuery}
          currencySymbol={currencySymbol}
          onOpenEntry={handleOpenHistoryEntry}
          onDeleteEntry={handleDeleteHistoryEntry}
          onClearHistory={handleClearHistory}
          onSwitchToSimulations={() => handleTabChange('simulations')}
        />
      )}

      {/* Strategy Backtest Modal */}
      {activeRuleForBacktest && (
        <BacktestModal
          isOpen={Boolean(activeRuleForBacktest)}
          onClose={() => {
            setActiveRuleForBacktest(null);
            setActiveBacktestPortfolioId(null);
          }}
          rule={activeRuleForBacktest}
          stocks={modalStocks}
          currencySymbol={currencySymbol}
          portfolioId={activeBacktestPortfolioId || undefined}
          onBacktestCompleted={refreshHistory}
        />
      )}

      {/* Portfolio Backtest Modal */}
      {portfolioBacktestTarget && (
        <PortfolioBacktestModal
          isOpen={Boolean(portfolioBacktestTarget)}
          onClose={() => setPortfolioBacktestTarget(null)}
          portfolio={portfolioBacktestTarget.portfolio}
          initialMode={portfolioBacktestTarget.mode}
          stocks={portfolioBacktestStocks}
          currencySymbol={currencySymbol}
          onBacktestCompleted={refreshHistory}
        />
      )}
    </div>
  );
}
