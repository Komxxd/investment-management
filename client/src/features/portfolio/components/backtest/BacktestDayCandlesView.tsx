import type { RefObject } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { IndicatorType } from '../../utils/strategyConfig';
import { BacktestIndicatorCell } from './BacktestIndicatorCell';
import {
  INDICATOR_CONFIG,
  type TimelineRow,
  type TradingDayItem,
} from './backtestResultsUtils';

interface BacktestDayCandlesViewProps {
  isDark: boolean;
  selectedTab: string;
  activeDay: TradingDayItem | null;
  resultSymbol: string;
  availablePortfolioStocks: string[];
  selectedStockSymbol: string;
  onSelectStockSymbol: (symbol: string) => void;
  isStockDropdownOpen: boolean;
  setIsStockDropdownOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  stockDropdownRef: RefObject<HTMLDivElement | null>;
  dayCandles: TimelineRow[];
  usedIndicators: IndicatorType[];
  currencySymbol: string;
}

/**
 * Renders the single-day candle breakdown toolbar, stock selector, and OHLCV/indicator table.
 */
export function BacktestDayCandlesView({
  isDark,
  selectedTab,
  activeDay,
  resultSymbol,
  availablePortfolioStocks,
  selectedStockSymbol,
  onSelectStockSymbol,
  isStockDropdownOpen,
  setIsStockDropdownOpen,
  stockDropdownRef,
  dayCandles,
  usedIndicators,
  currencySymbol,
}: BacktestDayCandlesViewProps) {
  const stockLastRow = dayCandles.length > 0 ? dayCandles[dayCandles.length - 1] : null;
  const pnlValue =
    activeDay && selectedStockSymbol && stockLastRow
      ? stockLastRow.totalPnl
      : activeDay?.totalPnl ?? 0;

  return (
    <div className="w-full flex flex-col min-w-full">
      <div
        className={`border-b px-4 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3 transition-colors ${
          isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-gray-50/80 border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className={`text-xs sm:text-sm font-bold tracking-wide uppercase ${
                isDark ? 'text-zinc-100' : 'text-gray-900'
              }`}
            >
              Market Data & Actions: {activeDay?.dateStr || selectedTab}
            </h2>
            <span
              className={`text-[11px] font-mono font-medium ${
                isDark ? 'text-zinc-400' : 'text-gray-500'
              }`}
            >
              {resultSymbol}
            </span>
          </div>

          {availablePortfolioStocks.length > 0 && (
            <div className="relative inline-block" ref={stockDropdownRef}>
              <button
                type="button"
                onClick={() => setIsStockDropdownOpen(prev => !prev)}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold font-mono border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-zinc-800/90 hover:bg-zinc-700/90 border-zinc-700 text-zinc-100 shadow-sm'
                    : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-800 shadow-xs'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{selectedStockSymbol || 'Select Stock'}</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-secondary transition-transform duration-200 ${
                    isStockDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isStockDropdownOpen && (
                <div
                  className={`absolute left-0 top-full mt-1.5 min-w-[190px] rounded-xl border shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                      : 'bg-white border-gray-200 text-gray-800'
                  }`}
                >
                  <div
                    className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b ${
                      isDark ? 'border-zinc-800 text-zinc-400' : 'border-gray-100 text-gray-500'
                    }`}
                  >
                    Stocks in Portfolio ({availablePortfolioStocks.length})
                  </div>
                  <div className="max-h-56 overflow-y-auto py-0.5">
                    {availablePortfolioStocks.map(sym => {
                      const isSelected = selectedStockSymbol === sym;
                      return (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => {
                            onSelectStockSymbol(sym);
                            setIsStockDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between gap-2 font-mono transition-colors cursor-pointer ${
                            isSelected
                              ? isDark
                                ? 'bg-primary/15 text-primary font-bold'
                                : 'bg-primary/10 text-primary font-bold'
                              : isDark
                                ? 'hover:bg-zinc-800/80 text-zinc-300'
                                : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-primary' : 'bg-transparent'
                              }`}
                            />
                            <span>{sym}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activeDay && (
            <div className="text-right">
              <div
                className={`text-[9px] uppercase font-semibold tracking-wider ${
                  isDark ? 'text-zinc-400' : 'text-gray-500'
                }`}
              >
                {selectedStockSymbol ? `${selectedStockSymbol} Total P&L` : 'PnL'}
              </div>
              <div className="flex items-center justify-end font-mono text-xs font-bold">
                <span
                  className={
                    pnlValue > 0
                      ? 'text-success'
                      : pnlValue < 0
                        ? 'text-danger'
                        : 'text-secondary opacity-70'
                  }
                >
                  {pnlValue > 0 ? '+' : pnlValue < 0 ? '-' : ''}
                  {currencySymbol}
                  {Math.abs(pnlValue).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

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
              {usedIndicators.map(ind => (
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
              <th
                className="py-2.5 px-3 font-medium text-right whitespace-nowrap"
                title="Current market value of held shares (Qty × Close)"
              >
                Holding Value
              </th>
              <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Unrealized P&L</th>
              <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Realized P&L</th>
              <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Total P&L</th>
              <th className="py-2.5 px-4 font-medium text-left">Action</th>
            </tr>
          </thead>
          <tbody className={`divide-y font-mono text-xs ${isDark ? 'divide-zinc-800/40' : 'divide-gray-100'}`}>
            {dayCandles.length === 0 ? (
              <tr>
                <td colSpan={13 + usedIndicators.length} className="py-12 text-center text-xs text-secondary">
                  No market data or actions found for {selectedStockSymbol || 'this portfolio'} on{' '}
                  {activeDay?.dateStr || selectedTab}.
                </td>
              </tr>
            ) : (
              dayCandles.map((row, idx) => {
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
                      {row.open.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium text-success">
                      {row.high.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium text-danger">
                      {row.low.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-primary">
                      {row.close.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    {usedIndicators.map(ind => (
                      <td key={ind} className="py-2 px-3 text-center whitespace-nowrap">
                        <BacktestIndicatorCell type={ind} data={row} currencySymbol={currencySymbol} />
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-success whitespace-nowrap">
                      {currencySymbol}
                      {row.invested.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-primary whitespace-nowrap">
                      {row.qty.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-primary whitespace-nowrap">
                      {currencySymbol}
                      {row.holdingValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold whitespace-nowrap">
                      <span
                        className={
                          row.unrealizedPnl > 0
                            ? 'text-success'
                            : row.unrealizedPnl < 0
                              ? 'text-danger'
                              : 'text-secondary opacity-70'
                        }
                      >
                        {row.unrealizedPnl > 0 ? '+' : row.unrealizedPnl < 0 ? '-' : ''}
                        {currencySymbol}
                        {Math.abs(row.unrealizedPnl).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold whitespace-nowrap">
                      <span
                        className={
                          row.realizedPnl > 0
                            ? 'text-success'
                            : row.realizedPnl < 0
                              ? 'text-danger'
                              : 'text-secondary opacity-70'
                        }
                      >
                        {row.realizedPnl > 0 ? '+' : row.realizedPnl < 0 ? '-' : ''}
                        {currencySymbol}
                        {Math.abs(row.realizedPnl).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold whitespace-nowrap">
                      <span
                        className={
                          row.totalPnl > 0
                            ? 'text-success'
                            : row.totalPnl < 0
                              ? 'text-danger'
                              : 'text-secondary opacity-70'
                        }
                      >
                        {row.totalPnl > 0 ? '+' : row.totalPnl < 0 ? '-' : ''}
                        {currencySymbol}
                        {Math.abs(row.totalPnl).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-left whitespace-nowrap">
                      {isInitial ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase border bg-success/10 text-success border-success/25">
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

