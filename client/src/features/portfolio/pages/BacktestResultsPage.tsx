import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  Activity,
  Sliders,
  X,
  Coins,
  ChevronLeft,
  ChevronRight,
  Filter,
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
            isOversold ? 'text-emerald-500' : isOverbought ? 'text-amber-500' : 'text-primary'
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
        <span className={`font-mono font-semibold ${num > 0 ? 'text-emerald-500' : num < 0 ? 'text-rose-500' : 'text-primary'}`}>
          {sign}
          {num.toFixed(2)}%
        </span>
      );
    }
    default:
      return <span className="text-secondary">—</span>;
  }
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

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(25);
  const [filterActionsOnly, setFilterActionsOnly] = useState(false);

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
          action: initialInvestment.action || 'Initial Entry',
          actionReason: undefined,
          conditionMatched: false,
        },
      ];
    }

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

      let action = pt.action;
      if (!action) {
        if (idx === 0) {
          action = 'Initial Entry';
        } else if (pt.conditionMatched) {
          action = 'Condition Met';
        }
      }

      const rowDate = pt.date ? (pt.date.includes(' ') ? pt.date.split(' ')[0] : pt.date.split('T')[0]) : '';
      const rowTime = pt.time || (pt.date && pt.date.includes(' ') ? pt.date.split(' ')[1] : undefined);

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
        action,
        actionReason: pt.actionReason,
        conditionMatched: pt.conditionMatched || action === 'Condition Met',
      };
    });
  }, [result, initialInvestment]);

  // Filtered rows (All vs Actions Only)
  const displayedRows = useMemo(() => {
    let rows = timelineRows;
    if (filterActionsOnly) {
      rows = rows.filter((r) => !!r.action);
    }
    return rows;
  }, [timelineRows, filterActionsOnly]);

  const totalPages = useMemo(() => {
    if (pageSize === 'ALL') return 1;
    return Math.max(1, Math.ceil(displayedRows.length / pageSize));
  }, [displayedRows.length, pageSize]);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'ALL') return displayedRows;
    const start = (currentPage - 1) * pageSize;
    return displayedRows.slice(start, start + pageSize);
  }, [displayedRows, currentPage, pageSize]);

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

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {timelineRows.length > 0 && (
          <div
            className={`rounded-xl border p-4 sm:p-5 transition-colors ${
              isDark
                ? 'bg-[#141518] border-zinc-800/80 shadow-lg shadow-black/20'
                : 'bg-white border-gray-200 shadow-xs'
            }`}
          >
            {/* Header with Title and Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-divider">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-lg border ${
                    isDark
                      ? 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  <Coins className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h2
                    className={`text-xs sm:text-sm font-bold tracking-wide uppercase ${
                      isDark ? 'text-zinc-100' : 'text-gray-900'
                    }`}
                  >
                    Simulation Timeline & Actions
                  </h2>
                  <p className={`text-[10px] sm:text-[11px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    Candle data, indicator readings, and condition events ({timelineRows.length} bars)
                    {usedIndicators.length > 0 && (
                      <span className="ml-1.5 opacity-90 font-medium">
                        • Strategy Indicators: {usedIndicators.map((i) => INDICATOR_CONFIG[i]?.label || i).join(', ')}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                {/* Actions Only Filter Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterActionsOnly((prev) => !prev);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${
                    filterActionsOnly
                      ? isDark
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                      : isDark
                      ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                  title="Toggle to view only rows where Initial Entry or Condition Met actions occurred"
                >
                  <Filter className="w-2.5 h-2.5" />
                  <span>{filterActionsOnly ? 'Actions Only' : 'All Dates'}</span>
                  <span className="px-1 py-0.2 rounded text-[9px] bg-black/20 font-bold">
                    {filterActionsOnly ? displayedRows.length : timelineRows.length}
                  </span>
                </button>

                {conditionMetCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] ${
                      isDark
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    Signals: <strong>{conditionMetCount}</strong>
                  </span>
                )}

                {initialInvestment && (
                  <>
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] ${
                        isDark
                          ? 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      Capital: <strong className={isDark ? 'text-zinc-200' : 'text-gray-900'}>{currencySymbol}{initialInvestment.initialCapital.toLocaleString()}</strong>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] ${
                        isDark
                          ? 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      Cash Left: <strong className={isDark ? 'text-zinc-200' : 'text-gray-900'}>{currencySymbol}{initialInvestment.cashRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Table: Date | Open | High | Low | Close | [Strategy Indicators...] | Invested | Qty | Action */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className={`border-b text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider ${
                      isDark
                        ? 'border-zinc-800 text-zinc-400 bg-zinc-900/40'
                        : 'border-gray-200 text-gray-500 bg-gray-50/70'
                    }`}
                  >
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Open</th>
                    <th className="py-2.5 px-3">High</th>
                    <th className="py-2.5 px-3">Low</th>
                    <th className="py-2.5 px-3">Close</th>
                    {usedIndicators.map((ind) => (
                      <th
                        key={ind}
                        className="py-2.5 px-3 text-center whitespace-nowrap"
                        title={INDICATOR_CONFIG[ind]?.tooltip || ind}
                      >
                        {INDICATOR_CONFIG[ind]?.label || ind}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right">Invested</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider font-mono text-xs">
                  {paginatedRows.map((row, idx) => {
                    const isInitial = row.action === 'Initial Entry';
                    const isConditionMet = row.action === 'Condition Met';

                    return (
                      <tr
                        key={`${row.date}-${row.time || idx}`}
                        className={`transition-colors ${
                          isConditionMet
                            ? isDark
                              ? 'bg-amber-500/10 hover:bg-amber-500/15 text-zinc-100 font-medium'
                              : 'bg-amber-50/70 hover:bg-amber-100/70 text-gray-900 font-medium'
                            : isInitial
                            ? isDark
                              ? 'bg-emerald-500/5 hover:bg-emerald-500/10 text-zinc-100'
                              : 'bg-emerald-50/40 hover:bg-emerald-50/70 text-gray-900'
                            : isDark
                            ? 'hover:bg-zinc-800/40 text-zinc-200'
                            : 'hover:bg-gray-50/80 text-gray-800'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-primary whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-secondary whitespace-nowrap">
                          {row.time ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                isDark
                                  ? 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60'
                                  : 'bg-gray-100 text-gray-700 border-gray-200'
                              }`}
                            >
                              {row.time}
                            </span>
                          ) : (
                            <span className="opacity-30">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {currencySymbol}{row.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-500">
                          {currencySymbol}{row.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-rose-500">
                          {currencySymbol}{row.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          {currencySymbol}{row.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        {usedIndicators.map((ind) => (
                          <td key={ind} className="py-2.5 px-3 text-center whitespace-nowrap">
                            {renderIndicatorCell(ind, row, currencySymbol)}
                          </td>
                        ))}
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-500">
                          {currencySymbol}{row.invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-primary">
                          {row.qty.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {isInitial ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase border ${
                                isDark
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              Initial Entry
                            </span>
                          ) : isConditionMet ? (
                            <span
                              title={row.actionReason}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border shadow-2xs ${
                                isDark
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
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

            {/* Footer with Pagination Controls */}
            <div
              className={`mt-3 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] ${
                isDark ? 'border-zinc-800/80 text-zinc-400' : 'border-gray-100 text-gray-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <span>
                  Showing{' '}
                  <strong className={isDark ? 'text-zinc-200' : 'text-gray-800'}>
                    {displayedRows.length === 0
                      ? 0
                      : pageSize === 'ALL'
                      ? `1 to ${displayedRows.length}`
                      : `${(currentPage - 1) * pageSize + 1} to ${Math.min(
                          currentPage * pageSize,
                          displayedRows.length
                        )}`}
                  </strong>{' '}
                  of{' '}
                  <strong className={isDark ? 'text-zinc-200' : 'text-gray-800'}>
                    {displayedRows.length}
                  </strong>{' '}
                  candles {conditionMetCount > 0 && `(${conditionMetCount} condition triggers)`}
                </span>

                {/* Page Size Selector */}
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <span>Rows:</span>
                  {[25, 50, 100, 'ALL'].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setPageSize(size as any);
                        setCurrentPage(1);
                      }}
                      className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        pageSize === size
                          ? isDark
                            ? 'bg-zinc-800 text-zinc-100 border-zinc-700 font-bold'
                            : 'bg-gray-200 text-gray-900 border-gray-300 font-bold'
                          : isDark
                          ? 'text-zinc-500 border-transparent hover:text-zinc-300'
                          : 'text-gray-500 border-transparent hover:text-gray-800'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prev / Next Pagination */}
              {totalPages > 1 && pageSize !== 'ALL' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={`p-1 rounded border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                      isDark
                        ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="font-mono text-[10px]">
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={`p-1 rounded border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                      isDark
                        ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

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
