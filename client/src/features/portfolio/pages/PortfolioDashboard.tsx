import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { calculateXIRR } from '../../../utils/xirr';
import { lazyNamed } from '../../../utils/lazyNamed';
import { api } from '../../../services/api/client';
import { usePortfolioContext } from '../hooks/PortfolioContext';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { useNavigate, useParams } from 'react-router-dom';
import { AddStockModal } from '../../stocks/components/AddStockModal';
import { SellStockModal } from '../../stocks/components/SellStockModal';
import { EditStockModal } from '../../stocks/components/EditStockModal';
import { EditSoldStockModal } from '../../stocks/components/EditSoldStockModal';
import { RenamePortfolioModal } from '../components/RenamePortfolioModal';
import { CorporateActionModal } from '../../stocks/components/CorporateActionModal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import {
  AddIndicatorsModal,
  DEFAULT_INDICATOR_CONFIG,
  type IndicatorConfig,
} from '../components/AddIndicatorsModal';
import {
  DEFAULT_VISIBLE_COLUMNS,
  INDICATOR_COLUMN_IDS,
  type IndicatorData,
} from '../components/dashboard/dashboardConfig';
import type { LivePricesMap, SymbolGroup } from '../components/dashboard/dashboardTypes';
import { PortfolioSummaryCards } from '../components/dashboard/PortfolioSummaryCards';
import { HoldingsTable } from '../components/dashboard/HoldingsTable';
import { exportPortfolioToExcel } from '../utils/portfolioExcel';
import { sortSymbolGroups } from '../utils/portfolioSorting';
import { usePortfolioDashboardPreferences } from '../hooks/usePortfolioDashboardPreferences';
import {
  getTodayDateKey,
  usePortfolioStrategySync,
} from '../hooks/usePortfolioStrategySync';

const CorporateActionsViewerModal = lazyNamed(
  () => import('../../stocks/components/CorporateActionsViewerModal'),
  'CorporateActionsViewerModal'
);
const PortfolioInfoModal = lazyNamed(
  () => import('../components/PortfolioInfoModal'),
  'PortfolioInfoModal'
);
const RebalanceModal = lazyNamed(
  () => import('../../stocks/components/RebalanceModal'),
  'RebalanceModal'
);
const StrategyBuilderModal = lazyNamed(
  () => import('../components/StrategyBuilderModal'),
  'StrategyBuilderModal'
);
const StrategyLogsModal = lazyNamed(
  () => import('../components/StrategyLogsModal'),
  'StrategyLogsModal'
);

interface ServerPortfolioStats {
  summary: {
    totalStocks: number;
    maxNetInvested: number;
    totalInvestment: number;
    totalCurrentValue: number;
    totalUnrealizedPnL: number;
    unrealizedPnLPercent: number;
    totalRealizedPnL: number;
    totalPnL: number;
    totalPnLPercent: number;
    totalDividend: number;
    xirr: number;
  };
  symbolGroups: SymbolGroup[];
}

