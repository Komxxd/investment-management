import { Calendar, BarChart3 } from 'lucide-react';
import type { TradingDayItem } from './backtestResultsUtils';

interface BacktestTradingDaysSidebarProps {
  isDark: boolean;
  selectedTab: string;
  onSelectTab: (tab: string) => void;
  groupedDays: Record<string, TradingDayItem[]>;
  tradingDaysCount: number;
  currencySymbol: string;
}

/**
 * Renders the scrollable sidebar listing Analytics Overview and month-grouped trading days.
 */
export function BacktestTradingDaysSidebar({
  isDark,
  selectedTab,
  onSelectTab,
  groupedDays,
  tradingDaysCount,
  currencySymbol,
}: BacktestTradingDaysSidebarProps) {
  return (
    <aside
      className={`w-52 sm:w-60 shrink-0 border-r flex flex-col h-full overflow-hidden select-none ${
        isDark ? 'bg-[#101114] border-zinc-800' : 'bg-gray-50/70 border-gray-200'
      }`}
    >
      <div className="p-3 border-b border-divider shrink-0">
        <div className="flex items-center gap-1.5 px-2 pb-2 text-[10px] font-bold tracking-wider text-secondary uppercase">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>TRADING DAYS</span>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('overview')}
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

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-3 pb-24">
        {Object.entries(groupedDays).map(([groupKey, days]) => (
          <div key={groupKey} className="space-y-0.5">
            <div className="px-2 pt-1 pb-1 text-[9px] sm:text-[10px] font-bold tracking-wider text-secondary uppercase">
              {groupKey}
            </div>
            {days.map(day => {
              const isSelected = selectedTab === day.dateStr;
              const isPositive = day.totalPnl > 0;
              const isNegative = day.totalPnl < 0;

              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => onSelectTab(day.dateStr)}
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
                      isPositive
                        ? 'text-success'
                        : isNegative
                          ? 'text-danger'
                          : 'text-secondary opacity-70'
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

        {tradingDaysCount === 0 && (
          <div className="p-4 text-center text-secondary text-xs">
            No trading days available.
          </div>
        )}
      </div>
    </aside>
  );
}

