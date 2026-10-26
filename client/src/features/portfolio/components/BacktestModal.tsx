import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Play,
  Loader2,
  AlertCircle,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { StrategyRule } from './StrategyBuilderModal';
import { runBacktest, type BacktestResponse } from '../services/backtestService';

interface BacktestModalProps {
  isOpen: boolean;
  onClose: () => void;
  rule: StrategyRule;
  stocks: Array<{ id: string; symbol: string; quantity: number; entry_price: number }>;
  currencySymbol?: string;
  portfolioId?: string;
  onBacktestCompleted?: (result: BacktestResponse) => void;
}

function formatDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function BacktestModal({
  isOpen,
  onClose,
  rule,
  stocks,
  currencySymbol = '₹',
  portfolioId,
  onBacktestCompleted,
}: BacktestModalProps) {
  const navigate = useNavigate();

  // Target stock resolved strictly from the strategy
  const targetStock = useMemo(() => {
    if (rule.targetSymbol && rule.targetSymbol !== 'ALL') {
      return rule.targetSymbol;
    }
    return stocks[0]?.symbol || 'RELIANCE.NS';
  }, [rule.targetSymbol, stocks]);

  // Default dates: From 1st of current month to today (matches Screenshot 2: 2026-10-01 to 2026-10-26)
  const defaultDates = useMemo(() => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: formatDateString(firstOfMonth),
      to: formatDateString(today),
    };
  }, []);

  const [fromDate, setFromDate] = useState<string>(defaultDates.from);
  const [toDate, setToDate] = useState<string>(defaultDates.to);
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [selectingField, setSelectingField] = useState<'from' | 'to'>('from');

  // Month displayed in the visual calendar
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [rule]);

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() - 1);
      return next;
    });
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + 1);
      return next;
    });
  };

  const handleDayClick = (dateStr: string) => {
    if (selectingField === 'from') {
      setFromDate(dateStr);
      if (dateStr > toDate) {
        setToDate(dateStr);
      }
      setSelectingField('to');
    } else {
      if (dateStr < fromDate) {
        setFromDate(dateStr);
      } else {
        setToDate(dateStr);
      }
      setSelectingField('from');
    }
  };

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      days.push({
        day: dayNum,
        dateStr: formatDateString(prevDate),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      days.push({
        day: d,
        dateStr: formatDateString(curDate),
        isCurrentMonth: true,
      });
    }

    // Next month filler days to complete the week
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      days.push({
        day: d,
        dateStr: formatDateString(nextDate),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [calendarMonth]);

  if (!isOpen) return null;

  const handleExecuteBacktest = async () => {
    if (!targetStock) {
      setError('Please select or specify a valid stock in the strategy.');
      return;
    }

    if (!rule.conditions || rule.conditions.length === 0) {
      setError('Strategy must have at least one condition to backtest.');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const res = await runBacktest({
        symbol: targetStock,
        rules: [rule],
        startDate: fromDate,
        endDate: toDate,
        initialCapital: Number(initialCapital) || 100000,
        slippagePct: 0.0005,
        feePct: 0.001,
      });

      // Save latest session so the Backtest Results page can load smoothly on refresh
      const backtestSession = {
        result: res,
        rule,
        portfolioId: portfolioId || null,
        timestamp: Date.now(),
      };
      localStorage.setItem('latest_backtest_session', JSON.stringify(backtestSession));

      if (onBacktestCompleted) {
        onBacktestCompleted(res);
      }

      onClose();

      // Navigate to dedicated Backtest Results page
      navigate('/backtest/results', { state: backtestSession });
    } catch (err: any) {
      setError(err.message || 'Failed to complete backtest. Verify stock symbol and historical data.');
    } finally {
      setIsRunning(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Compact Dialog matching Screenshot 2 */}
      <div className="bg-surface border border-divider rounded-2xl w-full max-w-[410px] overflow-hidden shadow-2xl flex flex-col text-primary">
        {/* Header (Screenshot 2 Match) */}
        <div className="px-5 py-3.5 border-b border-divider flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold tracking-wider uppercase text-primary">
              Run Backtest
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-secondary hover:text-primary rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3.5">
          {/* STRATEGY Section */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
              Strategy
            </label>
            <div className="p-2.5 rounded-xl bg-surface-hover/70 border border-divider flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-xs font-semibold text-primary truncate">
                  {rule.name || 'Untitled Strategy'}
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-surface border border-divider text-secondary shrink-0">
                {targetStock}
              </span>
            </div>
          </div>

          {/* INITIAL CAPITAL */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
              Initial Capital
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-secondary">
                {currencySymbol}
              </span>
              <input
                type="number"
                min="1000"
                step="10000"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Math.max(1000, Number(e.target.value)))}
                className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-divider bg-background text-primary font-mono text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="100000"
              />
            </div>
          </div>

          {/* FROM DATE / TO DATE Inputs (Screenshot 2 Match) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                From Date
              </label>
              <div
                onClick={() => setSelectingField('from')}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-mono cursor-pointer transition-all ${
                  selectingField === 'from'
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/5 text-primary font-bold'
                    : 'border-divider bg-background text-primary hover:border-divider/80'
                }`}
              >
                <input
                  type="text"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent border-none outline-none font-mono text-xs w-full cursor-pointer"
                  placeholder="YYYY-MM-DD"
                />
                <Calendar className="w-3.5 h-3.5 text-secondary shrink-0" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                To Date
              </label>
              <div
                onClick={() => setSelectingField('to')}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-mono cursor-pointer transition-all ${
                  selectingField === 'to'
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/5 text-primary font-bold'
                    : 'border-divider bg-background text-primary hover:border-divider/80'
                }`}
              >
                <input
                  type="text"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent border-none outline-none font-mono text-xs w-full cursor-pointer"
                  placeholder="YYYY-MM-DD"
                />
                <Calendar className="w-3.5 h-3.5 text-secondary shrink-0" />
              </div>
            </div>
          </div>

          {/* Visual Month Calendar (Directly Embedded - No Hide Calendar) */}
          <div className="p-3 bg-background border border-divider rounded-xl space-y-2.5 shadow-inner">
            {/* Calendar Navigation Header */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-md text-secondary hover:text-primary hover:bg-surface transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                {calendarMonth.toLocaleString('en-US', { month: 'long' })} {calendarMonth.getFullYear()}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-md text-secondary hover:text-primary hover:bg-surface transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday Names Header (SU MO TU WE TH FR SA) */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-secondary">
              <span>SU</span>
              <span>MO</span>
              <span>TU</span>
              <span>WE</span>
              <span>TH</span>
              <span>FR</span>
              <span>SA</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((item, idx) => {
                const { day, dateStr, isCurrentMonth } = item;
                const isFrom = dateStr === fromDate;
                const isTo = dateStr === toDate;
                const isInRange = dateStr > fromDate && dateStr < toDate;

                let dayClasses = 'h-7 text-xs flex items-center justify-center transition-all cursor-pointer select-none ';

                if (isFrom || isTo) {
                  dayClasses += 'bg-slate-900 text-white dark:bg-white dark:text-black font-bold rounded-lg shadow-sm scale-105 z-10';
                } else if (isInRange) {
                  dayClasses += 'bg-indigo-500/20 text-indigo-400 dark:bg-indigo-500/30 dark:text-indigo-200 font-medium rounded-md';
                } else if (!isCurrentMonth) {
                  dayClasses += 'text-secondary/20 pointer-events-none';
                } else {
                  dayClasses += 'text-primary hover:bg-surface rounded-lg';
                }

                return (
                  <button
                    key={dateStr || idx}
                    type="button"
                    disabled={!isCurrentMonth}
                    onClick={() => isCurrentMonth && handleDayClick(dateStr)}
                    className={dayClasses}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-500 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Backtest Failed</div>
                <div className="text-[11px] opacity-90">{error}</div>
              </div>
            </div>
          )}

          {/* Full-width Start Backtest Button matching Screenshot 2 */}
          <button
            type="button"
            onClick={handleExecuteBacktest}
            disabled={isRunning}
            className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-zinc-100 font-bold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Simulation...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Backtest</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
