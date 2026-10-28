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
  ChevronDown,
} from 'lucide-react';
import type { StrategyRule } from './StrategyBuilderModal';
import {
  runBacktest,
  getBacktestDataRange,
  type BacktestResponse,
  type BacktestDataRange,
} from '../services/backtestService';

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

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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
  const [pickerView, setPickerView] = useState<'days' | 'month-year'>('days');

  // Month displayed in the visual calendar
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  const [dataRange, setDataRange] = useState<BacktestDataRange | null>(null);
  const [isLoadingRange, setIsLoadingRange] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch exact backtestable data range excluding warmup buffer
  useEffect(() => {
    if (!targetStock || !isOpen) return;
    let isMounted = true;
    setIsLoadingRange(true);

    getBacktestDataRange(targetStock)
      .then((range) => {
        if (!isMounted) return;
        setDataRange(range);
        if (range.backtestableStartDate && range.backtestableEndDate) {
          // Set toDate to latest available backtestable candle
          setToDate(range.backtestableEndDate);

          // Default start date to 1 year back or start of backtestable data
          const endD = new Date(range.backtestableEndDate);
          const defStart = new Date(endD);
          defStart.setFullYear(defStart.getFullYear() - 1);
          const defStartStr = formatDateString(defStart);
          const initialFrom = defStartStr >= range.backtestableStartDate ? defStartStr : range.backtestableStartDate;

          setFromDate(initialFrom);
          setCalendarMonth(new Date(range.backtestableEndDate));
        }
      })
      .catch((err) => {
        console.warn('[BacktestModal] Failed to get data range for', targetStock, err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingRange(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetStock, isOpen]);

  useEffect(() => {
    setError(null);
  }, [rule]);

  // Set of dates where candle data actually exists and buffer is excluded
  const availableDatesSet = useMemo(() => {
    if (!dataRange?.availableDates) return null;
    return new Set(dataRange.availableDates);
  }, [dataRange]);

  const { minDateStr, maxDateStr, minYear, maxYear } = useMemo(() => {
    if (!dataRange?.backtestableStartDate || !dataRange?.backtestableEndDate) {
      const today = new Date();
      return {
        minDateStr: '2020-01-01',
        maxDateStr: formatDateString(today),
        minYear: 2020,
        maxYear: today.getFullYear(),
      };
    }
    return {
      minDateStr: dataRange.backtestableStartDate,
      maxDateStr: dataRange.backtestableEndDate,
      minYear: new Date(dataRange.backtestableStartDate).getFullYear(),
      maxYear: new Date(dataRange.backtestableEndDate).getFullYear(),
    };
  }, [dataRange]);

  // Only years that actually have backtestable data (buffer excluded)
  const backtestableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      years.push(y);
    }
    return years;
  }, [minYear, maxYear]);

  // Quick year chips (bounded by minYear and maxYear)
  const quickYears = useMemo(() => {
    if (backtestableYears.length <= 6) return backtestableYears;
    const current = calendarMonth.getFullYear();
    let start = Math.max(minYear, current - 3);
    if (start + 5 > maxYear) {
      start = Math.max(minYear, maxYear - 5);
    }
    return Array.from({ length: Math.min(6, maxYear - start + 1) }, (_, i) => start + i);
  }, [backtestableYears, calendarMonth, minYear, maxYear]);

  // Month selectable check for the currently selected year
  const isMonthSelectable = (monthIdx: number) => {
    const curYear = calendarMonth.getFullYear();
    const startMonth = new Date(minDateStr).getMonth();
    const endMonth = new Date(maxDateStr).getMonth();

    if (curYear === minYear && monthIdx < startMonth) return false;
    if (curYear === maxYear && monthIdx > endMonth) return false;
    if (curYear < minYear || curYear > maxYear) return false;
    return true;
  };

  // Day selectable check (buffer excluded, non-trading days/weekends excluded)
  const isDaySelectable = (dateStr: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return false;
    if (dateStr < minDateStr || dateStr > maxDateStr) return false;
    if (availableDatesSet && !availableDatesSet.has(dateStr)) return false;
    return true;
  };

  const canPrevMonth = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const startMonth = new Date(minDateStr).getMonth();
    return !(y <= minYear && m <= startMonth);
  }, [calendarMonth, minYear, minDateStr]);

  const canNextMonth = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const endMonth = new Date(maxDateStr).getMonth();
    return !(y >= maxYear && m >= endMonth);
  }, [calendarMonth, maxYear, maxDateStr]);

  const canPrevYear = calendarMonth.getFullYear() > minYear;
  const canNextYear = calendarMonth.getFullYear() < maxYear;

  const handlePrevMonth = () => {
    if (!canPrevMonth) return;
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() - 1);
      return next;
    });
  };

  const handleNextMonth = () => {
    if (!canNextMonth) return;
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + 1);
      return next;
    });
  };

  const handleSelectYear = (yr: number) => {
    const clamped = Math.max(minYear, Math.min(maxYear, yr));
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setFullYear(clamped);
      return next;
    });
  };

  const handleStepYear = (delta: number) => {
    const nextY = calendarMonth.getFullYear() + delta;
    if (nextY < minYear || nextY > maxYear) return;
    handleSelectYear(nextY);
  };

  const handleSelectMonth = (monthIdx: number) => {
    if (!isMonthSelectable(monthIdx)) return;
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(monthIdx);
      return next;
    });
    setPickerView('days');
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
      const targetUrl = portfolioId ? `/portfolio/${portfolioId}/backtest/results` : '/backtest/results';
      navigate(targetUrl, { state: backtestSession });
    } catch (err: any) {
      setError(err.message || 'Failed to complete backtest. Verify stock symbol and historical data.');
    } finally {
      setIsRunning(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
      {/* Compact Dialog matching Screenshot 2 */}
      <div className="bg-surface border border-divider rounded-2xl w-full max-w-[410px] overflow-hidden shadow-2xl flex flex-col text-primary">
        {/* Header (Screenshot 2 Match) */}
        <div className="px-5 py-3.5 border-b border-divider flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
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
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
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
                className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-divider bg-background text-primary font-mono text-xs font-semibold focus:outline-none focus:border-primary transition-colors"
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
                    ? 'border-primary ring-1 ring-primary/20 bg-surface-hover text-primary font-bold'
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
                    ? 'border-primary ring-1 ring-primary/20 bg-surface-hover text-primary font-bold'
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
                disabled={pickerView === 'month-year' ? !canPrevYear : !canPrevMonth}
                onClick={pickerView === 'month-year' ? () => handleStepYear(-1) : handlePrevMonth}
                className={`p-1 rounded-md text-secondary hover:text-primary hover:bg-surface transition-colors cursor-pointer ${
                  (pickerView === 'month-year' ? !canPrevYear : !canPrevMonth)
                    ? 'opacity-20 cursor-not-allowed pointer-events-none'
                    : ''
                }`}
                title={pickerView === 'month-year' ? 'Previous Year' : 'Previous Month'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setPickerView(pickerView === 'month-year' ? 'days' : 'month-year')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-surface transition-all cursor-pointer border border-transparent hover:border-divider"
                title={pickerView === 'month-year' ? 'Switch to Days' : 'Fast select Month & Year'}
              >
                <span>{calendarMonth.toLocaleString('en-US', { month: 'long' })}</span>
                <span className="font-mono text-secondary">{calendarMonth.getFullYear()}</span>
                <ChevronDown
                  className={`w-3 h-3 text-secondary transition-transform ${
                    pickerView === 'month-year' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                disabled={pickerView === 'month-year' ? !canNextYear : !canNextMonth}
                onClick={pickerView === 'month-year' ? () => handleStepYear(1) : handleNextMonth}
                className={`p-1 rounded-md text-secondary hover:text-primary hover:bg-surface transition-colors cursor-pointer ${
                  (pickerView === 'month-year' ? !canNextYear : !canNextMonth)
                    ? 'opacity-20 cursor-not-allowed pointer-events-none'
                    : ''
                }`}
                title={pickerView === 'month-year' ? 'Next Year' : 'Next Month'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {pickerView === 'month-year' ? (
              /* Fast Month & Year Selector View */
              <div className="space-y-3 py-1 animate-in fade-in duration-100">
                {/* Year Controls */}
                <div className="p-2.5 rounded-xl bg-surface border border-divider space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                      Select Year
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!canPrevYear}
                        onClick={() => handleStepYear(-1)}
                        className={`p-1 rounded text-secondary hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer ${
                          !canPrevYear ? 'opacity-20 cursor-not-allowed pointer-events-none' : ''
                        }`}
                        title="Previous Year"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <select
                        value={calendarMonth.getFullYear()}
                        onChange={(e) => handleSelectYear(Number(e.target.value))}
                        className="bg-background border border-divider text-primary font-mono text-xs font-bold rounded-lg px-2 py-0.5 cursor-pointer focus:outline-none focus:border-primary"
                      >
                        {backtestableYears.map((y) => (
                          <option key={y} value={y} className="bg-surface text-primary">
                            {y}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!canNextYear}
                        onClick={() => handleStepYear(1)}
                        className={`p-1 rounded text-secondary hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer ${
                          !canNextYear ? 'opacity-20 cursor-not-allowed pointer-events-none' : ''
                        }`}
                        title="Next Year"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Year Chips (Only backtestable years) */}
                  <div className="grid grid-cols-6 gap-1">
                    {quickYears.map((yr) => {
                      const isSelected = yr === calendarMonth.getFullYear();
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => handleSelectYear(yr)}
                          className={`py-1 text-[11px] font-mono font-semibold rounded-md text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-primary text-background font-bold shadow-xs'
                              : 'bg-background hover:bg-surface-hover text-secondary hover:text-primary border border-divider'
                          }`}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Month Selection Grid (Only backtestable months) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                      Select Month
                    </span>
                    <button
                      type="button"
                      onClick={() => setPickerView('days')}
                      className="text-[10px] text-secondary hover:text-primary font-medium hover:underline cursor-pointer"
                    >
                      Back to Days
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {MONTHS_SHORT.map((name, idx) => {
                      const isSelected = idx === calendarMonth.getMonth();
                      const selectable = isMonthSelectable(idx);
                      return (
                        <button
                          key={name}
                          type="button"
                          disabled={!selectable}
                          onClick={() => selectable && handleSelectMonth(idx)}
                          className={`py-2 text-xs font-semibold rounded-lg text-center transition-all ${
                            isSelected
                              ? 'bg-primary text-background font-bold shadow-xs cursor-pointer'
                              : selectable
                              ? 'bg-surface hover:bg-surface-hover text-secondary hover:text-primary border border-divider cursor-pointer'
                              : 'bg-surface/30 text-secondary/20 border border-divider/20 cursor-not-allowed pointer-events-none'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <>
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

                {/* Days Grid (Buffer and non-trading days disabled) */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((item, idx) => {
                    const { day, dateStr, isCurrentMonth } = item;
                    const isFrom = dateStr === fromDate;
                    const isTo = dateStr === toDate;
                    const isInRange = dateStr > fromDate && dateStr < toDate;
                    const selectable = isDaySelectable(dateStr, isCurrentMonth);

                    let dayClasses = 'h-7 text-xs flex items-center justify-center transition-all select-none ';

                    if (isFrom || isTo) {
                      dayClasses += 'bg-primary text-background font-bold rounded-lg shadow-xs scale-105 z-10 cursor-pointer';
                    } else if (isInRange) {
                      dayClasses += 'bg-surface-hover text-primary font-medium rounded-md cursor-pointer';
                    } else if (!selectable) {
                      dayClasses += 'text-secondary/20 cursor-not-allowed pointer-events-none';
                    } else {
                      dayClasses += 'text-primary hover:bg-surface rounded-lg cursor-pointer';
                    }

                    return (
                      <button
                        key={dateStr || idx}
                        type="button"
                        disabled={!selectable}
                        onClick={() => selectable && handleDayClick(dateStr)}
                        className={dayClasses}
                        title={selectable ? dateStr : `No backtestable candle data for ${dateStr}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
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
            className="w-full py-2.5 rounded-xl bg-primary text-background hover:opacity-90 font-bold text-xs tracking-wide shadow-xs transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
