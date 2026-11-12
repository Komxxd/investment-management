import type { StrategyRule, IndicatorType } from '../../utils/strategyConfig';
import { normalizeRule } from '../../utils/strategyConfig';
import type {
  BacktestResponse,
  InitialInvestmentInfo,
  DailyEquityPoint,
  BarIndicators,
} from '../../services/backtestService';

export interface IndicatorMeta {
  label: string;
  tooltip: string;
}

export const INDICATOR_CONFIG: Record<string, IndicatorMeta> = {
  rsi: { label: 'Daily RSI (14)', tooltip: "Live 14-day Wilder's Relative Strength Index updated on each candle" },
  dma50: { label: 'Daily DMA (50)', tooltip: '50-day Simple Moving Average updated on each candle' },
  dma200: { label: 'Daily DMA (200)', tooltip: '200-day Simple Moving Average updated on each candle' },
  ema20: { label: 'Daily EMA (20)', tooltip: '20-day Exponential Moving Average updated on each candle' },
  ema50: { label: 'Daily EMA (50)', tooltip: '50-day Exponential Moving Average updated on each candle' },
  ema200: { label: 'Daily EMA (200)', tooltip: '200-day Exponential Moving Average updated on each candle' },
  macd: { label: 'MACD Line (12, 26)', tooltip: 'MACD line (EMA 12 - EMA 26)' },
  macdSignal: { label: 'MACD Signal (9)', tooltip: '9-day EMA of MACD Line' },
  macdHist: { label: 'MACD Histogram', tooltip: 'MACD Line minus Signal Line' },
  bbUpper: { label: 'BB Upper (20, 2)', tooltip: 'Bollinger Bands Upper Band (20 SMA + 2 StdDev)' },
  bbMiddle: { label: 'BB Middle (20)', tooltip: 'Bollinger Bands Middle Band (20 SMA)' },
  bbLower: { label: 'BB Lower (20, 2)', tooltip: 'Bollinger Bands Lower Band (20 SMA - 2 StdDev)' },
  bbBandwidth: { label: 'BB Bandwidth %', tooltip: 'Bollinger Bandwidth % ((Upper - Lower) / Middle * 100)' },
  bbPercentB: { label: 'BB %B', tooltip: 'Bollinger %B ((Price - Lower) / (Upper - Lower))' },
  vwap: { label: 'VWAP', tooltip: 'Volume Weighted Average Price' },
  avgVolume: { label: '20d Avg Vol', tooltip: '20-period Average Volume' },
  volume: { label: 'Volume', tooltip: 'Candle Volume' },
  obv: { label: 'OBV', tooltip: 'On-Balance Volume (Cumulative volume indicator)' },
  obvSignal: { label: 'OBV Signal (20)', tooltip: '20-period Simple Moving Average of OBV' },
  changePct: { label: 'Day Change %', tooltip: 'Price Change % from previous day close' },
  price: { label: 'Price', tooltip: 'Stock Close Price' },
};

export interface TradingDayItem {
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

export interface YearReturnRow {
  year: string;
  months: ({ pnl: number; pnlPercent: number } | null)[];
  totalPnl: number;
  totalPercent: number;
  maxDrawdownPct: number;
  maxDrawdownValue: number;
}

export interface TimelineRow {
  date: string;
  time?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  changePercent?: number;
  indicators?: BarIndicators;
  volume?: number;
  invested: number;
  qty: number;
  holdingValue: number;
  equity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  action?: string;
  actionReason?: string;
  conditionMatched: boolean;
}

export interface PortfolioSimulationMetrics {
  calmarRatio: number | null;
  maxUnderwaterDays: number;
  beta: number | null;
  cashDragPct: number;
  trancheCount: number;
  effectiveAvgPrice: number | null;
  avgMarketPrice: number | null;
}

export interface PortfolioBacktestConfigSummary {
  portfolioName?: string;
  mode?: 'SIP' | 'ONE_TIME';
  sipAmount?: number;
  sipDay?: number | string;
  sipTime?: string;
  initialCapital?: number;
  constituents?: Array<string | { symbol: string }>;
}

export interface BacktestSessionState {
  result?: BacktestResponse | null;
  rule?: StrategyRule | null;
  rules?: StrategyRule[];
  portfolioId?: string;
  portfolioConfig?: PortfolioBacktestConfigSummary | null;
  mode?: string;
}

const MONTH_ABBRS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.includes(' ') ? dateStr.split(' ')[0] : dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return `${d} ${MONTH_ABBRS[m - 1] || ''} ${y}`.trim();
  }
  return clean;
}

