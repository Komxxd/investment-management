import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Columns } from 'lucide-react';
import { ALL_SUMMARY_STATS } from './dashboardConfig';
import { SortableChecklistItem, SortableStatCard } from './SortablePrimitives';

interface PortfolioSummaryCardsProps {
  sensors: SensorDescriptor<SensorOptions>[];
  activeSummaryStatsOrder: string[];
  activeVisibleSummaryStats: Set<string>;
  onDragEnd: (event: DragEndEvent) => void;
  onToggleStat: (id: string) => void;
  onResetStats: () => void;
  onApplyLayoutToAll: () => void;
  currencySymbol: string;
  totalStocksCount: number;
  maxNetInvested: number;
  totalInvestment: number;
  totalCurrentValue: number;
  totalUnrealizedPnL: number;
  unrealizedPnLPercent: number;
  totalRealizedPnL: number;
  portfolioRealizedCostBasis: number;
  portfolioRealizedPct: number;
  portfolioTotalDividend: number;
  portfolioTotalBrokerage: number;
  portfolioTotalGovtTax: number;
  totalPnL: number;
  totalPnLPercent: number;
  portfolioTotalDayGain: number;
  portfolioDayGainPct: number;
  portfolioXIRR: number;
}

const fmtStatNumber = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Draggable horizontal bar of portfolio summary KPI cards plus its visibility/order customization popover.
 */
