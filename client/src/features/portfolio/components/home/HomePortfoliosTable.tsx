import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  MoreVertical,
  LineChart,
  GripVertical,
} from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent, SensorDescriptor, SensorOptions } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SUMMARY_STATS } from './homeDashboardConfig';
import type { HomeStatsSummary, PortfolioSummaryMap } from './homeDashboardConfig';
import type { HomeConfirmationConfig } from '../../hooks/useHomeDashboardState';
import type { Portfolio, Stock } from '../../hooks/usePortfolioData';

function SortablePortfolioRow({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group/row border-b border-divider hover:bg-surface-hover transition-colors ${
        isDragging ? 'bg-surface shadow-lg relative z-50' : ''
      }`}
    >
      <td
        {...attributes}
        {...listeners}
        className="px-2 py-1.5 w-6 cursor-grab active:cursor-grabbing text-secondary/30 hover:text-secondary transition-opacity bg-surface group-hover/row:bg-surface-hover sticky left-0 z-20"
      >
        <GripVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </td>
      {children}
    </tr>
  );
}

interface HomePortfoliosTableProps {
  portfolios: Portfolio[];
  stocks: Stock[];
  stats: HomeStatsSummary;
  portfolioSummaries: PortfolioSummaryMap;
  totalUniqueStocks: number;
  totalBrokerageAndTax: number;
  summaryOrder: string[];
  visibleStats: Set<string>;
  sortedPortfolioOrder: string[];
  selectedSummaryPortfolioIds: string[] | null;
  setSelectedSummaryPortfolioIds: (ids: string[]) => void;
  isChartVisible: boolean;
  setIsChartVisible: (visible: boolean) => void;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  sensors: SensorDescriptor<SensorOptions>[];
  onPortfolioDragEnd: (event: DragEndEvent) => void;
  fmtCurrency: (value: number) => string;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  menuPosition: { bottom: number; right: number } | null;
  setMenuPosition: (pos: { bottom: number; right: number } | null) => void;
  onRenamePortfolio: (id: string) => void;
  onCopyPortfolio: (id: string) => void;
  onDeletePortfolio: (id: string) => void;
  setConfirmationConfig: (config: HomeConfirmationConfig | null) => void;
  openCreateModal: () => void;
}

/**
 * Renders the summary total row, sortable portfolio rows, and empty-state card on HomeDashboard.
 */
export function HomePortfoliosTable({
  portfolios,
  stocks,
  stats,
  portfolioSummaries,
  totalUniqueStocks,
  totalBrokerageAndTax,
  summaryOrder,
  visibleStats,
  sortedPortfolioOrder,
  selectedSummaryPortfolioIds,
  setSelectedSummaryPortfolioIds,
  isChartVisible,
  setIsChartVisible,
  sortField,
  sortDirection,
  onSort,
  sensors,
  onPortfolioDragEnd,
  fmtCurrency,
  activeMenuId,
  setActiveMenuId,
  menuPosition,
  setMenuPosition,
  onRenamePortfolio,
  onCopyPortfolio,
  onDeletePortfolio,
  setConfirmationConfig,
  openCreateModal,
}: HomePortfoliosTableProps) {
  const navigate = useNavigate();

  const renderTotalCell = (id: string) => {
    if (!visibleStats.has(id)) return null;

    const cellClass = 'px-2 py-2 text-[9px] sm:text-[10px] font-mono text-right whitespace-nowrap';
    switch (id) {
      case 'totalStocks':
        return <td key={id} className={`${cellClass} text-primary font-bold`}>{totalUniqueStocks}</td>;
      case 'maxNetInvested':
        return <td key={id} className={`${cellClass} text-primary font-bold`}>{fmtCurrency(stats.maxNetInvested)}</td>;
      case 'netInvested':
        return <td key={id} className={`${cellClass} text-primary font-bold`}>{fmtCurrency(stats.totalInvestment)}</td>;
      case 'unrealizedPnL':
        return (
          <td key={id} className={`${cellClass} ${stats.totalUnrealizedPnL >= 0 ? 'text-success' : 'text-danger'} font-bold`}>
            {stats.totalUnrealizedPnL >= 0 ? '+' : ''}
            {fmtCurrency(Math.abs(stats.totalUnrealizedPnL))}{' '}
            <span className="text-[8px] sm:text-[9px] font-medium opacity-80">
              ({stats.totalUnrealizedPnL >= 0 ? '+' : ''}
              {stats.totalInvestment > 0
                ? ((stats.totalUnrealizedPnL / stats.totalInvestment) * 100).toFixed(2)
                : '0.00'}
              %)
            </span>
          </td>
        );
      case 'realizedPnL':
        return (
          <td key={id} className={`${cellClass} ${stats.totalRealizedPnL >= 0 ? 'text-success' : 'text-danger'} font-bold`}>
            {stats.totalRealizedPnL >= 0 ? '+' : ''}
            {fmtCurrency(Math.abs(stats.totalRealizedPnL))}
          </td>
        );
      case 'totalDividend':
        return (
          <td key={id} className={`${cellClass} text-primary font-bold`}>
            {fmtCurrency(stats.totalDividend)}{' '}
            <span className="text-[8px] sm:text-[9px] font-medium opacity-80 text-success">
              ({stats.totalInvestment > 0
                ? ((stats.totalDividend / stats.totalInvestment) * 100).toFixed(2)
                : '0.00'}
              %)
            </span>
          </td>
        );
      case 'dayGain':
        return (
          <td key={id} className={`${cellClass} ${stats.totalDayGain >= 0 ? 'text-success' : 'text-danger'} font-bold`}>
            {stats.totalDayGain >= 0 ? '+' : ''}
            {fmtCurrency(Math.abs(stats.totalDayGain || 0))}{' '}
            <span className="text-[8px] sm:text-[9px] font-medium opacity-80">
              ({stats.totalDayGainPercent >= 0 ? '+' : ''}
              {(stats.totalDayGainPercent || 0).toFixed(2)}%)
            </span>
          </td>
        );
      case 'totalPnL':
        return (
          <td key={id} className={`${cellClass} ${stats.totalPnL >= 0 ? 'text-success' : 'text-danger'} font-bold`}>
            {stats.totalPnL >= 0 ? '+' : ''}
            {fmtCurrency(Math.abs(stats.totalPnL))}{' '}
            <span className="text-[8px] sm:text-[9px] font-medium opacity-80">
              ({stats.totalPnLPercent >= 0 ? '+' : ''}
              {(stats.totalPnLPercent || 0).toFixed(2)}%)
            </span>
          </td>
        );
      case 'currentValue':
        return <td key={id} className={`${cellClass} text-primary font-bold`}>{fmtCurrency(stats.totalCurrentValue)}</td>;
      case 'brokerage':
        return <td key={id} className={`${cellClass} text-danger font-bold`}>-{fmtCurrency(totalBrokerageAndTax)}</td>;
      case 'xirr':
        return (
          <td key={id} className={`${cellClass} ${stats.xirr >= 0 ? 'text-success' : 'text-danger'} font-bold`}>
            {stats.xirr >= 0 ? '+' : ''}
            {((stats.xirr || 0) * 100).toFixed(2)}%
          </td>
        );
      default:
        return null;
    }
  };

  const renderTableCell = (value: React.ReactNode, valueClass: string, key: string) => (
    <td key={key} className={`px-2 py-2 text-[9px] sm:text-[10px] font-mono text-right whitespace-nowrap ${valueClass}`}>
      {value}
    </td>
  );

  const renderListStat = (id: string, ps: HomeStatsSummary | undefined, symbolCount: number) => {
    if (!visibleStats.has(id)) return null;
    if (!ps) return <td key={id} className="px-2 py-2 text-right text-secondary">—</td>;

    switch (id) {
      case 'totalStocks':
        return renderTableCell(symbolCount, 'text-primary font-semibold', id);
      case 'maxNetInvested':
        return renderTableCell(fmtCurrency(ps.maxNetInvested), 'text-primary', id);
      case 'netInvested':
        return renderTableCell(fmtCurrency(ps.totalInvestment), 'text-primary', id);
      case 'unrealizedPnL':
        return renderTableCell(
          <span>
            {ps.totalUnrealizedPnL >= 0 ? '+' : ''}
            {fmtCurrency(Math.abs(ps.totalUnrealizedPnL))}{' '}
            <span className="text-[8px] sm:text-[9px] font-medium opacity-80">
              ({ps.totalUnrealizedPnL >= 0 ? '+' : ''}
              {ps.unrealizedPnLPercent.toFixed(2)}%)
            </span>
          </span>,
          ps.totalUnrealizedPnL >= 0 ? 'text-success' : 'text-danger',
          id
        );
      case 'realizedPnL':
        return renderTableCell(
          `${ps.totalRealizedPnL >= 0 ? '+' : ''}${fmtCurrency(Math.abs(ps.totalRealizedPnL))}`,
          ps.totalRealizedPnL >= 0 ? 'text-success' : 'text-danger',
          id
        );
      case 'totalDividend':
        return renderTableCell(
          <span>
            {fmtCurrency(ps.totalDividend)}{' '}
            <span className="text-[8px] sm:text-[9px] font-medium opacity-80">
              ({ps.totalInvestment > 0 ? ((ps.totalDividend / ps.totalInvestment) * 100).toFixed(2) : '0.00'}%)
            </span>
          </span>,
          'text-primary',
          id
        );
      case 'dayGain':
        return renderTableCell(
          <span>
            {ps.totalDayGain >= 0 ? '+' : ''}
            {fmtCurrency(Math.abs(ps.totalDayGain || 0))}{' '}
            <span className="text-[8px] sm:text-[9px] font-medium opacity-80">
              ({ps.totalDayGainPercent >= 0 ? '+' : ''}
              {ps.totalDayGainPercent.toFixed(2)}%)
            </span>
          </span>,
          ps.totalDayGain >= 0 ? 'text-success' : 'text-danger',
          id
        );
      case 'totalPnL':
        return renderTableCell(
          <span>
            {ps.totalPnL >= 0 ? '+' : ''}
            {fmtCurrency(Math.abs(ps.totalPnL))}{' '}
            <span className="text-[8px] sm:text-[9px] font-medium opacity-80">
              ({ps.totalPnLPercent >= 0 ? '+' : ''}
              {ps.totalPnLPercent.toFixed(2)}%)
            </span>
          </span>,
          ps.totalPnL >= 0 ? 'text-success' : 'text-danger',
          id
        );
      case 'currentValue':
        return renderTableCell(fmtCurrency(ps.totalCurrentValue), 'text-primary font-semibold', id);
      case 'brokerage':
        return renderTableCell(
          `-${fmtCurrency((ps.totalBrokerage || 0) + (ps.totalGovtTax || 0))}`,
          'text-danger',
          id
        );
      case 'xirr':
        return renderTableCell(
          `${ps.xirr >= 0 ? '+' : ''}${(ps.xirr * 100).toFixed(2)}%`,
          `font-bold ${ps.xirr >= 0 ? 'text-success' : 'text-danger'}`,
          id
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col mt-4 mb-4">
      {portfolios.length > 0 ? (
        <div className="bg-surface overflow-x-auto rounded-lg border border-divider shadow-sm relative">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-surface sticky top-0 z-40">
              <tr className="border-b border-divider">
                <th className="w-6 px-2 py-1.5 bg-surface z-30 sticky left-0"></th>
                <th
                  className="px-2 py-1.5 text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold text-secondary min-w-[120px] bg-surface cursor-pointer hover:bg-surface-hover transition-colors group z-30 sticky left-6 border-r border-divider"
                  onClick={() => onSort('name')}
                >
                  <div className="flex items-center gap-1 justify-start">
                    <span>Portfolio</span>
                    {sortField === 'name' ? (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" />
                      ) : (
                        <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-tertiary group-hover:text-secondary transition-colors shrink-0 opacity-0 group-hover:opacity-100" />
                    )}
                  </div>
                </th>
                {summaryOrder.map(id => {
                  if (!visibleStats.has(id)) return null;
                  const stat = SUMMARY_STATS.find(s => s.id === id);
                  return (
                    <th
                      key={id}
                      className="px-2 py-1.5 text-[7px] sm:text-[9px] uppercase tracking-wider font-semibold text-secondary bg-surface cursor-pointer hover:bg-surface-hover transition-colors group"
                      onClick={() => onSort(id)}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        <span>{stat?.label}</span>
                        {sortField === id ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" />
                          ) : (
                            <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-tertiary group-hover:text-secondary transition-colors shrink-0 opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="px-2 py-1.5 text-[7px] sm:text-[9px] uppercase tracking-wider font-semibold text-secondary bg-surface text-right">
                  Actions
                </th>
              </tr>
              <tr className="bg-surface-hover border-b-[3px] border-divider shadow-sm">
                <td className="w-6 px-2 py-2 sticky left-0 bg-surface-hover z-30"></td>
                <td className="px-2 py-2 text-[10px] sm:text-[11px] font-semibold text-primary sticky left-6 bg-surface-hover z-30 border-r border-divider">
                  Total
                </td>
                {summaryOrder.map(id => renderTotalCell(id))}
                <td className="px-2 py-2 text-right">
                  <div className="flex items-center justify-end gap-1 relative shrink-0">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const isAlreadyTotal =
                          selectedSummaryPortfolioIds?.length === portfolios.length;
                        if (isChartVisible && isAlreadyTotal) {
                          setIsChartVisible(false);
                        } else {
                          setSelectedSummaryPortfolioIds(portfolios.map(p => p.id));
                          setIsChartVisible(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={`p-1 sm:p-1.5 rounded transition-colors ${
                        isChartVisible && selectedSummaryPortfolioIds?.length === portfolios.length
                          ? 'bg-surface-hover text-primary border border-divider'
                          : 'text-tertiary hover:text-primary hover:bg-surface-hover'
                      }`}
                      title="Show Combined Chart"
                    >
                      <LineChart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <div className="p-1 sm:p-1.5 invisible pointer-events-none">
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                </td>
              </tr>
            </thead>
            <tbody>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onPortfolioDragEnd}
              >
                <SortableContext items={sortedPortfolioOrder} strategy={verticalListSortingStrategy}>
                  {sortedPortfolioOrder
                    .filter(
                      pid =>
                        !selectedSummaryPortfolioIds ||
                        selectedSummaryPortfolioIds.includes(pid)
                    )
                    .map(pid => {
                      const p = portfolios.find(item => item.id === pid);
                      if (!p) return null;

                      const pStocks = stocks.filter(
                        s => s.portfolio_id === p.id && Number(s.entry_price) > 0
                      );
                      const pSymbols = [...new Set(pStocks.map(s => s.symbol))];
                      const ps = portfolioSummaries[p.id];

                      return (
                        <SortablePortfolioRow key={p.id} id={p.id}>
                          <td className="px-2 py-2 min-w-[120px] max-w-[200px] bg-surface group-hover/row:bg-surface-hover sticky left-6 z-20 border-r border-divider">
                            <p
                              className="text-[10px] sm:text-[11px] font-medium text-primary group-hover/row:underline decoration-tertiary underline-offset-2 truncate cursor-pointer"
                              title={p.name}
                              onClick={() => navigate(`/portfolio/${p.id}`)}
                            >
                              {p.name}
                            </p>
                          </td>
                          {summaryOrder.map(id => renderListStat(id, ps, pSymbols.length))}
                          <td className="px-2 py-2 text-right">
                            <div className="flex items-center justify-end gap-1 relative shrink-0">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  const isAlreadyThisPortfolio =
                                    selectedSummaryPortfolioIds?.length === 1 &&
                                    selectedSummaryPortfolioIds[0] === p.id;
                                  if (isChartVisible && isAlreadyThisPortfolio) {
                                    setIsChartVisible(false);
                                  } else {
                                    setSelectedSummaryPortfolioIds([p.id]);
                                    setIsChartVisible(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }}
                                className="p-1 sm:p-1.5 text-tertiary hover:text-primary hover:bg-surface-hover rounded transition-colors"
                                title="Show Chart"
                              >
                                <LineChart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  if (activeMenuId === p.id) {
                                    setActiveMenuId(null);
                                    setMenuPosition(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMenuPosition({
                                      bottom: window.innerHeight - rect.top,
                                      right: window.innerWidth - rect.right,
                                    });
                                    setActiveMenuId(p.id);
                                  }
                                }}
                                className="p-1 sm:p-1.5 text-tertiary hover:text-primary hover:bg-surface-hover rounded transition-colors"
                                title="Options"
                              >
                                <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>

                              {activeMenuId === p.id && menuPosition && (
                                <div
                                  className="fixed w-36 bg-surface border border-divider rounded-lg shadow-xl shadow-black/20 z-[9999] py-1 flex flex-col"
                                  style={{
                                    bottom: `${menuPosition.bottom + 4}px`,
                                    right: `${menuPosition.right}px`,
                                  }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => {
                                      onRenamePortfolio(p.id);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs text-secondary hover:bg-background hover:text-primary transition-colors"
                                  >
                                    Rename
                                  </button>
                                  <button
                                    onClick={() => {
                                      onCopyPortfolio(p.id);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs text-secondary hover:bg-background hover:text-primary transition-colors"
                                  >
                                    Duplicate
                                  </button>
                                  <button
                                    onClick={() => {
                                      setConfirmationConfig({
                                        isOpen: true,
                                        title: 'Delete Portfolio',
                                        message: `Are you sure you want to delete "${p.name}"? This action cannot be undone.`,
                                        confirmText: 'Delete Portfolio',
                                        isDestructive: true,
                                        requireInputToConfirm: p.name,
                                        onConfirm: () => {
                                          onDeletePortfolio(p.id);
                                          setConfirmationConfig(null);
                                        },
                                      });
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs text-danger hover:bg-danger/10 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </SortablePortfolioRow>
                      );
                    })}
                </SortableContext>
              </DndContext>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-surface border border-divider rounded-lg shadow-sm">
          <div className="w-12 h-12 bg-surface-hover rounded-xl flex items-center justify-center mb-4 border border-divider">
            <Briefcase className="w-6 h-6 text-tertiary" />
          </div>
          <p className="text-base font-semibold text-primary mb-1">No active portfolios</p>
          <p className="text-xs text-secondary max-w-sm mb-5">
            Create your first portfolio to start tracking your stocks, corporate actions, and
            investments.
          </p>
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-background hover:opacity-90 transition-opacity rounded-md shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Portfolio</span>
          </button>
        </div>
      )}
    </div>
  );
}

