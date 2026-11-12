import { useState, useEffect, useRef, useMemo } from 'react';
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { api } from '../../../services/api/client';
import { usePortfolioContext } from './PortfolioContext';
import {
  DEFAULT_EMPTY_STATS,
  SUMMARY_STATS,
  sortHomePortfolioOrder,
} from '../components/home/homeDashboardConfig';
import type {
  HomeStatsSummary,
  PortfolioSummaryMap,
} from '../components/home/homeDashboardConfig';

export interface HomeConfirmationConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  isDestructive?: boolean;
  requireInputToConfirm?: string;
}

/**
 * Manages HomeDashboard summary stats fetching, column preferences, sorting, DnD order, and row actions.
 */
export function useHomeDashboardState() {
  const {
    portfolios,
    setPortfolios,
    stocks,
    setIsCreateModalOpen,
    isCreateModalOpen,
    fetchData,
    settings,
    updateSettings,
    settingsLoading,
    loading: portfolioDataLoading,
  } = usePortfolioContext();

  const [homeStats, setHomeStats] = useState<HomeStatsSummary | null>(null);
  const [portfolioSummaries, setPortfolioSummaries] = useState<PortfolioSummaryMap>({});
  const [loading, setLoading] = useState(true);
  const [isChartVisible, setIsChartVisible] = useState(false);

  const [selectedSummaryPortfolioIds, setSelectedSummaryPortfolioIds] = useState<string[] | null>(null);
  const [isSummaryDropdownOpen, setIsSummaryDropdownOpen] = useState(false);
  const summaryDropdownRef = useRef<HTMLDivElement>(null);

  const [summaryOrder, setSummaryOrder] = useState<string[]>(SUMMARY_STATS.map(s => s.id));
  const [visibleStats, setVisibleStats] = useState<Set<string>>(new Set(SUMMARY_STATS.map(s => s.id)));
  const [portfolioOrder, setPortfolioOrder] = useState<string[]>([]);
  const [isSettingsInitialized, setIsSettingsInitialized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [navbarPortalElement, setNavbarPortalElement] = useState<HTMLElement | null>(null);
  const [navbarLeftPortalElement, setNavbarLeftPortalElement] = useState<HTMLElement | null>(null);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [renamePortfolioId, setRenamePortfolioId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ bottom: number; right: number } | null>(null);
  const [confirmationConfig, setConfirmationConfig] = useState<HomeConfirmationConfig | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Resolve navbar portal containers after mount
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setNavbarPortalElement(document.getElementById('navbar-actions-portal'));
      setNavbarLeftPortalElement(document.getElementById('navbar-left-portal'));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate persisted column and portfolio order preferences once settings load
  useEffect(() => {
    if (settingsLoading || isSettingsInitialized) return;
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      if (settings?.home_summary_order) {
        const order: string[] = settings.home_summary_order;
        const existingIds = new Set(order);
        const missingStats = SUMMARY_STATS.map(s => s.id).filter(id => !existingIds.has(id));
        setSummaryOrder([...order, ...missingStats]);
      }

      if (settings?.home_summary_visible) {
        setVisibleStats(new Set(settings.home_summary_visible));
      }

      if (settings?.home_portfolio_order) {
        setPortfolioOrder(settings.home_portfolio_order);
      }

      setIsSettingsInitialized(true);
    });

    return () => {
      cancelled = true;
    };
  }, [settings, settingsLoading, isSettingsInitialized]);

  // Persist layout changes back to user settings
  useEffect(() => {
    if (!isSettingsInitialized) return;
    updateSettings({
      home_summary_order: summaryOrder,
      home_summary_visible: Array.from(visibleStats),
      home_portfolio_order: portfolioOrder,
    });
  }, [summaryOrder, visibleStats, portfolioOrder, isSettingsInitialized, updateSettings]);

  // Keep portfolioOrder reconciled with created/deleted portfolios
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setPortfolioOrder(prev => {
        const actualIds = portfolios.map(p => p.id);
        const newOrder = prev.filter(id => actualIds.includes(id));
        actualIds.forEach(id => {
          if (!newOrder.includes(id)) newOrder.push(id);
        });
        return newOrder;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [portfolios]);

  // Dismiss row menu on outside click or scroll
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    const handleScroll = () => setActiveMenuId(null);

    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  // Dismiss navbar popovers on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (summaryDropdownRef.current && !summaryDropdownRef.current.contains(event.target as Node)) {
        setIsSummaryDropdownOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep selected summary portfolio filter in sync with portfolio additions/deletions
  const prevPortfoliosRef = useRef(portfolios);
  useEffect(() => {
    if (portfolioDataLoading) return;
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      if (portfolios.length === 0) {
        setSelectedSummaryPortfolioIds([]);
        setHomeStats(DEFAULT_EMPTY_STATS);
        setPortfolioSummaries({});
        setLoading(false);
      } else if (selectedSummaryPortfolioIds === null) {
        setSelectedSummaryPortfolioIds(portfolios.map(p => p.id));
      } else {
        const prevIds = new Set(prevPortfoliosRef.current.map(p => p.id));
        const newPortfolios = portfolios.filter(p => !prevIds.has(p.id));
        if (newPortfolios.length > 0) {
          setSelectedSummaryPortfolioIds(prev => [...(prev || []), ...newPortfolios.map(p => p.id)]);
        }
      }
      prevPortfoliosRef.current = portfolios;
    });

    return () => {
      cancelled = true;
    };
  }, [portfolios, selectedSummaryPortfolioIds, portfolioDataLoading]);

  // Fetch dashboard summary stats whenever portfolio data or selection changes
  useEffect(() => {
    if (portfolioDataLoading) return;
    let cancelled = false;

    const fetchStats = async () => {
      if (portfolios.length === 0) {
        await Promise.resolve();
        if (cancelled) return;
        setHomeStats(DEFAULT_EMPTY_STATS);
        setPortfolioSummaries({});
        setLoading(false);
        return;
      }

      if (selectedSummaryPortfolioIds === null) return;

      try {
        const queryParams = new URLSearchParams();
        queryParams.set(
          'portfolioIds',
          selectedSummaryPortfolioIds.length > 0 ? selectedSummaryPortfolioIds.join(',') : 'NONE'
        );
        const result = await api.get(`/api/calculations/dashboard/stats?${queryParams.toString()}`);
        if (cancelled) return;
        setHomeStats(result?.summary || DEFAULT_EMPTY_STATS);
        setPortfolioSummaries(result?.portfolioSummaries || {});
      } catch (err) {
        console.error('Failed to fetch dashboard stats', err);
        if (!cancelled) {
          setHomeStats(DEFAULT_EMPTY_STATS);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchStats();
    return () => {
      cancelled = true;
    };
  }, [portfolios, stocks, selectedSummaryPortfolioIds, portfolioDataLoading]);

  const sortedPortfolioOrder = useMemo(
    () =>
      sortHomePortfolioOrder(
        portfolioOrder,
        sortField,
        sortDirection,
        portfolios,
        portfolioSummaries,
        stocks
      ),
    [portfolioOrder, sortField, sortDirection, portfolios, portfolioSummaries, stocks]
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handlePortfolioDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPortfolioOrder(items => {
        const currentOrder = sortField ? [...sortedPortfolioOrder] : items;
        const oldIndex = currentOrder.indexOf(active.id as string);
        const newIndex = currentOrder.indexOf(over.id as string);
        return arrayMove(currentOrder, oldIndex, newIndex);
      });
      setSortField(null);
    }
  };

  const handleStatDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSummaryOrder(items => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleStat = (id: string) => {
    setVisibleStats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSummaryPortfolioSelection = (id: string) => {
    setSelectedSummaryPortfolioIds(prev => {
      if (!prev) return [id];
      if (prev.includes(id)) {
        return prev.filter(pId => pId !== id);
      }
      return [...prev, id];
    });
  };

  const handleDeletePortfolio = async (id: string) => {
    try {
      await api.delete(`/api/portfolios/${id}`);
      setPortfolios(prev => prev.filter(p => p.id !== id));
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyPortfolio = async (id: string) => {
    try {
      const target = portfolios.find(p => p.id === id);
      if (!target) return;
      await api.post(`/api/portfolios/${id}/duplicate`, { name: `${target.name} (Copy)` });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const stats = homeStats || DEFAULT_EMPTY_STATS;
  const selectedStocks = stocks.filter(
    s => !selectedSummaryPortfolioIds || selectedSummaryPortfolioIds.includes(s.portfolio_id)
  );
  const totalUniqueStocks = new Set(
    selectedStocks.filter(s => Number(s.entry_price) > 0).map(s => s.symbol)
  ).size;
  const totalBrokerageAndTax = Object.entries(portfolioSummaries)
    .filter(([pid]) => !selectedSummaryPortfolioIds || selectedSummaryPortfolioIds.includes(pid))
    .reduce((sum, [, ps]) => sum + ((ps?.totalBrokerage || 0) + (ps?.totalGovtTax || 0)), 0);

  return {
    portfolios,
    stocks,
    fetchData,
    isCreateModalOpen,
    setIsCreateModalOpen,
    isLoading: loading || portfolioDataLoading,
    stats,
    portfolioSummaries,
    totalUniqueStocks,
    totalBrokerageAndTax,
    isChartVisible,
    setIsChartVisible,
    selectedSummaryPortfolioIds,
    setSelectedSummaryPortfolioIds,
    isSummaryDropdownOpen,
    setIsSummaryDropdownOpen,
    summaryDropdownRef,
    summaryOrder,
    visibleStats,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsRef,
    navbarPortalElement,
    navbarLeftPortalElement,
    sensors,
    sortField,
    setSortField,
    sortDirection,
    sortedPortfolioOrder,
    handleSort,
    handlePortfolioDragEnd,
    handleStatDragEnd,
    toggleStat,
    toggleSummaryPortfolioSelection,
    renamePortfolioId,
    setRenamePortfolioId,
    activeMenuId,
    setActiveMenuId,
    menuPosition,
    setMenuPosition,
    confirmationConfig,
    setConfirmationConfig,
    handleDeletePortfolio,
    handleCopyPortfolio,
  };
}

