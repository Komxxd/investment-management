import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  Check,
  Search,
} from 'lucide-react';
import { runPortfolioBacktest } from '../services/backtestService';
import type { StrategyRule } from './StrategyBuilderModal';
import { BacktestDateRangePicker } from './BacktestDateRangePicker';
import { saveBacktestSession } from './backtest/backtestSessionStorage';

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
  { value: '09:15', label: '09:15 AM' },
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
  const [oneTimeStartDate, setOneTimeStartDate] = useState<string>('');
  const [oneTimeEndDate, setOneTimeEndDate] = useState<string>('');

  // SIP inputs
  const [sipAmount, setSipAmount] = useState<number>(10000);
  const [sipDay, setSipDay] = useState<number>(5);
  const [sipTime, setSipTime] = useState<string>('09:15');
  const [sipStartDate, setSipStartDate] = useState<string>('');
  const [sipEndDate, setSipEndDate] = useState<string>('');

  // Constituent stocks in this portfolio
  const portfolioStocks = useMemo(() => {
    return stocks.filter((s) => s.portfolio_id === portfolio.id);
  }, [stocks, portfolio.id]);

  // Unique constituent stock symbols in this portfolio
  const constituentSymbols = useMemo(() => {
    return Array.from(new Set(portfolioStocks.map((s) => s.symbol.trim().toUpperCase())));
  }, [portfolioStocks]);

  // Selected constituent stocks for backtesting (defaults to all)
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(() => new Set());
  const [stockSearchQuery, setStockSearchQuery] = useState<string>('');

  // Initialize all constituent stocks as selected when constituentSymbols change or modal opens
  useEffect(() => {
    if (constituentSymbols.length > 0) {
      setSelectedSymbols(new Set(constituentSymbols));
    }
  }, [constituentSymbols, isOpen]);

  // Toggle selection of a stock symbol
  const toggleStock = (symbol: string) => {
    setSelectedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const selectAllStocks = () => {
    setSelectedSymbols(new Set(constituentSymbols));
  };

  const deselectAllStocks = () => {
    setSelectedSymbols(new Set());
  };

  // Filtered symbols by search query
  const filteredDisplaySymbols = useMemo(() => {
    if (!stockSearchQuery.trim()) return constituentSymbols;
    const q = stockSearchQuery.toLowerCase().trim();
    return constituentSymbols.filter((s) => s.toLowerCase().includes(q));
  }, [constituentSymbols, stockSearchQuery]);

  // Subset of portfolioStocks matching the selected symbols
  const targetStocksToBacktest = useMemo(() => {
    return portfolioStocks.filter((s) => selectedSymbols.has(s.symbol.trim().toUpperCase()));
  }, [portfolioStocks, selectedSymbols]);

  const representativeSymbol = useMemo(() => {
    return targetStocksToBacktest[0]?.symbol || constituentSymbols[0] || 'RELIANCE.NS';
  }, [targetStocksToBacktest, constituentSymbols]);

  const handleStartDateChange = (val: string) => {
    if (mode === 'SIP') {
      setSipStartDate(val);
    } else {
      setOneTimeStartDate(val);
    }
  };

  const handleEndDateChange = (val: string) => {
    if (mode === 'SIP') {
      setSipEndDate(val);
    } else {
      setOneTimeEndDate(val);
    }
  };

  if (!isOpen) return null;

  const handleRunBacktest = async () => {
    if (portfolioStocks.length === 0) {
      setError('This portfolio does not have any stocks configured. Please add stocks to this portfolio first.');
      return;
    }

    if (targetStocksToBacktest.length === 0) {
      setError('Please select at least one stock to backtest.');
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
        timeframe: mode === 'ONE_TIME' ? 'day' : 'hour',
        initialCapital: oneTimeCapital,
        sipAmount,
        frequency: 'monthly',
        sipDay,
        sipTime,
        stocks: targetStocksToBacktest,
      });

      // Virtual rule representing this portfolio backtest for the results page
      const isPartialSelection = selectedSymbols.size < constituentSymbols.length;
      const virtualRuleName = isPartialSelection
        ? `${portfolio.name} (${mode === 'SIP' ? 'SIP' : 'One-Time'} · ${selectedSymbols.size} Stocks)`
        : `${portfolio.name} (${mode === 'SIP' ? 'SIP' : 'One-Time'})`;

      const virtualRule: StrategyRule = {
        id: `portfolio-${portfolio.id}-${mode}`,
        name: virtualRuleName,
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
          timeframe: mode === 'ONE_TIME' ? 'day' : 'hour',
          startDate: mode === 'SIP' ? sipStartDate : oneTimeStartDate,
          endDate: mode === 'SIP' ? sipEndDate : oneTimeEndDate,
          portfolioName: portfolio.name,
          constituents: Array.from(selectedSymbols),
        },
        timestamp: Date.now(),
      };

      saveBacktestSession(backtestSession);

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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl lg:max-w-3xl bg-surface border border-divider rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-primary">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-divider flex items-center justify-between gap-3 shrink-0 bg-surface">
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

        {/* Modal Body: 2-Column Responsive Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto min-h-0 flex-1 text-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Left Column: Investment Parameters & Constituent Stocks */}
            <div className="space-y-4">
              {/* Options Switcher: SIP vs One-Time */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                  Investment Mode
                </label>
                <div className="grid grid-cols-2 p-1 bg-background border border-divider rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setMode('SIP')}
                    className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      mode === 'SIP'
                        ? 'bg-primary text-background shadow-xs font-bold'
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
                        ? 'bg-primary text-background shadow-xs font-bold'
                        : 'text-secondary hover:text-primary hover:bg-surface-hover'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>One-Time Investment</span>
                  </button>
                </div>
              </div>

              {/* Mode-Specific Parameters */}
              {mode === 'SIP' ? (
                <div className="space-y-3.5">
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
                        className="w-full pl-8 pr-3 py-1.5 bg-background border border-divider rounded-xl font-mono text-xs text-primary focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    {/* Quick amount chips */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {[5000, 10000, 25000, 50000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setSipAmount(amt)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
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
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-secondary flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-primary" />
                        <span>Monthly Date</span>
                      </label>
                      <select
                        value={sipDay}
                        onChange={(e) => setSipDay(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-background border border-divider rounded-xl text-xs font-mono text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}
                            {d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of month
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-secondary flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" />
                        <span>Execution Time</span>
                      </label>
                      <select
                        value={sipTime}
                        onChange={(e) => setSipTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-background border border-divider rounded-xl text-xs font-mono text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                      >
                        {EXECUTION_TIMES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
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
                        className="w-full pl-8 pr-3 py-1.5 bg-background border border-divider rounded-xl font-mono text-xs text-primary focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    {/* Quick amount chips */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {[50000, 100000, 250000, 500000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setOneTimeCapital(amt)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
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
                </div>
              )}

              {/* Constituent Assets Selection & Filter */}
              <div className="p-3 rounded-xl bg-background border border-divider space-y-2">
                <div className="flex items-center justify-between gap-2 text-secondary">
                  <span className="font-semibold text-[11px] flex items-center gap-1.5 text-primary">
                    <Tag className="w-3 h-3 text-primary" />
                    <span>
                      Constituent Stocks ({selectedSymbols.size}/{constituentSymbols.length} Selected)
                    </span>
                  </span>

                  {constituentSymbols.length > 0 && (
                    <div className="flex items-center gap-2 text-[10px]">
                      {selectedSymbols.size === constituentSymbols.length ? (
                        <button
                          type="button"
                          onClick={deselectAllStocks}
                          className="text-secondary hover:text-primary transition-colors cursor-pointer underline underline-offset-2"
                        >
                          Deselect All
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={selectAllStocks}
                          className="text-primary hover:opacity-80 transition-opacity font-semibold cursor-pointer underline underline-offset-2"
                        >
                          Select All
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Filter Search Input (visible if portfolio has more than 3 stocks) */}
                {constituentSymbols.length > 3 && (
                  <div className="relative">
                    <Search className="w-3 h-3 text-secondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={stockSearchQuery}
                      onChange={(e) => setStockSearchQuery(e.target.value)}
                      placeholder="Filter stocks..."
                      className="w-full pl-7 pr-6 py-1 text-xs bg-surface border border-divider rounded-lg text-primary placeholder:text-secondary/50 focus:outline-none focus:border-primary transition-colors font-mono"
                    />
                    {stockSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setStockSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-primary p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {constituentSymbols.length > 0 ? (
                  filteredDisplaySymbols.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pt-0.5">
                      {filteredDisplaySymbols.map((symbol) => {
                        const isSelected = selectedSymbols.has(symbol);
                        return (
                          <button
                            key={symbol}
                            type="button"
                            onClick={() => toggleStock(symbol)}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono font-semibold border transition-all cursor-pointer shadow-2xs select-none ${
                              isSelected
                                ? 'bg-primary text-background border-primary shadow-xs'
                                : 'bg-surface/50 border-divider text-secondary opacity-60 hover:opacity-100 hover:border-divider-hover'
                            }`}
                            title={isSelected ? `Click to exclude ${symbol}` : `Click to include ${symbol}`}
                          >
                            <span
                              className={`w-3 h-3 rounded flex items-center justify-center shrink-0 text-[9px] ${
                                isSelected
                                  ? 'bg-background text-primary'
                                  : 'border border-divider bg-background/50'
                              }`}
                            >
                              {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
                            </span>
                            <span>{symbol}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-secondary italic py-1">
                      No stocks match &quot;{stockSearchQuery}&quot;
                    </p>
                  )
                ) : (
                  <p className="text-[11px] text-danger italic">
                    No stocks added to this portfolio yet.
                  </p>
                )}

                {constituentSymbols.length > 0 && selectedSymbols.size === 0 && (
                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>Select at least 1 stock to run this backtest.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Date Range Picker with embedded Month Calendar */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-secondary">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Simulation Date Range
                </span>
              </div>
              <BacktestDateRangePicker
                fromDate={mode === 'SIP' ? sipStartDate : oneTimeStartDate}
                toDate={mode === 'SIP' ? sipEndDate : oneTimeEndDate}
                onChangeFromDate={handleStartDateChange}
                onChangeToDate={handleEndDateChange}
                targetSymbol={representativeSymbol}
                timeframe={mode === 'ONE_TIME' ? 'day' : 'hour'}
                skipWarmup={mode === 'ONE_TIME'}
                fromLabel="From Date"
                toLabel="To Date"
              />
            </div>
          </div>

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
            disabled={isRunning || portfolioStocks.length === 0 || selectedSymbols.size === 0}
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
                  {selectedSymbols.size > 0 && selectedSymbols.size < constituentSymbols.length
                    ? ` (${selectedSymbols.size} Selected)`
                    : ''}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