/**
 * Collects unique non-price indicators referenced across a strategy rule set.
 */
export function extractUsedIndicators(
  rule: StrategyRule | null,
  sessionRules?: StrategyRule[]
): IndicatorType[] {
  const rulesToCheck: StrategyRule[] = [];
  if (Array.isArray(sessionRules)) {
    rulesToCheck.push(...sessionRules);
  }
  if (rule && !rulesToCheck.some(r => r.id === rule.id)) {
    rulesToCheck.push(rule);
  }

  const set = new Set<IndicatorType>();
  for (const r of rulesToCheck) {
    const norm = normalizeRule(r);
    const allConds = [
      ...(Array.isArray(norm.entryConditions) ? norm.entryConditions : []),
      ...(Array.isArray(norm.exitConditions) ? norm.exitConditions : []),
      ...(Array.isArray(norm.conditions) ? norm.conditions : []),
    ];
    for (const cond of allConds) {
      if (cond.leftIndicator && cond.leftIndicator !== 'price') {
        set.add(cond.leftIndicator);
      }
      if (cond.rightType === 'indicator' && cond.rightIndicator && cond.rightIndicator !== 'price') {
        set.add(cond.rightIndicator);
      }
    }
  }

  return Array.from(set);
}

/**
 * Builds normalized timeline rows from the simulation equity curve or initial investment fallback.
 */
export function buildTimelineRows(
  result: BacktestResponse | null,
  initialInvestment: InitialInvestmentInfo | null
): TimelineRow[] {
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
        holdingValue: initialInvestment.invested,
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

    const rowDate = pt.date
      ? pt.date.includes(' ')
        ? pt.date.split(' ')[0]
        : pt.date.split('T')[0]
      : '';
    const rowTime = pt.time || (pt.date && pt.date.includes(' ') ? pt.date.split(' ')[1] : undefined);

    let action: string | undefined;
    let isConditionMatched = false;

    if (pt.action === 'Initial Entry') {
      if (!seenInitialEntry) {
        action = 'Initial Entry';
        seenInitialEntry = true;
      }
    } else if (pt.action === 'Condition Met' || pt.conditionMatched) {
      if (!seenConditionMetDays.has(rowDate)) {
        seenConditionMetDays.add(rowDate);
        action = 'Condition Met';
        isConditionMatched = true;
      }
    } else if (pt.action) {
      action = pt.action;
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

    const holdingValue =
      pt.holdingsValue !== undefined ? pt.holdingsValue : parseFloat((qty * close).toFixed(2));

    const equity =
      pt.equity !== undefined
        ? pt.equity
        : parseFloat(((pt.cash ?? 0) + holdingValue).toFixed(2));

    return {
      date: rowDate,
      time: rowTime,
      open,
      high,
      low,
      close,
      changePercent: pt.changePercent,
      indicators: pt.indicators,
      volume: (pt as DailyEquityPoint & { volume?: number }).volume,
      invested,
      qty,
      holdingValue,
      equity,
      unrealizedPnl,
      realizedPnl,
      totalPnl,
      action,
      actionReason: isConditionMatched ? pt.actionReason : undefined,
      conditionMatched: isConditionMatched,
    };
  });
}

/**
 * Aggregates simulation curve points into per-day PnL and equity summaries.
 */
