import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import {
  getBacktestDataRange,
  type BacktestDataRange,
} from '../services/backtestService';

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
  const clean = s ? s.split(' ')[0].split('T')[0] : '';
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export interface BacktestDateRangePickerProps {
  fromDate: string;
  toDate: string;
  onChangeFromDate: (date: string) => void;
  onChangeToDate: (date: string) => void;
  targetSymbol?: string;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}

export function BacktestDateRangePicker({
  fromDate,
  toDate,
  onChangeFromDate,
  onChangeToDate,
  targetSymbol,
  fromLabel = 'From Date',
  toLabel = 'To Date',
  className = '',
}: BacktestDateRangePickerProps) {
  const [selectingField, setSelectingField] = useState<'from' | 'to'>('from');
  const [pickerView, setPickerView] = useState<'days' | 'month-year'>('days');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (toDate) return parseDateString(toDate);
    return new Date();
  });

  const [dataRange, setDataRange] = useState<BacktestDataRange | null>(null);

  // Fetch exact backtestable data range excluding warmup buffer
  useEffect(() => {
    if (!targetSymbol) return;
    let isMounted = true;

    getBacktestDataRange(targetSymbol)
      .then((range) => {
        if (!isMounted) return;
        setDataRange(range);
        const cleanStart = range.backtestableStartDate ? range.backtestableStartDate.split(' ')[0].split('T')[0] : '';
        const cleanEnd = range.backtestableEndDate ? range.backtestableEndDate.split(' ')[0].split('T')[0] : '';

        if (cleanStart && cleanEnd) {
          if (!toDate) {
            onChangeToDate(cleanEnd);
          }
          if (!fromDate) {
            const endD = parseDateString(cleanEnd);
            const defStart = new Date(endD);
            defStart.setFullYear(defStart.getFullYear() - 1);
            const defStartStr = formatDateString(defStart);
            const initialFrom = defStartStr >= cleanStart ? defStartStr : cleanStart;
            onChangeFromDate(initialFrom);
          }
          setCalendarMonth(parseDateString(cleanEnd));
        }
      })
      .catch((err) => {
        console.warn('[BacktestDateRangePicker] Failed to get data range for', targetSymbol, err);
      });

    return () => {
      isMounted = false;
    };
  }, [targetSymbol]);

  // Set of dates where candle data actually exists and buffer is excluded (Date-only)
  const availableDatesSet = useMemo(() => {
    if (!dataRange?.availableDates) return null;
    return new Set(dataRange.availableDates.map((d) => d.split(' ')[0].split('T')[0]));
  }, [dataRange]);

  const { minDateStr, maxDateStr, minYear, maxYear } = useMemo(() => {
    if (!dataRange?.backtestableStartDate || !dataRange?.backtestableEndDate) {
      const today = new Date();
      const defMin = new Date(today);
      defMin.setFullYear(defMin.getFullYear() - 3);
      return {
        minDateStr: formatDateString(defMin),
        maxDateStr: formatDateString(today),
        minYear: defMin.getFullYear(),
        maxYear: today.getFullYear(),
      };
    }
    const cleanStart = dataRange.backtestableStartDate.split(' ')[0].split('T')[0];
    const cleanEnd = dataRange.backtestableEndDate.split(' ')[0].split('T')[0];
    return {
      minDateStr: cleanStart,
      maxDateStr: cleanEnd,
      minYear: new Date(cleanStart).getFullYear(),
      maxYear: new Date(cleanEnd).getFullYear(),
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
      onChangeFromDate(dateStr);
      if (dateStr > toDate) {
        onChangeToDate(dateStr);
      }
      setSelectingField('to');
    } else {
      if (dateStr < fromDate) {
        onChangeFromDate(dateStr);
      } else {
        onChangeToDate(dateStr);
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

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* FROM DATE / TO DATE Inputs (Strategy Backtest Form Exact Match) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
            {fromLabel}
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
              onChange={(e) => onChangeFromDate(e.target.value)}
              className="bg-transparent border-none outline-none font-mono text-xs w-full cursor-pointer"
              placeholder="YYYY-MM-DD"
            />
            <Calendar className="w-3.5 h-3.5 text-secondary shrink-0" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
            {toLabel}
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
              onChange={(e) => onChangeToDate(e.target.value)}
              className="bg-transparent border-none outline-none font-mono text-xs w-full cursor-pointer"
              placeholder="YYYY-MM-DD"
            />
            <Calendar className="w-3.5 h-3.5 text-secondary shrink-0" />
          </div>
        </div>
      </div>

      {/* Visual Month Calendar (Directly Embedded) */}
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

              {/* Quick Year Chips */}
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

            {/* Month Selection Grid */}
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

            {/* Days Grid */}
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
    </div>
  );
}