export function PortfolioDashboard() {
  const {
    portfolios,
    stocks,
    setStocks,
    soldStocks,
    setSoldStocks,
    livePrices,
    setLivePrices,
    pricesLoading,
    setPricesLoading,
    fetchData,
  } = usePortfolioContext();
  const navigate = useNavigate();
  const { currencySymbol, formatCurrency: fmtCurrency, formatCurrencyCompact, convert } = useCurrency();
  const { portfolioId } = useParams<{ portfolioId: string }>();

  const activePortfolioId = portfolioId || null;
  const [calculationTime] = useState(() => Date.now());

  // ── Modals & UI actions ──
  const [isPortfolioInfoModalOpen, setIsPortfolioInfoModalOpen] = useState(false);
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);
  const [addStockPortfolioId, setAddStockPortfolioId] = useState<string | null>(null);
  const [addStockInitialSymbol, setAddStockInitialSymbol] = useState<string>('');
  const [addStockInitialPrice, setAddStockInitialPrice] = useState<number | undefined>(undefined);
  const [sellStockPortfolioId, setSellStockPortfolioId] = useState<string | null>(null);
  const [sellStockInitialSymbol, setSellStockInitialSymbol] = useState<string>('');
  const [sellStockInitialPrice, setSellStockInitialPrice] = useState<number | undefined>(undefined);
  const [editStockId, setEditStockId] = useState<string | null>(null);
  const [editSoldStockId, setEditSoldStockId] = useState<string | null>(null);
  const [renamePortfolioId, setRenamePortfolioId] = useState<string | null>(null);
  const [corporateActionType, setCorporateActionType] = useState<'bonus' | 'split' | 'dividend' | null>(null);
  const [viewCorporateActionsSymbol, setViewCorporateActionsSymbol] = useState<string | null>(null);
  const [isAddIndicatorsModalOpen, setIsAddIndicatorsModalOpen] = useState(false);
  const [isStrategyBuilderModalOpen, setIsStrategyBuilderModalOpen] = useState(false);
  const [logsModalSymbol, setLogsModalSymbol] = useState<string | null>(null);
  const [confirmationConfig, setConfirmationConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDestructive?: boolean;
    requireInputToConfirm?: string;
  } | null>(null);

  // ── Layout, filter, sort, & column preferences ──
  const {
    sensors,
    filterType,
    searchSelectedSymbols,
    sortField,
    sortDirection,
    setFilterType,
    setSearchSelectedSymbols,
    setSortField,
    handleSort,
    expandedSymbols,
    setExpandedSymbols,
    toggleSymbol,
    activeVisibleSummaryStats,
    activeSummaryStatsOrder,
    handleSummaryDragEnd,
    toggleSummaryStat,
    resetSummaryStats,
    applySummaryLayoutToAll,
    visibleColumns,
    setPortfolioVisibleColumns,
    activeColumnOrder,
    activeColumnWidths,
    resizingColId,
    handleResizeStart,
    toggleColumn,
    resetColumns,
    applyColumnLayoutToAll,
    handleColumnDragEnd,
  } = usePortfolioDashboardPreferences(activePortfolioId);

  // ── Indicators state ──
  const [indicators, setIndicators] = useState<Record<string, IndicatorData>>({});
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);
  const [indicatorConfig, setIndicatorConfig] = useState<IndicatorConfig>(() => {
    try {
      const saved = localStorage.getItem('portfolio_indicator_config');
      if (saved) {
        return { ...DEFAULT_INDICATOR_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // fallback to defaults
    }
    return DEFAULT_INDICATOR_CONFIG;
  });

  // ── Strategy sync & server execution tracking ──
  const {
    portfolioStrategies,
    todayExecutions,
    localStrategyLogs,
    appendLocalStrategyLog,
    executingSignalSymbol,
    getStockStrategyEvaluation,
    handleExecuteStrategySignal,
  } = usePortfolioStrategySync({
    activePortfolioId,
    isStrategyBuilderModalOpen,
    livePrices: livePrices as LivePricesMap,
    indicators,
    fetchData,
  });

  // ── Active portfolio slices ──
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId);
  const activeStocks = stocks.filter(s => s.portfolio_id === activePortfolioId);
  const activeSoldStocks = soldStocks.filter(s => s.portfolio_id === activePortfolioId);
  const activeSymbols = [...new Set([...activeStocks, ...activeSoldStocks].map(s => s.symbol))];
  const allSymbols = [...new Set(stocks.map(s => s.symbol))];
  const allStockSymbols = allSymbols.sort().join(',');

  // ── Live price SSE stream across all held symbols ──
  useEffect(() => {
    if (!allStockSymbols) {
      setPricesLoading(false);
      return;
    }
    setPricesLoading(true);

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    const evtSource = new EventSource(
      `${apiBase}/api/prices/stream?symbols=${encodeURIComponent(allStockSymbols)}`,
      { withCredentials: true }
    );

    evtSource.onmessage = event => {
      try {
        const prices = JSON.parse(event.data);
        if (Object.keys(prices).length > 0) {
          setLivePrices(prev => ({ ...prev, ...prices }));
        }
        setPricesLoading(false);
      } catch (err) {
        console.error('Failed to parse live prices from SSE', err);
      }
    };

    evtSource.onerror = err => {
      console.error('SSE Error:', err);
      evtSource.close();
      setPricesLoading(false);
    };

    return () => evtSource.close();
  }, [allStockSymbols, setLivePrices, setPricesLoading]);

  // ── Technical indicators fetch when any indicator column is visible ──
  const indicatorColumnsVisible = INDICATOR_COLUMN_IDS.some(id => visibleColumns.has(id));

  useEffect(() => {
    if (!allStockSymbols || !indicatorColumnsVisible) return;
    let cancelled = false;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    const params = new URLSearchParams({
      symbols: allStockSymbols,
      force: 'false',
      rsiPeriod: String(indicatorConfig.rsiPeriod),
      macdFast: String(indicatorConfig.macdFastPeriod),
      macdSlow: String(indicatorConfig.macdSlowPeriod),
      macdSignal: String(indicatorConfig.macdSignalPeriod),
      bbPeriod: String(indicatorConfig.bbPeriod),
      bbStdDev: String(indicatorConfig.bbStdDev),
    });

    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setIndicatorsLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/prices/indicators?${params.toString()}`, { credentials: 'include' });
        const data = await res.json();
        if (!cancelled) setIndicators(prev => ({ ...prev, ...data }));
      } catch (err) {
        console.error('Failed to fetch indicators', err);
      } finally {
        if (!cancelled) setIndicatorsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allStockSymbols, indicatorColumnsVisible, indicatorConfig]);

  // ── Server-calculated FIFO symbol groups & summary ──
  const [serverStats, setServerStats] = useState<ServerPortfolioStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!activePortfolioId) return;
      try {
        const result = await api.get(`/api/calculations/portfolio/${activePortfolioId}/summary`);
        setServerStats(result);
      } catch (err) {
        console.error('Failed to fetch portfolio stats', err);
      }
    };
    fetchStats();
  }, [activePortfolioId, stocks, soldStocks]);

  // ── Delete handlers ──
  const executeDeleteAsset = async (symbol: string) => {
    if (!activePortfolio) return;
    try {
      const stocksToDelete = stocks.filter(s => s.portfolio_id === activePortfolio.id && s.symbol === symbol);
      for (const stock of stocksToDelete) {
        await api.delete(`/api/stocks/${stock.id}`);
      }

      const soldStocksToDelete = soldStocks.filter(s => s.portfolio_id === activePortfolio.id && s.symbol === symbol);
      for (const soldStock of soldStocksToDelete) {
        await api.delete(`/api/sold-stocks/${soldStock.id}`);
      }

      setStocks(prev => prev.filter(s => s.symbol !== symbol));
      setSoldStocks(prev => prev.filter(s => s.symbol !== symbol));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error deleting asset:', msg);
      alert(`Failed to delete ${symbol}. Please try again.`);
    }
  };

  const handleDeleteStock = (stockId: string) => {
    const stockToDelete = stocks.find(s => s.id === stockId);
    if (stockToDelete && stockToDelete.entry_price > 0) {
      const otherBuys = stocks.filter(s => s.symbol === stockToDelete.symbol && s.id !== stockId && s.entry_price > 0);
      if (otherBuys.length === 0) {
        const hasOtherEntries =
          stocks.some(s => s.symbol === stockToDelete.symbol && s.id !== stockId) ||
          soldStocks.some(s => s.symbol === stockToDelete.symbol);
        if (hasOtherEntries) {
          setConfirmationConfig({
            isOpen: true,
            title: 'Delete Asset entirely?',
            message: `Deleting the last Buy entry for ${stockToDelete.symbol} will also delete all associated Sells and Corporate Actions. Continue?`,
            confirmText: 'Delete All',
            isDestructive: true,
            onConfirm: () => executeDeleteAsset(stockToDelete.symbol),
          });
          return;
        }
        executeDeleteAsset(stockToDelete.symbol);
        return;
      }
    }

    setConfirmationConfig({
      isOpen: true,
      title: 'Delete Buy Entry',
      message: 'Are you sure you want to delete this buy entry? This action cannot be undone.',
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api.delete(`/api/stocks/${stockId}`);
          setStocks(prev => prev.filter(s => s.id !== stockId));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error('Error deleting stock:', msg);
          alert('Failed to delete asset. Please try again.');
        }
      },
    });
  };

  const handleDeleteSoldStock = (soldStockId: string) => {
    setConfirmationConfig({
      isOpen: true,
      title: 'Delete Sell Entry',
      message: 'Are you sure you want to delete this sell entry? This action cannot be undone.',
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api.delete(`/api/sold-stocks/${soldStockId}`);
          setSoldStocks(prev => prev.filter(s => s.id !== soldStockId));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error('Error deleting sold stock:', msg);
          alert('Failed to delete sold asset. Please try again.');
        }
      },
    });
  };

  const handleDeleteAsset = (symbol: string) => {
    setConfirmationConfig({
      isOpen: true,
      title: `Delete Asset: ${symbol}`,
      message: `Are you sure you want to delete ALL records for ${symbol}? This cannot be undone.`,
      confirmText: 'Delete Asset',
      isDestructive: true,
      onConfirm: () => executeDeleteAsset(symbol),
    });
  };

  // ── Filter, aggregate totals, XIRR & sort symbol groups ──
  const symbolGroups = useMemo(() => serverStats?.symbolGroups || [], [serverStats]);

  let filteredSymbolGroups = symbolGroups;
  if (filterType === 'open') {
    filteredSymbolGroups = symbolGroups.filter(g => g.netQty > 0);
  } else if (filterType === 'closed') {
    filteredSymbolGroups = symbolGroups.filter(g => g.netQty === 0 && g.totalBoughtQty > 0);
  }

  if (searchSelectedSymbols.length > 0) {
    filteredSymbolGroups = filteredSymbolGroups.filter(g => searchSelectedSymbols.includes(g.symbol));
  }

  const openPortfolioStocks = useMemo(() => {
    if (symbolGroups.length > 0) {
      const openSymbols = new Set(symbolGroups.filter(g => (g.netQty || 0) > 0).map(g => g.symbol));
      return activeStocks.filter(s => openSymbols.has(s.symbol));
    }

    const soldQtyBySymbol: Record<string, number> = {};
    activeSoldStocks.forEach(s => {
      soldQtyBySymbol[s.symbol] = (soldQtyBySymbol[s.symbol] || 0) + (Number(s.quantity) || 0);
    });
    const boughtQtyBySymbol: Record<string, number> = {};
    activeStocks.forEach(s => {
      boughtQtyBySymbol[s.symbol] = (boughtQtyBySymbol[s.symbol] || 0) + (Number(s.quantity) || 0);
    });

    return activeStocks.filter(s => (boughtQtyBySymbol[s.symbol] || 0) > (soldQtyBySymbol[s.symbol] || 0));
  }, [symbolGroups, activeStocks, activeSoldStocks]);

  const maxNetInvested = convert(serverStats?.summary?.maxNetInvested || 0, 'INR');
  const totalInvestment = filteredSymbolGroups.reduce(
    (sum, g) => sum + convert(g.netCostBasis || 0, livePrices[g.symbol]?.currency),
    0
  );
  const totalCurrentValue = filteredSymbolGroups.reduce((sum, g) => {
    const currentPrice = livePrices[g.symbol]?.price || g.avgBuyPrice || 0;
    return sum + convert(g.netQty * currentPrice, livePrices[g.symbol]?.currency);
  }, 0);
  const totalUnrealizedPnL = filteredSymbolGroups.reduce((sum, g) => {
    const currentPrice = livePrices[g.symbol]?.price || g.avgBuyPrice || 0;
    const currentValue = g.netQty * currentPrice;
    return sum + convert(currentValue - g.netCostBasis, livePrices[g.symbol]?.currency);
  }, 0);
  const totalRealizedPnL = filteredSymbolGroups.reduce(
    (sum, g) => sum + convert(g.realizedPnL || 0, livePrices[g.symbol]?.currency),
    0
  );
  const portfolioTotalBrokerage = filteredSymbolGroups.reduce(
    (sum, g) => sum + convert(g.brokerage || 0, livePrices[g.symbol]?.currency),
    0
  );
  const portfolioTotalGovtTax = filteredSymbolGroups.reduce(
    (sum, g) => sum + convert(g.govtTax || 0, livePrices[g.symbol]?.currency),
    0
  );
  const portfolioTotalDividend = filteredSymbolGroups.reduce(
    (sum, g) => sum + convert(g.totalDividend || 0, livePrices[g.symbol]?.currency),
    0
  );
  const portfolioTotalDayGain = filteredSymbolGroups.reduce(
    (sum, g) => sum + convert(g.netQty * (g.liveData?.change || 0), livePrices[g.symbol]?.currency),
    0
  );
  const portfolioRealizedCostBasis = filteredSymbolGroups.reduce(
    (sum, g) => sum + convert(g.totalBuyCost - g.netCostBasis, livePrices[g.symbol]?.currency),
    0
  );

  const portfolioCashFlows = filteredSymbolGroups.flatMap(g =>
    (g.cashFlows || []).map(cf => ({
      ...cf,
      amount: convert(cf.amount, livePrices[g.symbol]?.currency),
    }))
  );
  let portfolioXIRR = 0;
  if (totalCurrentValue > 0 || portfolioCashFlows.length > 0) {
    const xirrCF = [...portfolioCashFlows];
    if (totalCurrentValue > 0) xirrCF.push({ date: calculationTime, amount: totalCurrentValue });
    portfolioXIRR = calculateXIRR(xirrCF);
  }

  const sortedSymbolGroups = sortSymbolGroups({
    groups: filteredSymbolGroups,
    sortField,
    sortDirection,
    totalInvestment,
    totalCurrentValue,
    indicators,
    todayExecutions,
    getStockStrategyEvaluation,
  });

  const totalPnL =
    totalUnrealizedPnL + totalRealizedPnL + portfolioTotalDividend - portfolioTotalBrokerage - portfolioTotalGovtTax;
  const totalPnLPercent = maxNetInvested > 0 ? (totalPnL / maxNetInvested) * 100 : 0;
  const unrealizedPnLPercent = totalInvestment > 0 ? (totalUnrealizedPnL / totalInvestment) * 100 : 0;
  const portfolioRealizedPct =
    portfolioRealizedCostBasis > 0 ? (totalRealizedPnL / portfolioRealizedCostBasis) * 100 : 0;
  const portfolioPreviousValue = totalCurrentValue - portfolioTotalDayGain;
  const portfolioDayGainPct =
    portfolioPreviousValue > 0 ? (portfolioTotalDayGain / portfolioPreviousValue) * 100 : 0;

  const handleExportExcel = async () => {
    if (!activePortfolio || sortedSymbolGroups.length === 0) return;
    await exportPortfolioToExcel({
      portfolioName: activePortfolio.name || 'Portfolio',
      filteredSymbolGroups: sortedSymbolGroups,
      livePrices,
      indicators,
    });
  };

  return (
    <>
      <div className="flex-1 w-full flex flex-col min-h-0">
        <PortfolioSummaryCards
          sensors={sensors}
          activeSummaryStatsOrder={activeSummaryStatsOrder}
          activeVisibleSummaryStats={activeVisibleSummaryStats}
          onDragEnd={handleSummaryDragEnd}
          onToggleStat={toggleSummaryStat}
          onResetStats={resetSummaryStats}
          onApplyLayoutToAll={applySummaryLayoutToAll}
          currencySymbol={currencySymbol}
          totalStocksCount={sortedSymbolGroups.length}
          maxNetInvested={maxNetInvested}
          totalInvestment={totalInvestment}
          totalCurrentValue={totalCurrentValue}
          totalUnrealizedPnL={totalUnrealizedPnL}
          unrealizedPnLPercent={unrealizedPnLPercent}
          totalRealizedPnL={totalRealizedPnL}
          portfolioRealizedCostBasis={portfolioRealizedCostBasis}
          portfolioRealizedPct={portfolioRealizedPct}
          portfolioTotalDividend={portfolioTotalDividend}
          portfolioTotalBrokerage={portfolioTotalBrokerage}
          portfolioTotalGovtTax={portfolioTotalGovtTax}
          totalPnL={totalPnL}
          totalPnLPercent={totalPnLPercent}
          portfolioTotalDayGain={portfolioTotalDayGain}
          portfolioDayGainPct={portfolioDayGainPct}
          portfolioXIRR={portfolioXIRR}
        />

        <HoldingsTable
          activePortfolioId={activePortfolioId || ''}
          sensors={sensors}
          pricesLoading={pricesLoading}
          activeSymbols={activeSymbols}
          livePrices={livePrices as LivePricesMap}
          symbolGroupsCount={symbolGroups.length}
          filteredSymbolGroups={sortedSymbolGroups}
          totals={{
            totalInvestment,
            totalCurrentValue,
            totalUnrealizedPnL,
            totalRealizedPnL,
            portfolioRealizedCostBasis,
            portfolioTotalDividend,
            portfolioTotalBrokerage,
            portfolioTotalGovtTax,
            maxNetInvested,
            portfolioXIRR,
            portfolioTotalDayGain,
            portfolioDayGainPct,
          }}
          currencySymbol={currencySymbol}
          fmtCurrency={fmtCurrency}
          formatCurrencyCompact={formatCurrencyCompact}
          filterType={filterType}
          setFilterType={setFilterType}
          searchSelectedSymbols={searchSelectedSymbols}
          setSearchSelectedSymbols={setSearchSelectedSymbols}
          sortField={sortField}
          setSortField={setSortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          expandedSymbols={expandedSymbols}
          setExpandedSymbols={setExpandedSymbols}
          onToggleSymbol={toggleSymbol}
          visibleColumns={visibleColumns}
          activeColumnOrder={activeColumnOrder}
          activeColumnWidths={activeColumnWidths}
          resizingColId={resizingColId}
          onResizeStart={handleResizeStart}
          onToggleColumn={toggleColumn}
          onResetColumns={resetColumns}
          onApplyColumnLayoutToAll={applyColumnLayoutToAll}
          onColumnDragEnd={handleColumnDragEnd}
          indicators={indicators}
          indicatorsLoading={indicatorsLoading}
          indicatorConfig={indicatorConfig}
          todayExecutions={todayExecutions}
          executingSignalSymbol={executingSignalSymbol}
          getStockStrategyEvaluation={getStockStrategyEvaluation}
          onExecuteStrategySignal={handleExecuteStrategySignal}
          onOpenPortfolioInfo={() => setIsPortfolioInfoModalOpen(true)}
          onOpenAddIndicators={() => setIsAddIndicatorsModalOpen(true)}
          onOpenStrategyBuilder={() => setIsStrategyBuilderModalOpen(true)}
          onBuyAsset={(pid, sym = '', price) => {
            setAddStockInitialSymbol(sym);
            setAddStockInitialPrice(price);
            setAddStockPortfolioId(pid);
          }}
          onSellAsset={(pid, sym = '', price) => {
            setSellStockInitialSymbol(sym);
            setSellStockInitialPrice(price);
            setSellStockPortfolioId(pid);
          }}
          onOpenRebalance={() => setIsRebalanceModalOpen(true)}
          onOpenCorporateAction={type => setCorporateActionType(type)}
          onOpenCorporateActionsViewer={sym => setViewCorporateActionsSymbol(sym)}
          onOpenStrategyLogs={sym => setLogsModalSymbol(sym)}
          onNavigateStock={sym => navigate(`/stocks/${sym}`)}
          onExportExcel={handleExportExcel}
          onEditStock={id => setEditStockId(id)}
          onEditSoldStock={id => setEditSoldStockId(id)}
          onDeleteStock={handleDeleteStock}
          onDeleteSoldStock={handleDeleteSoldStock}
          onDeleteAsset={handleDeleteAsset}
        />
      </div>

      {/* ── Modals ── */}
      <AddStockModal
        isOpen={!!addStockPortfolioId}
        portfolioId={addStockPortfolioId}
        initialSymbol={addStockInitialSymbol}
        initialPrice={addStockInitialPrice}
        existingSymbols={!addStockInitialSymbol ? [...new Set(stocks.filter(s => s.portfolio_id === addStockPortfolioId).map(s => s.symbol))] : []}
        onClose={() => {
          setAddStockPortfolioId(null);
          setAddStockInitialSymbol('');
          setAddStockInitialPrice(undefined);
        }}
        onAdded={fetchData}
      />

      <SellStockModal
        isOpen={!!sellStockPortfolioId}
        portfolioId={sellStockPortfolioId}
        initialSymbol={sellStockInitialSymbol}
        initialPrice={sellStockInitialPrice}
        onClose={() => {
          setSellStockPortfolioId(null);
          setSellStockInitialSymbol('');
          setSellStockInitialPrice(undefined);
        }}
        onAdded={fetchData}
      />

      <EditStockModal
        isOpen={!!editStockId}
        stock={stocks.find(s => s.id === editStockId) || null}
        onClose={() => setEditStockId(null)}
        onEdited={fetchData}
      />

      <EditSoldStockModal
        isOpen={!!editSoldStockId}
        soldStock={soldStocks.find(s => s.id === editSoldStockId) || null}
        onClose={() => setEditSoldStockId(null)}
        onEdited={fetchData}
      />

      <RenamePortfolioModal
        isOpen={!!renamePortfolioId}
        onClose={() => setRenamePortfolioId(null)}
        onRenamed={fetchData}
        portfolioId={renamePortfolioId}
        currentName={portfolios.find(p => p.id === renamePortfolioId)?.name || ''}
      />

      <CorporateActionModal
        isOpen={corporateActionType !== null}
        onClose={() => setCorporateActionType(null)}
        type={corporateActionType}
        portfolioId={activePortfolio?.id || null}
        ownedSymbols={symbolGroups.filter(g => g.netQty > 0).map(g => g.symbol)}
        symbolGroups={symbolGroups}
        onSuccess={fetchData}
      />

      {viewCorporateActionsSymbol !== null && (
        <Suspense fallback={null}>
          <CorporateActionsViewerModal
            isOpen={viewCorporateActionsSymbol !== null}
            onClose={() => setViewCorporateActionsSymbol(null)}
            symbol={viewCorporateActionsSymbol || ''}
            portfolioId={activePortfolioId || ''}
            onSuccess={fetchData}
            existingEvents={
              viewCorporateActionsSymbol
                ? symbolGroups.find(g => g.symbol === viewCorporateActionsSymbol)?.events || []
                : []
            }
          />
        </Suspense>
      )}

      {isPortfolioInfoModalOpen && (
        <Suspense fallback={null}>
          <PortfolioInfoModal
            isOpen={isPortfolioInfoModalOpen}
            onClose={() => setIsPortfolioInfoModalOpen(false)}
            symbols={allSymbols.map(sym => ({ symbol: sym, name: livePrices[sym]?.name || '' }))}
            portfolioId={activePortfolioId || ''}
            onSuccess={fetchData}
            existingEvents={symbolGroups.flatMap(g => g.events.map(e => ({ ...e, symbol: g.symbol })))}
          />
        </Suspense>
      )}

      {confirmationConfig && (
        <ConfirmationModal
          isOpen={confirmationConfig.isOpen}
          onClose={() => setConfirmationConfig(null)}
          onConfirm={confirmationConfig.onConfirm}
          title={confirmationConfig.title}
          message={confirmationConfig.message}
          confirmText={confirmationConfig.confirmText}
          isDestructive={confirmationConfig.isDestructive}
          requireInputToConfirm={confirmationConfig.requireInputToConfirm}
        />
      )}

      {isRebalanceModalOpen && (
        <Suspense fallback={null}>
          <RebalanceModal
            isOpen={isRebalanceModalOpen}
            onClose={() => setIsRebalanceModalOpen(false)}
            portfolioId={activePortfolioId || ''}
            symbolGroups={sortedSymbolGroups}
            totalCurrentValue={totalCurrentValue}
            onSuccess={fetchData}
          />
        </Suspense>
      )}

      <AddIndicatorsModal
        isOpen={isAddIndicatorsModalOpen}
        onClose={() => setIsAddIndicatorsModalOpen(false)}
        visibleColumns={visibleColumns}
        symbols={activeSymbols}
        config={indicatorConfig}
        onIndicatorsUpdated={data => setIndicators(prev => ({ ...prev, ...data }))}
        onApplyIndicators={(selectedIds, newConfig) => {
          if (newConfig) {
            setIndicatorConfig(newConfig);
            try {
              localStorage.setItem('portfolio_indicator_config', JSON.stringify(newConfig));
            } catch {
              // ignore storage error
            }
          }
          if (!activePortfolioId) return;
          setPortfolioVisibleColumns(prev => {
            const current = prev[activePortfolioId]
              ? new Set(prev[activePortfolioId])
              : new Set(DEFAULT_VISIBLE_COLUMNS);
            INDICATOR_COLUMN_IDS.forEach(ind => {
              if (selectedIds.includes(ind)) current.add(ind);
              else current.delete(ind);
            });
            return { ...prev, [activePortfolioId]: current };
          });
        }}
      />

      {isStrategyBuilderModalOpen && (
        <Suspense fallback={null}>
          <StrategyBuilderModal
            isOpen={isStrategyBuilderModalOpen}
            onClose={() => setIsStrategyBuilderModalOpen(false)}
            portfolioId={activePortfolioId || ''}
            portfolioName={activePortfolio?.name || 'Portfolio'}
            stocks={openPortfolioStocks}
            indicators={indicators}
            livePrices={livePrices}
            currencySymbol={currencySymbol}
            onLifecycleLog={entry =>
              appendLocalStrategyLog(activePortfolioId, entry.eventDate || getTodayDateKey(), entry)
            }
          />
        </Suspense>
      )}

      {Boolean(logsModalSymbol) && (
        <Suspense fallback={null}>
          <StrategyLogsModal
            isOpen={Boolean(logsModalSymbol)}
            onClose={() => setLogsModalSymbol(null)}
            portfolioId={activePortfolioId || ''}
            symbol={logsModalSymbol}
            currencySymbol={currencySymbol}
            strategies={portfolioStrategies}
            fallbackLocalLogs={localStrategyLogs}
          />
        </Suspense>
      )}
    </>
  );
}