export function buildTradingDays(
  result: BacktestResponse | null,
  timelineRows: TimelineRow[],
  initialInvestment: InitialInvestmentInfo | null
): TradingDayItem[] {
  if (!result) return [];

  const initialCap = result.summary?.initialCapital ?? 0;
  const curve = result.equityCurve || [];

  const pointsByDate = new Map<string, DailyEquityPoint[]>();
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
  let prevTotalPnl = 0;
  let prevEquity = initialCap;
  const days: TradingDayItem[] = [];

  for (const d of sortedDates) {
    const dayPts = pointsByDate.get(d) || [];
    const lastPt = dayPts[dayPts.length - 1];
    const rawEndEquity = lastPt?.equity ?? (lastPt ? lastPt.holdingsValue + lastPt.cash : 0);
    const endEquity = rawEndEquity > 0 ? rawEndEquity : prevEquity;
    const startEquity = prevEquity;

    const totalPnl =
      lastPt?.totalPnl !== undefined
        ? lastPt.totalPnl
        : parseFloat((endEquity - initialCap).toFixed(2));
    const dayPnL = parseFloat((totalPnl - prevTotalPnl).toFixed(2));
    const pnlPercent = startEquity > 0 ? (dayPnL / startEquity) * 100 : 0;
    const totalPnlPercent = initialCap > 0 ? (totalPnl / initialCap) * 100 : 0;

    const parts = d.split('-');
    const year = parts[0] || '';
    const mNum = parseInt(parts[1] || '1', 10);
    const dayNum = parts[2] || '';

    const formattedDate = `${dayNum} ${MONTH_ABBRS[mNum - 1] || ''}`.trim();
    const monthName = FULL_MONTH_NAMES[mNum - 1] || '';

    const signalsCount = timelineRows.filter(
      r => r.date === d && r.action === 'Condition Met'
    ).length;

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
      invested:
        lastPt?.holdingsValue ??
        (lastPt?.heldQty ? lastPt.heldQty * (lastPt.stockClose || 0) : 0),
      cash: lastPt?.cash ?? 0,
      signalsCount,
      candlesCount: dayPts.length,
    });

    prevEquity = endEquity;
    prevTotalPnl = totalPnl;
  }

  return days;
}

/**
 * Groups trading days (already reversed chronologically) by year and month label.
 */
export function groupTradingDaysByMonth(
  reversedDays: TradingDayItem[]
): Record<string, TradingDayItem[]> {
  const map: Record<string, TradingDayItem[]> = {};
  for (const day of reversedDays) {
    const key = `${day.year} • ${day.monthName}`;
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(day);
  }
  return map;
}

/**
 * Computes the Year-wise Returns and Max Drawdown matrix.
 */
