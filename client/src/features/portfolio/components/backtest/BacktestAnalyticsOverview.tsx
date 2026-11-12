import { CalendarDays, Activity, TrendingUp, ShieldAlert } from 'lucide-react';
import type { BacktestResponse } from '../../services/backtestService';
import type { PortfolioSimulationMetrics, YearReturnRow } from './backtestResultsUtils';

interface BacktestAnalyticsOverviewProps {
  isDark: boolean;
  result: BacktestResponse;
  yearReturns: YearReturnRow[];
  displayCagr: number;
  hasMode: boolean;
  peakEquityInfo: { value: number; formattedDate: string };
  maxDrawdownRangeInfo: string;
  displayMaxDrawdownValue: number;
  portfolioMetrics: PortfolioSimulationMetrics | null;
  tradingDaysCount: number;
  currencySymbol: string;
}

/**
 * Renders the Analytics Overview pane with Year-wise Returns and Capital & Drawdown cards.
 */
export function BacktestAnalyticsOverview({
  isDark,
  result,
  yearReturns,
  displayCagr,
  hasMode,
  peakEquityInfo,
  maxDrawdownRangeInfo,
  displayMaxDrawdownValue,
  portfolioMetrics,
  tradingDaysCount,
  currencySymbol,
}: BacktestAnalyticsOverviewProps) {
  return (
    <div className="p-4 sm:p-6 space-y-6">
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
              {yearReturns.map(yr => {
                const isTotalPos = yr.totalPnl >= 0;
                return (
                  <tr key={yr.year} className={isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50'}>
                    <td className="py-2.5 px-3 text-left font-bold text-primary">{yr.year}</td>
                    {yr.months.map((m, mIdx) => (
                      <td key={mIdx} className="py-2.5 px-2 tabular-nums text-[11px]">
                        {m !== null ? (
                          <span className={`font-semibold ${m.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
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

      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-primary">
            Strategy Performance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  {result.summary.netProfit.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`text-[10px] ml-1.5 font-mono ${
                    result.summary.totalReturnPct >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  ({result.summary.totalReturnPct >= 0 ? '+' : ''}
                  {result.summary.totalReturnPct.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-secondary">Strategy CAGR</span>
              <span
                className={`font-mono font-bold ${
                  displayCagr >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {displayCagr >= 0 ? '+' : ''}
                {displayCagr.toFixed(2)}%
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-divider">
              <span className="text-secondary">
                {hasMode ? 'Initial Capital' : 'Total Capital Invested'}
              </span>
              <span className="font-mono text-primary font-semibold">
                {currencySymbol}
                {(result.summary.initialCapital ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-secondary">Portfolio Equity</span>
              <span className="font-mono text-primary font-bold">
                {currencySymbol}
                {result.summary.finalEquity.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-secondary">Peak Equity</span>
              <div className="text-right">
                <span className="font-mono text-primary font-bold">
                  {currencySymbol}
                  {peakEquityInfo.value.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                {peakEquityInfo.formattedDate && (
                  <div className={`text-[10px] font-mono ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    on {peakEquityInfo.formattedDate}
                  </div>
                )}
              </div>
            </div>
          </div>

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
                      (-{currencySymbol}
                      {Math.round(displayMaxDrawdownValue).toLocaleString()})
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
                {portfolioMetrics?.maxUnderwaterDays || 0}{' '}
                {portfolioMetrics?.maxUnderwaterDays === 1 ? 'day' : 'days'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-divider">
              <span className="text-secondary">Effective Avg Buy Price</span>
              <div className="text-right">
                <span className="font-mono font-bold text-primary">
                  {portfolioMetrics?.effectiveAvgPrice !== null &&
                  portfolioMetrics?.effectiveAvgPrice !== undefined
                    ? `${currencySymbol}${portfolioMetrics.effectiveAvgPrice.toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}`
                    : '—'}
                </span>
                {portfolioMetrics?.avgMarketPrice && (
                  <div className="text-[10px] text-secondary">
                    vs Avg Close {currencySymbol}
                    {portfolioMetrics.avgMarketPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-secondary">Trading Days</span>
              <span className="font-mono font-bold text-primary">{tradingDaysCount} days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

