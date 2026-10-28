import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  Activity,
  Sliders,
  X,
  BarChart3,
  Calendar,
  CalendarDays,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import type { StrategyRule, IndicatorType } from '../components/StrategyBuilderModal';
import { formatRuleFormula } from '../components/StrategyBuilderModal';
import type { BacktestResponse, InitialInvestmentInfo, BarIndicators } from '../services/backtestService';
import { usePortfolioContext } from '../hooks/PortfolioContext';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { useTheme } from '../../../app/providers/ThemeProvider';

const INDICATOR_CONFIG: Record<string, { label: string; tooltip: string }> = {
  rsi: { label: 'Daily RSI (14)', tooltip: "Live 14-day Wilder's Relative Strength Index updated on each candle" },
  dma50: { label: 'Daily DMA (50)', tooltip: '50-day Simple Moving Average updated on each candle' },
  dma200: { label: 'Daily DMA (200)', tooltip: '200-day Simple Moving Average updated on each candle' },
  changePct: { label: 'Day Change %', tooltip: 'Price Change % from previous day close' },
  price: { label: 'Price', tooltip: 'Stock Close Price' },
};

function renderIndicatorCell(
  type: string,
  data: { indicators?: BarIndicators; changePercent?: number } | null,
  currencySymbol: string
) {
  if (!data) return <span className="text-secondary">—</span>;

  switch (type) {
    case 'rsi': {
      const val = data.indicators?.rsi;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      const num = Number(val);
      const isOversold = num <= 30;
      const isOverbought = num >= 70;
      return (
        <span
          className={`font-mono font-semibold ${
            isOversold ? 'text-success' : isOverbought ? 'text-amber-500' : 'text-primary'
          }`}
        >
          {num.toFixed(2)}
        </span>
      );
    }
    case 'dma50': {
      const val = data.indicators?.dma50;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      return (
        <span className="font-mono text-primary font-medium">
          {currencySymbol}
          {Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }
    case 'dma200': {
      const val = data.indicators?.dma200;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      return (
        <span className="font-mono text-primary font-medium">
          {currencySymbol}
          {Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }
    case 'changePct': {
      const val = data.changePercent;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      const num = Number(val);
      const sign = num > 0 ? '+' : '';
      return (
        <span className={`font-mono font-semibold ${num > 0 ? 'text-success' : num < 0 ? 'text-danger' : 'text-primary'}`}>
          {sign}
          {num.toFixed(2)}%
        </span>
      );
    }
    default:
      return <span className="text-secondary">—</span>;
  }
}

interface TradingDayItem {
  dateStr: string;
  formattedDate: string;
  monthName: string;
  year: string;
  pnl: number;
  pnlPercent: number;
  totalPnl: number;
  totalPnlPercent: number;
  endEquity: number;
  startEquity: number;
  invested: number;
  cash: number;
  signalsCount: number;
  candlesCount: number;
}

interface YearReturnRow {
  year: string;
  months: ({ pnl: number; pnlPercent: number } | null)[];
  totalPnl: number;
  totalPercent: number;
  maxDrawdownPct: number;
  maxDrawdownValue: number;
}

export function BacktestResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { portfolioId: urlPortfolioId } = useParams();
  const { currencySymbol = '₹' } = useCurrency();
  const { stocks = [] } = usePortfolioContext();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Load session from router state or fallback to localStorage
  const session = useMemo(() => {
    if (location.state && location.state.result) {
      return location.state;
    }
    try {
      const saved = localStorage.getItem('latest_backtest_session');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  }, [location.state]);

  const result: BacktestResponse | null = session?.result || null;
  const rule: StrategyRule | null = session?.rule || null;
  const portfolioId = session?.portfolioId || urlPortfolioId;

  const [selectedTab, setSelectedTab] = useState<string>('overview');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Detect which indicators are actively used in strategy rule(s)
  const usedIndicators: IndicatorType[] = useMemo(() => {
    const rulesToCheck: StrategyRule[] = [];
    if (session?.rules && Array.isArray(session.rules)) {
      rulesToCheck.push(...session.rules);
    }
    if (rule && !rulesToCheck.some((r) => r.id === rule.id)) {
      rulesToCheck.push(rule);
    }

    const set = new Set<IndicatorType>();
    for (const r of rulesToCheck) {
      if (!r.conditions || !Array.isArray(r.conditions)) continue;
      for (const cond of r.conditions) {
        if (cond.leftIndicator && cond.leftIndicator !== 'price') {
          set.add(cond.leftIndicator);
        }
        if (cond.rightType === 'indicator' && cond.rightIndicator && cond.rightIndicator !== 'price') {
          set.add(cond.rightIndicator);
        }
      }
    }

    return Array.from(set);
  }, [rule, session?.rules]);

  // Compute or extract Initial Investment details
  const initialInvestment: InitialInvestmentInfo | null = useMemo(() => {
    if (!result) return null;
    const firstPoint = result.equityCurve?.[0];
    const initialCap = result.summary.initialCapital || 100000;
    const firstTrade = result.trades?.[0];

    if (result.initialInvestment) {
      return {
        ...result.initialInvestment,
        action: result.initialInvestment.action || 'Initial Entry',
        changePercent: result.initialInvestment.changePercent ?? firstPoint?.changePercent,
        indicators: result.initialInvestment.indicators ?? firstPoint?.indicators,
      };
    }

    // Fallback if not directly present in cached session
    const rawDate = result.summary.startDate || firstPoint?.date || firstTrade?.entryDate || 'N/A';
    const date = rawDate.includes(' ') ? rawDate.split(' ')[0] : rawDate.split('T')[0];
    const time = firstPoint?.time || (rawDate.includes(' ') ? rawDate.split(' ')[1] : undefined);
    const close = firstPoint?.close ?? firstPoint?.stockClose ?? firstTrade?.entryPrice ?? 0;
    const open = firstPoint?.open ?? close;
    const high = firstPoint?.high ?? Math.max(open, close);
    const low = firstPoint?.low ?? Math.min(open, close);
    const qty = firstPoint?.heldQty || firstTrade?.qty || (close > 0 ? Math.floor(initialCap / close) : 0);
    const invested = firstPoint?.holdingsValue || firstTrade?.totalCost || (qty * (open || close));
    const cashRemaining = Math.max(0, initialCap - invested);

    return {
      date,
      time,
      action: 'Initial Entry',
      open,
      high,
      low,
      close,
      invested,
      qty,
      execPrice: open || close,
      cashRemaining,
      initialCapital: initialCap,
      changePercent: firstPoint?.changePercent,
      indicators: firstPoint?.indicators,
    };
  }, [result]);

  // Construct timeline rows across all simulation dates
  const timelineRows = useMemo(() => {
    if (!result) return [];

    const curve = result.equityCurve || [];
    if (curve.length === 0 && initialInvestment) {
      return [
        {
          date: initialInvestment.date,
          time: initialInvestment.time,
          open: initialInvestment.open,
          high: initialInvestment.high,
          low: initialInvestment.low,
          close: initialInvestment.close,
          changePercent: initialInvestment.changePercent,
          indicators: initialInvestment.indicators,
          invested: initialInvestment.invested,
          qty: initialInvestment.qty,
          equity: initialInvestment.invested + (initialInvestment.cashRemaining || 0),
          unrealizedPnl: 0,
          realizedPnl: 0,
          totalPnl: 0,
          action: initialInvestment.action || 'Initial Entry',
          actionReason: undefined,
          conditionMatched: false,
        },
      ];
    }

    const seenConditionMetDays = new Set<string>();
    let seenInitialEntry = false;

    return curve.map((pt, idx) => {
      const open = pt.open ?? pt.close ?? pt.stockClose ?? 0;
      const high = pt.high ?? Math.max(open, pt.close ?? pt.stockClose ?? open);
      const low = pt.low ?? Math.min(open, pt.close ?? pt.stockClose ?? open);
      const close = pt.close ?? pt.stockClose ?? open;
      const qty = pt.heldQty;
      const invested =
        pt.invested !== undefined
          ? pt.invested
          : idx === 0 && initialInvestment
          ? initialInvestment.invested
          : pt.holdingsValue > 0
          ? pt.holdingsValue
          : qty * close;

      const rowDate = pt.date ? (pt.date.includes(' ') ? pt.date.split(' ')[0] : pt.date.split('T')[0]) : '';
      const rowTime = pt.time || (pt.date && pt.date.includes(' ') ? pt.date.split(' ')[1] : undefined);

      let action: string | undefined = undefined;
      let isConditionMatched = false;

      if (pt.action === 'Initial Entry' || idx === 0) {
        if (!seenInitialEntry) {
          action = 'Initial Entry';
          seenInitialEntry = true;
        }
      } else if (pt.action === 'Condition Met' || pt.conditionMatched) {
        // Enforce: only once a condition meets and displays per day in the action column
        if (!seenConditionMetDays.has(rowDate)) {
          seenConditionMetDays.add(rowDate);
          action = 'Condition Met';
          isConditionMatched = true;
        }
      }

      const unrealizedPnl =
        pt.unrealizedPnl !== undefined
          ? pt.unrealizedPnl
          : qty > 0
          ? parseFloat((qty * close - invested).toFixed(2))
          : 0;
      const realizedPnl = pt.realizedPnl !== undefined ? pt.realizedPnl : 0;
      const totalPnl =
        pt.totalPnl !== undefined
          ? pt.totalPnl
          : parseFloat((realizedPnl + unrealizedPnl).toFixed(2));

      const equity =
        pt.equity !== undefined
          ? pt.equity
          : parseFloat(((pt.cash ?? 0) + (pt.holdingsValue > 0 ? pt.holdingsValue : qty * close)).toFixed(2));

      return {
        date: rowDate,
        time: rowTime,
        open,
        high,
        low,
        close,
        changePercent: pt.changePercent,
        indicators: pt.indicators,
        invested,
        qty,
        equity,
        unrealizedPnl,
        realizedPnl,
        totalPnl,
        action,
        actionReason: isConditionMatched ? pt.actionReason : undefined,
        conditionMatched: isConditionMatched,
      };
    });
  }, [result, initialInvestment]);

  // Construct trading days with exact daily PnL (endEquity - startEquity)
  const tradingDays: TradingDayItem[] = useMemo(() => {
    if (!result) return [];

    const initialCap = result.summary?.initialCapital || 100000;
    const curve = result.equityCurve || [];

    const pointsByDate = new Map<string, typeof curve>();
    for (const pt of curve) {
      const raw = pt.date || '';
      const dateStr = raw.includes(' ') ? raw.split(' ')[0] : raw.split('T')[0];
      if (!dateStr) continue;
      if (!pointsByDate.has(dateStr)) {
        pointsByDate.set(dateStr, []);
      }
      pointsByDate.get(dateStr)!.push(pt);
    }

    if (pointsByDate.size === 0 && timelineRows.length > 0) {
      for (const row of timelineRows) {
        if (!row.date) continue;
        if (!pointsByDate.has(row.date)) {
          pointsByDate.set(row.date, []);
        }
        pointsByDate.get(row.date)!.push({
          date: row.date,
          time: row.time,
          equity: row.invested + (initialInvestment?.cashRemaining || 0),
          cash: initialInvestment?.cashRemaining || 0,
          holdingsValue: row.invested,
          heldQty: row.qty,
          stockClose: row.close,
          benchmarkEquity: 0,
          drawdownPercent: 0,
        });
      }
    }

    const sortedDates = Array.from(pointsByDate.keys()).sort((a, b) => a.localeCompare(b));
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

    let prevEquity = initialCap;
    const days: TradingDayItem[] = [];

    for (let i = 0; i < sortedDates.length; i++) {
      const d = sortedDates[i];
      const dayPts = pointsByDate.get(d) || [];
      const lastPt = dayPts[dayPts.length - 1];
      const rawEndEquity = lastPt?.equity ?? (lastPt ? lastPt.holdingsValue + lastPt.cash : 0);
      const endEquity = rawEndEquity > 0 ? rawEndEquity : prevEquity;
      const startEquity = prevEquity;
      const dayPnL = endEquity - startEquity;
      const pnlPercent = startEquity > 0 ? (dayPnL / startEquity) * 100 : 0;

      const parts = d.split('-');
      const year = parts[0] || '';
      const mNum = parseInt(parts[1] || '1', 10);
      const dayNum = parts[2] || '';

      const formattedDate = `${dayNum} ${monthNames[mNum - 1] || ''}`.trim();
      const monthName = fullMonthNames[mNum - 1] || '';

      const signalsCount = timelineRows.filter(
        (r) => r.date === d && r.action === 'Condition Met'
      ).length;

      const totalPnl =
        lastPt?.totalPnl !== undefined
          ? lastPt.totalPnl
          : parseFloat((endEquity - initialCap).toFixed(2));
      const totalPnlPercent = initialCap > 0 ? (totalPnl / initialCap) * 100 : 0;

      days.push({
        dateStr: d,
        formattedDate,
        monthName,
        year,
        pnl: dayPnL,
        pnlPercent,
        totalPnl,
        totalPnlPercent,
        endEquity,
        startEquity,
        invested: lastPt?.holdingsValue ?? (lastPt?.heldQty ? lastPt.heldQty * (lastPt.stockClose || 0) : 0),
        cash: lastPt?.cash ?? 0,
        signalsCount,
        candlesCount: dayPts.length,
      });

      prevEquity = endEquity;
    }

    return days;
  }, [result, timelineRows, initialInvestment]);

  const reversedDays = useMemo(() => [...tradingDays].reverse(), [tradingDays]);

  const groupedDays = useMemo(() => {
    const map: Record<string, TradingDayItem[]> = {};
    for (const day of reversedDays) {
      const key = `${day.year} • ${day.monthName}`;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(day);
    }
    return map;
  }, [reversedDays]);

  // Year-wise Returns Matrix
  const yearReturns: YearReturnRow[] = useMemo(() => {
    if (tradingDays.length === 0) return [];

    const years = Array.from(new Set(tradingDays.map((d) => d.year))).sort().reverse();
    const rows: YearReturnRow[] = [];

    for (const yr of years) {
      const daysInYear = tradingDays.filter((d) => d.year === yr);
      const months: ({ pnl: number; pnlPercent: number } | null)[] = Array(12).fill(null);

      for (let m = 0; m < 12; m++) {
        const daysInMonth = daysInYear.filter((d) => {
          const parts = d.dateStr.split('-');
          return parseInt(parts[1] || '0', 10) === m + 1;
        });

        if (daysInMonth.length > 0) {
          const first = daysInMonth[0];
          const last = daysInMonth[daysInMonth.length - 1];
          const monthPnl = last.endEquity - first.startEquity;
          const monthPct = first.startEquity > 0 ? (monthPnl / first.startEquity) * 100 : 0;
          months[m] = { pnl: monthPnl, pnlPercent: monthPct };
        }
      }

      const firstYearDay = daysInYear[0];
      const lastYearDay = daysInYear[daysInYear.length - 1];
      const totalPnl = lastYearDay.endEquity - firstYearDay.startEquity;
      const totalPercent = firstYearDay.startEquity > 0 ? (totalPnl / firstYearDay.startEquity) * 100 : 0;

      // Calculate max drawdown for this year (monetary decline & percentage from peak)
      let yearMaxDdVal = 0;
      let yearMaxDdPct = 0;

      if (years.length === 1 && result?.summary?.maxDrawdownValue !== undefined && result.summary.maxDrawdownValue > 0) {
        yearMaxDdVal = result.summary.maxDrawdownValue;
        yearMaxDdPct = result.summary.maxDrawdownPct;
      } else {
        const yearPts = (result?.equityCurve || []).filter((pt) => pt.date.startsWith(yr));
        if (yearPts.length > 0) {
          let yPeak = yearPts[0].equity;
          for (const pt of yearPts) {
            if (pt.equity > yPeak) {
              yPeak = pt.equity;
            } else if (yPeak > 0) {
              const ddVal = yPeak - pt.equity;
              const ddPct = (ddVal / yPeak) * 100;
              if (ddPct > yearMaxDdPct) {
                yearMaxDdPct = ddPct;
                yearMaxDdVal = ddVal;
              }
            }
          }
        }
        if (yearMaxDdVal === 0 && (result?.summary?.maxDrawdownPct ?? 0) > 0) {
          yearMaxDdPct = result?.summary?.maxDrawdownPct ?? 0;
          const peakEq = result?.summary?.peakEquity || result?.summary?.initialCapital || 100000;
          yearMaxDdVal = result?.summary?.maxDrawdownValue || (yearMaxDdPct / 100) * peakEq;
        }
      }

      rows.push({
        year: yr,
        months,
        totalPnl,
        totalPercent,
        maxDrawdownPct: yearMaxDdPct,
        maxDrawdownValue: yearMaxDdVal,
      });
    }

    return rows;
  }, [tradingDays, result]);

  const displayCagr = useMemo(() => {
    if (!result) return 0;
    const summary = result.summary;
    const initialCap = summary?.initialCapital || 100000;
    const finalEq = summary?.finalEquity || initialCap;
    const curve = result.equityCurve || [];

    const startDate = curve.length > 0 ? (curve[0].date || summary.startDate) : summary.startDate;
    const endDate = curve.length > 0 ? (curve[curve.length - 1].date || summary.endDate) : summary.endDate;

    if (startDate && endDate && initialCap > 0 && finalEq > 0) {
      const d1 = new Date(startDate.split(' ')[0].split('T')[0]).getTime();
      const d2 = new Date(endDate.split(' ')[0].split('T')[0]).getTime();
      const calendarDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      if (calendarDays > 0) {
        const years = calendarDays / 365.25;
        const compoundRatio = finalEq / initialCap;
        return parseFloat(((Math.pow(compoundRatio, 1 / years) - 1) * 100).toFixed(2));
      }
    }

    return summary?.cagrPct ?? summary?.totalReturnPct ?? 0;
  }, [result]);

  const peakEquityInfo = useMemo(() => {
    if (!result) return { value: 0, formattedDate: '' };
    const summary = result.summary;
    const initialCap = summary?.initialCapital || 100000;
    const curve = result.equityCurve || [];

    let maxEq = summary?.peakEquity || initialCap;
    let maxDate = summary?.peakEquityDate || (curve[0]?.date || '');

    if (!summary?.peakEquity && curve.length > 0) {
      maxEq = initialCap;
      for (const pt of curve) {
        if (pt.equity > maxEq) {
          maxEq = pt.equity;
          maxDate = pt.date || '';
        }
      }
    }

    let formattedDate = '';
    if (maxDate) {
      const datePart = maxDate.includes(' ') ? maxDate.split(' ')[0] : maxDate.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parseInt(parts[1], 10);
        const d = parts[2];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        formattedDate = `${parseInt(d, 10)} ${monthNames[m - 1] || ''} ${y}`.trim();
      } else {
        formattedDate = datePart;
      }
    }

    return { value: maxEq, formattedDate };
  }, [result]);

  const maxDrawdownRangeInfo = useMemo(() => {
    if (!result) return '';
    const summary = result.summary;
    const curve = result.equityCurve || [];

    let peakDate = summary?.maxDrawdownStartDate || '';
    let troughDate = summary?.maxDrawdownEndDate || '';

    if (!peakDate || !troughDate) {
      const initialCap = summary?.initialCapital || 100000;
      let runningPeak = initialCap;
      let currentPeakDate = curve[0]?.date || '';
      let maxDd = 0;

      for (const pt of curve) {
        if (pt.equity >= runningPeak) {
          runningPeak = pt.equity;
          currentPeakDate = pt.date || '';
        } else if (pt.drawdownPercent > maxDd) {
          maxDd = pt.drawdownPercent;
          peakDate = currentPeakDate;
          troughDate = pt.date || '';
        }
      }
    }

    if (!peakDate && !troughDate) return '';

    const formatShort = (dateStr: string) => {
      if (!dateStr) return '';
      const clean = dateStr.includes(' ') ? dateStr.split(' ')[0] : dateStr.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${d} ${monthNames[m - 1] || ''} ${y}`.trim();
      }
      return clean;
    };

    const formattedPeak = formatShort(peakDate);
    const formattedTrough = formatShort(troughDate);

    if (formattedPeak && formattedTrough) {
      if (formattedPeak === formattedTrough) {
        return `on ${formattedPeak}`;
      }
      return `${formattedPeak} – ${formattedTrough}`;
    }
    return formattedPeak ? `from ${formattedPeak}` : formattedTrough ? `at ${formattedTrough}` : '';
  }, [result]);

  const displayMaxDrawdownValue = useMemo(() => {
    if (!result?.summary) return 0;
    if (result.summary.maxDrawdownValue !== undefined && result.summary.maxDrawdownValue > 0) {
      return result.summary.maxDrawdownValue;
    }

    if (yearReturns.length > 0) {
      const worstYear = yearReturns.reduce(
        (prev, curr) => (curr.maxDrawdownValue > (prev?.maxDrawdownValue || 0) ? curr : prev),
        yearReturns[0]
      );
      if (worstYear && worstYear.maxDrawdownValue > 0) {
        return worstYear.maxDrawdownValue;
      }
    }

    const peak = peakEquityInfo.value || result.summary.peakEquity || result.summary.initialCapital || 100000;
    return ((result.summary.maxDrawdownPct || 0) / 100) * peak;
  }, [result, yearReturns, peakEquityInfo]);

  const portfolioMetrics = useMemo(() => {
    if (!result) return null;
    const curve = result.equityCurve || [];
    const summary = result.summary;

    // 1. Calmar Ratio: CAGR / Max Drawdown
    const calmar =
      summary.calmarRatio !== undefined && summary.calmarRatio !== null
        ? summary.calmarRatio
        : summary.maxDrawdownPct > 0
        ? parseFloat((displayCagr / summary.maxDrawdownPct).toFixed(2))
        : null;

    // 2. Max Drawdown Duration (Underwater period in trading days)
    let maxUnderwater = 0;
    if (curve.length > 0) {
      const currentUnderwaterDates = new Set<string>();
      for (const pt of curve) {
        const dateStr = pt.date ? (pt.date.includes(' ') ? pt.date.split(' ')[0] : pt.date.split('T')[0]) : '';
        if (pt.drawdownPercent > 0.05) {
          if (dateStr) currentUnderwaterDates.add(dateStr);
          if (currentUnderwaterDates.size > maxUnderwater) {
            maxUnderwater = currentUnderwaterDates.size;
          }
        } else {
          currentUnderwaterDates.clear();
        }
      }
    } else if (summary.maxDrawdownDurationDays) {
      maxUnderwater = Math.min(tradingDays.length, summary.maxDrawdownDurationDays);
    }

    // 3. Beta: Portfolio sensitivity to Benchmark
    let betaVal = summary.beta !== undefined && summary.beta !== null ? summary.beta : null;
    if (betaVal === null && curve.length > 5) {
      const stratReturns: number[] = [];
      const benchReturns: number[] = [];
      for (let i = 1; i < curve.length; i++) {
        const prevE = curve[i - 1].equity;
        const currE = curve[i].equity;
        const prevB = curve[i - 1].benchmarkEquity;
        const currB = curve[i].benchmarkEquity;
        if (prevE > 0 && prevB > 0) {
          stratReturns.push((currE - prevE) / prevE);
          benchReturns.push((currB - prevB) / prevB);
        }
      }
      if (stratReturns.length > 0) {
        const meanS = stratReturns.reduce((a, b) => a + b, 0) / stratReturns.length;
        const meanB = benchReturns.reduce((a, b) => a + b, 0) / benchReturns.length;
        let cov = 0;
        let varB = 0;
        for (let i = 0; i < stratReturns.length; i++) {
          cov += (stratReturns[i] - meanS) * (benchReturns[i] - meanB);
          varB += Math.pow(benchReturns[i] - meanB, 2);
        }
        if (varB > 0) {
          betaVal = parseFloat((cov / varB).toFixed(2));
        }
      }
    }

    // 4. Cash Drag % (Average % of capital kept in cash)
    const cashDragPct = parseFloat(Math.max(0, 100 - summary.marketExposurePct).toFixed(2));

    // 5. Total Tranches / Allocations
    let trancheCount = result.initialInvestment ? 1 : 0;
    const conditionDays = new Set<string>();
    for (const pt of curve) {
      if (pt.action === 'Condition Met' || (pt.conditionMatched && pt.action !== 'Initial Entry')) {
        conditionDays.add(pt.date);
      }
    }
    trancheCount += conditionDays.size;
    if (trancheCount === 0 && summary.totalTrades > 0) {
      trancheCount = summary.totalTrades;
    }

    // 6. Effective Average Buy Cost vs Benchmark / Average Market Price
    let totalBoughtShares = result.initialInvestment?.qty || 0;
    let totalCost = result.initialInvestment?.invested || 0;
    for (const t of result.trades) {
      if (t.action === 'BUY' && (!result.initialInvestment || t.entryPrice !== result.initialInvestment.execPrice)) {
        totalBoughtShares += t.qty;
        totalCost += t.totalCost;
      }
    }
    const effectiveAvgPrice =
      totalBoughtShares > 0
        ? parseFloat((totalCost / totalBoughtShares).toFixed(2))
        : result.initialInvestment?.execPrice || null;

    const avgMarketPrice =
      curve.length > 0
        ? parseFloat((curve.reduce((acc, p) => acc + (p.stockClose || p.close || 0), 0) / curve.length).toFixed(2))
        : null;

    return {
      calmarRatio: calmar,
      maxUnderwaterDays: maxUnderwater,
      beta: betaVal,
      cashDragPct,
      trancheCount: Math.max(1, trancheCount),
      effectiveAvgPrice,
      avgMarketPrice,
    };
  }, [result]);

  // Selected Day State & Filtering
  const activeDay = useMemo(() => {
    if (selectedTab === 'overview') return null;
    return tradingDays.find((d) => d.dateStr === selectedTab) || null;
  }, [selectedTab, tradingDays]);

  const dayCandles = useMemo(() => {
    if (selectedTab === 'overview') return [];
    return timelineRows.filter((r) => r.date === selectedTab);
  }, [selectedTab, timelineRows]);

  const conditionMetCount = useMemo(() => {
    return timelineRows.filter((r) => r.action === 'Condition Met').length;
  }, [timelineRows]);

  if (!result || !rule) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-[70vh]">
        <div className="p-4 rounded-2xl bg-surface border border-divider text-secondary">
          <Layers className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-primary">No Backtest Results Loaded</h2>
          <p className="text-xs text-secondary max-w-sm">
            Launch a backtest from any strategy card to generate comprehensive institutional simulation metrics.
          </p>
        </div>
        <button
          onClick={() => navigate(portfolioId ? `/portfolio/${portfolioId}/backtest` : '/backtest')}
          className="px-4 py-2 rounded-xl bg-primary text-background text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Backtest</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen text-primary overflow-x-hidden">
      {/* Strategy Header Band (Light Grey in Light Mode, Darker Gray in Dark Mode) */}
      <div
        className={`w-full border-b px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-3 shrink-0 transition-colors shadow-xs ${
          isDark
            ? 'bg-[#141518] border-zinc-800'
            : 'bg-gray-100 border-gray-200'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div
            className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 shadow-2xs ${
              isDark
                ? 'bg-zinc-800/80 border-zinc-700/60 text-zinc-200'
                : 'bg-white border-gray-200 text-gray-700'
            }`}
          >
            <Activity className="w-3 h-3" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1
                className={`text-[11px] sm:text-xs font-bold tracking-wider uppercase truncate ${
                  isDark ? 'text-zinc-100' : 'text-gray-900'
                }`}
              >
                {rule.name || 'TEST STRATEGY'}
              </h1>
              {result.symbol && (
                <span
                  className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 shadow-2xs ${
                    isDark
                      ? 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {result.symbol}
                </span>
              )}
            </div>
            <p
              className={`text-[9px] sm:text-[10px] leading-tight mt-0.5 truncate ${
                isDark ? 'text-zinc-400' : 'text-gray-500'
              }`}
            >
              Historical Simulation Report{' '}
              <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>
                ({(result.summary.startDate || '').split(' ')[0].split('T')[0]} to{' '}
                {(result.summary.endDate || '').split(' ')[0].split('T')[0]})
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border rounded-md transition-colors cursor-pointer shadow-2xs ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
            }`}
          >
            <Sliders className={`w-3 h-3 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
            <span>View Config</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body with Left Tab Sidebar and Right Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Tab / Sidebar: TRADING DAYS */}
        <aside
          className={`w-52 sm:w-60 shrink-0 border-r flex flex-col h-full overflow-hidden select-none ${
            isDark ? 'bg-[#101114] border-zinc-800' : 'bg-gray-50/70 border-gray-200'
          }`}
        >
          {/* TRADING DAYS title & Analytics Overview button */}
          <div className="p-3 border-b border-divider shrink-0">
            <div className="flex items-center gap-1.5 px-2 pb-2 text-[10px] font-bold tracking-wider text-secondary uppercase">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>TRADING DAYS</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedTab('overview');
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedTab === 'overview'
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-2xs'
                    : 'bg-white text-gray-900 border border-gray-200 shadow-2xs'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
              <span>Analytics Overview</span>
            </button>
          </div>

          {/* Days List with final daily PnL */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
            {Object.entries(groupedDays).map(([groupKey, days]) => (
              <div key={groupKey} className="space-y-0.5">
                <div className="px-2 pt-1 pb-1 text-[9px] sm:text-[10px] font-bold tracking-wider text-secondary uppercase">
                  {groupKey}
                </div>
                {days.map((day) => {
                  const isSelected = selectedTab === day.dateStr;
                  const isPositive = day.totalPnl > 0;
                  const isNegative = day.totalPnl < 0;

                  return (
                    <button
                      key={day.dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedTab(day.dateStr);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                        isSelected
                          ? isDark
                            ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
                            : 'bg-white text-gray-900 font-bold border border-gray-200 shadow-2xs'
                          : isDark
                          ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                      }`}
                    >
                      <span className="font-medium">{day.formattedDate}</span>
                      <span
                        className={`font-semibold tabular-nums text-[11px] ${
                          isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-secondary opacity-70'
                        }`}
                      >
                        {isPositive ? '+' : isNegative ? '-' : ''}
                        {currencySymbol}
                        {Math.abs(Math.round(day.totalPnl)).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}

            {tradingDays.length === 0 && (
              <div className="p-4 text-center text-secondary text-xs">
                No trading days available.
              </div>
            )}
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 overflow-y-auto">
          {selectedTab === 'overview' ? (
            /* ANALYTICS OVERVIEW (Default View) */
            <div className="p-4 sm:p-6 space-y-6">
              {/* Year-wise Returns */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-primary">
                    Year-wise Returns
                  </h2>
                </div>

                <div className="overflow-x-auto border border-divider rounded-xl">
                  <table className="w-full text-center text-xs font-mono">
                    <thead
                      className={`border-b text-[10px] font-semibold uppercase tracking-wider ${
                        isDark ? 'bg-zinc-900/60 text-zinc-400' : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      <tr>
                        <th className="py-2.5 px-3 text-left">Year</th>
                        <th className="py-2.5 px-2">Jan</th>
                        <th className="py-2.5 px-2">Feb</th>
                        <th className="py-2.5 px-2">Mar</th>
                        <th className="py-2.5 px-2">Apr</th>
                        <th className="py-2.5 px-2">May</th>
                        <th className="py-2.5 px-2">Jun</th>
                        <th className="py-2.5 px-2">Jul</th>
                        <th className="py-2.5 px-2">Aug</th>
                        <th className="py-2.5 px-2">Sep</th>
                        <th className="py-2.5 px-2">Oct</th>
                        <th className="py-2.5 px-2">Nov</th>
                        <th className="py-2.5 px-2">Dec</th>
                        <th className="py-2.5 px-3 text-right font-bold">Total</th>
                        <th className="py-2.5 px-3 text-right font-bold text-danger">Max Drawdown</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider font-mono">
                      {yearReturns.map((yr) => {
                        const isTotalPos = yr.totalPnl >= 0;
                        return (
                          <tr
                            key={yr.year}
                            className={isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50'}
                          >
                            <td className="py-2.5 px-3 text-left font-bold text-primary">
                              {yr.year}
                            </td>
                            {yr.months.map((m, mIdx) => (
                              <td key={mIdx} className="py-2.5 px-2 tabular-nums text-[11px]">
                                {m !== null ? (
                                  <span
                                    className={`font-semibold ${
                                      m.pnl >= 0 ? 'text-success' : 'text-danger'
                                    }`}
                                  >
                                    {m.pnl >= 0 ? '+' : ''}
                                    {currencySymbol}
                                    {Math.round(m.pnl).toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-secondary opacity-30">0</span>
                                )}
                              </td>
                            ))}
                            <td className="py-2.5 px-3 text-right tabular-nums font-bold">
                              <span className={isTotalPos ? 'text-success' : 'text-danger'}>
                                {isTotalPos ? '+' : ''}
                                {currencySymbol}
                                {Math.round(yr.totalPnl).toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums font-bold text-danger">
                              {yr.maxDrawdownValue > 0
                                ? `-${currencySymbol}${Math.round(yr.maxDrawdownValue).toLocaleString()}`
                                : `${currencySymbol}0`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Strategy Performance Grid (3 Columns, matching CoreQuant inspo) */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-primary">
                    Strategy Performance
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Column 1: Capital & Returns */}
                  <div
                    className={`p-4 rounded-xl border space-y-3 ${
                      isDark ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 pb-2 border-b border-divider text-[11px] font-bold uppercase tracking-wider text-secondary">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      <span>Capital & Returns</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">Total Net Profit</span>
                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-sm ${
                            result.summary.netProfit >= 0 ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {result.summary.netProfit >= 0 ? '+' : ''}
                          {currencySymbol}
                          {result.summary.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={`text-[10px] ml-1.5 font-mono ${result.summary.totalReturnPct >= 0 ? 'text-success' : 'text-danger'}`}>
                          ({result.summary.totalReturnPct >= 0 ? '+' : ''}{result.summary.totalReturnPct.toFixed(2)}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">Strategy CAGR</span>
                      <span className={`font-mono font-bold ${displayCagr >= 0 ? 'text-success' : 'text-danger'}`}>
                        {displayCagr >= 0 ? '+' : ''}{displayCagr.toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-divider">
                      <span className="text-secondary">Initial Capital</span>
                      <span className="font-mono text-primary font-semibold">
                        {currencySymbol}
                        {(result.summary.initialCapital || 100000).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">Portfolio Equity</span>
                      <span className="font-mono text-primary font-bold">
                        {currencySymbol}
                        {result.summary.finalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">Peak Equity</span>
                      <div className="text-right">
                        <span className="font-mono text-primary font-bold">
                          {currencySymbol}
                          {peakEquityInfo.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {peakEquityInfo.formattedDate && (
                          <div className={`text-[10px] font-mono ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                            on {peakEquityInfo.formattedDate}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Drawdown */}
                  <div
                    className={`p-4 rounded-xl border space-y-3 ${
                      isDark ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 pb-2 border-b border-divider text-[11px] font-bold uppercase tracking-wider text-secondary">
                      <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                      <span>Drawdown</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">Max Drawdown</span>
                      <div className="text-right">
                        <div className="font-mono font-bold text-danger">
                          -{result.summary.maxDrawdownPct.toFixed(2)}%
                          {displayMaxDrawdownValue > 0 && (
                            <span className="text-[11px] font-medium ml-1.5 opacity-90">
                              (-{currencySymbol}{Math.round(displayMaxDrawdownValue).toLocaleString()})
                            </span>
                          )}
                        </div>
                        {maxDrawdownRangeInfo && (
                          <div className={`text-[10px] font-mono ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                            {maxDrawdownRangeInfo}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">Max Drawdown Duration</span>
                      <span className="font-mono font-bold text-primary">
                        {portfolioMetrics?.maxUnderwaterDays || 0} {portfolioMetrics?.maxUnderwaterDays === 1 ? 'day' : 'days'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-divider">
                      <span className="text-secondary">Effective Avg Buy Price</span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-primary">
                          {portfolioMetrics?.effectiveAvgPrice !== null && portfolioMetrics?.effectiveAvgPrice !== undefined
                            ? `${currencySymbol}${portfolioMetrics.effectiveAvgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '—'}
                        </span>
                        {portfolioMetrics?.avgMarketPrice && (
                          <div className="text-[10px] text-secondary">
                            vs Avg Close {currencySymbol}{portfolioMetrics.avgMarketPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">Trading Days</span>
                      <span className="font-mono font-bold text-primary">
                        {tradingDays.length} days
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* SINGLE DAY CANDLE VIEW (CoreQuant Day View Style) */
            <div className="w-full flex flex-col min-w-full">
              {/* Day Subheader Toolbar */}
              <div
                className={`border-b px-4 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                  isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-gray-50/80 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2
                        className={`text-xs sm:text-sm font-bold tracking-wide uppercase ${
                          isDark ? 'text-zinc-100' : 'text-gray-900'
                        }`}
                      >
                        Market Data & Actions: {activeDay?.dateStr || selectedTab}
                      </h2>
                      <span className={`text-[11px] font-mono font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                        {result.symbol}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* PnL Badge */}
                  {activeDay && (
                    <div className="text-right">
                      <div className={`text-[9px] uppercase font-semibold tracking-wider ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                        PnL
                      </div>
                      <div className="flex items-center justify-end font-mono text-xs font-bold">
                        <span
                          className={
                            activeDay.totalPnl > 0
                              ? 'text-success'
                              : activeDay.totalPnl < 0
                              ? 'text-danger'
                              : 'text-secondary opacity-70'
                          }
                        >
                          {activeDay.totalPnl > 0 ? '+' : activeDay.totalPnl < 0 ? '-' : ''}
                          {currencySymbol}
                          {Math.abs(activeDay.totalPnl).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Day Candle Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr
                      className={`border-b text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider ${
                        isDark
                          ? 'border-zinc-800 text-zinc-400 bg-zinc-900/60'
                          : 'border-gray-200 text-gray-500 bg-gray-50'
                      }`}
                    >
                      <th className="py-2.5 px-4 font-medium">Time</th>
                      <th className="py-2.5 px-3 font-medium text-right">Open</th>
                      <th className="py-2.5 px-3 font-medium text-right">High</th>
                      <th className="py-2.5 px-3 font-medium text-right">Low</th>
                      <th className="py-2.5 px-3 font-medium text-right">Close</th>
                      {usedIndicators.map((ind) => (
                        <th
                          key={ind}
                          className="py-2.5 px-3 font-medium text-center whitespace-nowrap"
                          title={INDICATOR_CONFIG[ind]?.tooltip || ind}
                        >
                          {INDICATOR_CONFIG[ind]?.label || ind}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 font-medium text-right">Invested</th>
                      <th className="py-2.5 px-3 font-medium text-right">Qty</th>
                      <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Equity Value</th>
                      <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Unrealized P&L</th>
                      <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Realized P&L</th>
                      <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Total P&L</th>
                      <th className="py-2.5 px-4 font-medium text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-mono text-xs ${isDark ? 'divide-zinc-800/40' : 'divide-gray-100'}`}>
                    {dayCandles.map((row, idx) => {
                      const isInitial = row.action === 'Initial Entry';
                      const isConditionMet = row.action === 'Condition Met';

                      return (
                        <tr
                          key={`${row.date}-${row.time || idx}`}
                          className={`transition-colors border-b ${
                            isDark ? 'border-zinc-800/40' : 'border-gray-100'
                          } ${
                            isConditionMet
                              ? isDark
                                ? 'bg-amber-500/[0.07] hover:bg-amber-500/[0.12] text-zinc-100 font-medium'
                                : 'bg-amber-50/70 hover:bg-amber-100/70 text-gray-900 font-medium'
                              : isInitial
                              ? isDark
                                ? 'bg-success/[0.06] hover:bg-success/[0.12] text-zinc-100'
                                : 'bg-success/[0.06] hover:bg-success/[0.12] text-gray-900'
                              : isDark
                              ? 'hover:bg-zinc-800/25 text-zinc-200'
                              : 'hover:bg-gray-50/80 text-gray-800'
                          }`}
                        >
                          <td className="py-2 px-4 font-semibold text-primary whitespace-nowrap">
                            {row.time || row.date}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-secondary">
                            {row.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium text-success">
                            {row.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium text-danger">
                            {row.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-primary">
                            {row.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          {usedIndicators.map((ind) => (
                            <td key={ind} className="py-2 px-3 text-center whitespace-nowrap">
                              {renderIndicatorCell(ind, row, currencySymbol)}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right tabular-nums font-semibold text-success whitespace-nowrap">
                            {currencySymbol}{row.invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-primary whitespace-nowrap">
                            {row.qty.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-primary whitespace-nowrap">
                            {currencySymbol}{row.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold whitespace-nowrap">
                            <span className={row.unrealizedPnl > 0 ? 'text-success' : row.unrealizedPnl < 0 ? 'text-danger' : 'text-secondary opacity-70'}>
                              {row.unrealizedPnl > 0 ? '+' : row.unrealizedPnl < 0 ? '-' : ''}
                              {currencySymbol}
                              {Math.abs(row.unrealizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold whitespace-nowrap">
                            <span className={row.realizedPnl > 0 ? 'text-success' : row.realizedPnl < 0 ? 'text-danger' : 'text-secondary opacity-70'}>
                              {row.realizedPnl > 0 ? '+' : row.realizedPnl < 0 ? '-' : ''}
                              {currencySymbol}
                              {Math.abs(row.realizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold whitespace-nowrap">
                            <span className={row.totalPnl > 0 ? 'text-success' : row.totalPnl < 0 ? 'text-danger' : 'text-secondary opacity-70'}>
                              {row.totalPnl > 0 ? '+' : row.totalPnl < 0 ? '-' : ''}
                              {currencySymbol}
                              {Math.abs(row.totalPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-left whitespace-nowrap">
                            {isInitial ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase border bg-success/10 text-success border-success/25"
                              >
                                Initial Entry
                              </span>
                            ) : isConditionMet ? (
                              <span
                                title={row.actionReason}
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase border ${
                                  isDark
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                              >
                                Condition Met
                              </span>
                            ) : (
                              <span className="text-secondary opacity-30">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Config Details Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-surface border border-divider rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <h3 className="text-sm font-bold text-primary">Strategy Configuration</h3>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="p-1 text-secondary hover:text-primary rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-secondary block mb-1">Strategy Name</label>
                <div className="font-semibold text-primary">{rule.name}</div>
              </div>
              <div>
                <label className="text-secondary block mb-1">Target Stock</label>
                <div className="font-mono text-primary font-bold">{result.symbol}</div>
              </div>
              <div>
                <label className="text-secondary block mb-1">Formula</label>
                <div className="p-3 bg-background border border-divider rounded-lg font-mono text-xs text-primary overflow-x-auto">
                  {formatRuleFormula(rule)}
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-primary text-surface text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