export function buildYearReturnsMatrix(
  tradingDays: TradingDayItem[],
  result: BacktestResponse | null
): YearReturnRow[] {
  if (tradingDays.length === 0) return [];

  const years = Array.from(new Set(tradingDays.map(d => d.year))).sort().reverse();
  const rows: YearReturnRow[] = [];

  for (const yr of years) {
    const daysInYear = tradingDays.filter(d => d.year === yr);
    const months: ({ pnl: number; pnlPercent: number } | null)[] = Array(12).fill(null);
    const baseCapital =
      result?.summary?.initialCapital ||
      (daysInYear[0]?.startEquity > 0 ? daysInYear[0].startEquity : 0);

    for (let m = 0; m < 12; m++) {
      const daysInMonth = daysInYear.filter(d => {
        const parts = d.dateStr.split('-');
        return parseInt(parts[1] || '0', 10) === m + 1;
      });

      if (daysInMonth.length > 0) {
        const monthPnl = parseFloat(daysInMonth.reduce((acc, d) => acc + d.pnl, 0).toFixed(2));
        const monthPct =
          baseCapital > 0 ? parseFloat(((monthPnl / baseCapital) * 100).toFixed(2)) : 0;
        months[m] = { pnl: monthPnl, pnlPercent: monthPct };
      }
    }

    const totalPnl = parseFloat(daysInYear.reduce((acc, d) => acc + d.pnl, 0).toFixed(2));
    const totalPercent =
      baseCapital > 0 ? parseFloat(((totalPnl / baseCapital) * 100).toFixed(2)) : 0;

    let yearMaxDdVal = 0;
    let yearMaxDdPct = 0;
    const yearPts = (result?.equityCurve || []).filter(pt => pt.date.startsWith(yr));
    if (yearPts.length > 0) {
      let yPeak = yearPts[0].equity;
      for (const pt of yearPts) {
        if (pt.equity > yPeak) {
          yPeak = pt.equity;
        } else if (yPeak > 0) {
          const ddVal = yPeak - pt.equity;
          const ddPct = (ddVal / yPeak) * 100;
          if (ddVal > yearMaxDdVal) {
            yearMaxDdVal = parseFloat(ddVal.toFixed(2));
          }
          if (ddPct > yearMaxDdPct) {
            yearMaxDdPct = parseFloat(ddPct.toFixed(2));
          }
        }
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
}

/**
 * Computes display CAGR from curve endpoints or falls back to summary CAGR.
 */
export function computeDisplayCagr(result: BacktestResponse | null): number {
  if (!result) return 0;
  const summary = result.summary;
  const initialCap = summary?.initialCapital ?? 0;
  const finalEq = summary?.finalEquity || initialCap;
  const curve = result.equityCurve || [];

  const startDate = curve.length > 0 ? curve[0].date || summary.startDate : summary.startDate;
  const endDate =
    curve.length > 0 ? curve[curve.length - 1].date || summary.endDate : summary.endDate;

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
}

/**
 * Extracts peak equity value and formatted peak date.
 */
export function computePeakEquityInfo(result: BacktestResponse | null): {
  value: number;
  formattedDate: string;
} {
  if (!result) return { value: 0, formattedDate: '' };
  const summary = result.summary;
  const initialCap = summary?.initialCapital ?? 0;
  const curve = result.equityCurve || [];

  let maxEq =
    summary?.peakEquity ||
    (curve.length > 0 ? Math.max(...curve.map(c => c.equity)) : initialCap);
  let maxDate = summary?.peakEquityDate || curve[0]?.date || '';

  if (!summary?.peakEquity && curve.length > 0) {
    maxEq = curve[0]?.equity || 0;
    for (const pt of curve) {
      if (pt.equity > maxEq) {
        maxEq = pt.equity;
        maxDate = pt.date || '';
      }
    }
  }

  return { value: maxEq, formattedDate: formatShortDate(maxDate) };
}

/**
 * Computes human-readable date range label for maximum drawdown.
 */
export function computeMaxDrawdownRangeInfo(result: BacktestResponse | null): string {
  if (!result) return '';
  const summary = result.summary;
  const curve = result.equityCurve || [];

  let peakDate = summary?.maxDrawdownStartDate || '';
  let troughDate = summary?.maxDrawdownEndDate || '';

  if (!peakDate || !troughDate) {
    const initialCap = summary?.initialCapital ?? 0;
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

  const formattedPeak = formatShortDate(peakDate);
  const formattedTrough = formatShortDate(troughDate);

  if (formattedPeak && formattedTrough) {
    if (formattedPeak === formattedTrough) {
      return `on ${formattedPeak}`;
    }
    return `${formattedPeak} – ${formattedTrough}`;
  }
  return formattedPeak ? `from ${formattedPeak}` : formattedTrough ? `at ${formattedTrough}` : '';
}

/**
 * Computes monetary value of the worst drawdown across summary or yearly breakdown.
 */
export function computeDisplayMaxDrawdownValue(
  result: BacktestResponse | null,
  yearReturns: YearReturnRow[],
  peakEquityValue: number
): number {
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

  const peak = peakEquityValue || result.summary.peakEquity || result.summary.initialCapital || 0;
  return ((result.summary.maxDrawdownPct || 0) / 100) * peak;
}

/**
 * Computes supplementary institutional metrics such as Calmar, Beta, underwater duration, and avg buy cost.
 */
export function computePortfolioSimulationMetrics(
  result: BacktestResponse | null,
  displayCagr: number,
  tradingDaysCount: number
): PortfolioSimulationMetrics | null {
  if (!result) return null;
  const curve = result.equityCurve || [];
  const summary = result.summary;

  const calmar =
    summary.calmarRatio !== undefined && summary.calmarRatio !== null
      ? summary.calmarRatio
      : summary.maxDrawdownPct > 0
        ? parseFloat((displayCagr / summary.maxDrawdownPct).toFixed(2))
        : null;

  let maxUnderwater = 0;
  if (curve.length > 0) {
    const currentUnderwaterDates = new Set<string>();
    for (const pt of curve) {
      const dateStr = pt.date
        ? pt.date.includes(' ')
          ? pt.date.split(' ')[0]
          : pt.date.split('T')[0]
        : '';
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
    maxUnderwater = Math.min(tradingDaysCount, summary.maxDrawdownDurationDays);
  }

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

  const cashDragPct = parseFloat(Math.max(0, 100 - summary.marketExposurePct).toFixed(2));

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

  let totalBoughtShares = result.initialInvestment?.qty || 0;
  let totalCost = result.initialInvestment?.invested || 0;
  for (const t of result.trades) {
    if (
      t.action === 'BUY' &&
      (!result.initialInvestment || t.entryPrice !== result.initialInvestment.execPrice)
    ) {
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
      ? parseFloat(
          (curve.reduce((acc, p) => acc + (p.stockClose || p.close || 0), 0) / curve.length).toFixed(
            2
          )
        )
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
}

/**
 * Selects timeline candles for a chosen day, reading constituent-specific series when available.
 */
export function buildDayCandles(
  selectedTab: string,
  timelineRows: TimelineRow[],
  selectedStockSymbol: string,
  stocksData?: Record<string, DailyEquityPoint[]>
): TimelineRow[] {
  if (selectedTab === 'overview') return [];

  if (selectedStockSymbol && stocksData?.[selectedStockSymbol]) {
    const stockPoints = stocksData[selectedStockSymbol];
    return stockPoints
      .filter(r => r.date === selectedTab)
      .map(pt => {
        const open = pt.open ?? pt.close ?? pt.stockClose ?? 0;
        const high = pt.high ?? Math.max(open, pt.close ?? pt.stockClose ?? open);
        const low = pt.low ?? Math.min(open, pt.close ?? pt.stockClose ?? open);
        const close = pt.close ?? pt.stockClose ?? open;
        const qty = pt.heldQty ?? 0;
        const invested = pt.invested ?? qty * close;
        const holdingValue = pt.holdingsValue ?? parseFloat((qty * close).toFixed(2));
        const unrealizedPnl = pt.unrealizedPnl ?? parseFloat((holdingValue - invested).toFixed(2));
        const realizedPnl = pt.realizedPnl ?? 0;
        const totalPnl = pt.totalPnl ?? parseFloat((realizedPnl + unrealizedPnl).toFixed(2));

        return {
          date: pt.date,
          time: pt.time,
          open,
          high,
          low,
          close,
          changePercent: pt.changePercent,
          indicators: pt.indicators,
          volume: (pt as DailyEquityPoint & { volume?: number }).volume,
          invested,
          qty,
          holdingValue,
          equity: pt.equity,
          unrealizedPnl,
          realizedPnl,
          totalPnl,
          action: pt.action,
          actionReason: pt.actionReason,
          conditionMatched: Boolean(pt.conditionMatched || pt.action),
        };
      });
  }

  return timelineRows.filter(r => r.date === selectedTab);
}