export const PortfolioSummaryCards: React.FC<PortfolioSummaryCardsProps> = ({
  sensors,
  activeSummaryStatsOrder,
  activeVisibleSummaryStats,
  onDragEnd,
  onToggleStat,
  onResetStats,
  onApplyLayoutToAll,
  currencySymbol,
  totalStocksCount,
  maxNetInvested,
  totalInvestment,
  totalCurrentValue,
  totalUnrealizedPnL,
  unrealizedPnLPercent,
  totalRealizedPnL,
  portfolioRealizedCostBasis,
  portfolioRealizedPct,
  portfolioTotalDividend,
  portfolioTotalBrokerage,
  portfolioTotalGovtTax,
  totalPnL,
  totalPnLPercent,
  portfolioTotalDayGain,
  portfolioDayGainPct,
  portfolioXIRR,
}) => {
  const [isSummaryDropdownOpen, setIsSummaryDropdownOpen] = useState(false);

  const renderStatCard = (id: string) => {
    if (!activeVisibleSummaryStats.has(id)) return null;

    const totalCharges = portfolioTotalBrokerage + portfolioTotalGovtTax;
    const dividendPct = totalInvestment > 0 ? ((portfolioTotalDividend / totalInvestment) * 100).toFixed(2) : '0.00';

    let content: React.ReactNode;
    switch (id) {
      case 'totalStocks':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span>Total Stocks</span>
            </div>
            <div className="text-[10px] lg:text-xs font-bold text-primary">{totalStocksCount}</div>
          </div>
        );
        break;
      case 'maxNetInvested':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span>Max Invested</span>
            </div>
            <div className="text-[10px] lg:text-xs font-bold text-primary whitespace-nowrap" title={`${currencySymbol}${fmtStatNumber(maxNetInvested)}`}>
              {currencySymbol}{fmtStatNumber(maxNetInvested)}
            </div>
          </div>
        );
        break;
      case 'netInvested':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span>Net Invested</span>
            </div>
            <div className="text-[10px] lg:text-xs font-bold text-primary whitespace-nowrap" title={`${currencySymbol}${fmtStatNumber(totalInvestment)}`}>
              {currencySymbol}{fmtStatNumber(totalInvestment)}
            </div>
          </div>
        );
        break;
      case 'currentValue':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span>Current Value</span>
            </div>
            <div className="text-[10px] lg:text-xs font-bold text-primary whitespace-nowrap" title={`${currencySymbol}${fmtStatNumber(totalCurrentValue)}`}>
              {currencySymbol}{fmtStatNumber(totalCurrentValue)}
            </div>
          </div>
        );
        break;
      case 'unrealizedPnL':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span className="whitespace-nowrap">
                Unrealized PnL{' '}
                <span className={unrealizedPnLPercent >= 0 ? 'text-success' : 'text-danger'}>
                  ({unrealizedPnLPercent >= 0 ? '+' : ''}{unrealizedPnLPercent.toFixed(2)}%)
                </span>
              </span>
            </div>
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap ${totalUnrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`} title={`${currencySymbol}${fmtStatNumber(totalUnrealizedPnL)}`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''}{currencySymbol}{fmtStatNumber(totalUnrealizedPnL)}
            </div>
          </div>
        );
        break;
      case 'realizedPnL':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span className="whitespace-nowrap">
                Realized PnL{' '}
                {portfolioRealizedCostBasis > 0 && (
                  <span className={portfolioRealizedPct >= 0 ? 'text-success' : 'text-danger'}>
                    ({portfolioRealizedPct >= 0 ? '+' : ''}{portfolioRealizedPct.toFixed(2)}%)
                  </span>
                )}
              </span>
            </div>
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap ${totalRealizedPnL >= 0 ? 'text-success' : 'text-danger'}`} title={`${currencySymbol}${fmtStatNumber(totalRealizedPnL)}`}>
              {totalRealizedPnL >= 0 ? '+' : ''}{currencySymbol}{fmtStatNumber(totalRealizedPnL)}
            </div>
          </div>
        );
        break;
      case 'totalDividend':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span className="whitespace-nowrap">
                Dividend{' '}
                <span className="text-success">
                  ({dividendPct}%)
                </span>
              </span>
            </div>
            <div className="text-[10px] lg:text-xs font-bold whitespace-nowrap text-primary" title={`${currencySymbol}${fmtStatNumber(portfolioTotalDividend)}`}>
              {currencySymbol}{fmtStatNumber(portfolioTotalDividend)}
            </div>
          </div>
        );
        break;
      case 'brokerage':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span>Brokerage & Tax</span>
            </div>
            <div className="text-[10px] lg:text-xs font-bold whitespace-nowrap text-danger" title={`${currencySymbol}${fmtStatNumber(totalCharges)}`}>
              -{currencySymbol}{fmtStatNumber(totalCharges)}
            </div>
          </div>
        );
        break;
      case 'totalPnL':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span className="whitespace-nowrap">
                Total PnL{' '}
                <span className={totalPnLPercent >= 0 ? 'text-success' : 'text-danger'}>
                  ({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                </span>
              </span>
            </div>
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap ${totalPnL >= 0 ? 'text-success' : 'text-danger'}`} title={`${currencySymbol}${fmtStatNumber(totalPnL)}`}>
              {totalPnL >= 0 ? '+' : ''}{currencySymbol}{fmtStatNumber(totalPnL)}
            </div>
          </div>
        );
        break;
      case 'dayGain':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span className="whitespace-nowrap">
                Day Gain{' '}
                <span className={portfolioDayGainPct >= 0 ? 'text-success' : 'text-danger'}>
                  ({portfolioDayGainPct >= 0 ? '+' : ''}{portfolioDayGainPct.toFixed(2)}%)
                </span>
              </span>
            </div>
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap ${portfolioTotalDayGain >= 0 ? 'text-success' : 'text-danger'}`} title={`${currencySymbol}${fmtStatNumber(portfolioTotalDayGain)}`}>
              {portfolioTotalDayGain >= 0 ? '+' : ''}{currencySymbol}{fmtStatNumber(portfolioTotalDayGain)}
            </div>
          </div>
        );
        break;
      case 'xirr':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span>XIRR</span>
            </div>
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap ${portfolioXIRR >= 0 ? 'text-success' : 'text-danger'}`} title={`${(portfolioXIRR * 100).toFixed(2)}%`}>
              {portfolioXIRR >= 0 ? '+' : ''}{(portfolioXIRR * 100).toFixed(2)}%
            </div>
          </div>
        );
        break;
      default:
        return null;
    }

    return (
      <SortableStatCard id={id} key={id}>
        {content}
      </SortableStatCard>
    );
  };

  return (
    <div className="flex gap-2 mb-2 md:mb-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={activeSummaryStatsOrder.filter(id => activeVisibleSummaryStats.has(id))} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto xl:overflow-x-hidden no-scrollbar pb-1 xl:pb-0 [&>div]:min-w-[115px] xl:[&>div]:min-w-0 [&>div]:flex-1">
            {activeSummaryStatsOrder.map(id => renderStatCard(id))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="relative shrink-0 flex">
        <button
          onClick={() => setIsSummaryDropdownOpen(!isSummaryDropdownOpen)}
          className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 self-center bg-background hover:bg-surface-hover border border-divider rounded text-secondary hover:text-primary transition-colors"
          title="Customize Summary"
        >
          <Columns className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        {isSummaryDropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsSummaryDropdownOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-divider rounded-lg shadow-2xl shadow-black/50 z-50 py-1 max-h-64 overflow-y-auto">
              <div className="border-b border-divider p-1 mb-0.5 space-y-0.5">
                <button
                  onClick={() => {
                    onApplyLayoutToAll();
                    setIsSummaryDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-center px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-blue-400 hover:text-blue-800 hover:bg-blue-500/10 rounded transition-colors"
                >
                  Apply to All Portfolios
                </button>
                <button
                  onClick={() => {
                    onResetStats();
                    setIsSummaryDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-center px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-secondary hover:text-secondary hover:bg-background rounded transition-colors"
                >
                  Reset to Default
                </button>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext items={activeSummaryStatsOrder} strategy={verticalListSortingStrategy}>
                  {activeSummaryStatsOrder.map(id => {
                    const stat = ALL_SUMMARY_STATS.find(s => s.id === id);
                    if (!stat) return null;
                    return (
                      <SortableChecklistItem
                        key={stat.id}
                        item={stat}
                        isVisible={activeVisibleSummaryStats.has(stat.id)}
                        onToggle={onToggleStat}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
