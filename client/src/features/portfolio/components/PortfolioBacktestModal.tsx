import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Play,
  Briefcase,
  Calendar,
  Clock,
  Coins,
  Repeat,
  ArrowRight,
  Loader2,
  AlertCircle,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { runPortfolioBacktest } from '../services/backtestService';
import type { StrategyRule } from './StrategyBuilderModal';

interface PortfolioBacktestModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolio: {
    id: string;
    name: string;
  };
  initialMode?: 'SIP' | 'ONE_TIME';
  stocks: Array<{ id: string; portfolio_id: string; symbol: string; quantity: number; entry_price: number }>;
  currencySymbol?: string;
  onBacktestCompleted?: () => void;
}

const EXECUTION_TIMES = [
  { value: '09:15', label: '09:15 AM (Market Open)' },
  { value: '10:15', label: '10:15 AM' },
  { value: '11:15', label: '11:15 AM' },
  { value: '12:15', label: '12:15 PM' },
  { value: '13:15', label: '01:15 PM' },
  { value: '14:15', label: '02:15 PM' },
  { value: '15:15', label: '03:15 PM' },
];

export function PortfolioBacktestModal({
  isOpen,
  onClose,
  portfolio,
  initialMode = 'SIP',
  stocks = [],
  currencySymbol = '₹',
  onBacktestCompleted,
}: PortfolioBacktestModalProps) {
  const navigate = useNavigate();

  const [mode, setMode] = useState<'SIP' | 'ONE_TIME'>(initialMode);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default dates (2 years back to today)
  const defaultDates = useMemo(() => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(today.getFullYear() - 2);
    const startStr = twoYearsAgo.toISOString().split('T')[0];
    return { startStr, endStr };
  }, []);

  // One-time investment inputs
  const [oneTimeCapital, setOneTimeCapital] = useState<number>(100000);
  const [oneTimeStartDate, setOneTimeStartDate] = useState<string>(defaultDates.startStr);
  const [oneTimeEndDate, setOneTimeEndDate] = useState<string>(defaultDates.endStr);

  // SIP inputs
  const [sipAmount, setSipAmount] = useState<number>(10000);
  const [sipDay, setSipDay] = useState<number>(5);
  const [sipTime, setSipTime] = useState<string>('09:15');
  const [sipStartDate, setSipStartDate] = useState<string>(defaultDates.startStr);
  const [sipEndDate, setSipEndDate] = useState<string>(defaultDates.endStr);

  // Constituent stocks in this portfolio
  const portfolioStocks = useMemo(() => {
    return stocks.filter((s) => s.portfolio_id === portfolio.id);
  }, [stocks, portfolio.id]);

  // Compute allocation weights of constituent stocks
  const stockAllocations = useMemo(() => {
    if (portfolioStocks.length === 0) return [];
    let totalBase = 0;
    portfolioStocks.forEach((s) => {
      const q = Number(s.quantity) || 0;
      const p = Number(s.entry_price) || 0;
      if (q > 0 && p > 0) totalBase += q * p;
    });

    return portfolioStocks.map((s) => {
      const q = Number(s.quantity) || 0;
      const p = Number(s.entry_price) || 0;
      const weight = totalBase > 0 && q > 0 && p > 0 ? (q * p) / totalBase : 1 / portfolioStocks.length;
      return {
        symbol: s.symbol,
        weight,
        weightPercent: (weight * 100).toFixed(1),
      };
    });
  }, [portfolioStocks]);

  if (!isOpen) return null;

  const handleRunBacktest = async () => {
    if (portfolioStocks.length === 0) {
      setError('This portfolio does not have any stocks configured. Please add stocks to this portfolio first.');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const res = await runPortfolioBacktest({
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        mode,
        startDate: mode === 'SIP' ? sipStartDate : oneTimeStartDate,
        endDate: mode === 'SIP' ? sipEndDate : oneTimeEndDate,
        timeframe: 'hour',
        initialCapital: oneTimeCapital,
        sipAmount,
        frequency: 'monthly',
        sipDay,
        sipTime,
        stocks: portfolioStocks,
      });

      // Virtual rule representing this portfolio backtest for the results page
      const virtualRule: StrategyRule = {
        id: `portfolio-${portfolio.id}-${mode}`,
        name: `${portfolio.name} (${mode === 'SIP' ? 'SIP' : 'One-Time'})`,
        scope: 'global',
        targetSymbol: portfolio.name,
        action: 'BUY',
        sizingType: 'VALUE',
        sizingValue: mode === 'SIP' ? sipAmount : oneTimeCapital,
        enabled: true,
        frequency: 'daily',
        createdAt: new Date().toISOString(),
        conditions: [],
        portfolioId: portfolio.id,
      };

      const backtestSession = {
        result: res,
        rule: virtualRule,
        portfolioId: portfolio.id,
        mode,
        portfolioConfig: {
          mode,
          initialCapital: oneTimeCapital,
          sipAmount,
          sipDay,
          sipTime,
          startDate: mode === 'SIP' ? sipStartDate : oneTimeStartDate,
          endDate: mode === 'SIP' ? sipEndDate : oneTimeEndDate,
        },
        timestamp: Date.now(),
      };

      localStorage.setItem('latest_backtest_session', JSON.stringify(backtestSession));

      if (onBacktestCompleted) {
        onBacktestCompleted();
      }

      onClose();
      navigate(`/portfolio/${portfolio.id}/backtest/results`, { state: backtestSession });
    } catch (err: any) {
      console.error('[Portfolio Backtest Error]:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to execute portfolio backtest.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-surface border border-divider rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-divider flex items-center justify-between gap-3 shrink-0">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-surface-hover border border-divider text-primary shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-primary truncate">
                Backtest: {portfolio.name}
              </h2>
            </div>
            <p className="text-xs text-secondary truncate">
              Simulate entire portfolio performance across all constituent assets
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs">
          {/* Options Switcher: SIP vs One-Time */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider">
              Investment Mode
            </label>
            <div className="grid grid-cols-2 p-1 bg-background border border-divider rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setMode('SIP')}
                className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'SIP'
                    ? 'bg-primary text-background shadow-xs'
                    : 'text-secondary hover:text-primary hover:bg-surface-hover'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>SIP (Recurring)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('ONE_TIME')}
                className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'ONE_TIME'
                    ? 'bg-primary text-background shadow-xs'
                    : 'text-secondary hover:text-primary hover:bg-surface-hover'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>One-Time Investment</span>
              </button>
            </div>
          </div>

          {/* Constituent Assets Preview */}
          <div className="p-3 rounded-xl bg-background border border-divider space-y-2">
            <div className="flex items-center justify-between text-secondary">
              <span className="font-semibold text-[11px] flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-primary" />
                <span>Portfolio Constituents ({portfolioStocks.length})</span>
              </span>
              <span className="text-[10px] font-mono">Weighted Allocation</span>
            </div>

            {stockAllocations.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {stockAllocations.map((item) => (
                  <span
                    key={item.symbol}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface border border-divider text-primary"
                  >
                    <span>{item.symbol}</span>
                    <span className="text-secondary opacity-80">({item.weightPercent}%)</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-danger italic">
                No stocks added to this portfolio yet. Please add stocks before backtesting.
              </p>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SIP CONFIGURATION OPTIONS                                                 */}
          {/* ========================================================================= */}
          {mode === 'SIP' && (
            <div className="space-y-4">
              {/* SIP Installment Amount */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-secondary flex items-center justify-between">
                  <span>SIP Amount per Installment</span>
                  <span className="font-mono text-primary font-bold">
                    {currencySymbol}
                    {sipAmount.toLocaleString()}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary font-mono font-bold">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={sipAmount}
                    onChange={(e) => setSipAmount(Math.max(100, Number(e.target.value)))}
                    className="w-full pl-8 pr-3 py-2 bg-background border border-divider rounded-xl font-mono text-sm text-primary focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                {/* Quick amount chips */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[5000, 10000, 25000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSipAmount(amt)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                        sipAmount === amt
                          ? 'bg-primary/10 text-primary border-primary'
                          : 'bg-background border-divider text-secondary hover:text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {currencySymbol}
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Execution Day and Time Inputs */}
              <div className="grid grid-cols-2 gap-3">
                {/* Date / Day of Month */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-secondary flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-primary" />
                    <span>Monthly SIP Date</span>
                  </label>
                  <select
                    value={sipDay}
                    onChange={(e) => setSipDay(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-background border border-divider rounded-xl text-xs font-mono text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                        {d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of month
                      </option>
                    ))}
                  </select>
                </div>

                {/* Execution Time */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-secondary flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-primary" />
                    <span>Execution Time</span>
                  </label>
                  <select
                    value={sipTime}
                    onChange={(e) => setSipTime(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-divider rounded-xl text-xs font-mono text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    {EXECUTION_TIMES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start Date and End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-secondary">Start Date</label>
                  <input
                    type="date"
                    value={sipStartDate}
                    onChange={(e) => setSipStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-divider rounded-xl text-xs font-mono text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-secondary">End Date</label>
                  <input
                    type="date"
                    value={sipEndDate}
                    onChange={(e) => setSipEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-divider rounded-xl text-xs font-mono text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  />
                </div>
              </div>

              {/* Information Hint */}
              <div className="p-3 rounded-xl bg-surface-hover/70 border border-divider text-[11px] text-secondary leading-relaxed">
                💡 <strong className="text-primary">Keep Buying Strategy:</strong> The system will execute recurring purchases of all portfolio assets on the <strong className="text-primary font-mono">{sipDay}th</strong> of every month at <strong className="text-primary font-mono">{sipTime}</strong> throughout the timeline.
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ONE-TIME INVESTMENT CONFIGURATION OPTIONS                                 */}
          {/* ========================================================================= */}
          {mode === 'ONE_TIME' && (
            <div className="space-y-4">
              {/* Lump Sum Investment Capital */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-secondary flex items-center justify-between">
                  <span>Initial Investment Capital</span>
                  <span className="font-mono text-primary font-bold">
                    {currencySymbol}
                    {oneTimeCapital.toLocaleString()}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary font-mono font-bold">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="1000"
                    step="5000"
                    value={oneTimeCapital}
                    onChange={(e) => setOneTimeCapital(Math.max(1000, Number(e.target.value)))}
                    className="w-full pl-8 pr-3 py-2 bg-background border border-divider rounded-xl font-mono text-sm text-primary focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                {/* Quick amount chips */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[50000, 100000, 250000, 500000, 1000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setOneTimeCapital(amt)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                        oneTimeCapital === amt
                          ? 'bg-primary/10 text-primary border-primary'
                          : 'bg-background border-divider text-secondary hover:text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {currencySymbol}
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-secondary flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-primary" />
                    <span>Start Date (Lump Sum Entry)</span>
                  </label>
                  <input
                    type="date"
                    value={oneTimeStartDate}
                    onChange={(e) => setOneTimeStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-divider rounded-xl text-xs font-mono text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-secondary flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-primary" />
                    <span>End Date</span>
                  </label>
                  <input
                    type="date"
                    value={oneTimeEndDate}
                    onChange={(e) => setOneTimeEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-divider rounded-xl text-xs font-mono text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  />
                </div>
              </div>

              {/* Information Hint */}
              <div className="p-3 rounded-xl bg-surface-hover/70 border border-divider text-[11px] text-secondary leading-relaxed">
                💡 <strong className="text-primary">One-Time Allocation:</strong> Allocates full capital across all constituent assets at the start date opening price and tracks mark-to-market performance until the end date.
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-[11px]">{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-divider flex items-center justify-between gap-3 shrink-0 bg-surface">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="px-4 py-2 rounded-xl border border-divider hover:bg-surface-hover text-secondary hover:text-primary transition-colors text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleRunBacktest}
            disabled={isRunning || portfolioStocks.length === 0}
            className="px-5 py-2 rounded-xl bg-primary text-background hover:opacity-90 transition-opacity text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating Portfolio...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  Run {mode === 'SIP' ? 'SIP' : 'One-Time'} Backtest
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

