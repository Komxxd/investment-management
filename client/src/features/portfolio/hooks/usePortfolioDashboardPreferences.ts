import { useState, useEffect, useRef } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { usePortfolioContext } from './PortfolioContext';
import {
  ALL_COLUMNS,
  ALL_SUMMARY_STATS,
  COLUMN_INSERT_ANCHORS,
  DEFAULT_VISIBLE_COLUMNS,
  type PortfolioFilterState,
} from '../components/dashboard/dashboardConfig';

const DEFAULT_FILTERS: PortfolioFilterState = {
  filterType: 'open',
  searchSelectedSymbols: [],
  sortField: null,
  sortDirection: 'desc',
};

/**
 * Manages per-portfolio filters, sorting, summary card customization, column order/visibility/widths,
 * expanded row state, and two-way persistence with SettingsProvider.
 */
export function usePortfolioDashboardPreferences(activePortfolioId: string | null) {
  const { portfolios, settings, updateSettings, settingsLoading } = usePortfolioContext();

  const [portfolioFilters, setPortfolioFilters] = useState<Record<string, PortfolioFilterState>>({});
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());
  const [portfolioVisibleSummaryStats, setPortfolioVisibleSummaryStats] = useState<Record<string, Set<string>>>({});
  const [portfolioSummaryStatsOrder, setPortfolioSummaryStatsOrder] = useState<Record<string, string[]>>({});
  const [portfolioVisibleColumns, setPortfolioVisibleColumns] = useState<Record<string, Set<string>>>({});
  const [portfolioColumnOrder, setPortfolioColumnOrder] = useState<Record<string, string[]>>({});
  const [portfolioColumnWidths, setPortfolioColumnWidths] = useState<Record<string, Record<string, number>>>({});
  const [isSettingsInitialized, setIsSettingsInitialized] = useState(false);

  const [resizingCol, setResizingCol] = useState<{ id: string; startX: number; startWidth: number } | null>(null);
  const hasDraggedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Hydrate state from backend user settings
  useEffect(() => {
    if (settingsLoading || isSettingsInitialized) return;
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      if (settings?.portfolioFilters) setPortfolioFilters(settings.portfolioFilters);

      if (settings?.expandedSymbols) {
        setExpandedSymbols(new Set(settings.expandedSymbols));
      }

      if (settings?.portfolioVisibleSummaryStats) {
        const result: Record<string, Set<string>> = {};
        for (const key in settings.portfolioVisibleSummaryStats) {
          result[key] = new Set(settings.portfolioVisibleSummaryStats[key]);
        }
        setPortfolioVisibleSummaryStats(result);
      }

      if (settings?.portfolioSummaryStatsOrder) {
        setPortfolioSummaryStatsOrder(settings.portfolioSummaryStatsOrder);
      }

      if (settings?.portfolioVisibleColumns) {
        const result: Record<string, Set<string>> = {};
        for (const key in settings.portfolioVisibleColumns) {
          const colSet = new Set<string>((settings.portfolioVisibleColumns[key] || []) as string[]);
          if (!colSet.has('strategy')) {
            colSet.add('strategy');
          }
          result[key] = colSet;
        }
        setPortfolioVisibleColumns(result);
      }

      if (settings?.portfolioColumnOrder) setPortfolioColumnOrder(settings.portfolioColumnOrder);
      if (settings?.portfolioColumnWidths) setPortfolioColumnWidths(settings.portfolioColumnWidths);

      setIsSettingsInitialized(true);
    });

    return () => {
      cancelled = true;
    };
  }, [settings, settingsLoading, isSettingsInitialized]);

  // Persist preference changes back to user_settings
  useEffect(() => {
    if (!isSettingsInitialized) return;

    const serializedVisibleSummaryStats: Record<string, string[]> = {};
    for (const key in portfolioVisibleSummaryStats) {
      serializedVisibleSummaryStats[key] = Array.from(portfolioVisibleSummaryStats[key]);
    }

    const serializedVisibleColumns: Record<string, string[]> = {};
    for (const key in portfolioVisibleColumns) {
      serializedVisibleColumns[key] = Array.from(portfolioVisibleColumns[key]);
    }

    updateSettings({
      portfolioFilters,
      expandedSymbols: Array.from(expandedSymbols),
      portfolioVisibleSummaryStats: serializedVisibleSummaryStats,
      portfolioSummaryStatsOrder,
      portfolioVisibleColumns: serializedVisibleColumns,
      portfolioColumnOrder,
      portfolioColumnWidths,
    });
  }, [
    portfolioFilters,
    expandedSymbols,
    portfolioVisibleSummaryStats,
    portfolioSummaryStatsOrder,
    portfolioVisibleColumns,
    portfolioColumnOrder,
    portfolioColumnWidths,
    isSettingsInitialized,
    updateSettings,
  ]);

  useEffect(() => {
    if (isSettingsInitialized && portfolios.length > 0) {
      updateSettings({ portfolioOrder: portfolios.map((p) => p.id) });
    }
  }, [portfolios, isSettingsInitialized, updateSettings]);

  // Column drag-resize listeners
  useEffect(() => {
    if (!resizingCol || !activePortfolioId) return;

    const handleMouseMove = (e: MouseEvent) => {
      hasDraggedRef.current = true;
      const deltaX = e.clientX - resizingCol.startX;
      const newWidth = Math.max(50, resizingCol.startWidth + deltaX);
      setPortfolioColumnWidths((prev) => ({
        ...prev,
        [activePortfolioId]: {
          ...(prev[activePortfolioId] || {}),
          [resizingCol.id]: newWidth,
        },
      }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, activePortfolioId]);

  const currentFilters =
    activePortfolioId && portfolioFilters[activePortfolioId]
      ? portfolioFilters[activePortfolioId]
      : DEFAULT_FILTERS;

  const setFilterType = (val: 'open' | 'closed' | 'all') => {
    if (!activePortfolioId) return;
    setPortfolioFilters((prev) => ({
      ...prev,
      [activePortfolioId]: { ...(prev[activePortfolioId] || DEFAULT_FILTERS), filterType: val },
    }));
  };

  const setSearchSelectedSymbols = (val: string[] | ((prev: string[]) => string[])) => {
    if (!activePortfolioId) return;
    setPortfolioFilters((prev) => {
      const current = prev[activePortfolioId] || DEFAULT_FILTERS;
      const nextVal = typeof val === 'function' ? val(current.searchSelectedSymbols) : val;
      return { ...prev, [activePortfolioId]: { ...current, searchSelectedSymbols: nextVal } };
    });
  };

  const setSortField = (val: string | null | ((prev: string | null) => string | null)) => {
    if (!activePortfolioId) return;
    setPortfolioFilters((prev) => {
      const current = prev[activePortfolioId] || DEFAULT_FILTERS;
      const nextVal = typeof val === 'function' ? val(current.sortField) : val;
      return { ...prev, [activePortfolioId]: { ...current, sortField: nextVal } };
    });
  };

  const setSortDirection = (val: 'asc' | 'desc' | ((prev: 'asc' | 'desc') => 'asc' | 'desc')) => {
    if (!activePortfolioId) return;
    setPortfolioFilters((prev) => {
      const current = prev[activePortfolioId] || DEFAULT_FILTERS;
      const nextVal = typeof val === 'function' ? val(current.sortDirection) : val;
      return { ...prev, [activePortfolioId]: { ...current, sortDirection: nextVal } };
    });
  };

  const handleSort = (field: string) => {
    if (hasDraggedRef.current) return;
    if (currentFilters.sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleSymbol = (symbol: string) => {
    setExpandedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const activeVisibleSummaryStats = (() => {
    if (activePortfolioId && portfolioVisibleSummaryStats[activePortfolioId]) {
      return new Set(portfolioVisibleSummaryStats[activePortfolioId]);
    }
    if (portfolioVisibleSummaryStats['global_fallback']) {
      return new Set(portfolioVisibleSummaryStats['global_fallback']);
    }
    return new Set(ALL_SUMMARY_STATS.map((s) => s.id));
  })();

  const activeSummaryStatsOrder = (() => {
    const order =
      activePortfolioId && portfolioSummaryStatsOrder[activePortfolioId]
        ? [...portfolioSummaryStatsOrder[activePortfolioId]]
        : portfolioSummaryStatsOrder['global_fallback']
          ? [...portfolioSummaryStatsOrder['global_fallback']]
          : ALL_SUMMARY_STATS.map((s) => s.id);

    const missingStats = ALL_SUMMARY_STATS.map((s) => s.id).filter((id) => !order.includes(id));
    if (missingStats.length > 0) {
      order.push(...missingStats);
    }
    return order;
  })();

  const handleSummaryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && activePortfolioId) {
      setPortfolioSummaryStatsOrder((prev) => {
        const currentOrder = activeSummaryStatsOrder;
        const oldIndex = currentOrder.indexOf(active.id as string);
        const newIndex = currentOrder.indexOf(over.id as string);
        return { ...prev, [activePortfolioId]: arrayMove(currentOrder, oldIndex, newIndex) };
      });
    }
  };

  const toggleSummaryStat = (id: string) => {
    if (!activePortfolioId) return;
    setPortfolioVisibleSummaryStats((prev) => {
      const current =
        prev[activePortfolioId] ||
        (prev['global_fallback']
          ? new Set(prev['global_fallback'])
          : new Set(ALL_SUMMARY_STATS.map((s) => s.id)));
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [activePortfolioId]: next };
    });
  };

  const resetSummaryStats = () => {
    if (!activePortfolioId) return;
    setPortfolioVisibleSummaryStats((prev) => {
      const next = { ...prev };
      delete next[activePortfolioId];
      return next;
    });
    setPortfolioSummaryStatsOrder((prev) => {
      const next = { ...prev };
      delete next[activePortfolioId];
      return next;
    });
  };

  const applySummaryLayoutToAll = () => {
    if (!activePortfolioId) return;
    const currentOrder = activeSummaryStatsOrder;
    const currentVisible = activeVisibleSummaryStats;

    const newOrderState: Record<string, string[]> = {};
    const newVisibleState: Record<string, Set<string>> = {};

    portfolios.forEach((p) => {
      newOrderState[p.id] = [...currentOrder];
      newVisibleState[p.id] = new Set(currentVisible);
    });

    setPortfolioSummaryStatsOrder(newOrderState);
    setPortfolioVisibleSummaryStats(newVisibleState);
  };

  const visibleColumns = (() => {
    if (activePortfolioId && portfolioVisibleColumns[activePortfolioId]) {
      return portfolioVisibleColumns[activePortfolioId];
    }
    return new Set(DEFAULT_VISIBLE_COLUMNS);
  })();

  const activeColumnOrder = (() => {
    const order =
      activePortfolioId && portfolioColumnOrder[activePortfolioId]
        ? [...portfolioColumnOrder[activePortfolioId]]
        : ALL_COLUMNS.map((c) => c.id);

    const missingCols = ALL_COLUMNS.map((c) => c.id).filter((id) => !order.includes(id));
    for (const missingCol of missingCols) {
      let inserted = false;
      for (const anchor of COLUMN_INSERT_ANCHORS[missingCol] || []) {
        const idx = order.indexOf(anchor);
        if (idx !== -1) {
          order.splice(idx + 1, 0, missingCol);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        order.push(missingCol);
      }
    }
    return order;
  })();

  const toggleColumn = (colId: string) => {
    if (!activePortfolioId) return;
    setPortfolioVisibleColumns((prev) => {
      const current = prev[activePortfolioId] || new Set(DEFAULT_VISIBLE_COLUMNS);
      const next = new Set(current);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return { ...prev, [activePortfolioId]: next };
    });
  };

  const resetColumns = () => {
    if (!activePortfolioId) return;
    setPortfolioColumnOrder((prev) => {
      const next = { ...prev };
      delete next[activePortfolioId];
      return next;
    });
    setPortfolioVisibleColumns((prev) => {
      const next = { ...prev };
      delete next[activePortfolioId];
      return next;
    });
    setPortfolioColumnWidths((prev) => {
      const next = { ...prev };
      delete next[activePortfolioId];
      return next;
    });
  };

  const applyColumnLayoutToAll = () => {
    if (!activePortfolioId) return;
    const currentOrder = activeColumnOrder;
    const currentVisible = portfolioVisibleColumns[activePortfolioId] || new Set(DEFAULT_VISIBLE_COLUMNS);
    const currentWidths = portfolioColumnWidths[activePortfolioId] || {};

    const newOrderState: Record<string, string[]> = {};
    const newVisibleState: Record<string, Set<string>> = {};
    const newWidthsState: Record<string, Record<string, number>> = {};

    portfolios.forEach((p) => {
      newOrderState[p.id] = [...currentOrder];
      newVisibleState[p.id] = new Set(currentVisible);
      newWidthsState[p.id] = { ...currentWidths };
    });

    setPortfolioColumnOrder(newOrderState);
    setPortfolioVisibleColumns(newVisibleState);
    setPortfolioColumnWidths(newWidthsState);
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && activePortfolioId) {
      setPortfolioColumnOrder((prev) => {
        const currentOrder = activeColumnOrder;
        const oldIndex = currentOrder.indexOf(active.id as string);
        const newIndex = currentOrder.indexOf(over.id as string);
        return { ...prev, [activePortfolioId]: arrayMove(currentOrder, oldIndex, newIndex) };
      });
    }
  };

  const activeColumnWidths =
    activePortfolioId && portfolioColumnWidths[activePortfolioId]
      ? portfolioColumnWidths[activePortfolioId]
      : {};

  const handleResizeStart = (e: React.MouseEvent, id: string, currentWidth: number) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingCol({ id, startX: e.clientX, startWidth: currentWidth });
  };

  return {
    sensors,
    filterType: currentFilters.filterType,
    searchSelectedSymbols: currentFilters.searchSelectedSymbols,
    sortField: currentFilters.sortField,
    sortDirection: currentFilters.sortDirection,
    setFilterType,
    setSearchSelectedSymbols,
    setSortField,
    setSortDirection,
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
    resizingColId: resizingCol?.id,
    handleResizeStart,
    toggleColumn,
    resetColumns,
    applyColumnLayoutToAll,
    handleColumnDragEnd,
  };
}
