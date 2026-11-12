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
import {
  Activity,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Columns,
  Download,
  FilterX,
  Info,
  MoreVertical,
  Sliders,
  Trash2,
} from 'lucide-react';
import { AssetSearch } from '../../../stocks/components/AssetSearch';
import type { IndicatorConfig } from '../AddIndicatorsModal';
import { ALL_COLUMNS, type DailyExecutionEntry } from './dashboardConfig';
import type { IndicatorsMap, LivePricesMap, SymbolGroup } from './dashboardTypes';
import { SortableChecklistItem, SortableHeaderCell } from './SortablePrimitives';
import { HoldingExpandedFifoRow } from './HoldingExpandedFifoRow';
import {
  renderHoldingBodyCell,
  renderTotalRowCell,
  type PortfolioTotalsSummary,
} from './HoldingsCells';
import type { StockStrategyStatus } from '../../utils/strategyEvaluator';
import type { ExecuteStrategySignalHandler } from '../../utils/portfolioSorting';

interface HoldingsTableProps {
  activePortfolioId: string;
  sensors: SensorDescriptor<SensorOptions>[];
  pricesLoading: boolean;
  activeSymbols: string[];
  livePrices: LivePricesMap;
  symbolGroupsCount: number;
  filteredSymbolGroups: SymbolGroup[];
  totals: PortfolioTotalsSummary;
  currencySymbol: string;
  fmtCurrency: (amount: number, currency?: string) => string;
  formatCurrencyCompact: (amount: number, currency?: string) => string;
  filterType: 'open' | 'closed' | 'all';
  setFilterType: (type: 'open' | 'closed' | 'all') => void;
  searchSelectedSymbols: string[];
  setSearchSelectedSymbols: (symbols: string[]) => void;
  sortField: string | null;
  setSortField: (field: string | null) => void;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  expandedSymbols: Set<string>;
  setExpandedSymbols: React.Dispatch<React.SetStateAction<Set<string>>>;
  onToggleSymbol: (symbol: string) => void;
  visibleColumns: Set<string>;
  activeColumnOrder: string[];
  activeColumnWidths: Record<string, number>;
  resizingColId?: string;
  onResizeStart: (e: React.MouseEvent, id: string, currentWidth: number) => void;
  onToggleColumn: (id: string) => void;
  onResetColumns: () => void;
  onApplyColumnLayoutToAll: () => void;
  onColumnDragEnd: (event: DragEndEvent) => void;
  indicators: IndicatorsMap;
  indicatorsLoading: boolean;
  indicatorConfig: IndicatorConfig;
  todayExecutions: Record<string, DailyExecutionEntry>;
  executingSignalSymbol: string | null;
  getStockStrategyEvaluation: (symbol: string) => StockStrategyStatus;
  onExecuteStrategySignal: ExecuteStrategySignalHandler;
  onOpenPortfolioInfo: () => void;
  onOpenAddIndicators: () => void;
  onOpenStrategyBuilder: () => void;
  onBuyAsset: (portfolioId: string, symbol?: string, price?: number) => void;
  onSellAsset: (portfolioId: string, symbol?: string, price?: number) => void;
  onOpenRebalance: () => void;
  onOpenCorporateAction: (type: 'bonus' | 'split' | 'dividend') => void;
  onOpenCorporateActionsViewer: (symbol: string) => void;
  onOpenStrategyLogs: (symbol: string) => void;
  onNavigateStock: (symbol: string) => void;
  onExportExcel: () => void;
  onEditStock: (id: string) => void;
  onEditSoldStock: (id: string) => void;
  onDeleteStock: (id: string) => void;
  onDeleteSoldStock: (id: string) => void;
  onDeleteAsset: (symbol: string) => void;
}

