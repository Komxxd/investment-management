import { Briefcase, Plus, AlertCircle, Repeat, Coins } from 'lucide-react';
import type { Portfolio } from '../../hooks/usePortfolioData';

interface BacktestPortfoliosTabProps {
  portfolios: Portfolio[];
  filteredPortfolios: Portfolio[];
  onOpenCreatePortfolio: () => void;
  onOpenPortfolioBacktest: (portfolio: Portfolio, mode: 'SIP' | 'ONE_TIME') => void;
}

/**
 * Renders the portfolio selection grid for launching SIP or one-time portfolio backtests.
 */
export function BacktestPortfoliosTab({
  portfolios,
  filteredPortfolios,
  onOpenCreatePortfolio,
  onOpenPortfolioBacktest,
}: BacktestPortfoliosTabProps) {
  return (
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
            onClick={onOpenCreatePortfolio}
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
          {filteredPortfolios.map(portfolio => (
            <div
              key={portfolio.id}
              className="p-4 sm:p-5 rounded-2xl border border-divider bg-surface hover:border-divider-hover hover:shadow-md transition-all flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-surface-hover border border-divider text-primary shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-primary truncate" title={portfolio.name}>
                  {portfolio.name}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onOpenPortfolioBacktest(portfolio, 'SIP')}
                  className="px-3 py-1.5 rounded-xl bg-primary text-background hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity flex items-center gap-1.5 cursor-pointer"
                  title="Backtest monthly SIP"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>SIP</span>
                </button>
                <button
                  onClick={() => onOpenPortfolioBacktest(portfolio, 'ONE_TIME')}
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
  );
}