const getColumnHeaderLabel = (colId: string, defaultLabel: string, indicatorConfig: IndicatorConfig) => {
  if (colId === 'bollinger') return `Bollinger (${indicatorConfig.bbPeriod}, ${indicatorConfig.bbStdDev})`;
  if (colId === 'macd') return `MACD (${indicatorConfig.macdFastPeriod}, ${indicatorConfig.macdSlowPeriod}, ${indicatorConfig.macdSignalPeriod})`;
  if (colId === 'rsi') return `RSI (${indicatorConfig.rsiPeriod})`;
  return defaultLabel;
};

const getColumnHeaderWidth = (colId: string, activeColumnWidths: Record<string, number>) => {
  if (colId === 'strategy') return Math.max(activeColumnWidths[colId] || 0, 215);
  if (colId === 'bollinger') return Math.max(activeColumnWidths[colId] || 0, 175);
  if (colId === 'macd') return Math.max(activeColumnWidths[colId] || 0, 125);
  return activeColumnWidths[colId] || 100;
};

/**
 * Filterable, sortable, column-resizable portfolio holdings table with expandable FIFO lots.
 */
export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  activePortfolioId,
  sensors,
  pricesLoading,
  activeSymbols,
  livePrices,
  symbolGroupsCount,
  filteredSymbolGroups,
  totals,
  currencySymbol,
  fmtCurrency,
  formatCurrencyCompact,
  filterType,
  setFilterType,
  searchSelectedSymbols,
  setSearchSelectedSymbols,
  sortField,
  setSortField,
  sortDirection,
  onSort,
  expandedSymbols,
  setExpandedSymbols,
  onToggleSymbol,
  visibleColumns,
  activeColumnOrder,
  activeColumnWidths,
  resizingColId,
  onResizeStart,
  onToggleColumn,
  onResetColumns,
  onApplyColumnLayoutToAll,
  onColumnDragEnd,
  indicators,
  indicatorsLoading,
  indicatorConfig,
  todayExecutions,
  executingSignalSymbol,
  getStockStrategyEvaluation,
  onExecuteStrategySignal,
  onOpenPortfolioInfo,
  onOpenAddIndicators,
  onOpenStrategyBuilder,
  onBuyAsset,
  onSellAsset,
  onOpenRebalance,
  onOpenCorporateAction,
  onOpenCorporateActionsViewer,
  onOpenStrategyLogs,
  onNavigateStock,
  onExportExcel,
  onEditStock,
  onEditSoldStock,
  onDeleteStock,
  onDeleteSoldStock,
  onDeleteAsset,
}) => {
  const [isColumnsDropdownOpen, setIsColumnsDropdownOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const orderedNonSymbolColumns = activeColumnOrder.filter(id => id !== 'symbol');

  return (
    <div className="bg-surface border border-divider rounded-lg flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-divider flex flex-wrap justify-between items-center gap-2 bg-surface shrink-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base text-primary">Assets</h3>
            <button
              onClick={onOpenPortfolioInfo}
              className="text-tertiary hover:text-blue-500 transition-colors"
              title="View Corporate Actions Timeline"
            >
              <Info className="w-4 h-4" />
            </button>
            {pricesLoading && (
              <div className="w-3.5 h-3.5 border-2 border-divider border-t-zinc-900 rounded-full animate-spin" title="Updating live prices..." />
            )}
          </div>
          <div className="flex bg-surface-hover p-0.5 rounded-lg border border-divider">
            {(['open', 'closed', 'all'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 text-[10px] font-medium rounded-md capitalize transition-colors ${
                  filterType === type ? 'bg-surface text-primary ' : 'text-secondary hover:text-secondary'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <AssetSearch
            availableAssets={activeSymbols.map(sym => ({ symbol: sym, name: livePrices[sym]?.name || '' }))}
            selectedSymbols={searchSelectedSymbols}
            onChange={setSearchSelectedSymbols}
          />

          {(filterType !== 'open' || sortField !== null || searchSelectedSymbols.length > 0) && (
            <button
              onClick={() => {
                setFilterType('open');
                setSortField(null);
                setSearchSelectedSymbols([]);
              }}
              className="flex items-center gap-1 px-2 py-1 bg-surface border border-divider rounded-md  text-[10px] font-medium text-secondary hover:text-primary transition-colors"
            >
              <FilterX className="w-3 h-3" />
              Clear
            </button>
          )}

          <button
            onClick={onOpenAddIndicators}
            className="flex items-center gap-1 px-2 py-1 bg-surface border border-divider rounded-md text-[10px] font-medium text-secondary hover:text-primary transition-colors"
            title="Technical Indicators (50 DMA, 200 DMA, RSI 14)"
          >
            <Activity className="w-3 h-3" />
            <span>Add Indicators</span>
          </button>

          <button
            onClick={onOpenStrategyBuilder}
            className="flex items-center gap-1 px-2 py-1 bg-surface border border-divider rounded-md text-[10px] font-medium text-secondary hover:text-primary transition-colors cursor-pointer"
            title="Strategy Builder"
          >
            <Sliders className="w-3 h-3" />
            <span>Add Strategy</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setIsColumnsDropdownOpen(!isColumnsDropdownOpen)}
              className="flex items-center gap-1 px-2 py-1 bg-surface border border-divider rounded-md text-[10px] font-medium text-secondary hover:text-primary transition-colors"
            >
              <Columns className="w-3 h-3" />
              Columns
            </button>

            {isColumnsDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsColumnsDropdownOpen(false)} />
                <div className="absolute left-0 mt-1 w-48 bg-surface border border-divider rounded-lg shadow-2xl shadow-black/50 shadow-black/40 z-50 py-1 max-h-64 overflow-y-auto">
                  <div className="border-b border-divider p-1 mb-0.5 space-y-0.5">
                    <button
                      onClick={() => {
                        onApplyColumnLayoutToAll();
                        setIsColumnsDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-center px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-blue-400 hover:text-blue-800 hover:bg-blue-500/10 rounded transition-colors"
                    >
                      Apply to All Portfolios
                    </button>
                    <button
                      onClick={() => {
                        onResetColumns();
                        setIsColumnsDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-center px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-secondary hover:text-secondary hover:bg-background rounded transition-colors"
                    >
                      Reset to Default
                    </button>
                  </div>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onColumnDragEnd}
                  >
                    <SortableContext items={activeColumnOrder} strategy={verticalListSortingStrategy}>
                      {activeColumnOrder.map(colId => {
                        const col = ALL_COLUMNS.find(c => c.id === colId);
                        if (!col) return null;
                        return (
                          <SortableChecklistItem
                            key={col.id}
                            item={col}
                            isVisible={visibleColumns.has(col.id)}
                            onToggle={onToggleColumn}
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

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => onBuyAsset(activePortfolioId)}
            className="text-xs font-medium text-secondary hover:text-primary transition-colors"
          >
            + Buy Asset
          </button>
          <button
            onClick={() => onSellAsset(activePortfolioId)}
            className="text-xs font-medium text-danger hover:text-danger transition-colors"
          >
            − Sell Asset
          </button>
          <div className="relative flex items-center">
            <button
              onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
              className="text-secondary hover:text-primary transition-colors flex items-center justify-center p-1 rounded-md hover:bg-surface-hover"
              title="More Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {isActionMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsActionMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-32 bg-surface border border-divider rounded-lg shadow-2xl shadow-black/50 z-50 py-1 flex flex-col">
                  <button
                    onClick={() => {
                      onOpenRebalance();
                      setIsActionMenuOpen(false);
                    }}
                    className="px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-surface-hover transition-colors"
                  >
                    Rebalance
                  </button>
                  <div className="border-t border-divider my-0.5"></div>
                  {(['bonus', 'split', 'dividend'] as const).map(action => (
                    <button
                      key={action}
                      onClick={() => {
                        onOpenCorporateAction(action);
                        setIsActionMenuOpen(false);
                      }}
                      className="px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-surface-hover transition-colors capitalize"
                    >
                      Add {action}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => {
              if (expandedSymbols.size > 0) {
                setExpandedSymbols(new Set());
              } else {
                setExpandedSymbols(new Set(filteredSymbolGroups.map(g => g.symbol)));
              }
            }}
            className="text-xs font-medium text-secondary hover:text-primary transition-colors flex items-center gap-1"
          >
            <ArrowUpDown className="w-3 h-3" />
            {expandedSymbols.size > 0 ? 'Collapse All' : 'Expand All'}
          </button>
          <div className="w-px h-3 bg-divider mx-1"></div>

          <button
            onClick={onExportExcel}
            disabled={filteredSymbolGroups.length === 0}
            className="text-xs font-medium text-secondary hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onColumnDragEnd}
      >
        <div className="flex-1 bg-surface overflow-auto relative min-h-0">
          <table className="w-full text-left border-collapse whitespace-nowrap table-fixed">
            <thead className="sticky top-0 z-40 bg-surface ">
              <tr className="border-b border-divider divide-x divide-divider">
                <th className="px-2 py-1.5 text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold text-secondary w-6 bg-surface sticky left-0 z-30"></th>
                {visibleColumns.has('symbol') && (
                  <SortableHeaderCell
                    key="symbol"
                    field="symbol"
                    label="Symbol"
                    width={activeColumnWidths['symbol'] || 180}
                    isNumber={false}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    resizingColId={resizingColId}
                    onSort={onSort}
                    onResizeStart={onResizeStart}
                    className="sticky left-6 z-30 bg-surface border-r border-divider"
                  />
                )}
                <SortableContext items={activeColumnOrder.filter(id => visibleColumns.has(id) && id !== 'symbol')} strategy={horizontalListSortingStrategy}>
                  {orderedNonSymbolColumns.map(colId => {
                    if (!visibleColumns.has(colId)) return null;
                    const col = ALL_COLUMNS.find(c => c.id === colId);
                    if (!col) return null;
                    return (
                      <SortableHeaderCell
                        key={col.id}
                        field={col.id}
                        label={getColumnHeaderLabel(col.id, col.label, indicatorConfig)}
                        width={getColumnHeaderWidth(col.id, activeColumnWidths)}
                        isNumber={col.id !== 'symbol'}
                        sortField={sortField}
                        sortDirection={sortDirection}
                        resizingColId={resizingColId}
                        onSort={onSort}
                        onResizeStart={onResizeStart}
                      />
                    );
                  })}
                </SortableContext>
                <th className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right w-8 bg-surface"></th>
              </tr>

              {filteredSymbolGroups.length > 0 && (
                <tr className="border-b-[3px] border-divider bg-surface-hover font-semibold shadow-sm">
                  <td className="px-2 py-1.5 text-[9px] sm:text-[10px] sticky left-0 z-30 bg-surface-hover"></td>
                  {visibleColumns.has('symbol') && (
                    <td key="symbol" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-primary uppercase tracking-wider sticky left-6 z-30 bg-surface-hover border-r border-divider">
                      Total
                    </td>
                  )}
                  {orderedNonSymbolColumns.map(colId =>
                    visibleColumns.has(colId) ? renderTotalRowCell(colId, totals, currencySymbol) : null
                  )}
                  <td className="px-2 py-1.5 text-[9px] sm:text-[10px]"></td>
                </tr>
              )}
            </thead>

            <tbody>
              {filteredSymbolGroups.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.size + 2} className="px-3 py-6 text-center text-secondary text-[9px] sm:text-[10px]">
                    No assets found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredSymbolGroups.map(group => {
                  const isExpanded = expandedSymbols.has(group.symbol);
                  return (
                    <React.Fragment key={group.symbol}>
                      <tr className="border-b border-divider divide-x divide-divider hover:bg-background transition-colors group">
                        <td
                          onClick={() => onToggleSymbol(group.symbol)}
                          className="pl-2 pr-1 py-1.5 sticky left-0 z-20 bg-background group-hover:bg-surface-hover cursor-pointer"
                        >
                          <span className="text-tertiary group-hover:text-secondary transition-colors">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                          </span>
                        </td>

                        {visibleColumns.has('symbol') && (
                          <td className="px-2 py-1.5 sticky left-6 z-20 bg-background group-hover:bg-surface-hover border-r border-divider min-w-[140px] w-[140px] truncate">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <div className="min-w-0 flex-1">
                                <div
                                  className="font-semibold text-[9px] sm:text-[10px] text-primary flex items-center gap-1.5 truncate cursor-pointer hover:underline"
                                  onClick={() => onNavigateStock(group.symbol)}
                                >
                                  <span className="truncate">{group.symbol}</span>
                                  {group.liveData?.name && (
                                    <span className="font-normal text-[9px] sm:text-[10px] text-secondary truncate" title={group.liveData.name}>
                                      {group.liveData.name}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[9px] sm:text-[10px] text-tertiary mt-0.5 truncate flex items-center gap-1.5">
                                  <span>
                                    {group.totalBoughtQty.toLocaleString()} bought
                                    {group.totalSoldQty > 0 && <> · <span className="text-danger">{group.totalSoldQty.toLocaleString()} sold</span></>}
                                  </span>
                                  <span>·</span>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      onBuyAsset(activePortfolioId, group.symbol, group.livePrice);
                                    }}
                                    className="text-success hover:text-success hover:underline transition-colors focus:outline-none"
                                    title={`Buy more ${group.symbol}`}
                                  >
                                    Buy
                                  </button>
                                  <span>·</span>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      onSellAsset(activePortfolioId, group.symbol, group.livePrice);
                                    }}
                                    className="text-danger hover:text-danger hover:underline transition-colors focus:outline-none"
                                    title={`Sell ${group.symbol}`}
                                  >
                                    Sell
                                  </button>
                                  <span>·</span>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      onOpenCorporateActionsViewer(group.symbol);
                                    }}
                                    className="text-blue-500 hover:text-blue-300 hover:underline transition-colors focus:outline-none"
                                    title={`View Corporate Actions for ${group.symbol}`}
                                  >
                                    Corporate Actions
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        )}

                        {orderedNonSymbolColumns.map(colId => {
                          if (!visibleColumns.has(colId)) return null;
                          return renderHoldingBodyCell(colId, group, {
                            totalInvestment: totals.totalInvestment,
                            totalCurrentValue: totals.totalCurrentValue,
                            currencySymbol,
                            fmtCurrency,
                            formatCurrencyCompact,
                            indicators,
                            indicatorsLoading,
                            indicatorConfig,
                            todayExecutions,
                            executingSignalSymbol,
                            getStockStrategyEvaluation,
                            onExecuteStrategySignal,
                            onOpenStrategyLogs,
                          });
                        })}

                        <td className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onDeleteAsset(group.symbol);
                            }}
                            className="p-1 text-tertiary hover:text-danger rounded hover:bg-danger/10 transition-colors"
                            title={`Delete ${group.symbol}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <HoldingExpandedFifoRow
                          group={group}
                          colSpan={visibleColumns.size + 2}
                          currencySymbol={currencySymbol}
                          fmtCurrency={fmtCurrency}
                          onEditStock={onEditStock}
                          onEditSoldStock={onEditSoldStock}
                          onDeleteStock={onDeleteStock}
                          onDeleteSoldStock={onDeleteSoldStock}
                        />
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DndContext>

      {symbolGroupsCount > 0 && (
        <div className="px-4 py-2 border-t border-divider bg-background/50 text-[10px] text-secondary flex justify-between items-center">
          <span>Click a row to expand transactions</span>
        </div>
      )}
    </div>
  );
};

