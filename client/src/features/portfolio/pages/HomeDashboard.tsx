import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Plus, BarChart2, Briefcase, TrendingUp, Search, ChevronDown, ChevronUp, ArrowUpDown, Check, MoreVertical, LineChart, Trash2, Loader2, Pencil, GripVertical, Columns, FilterX } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../services/api/client';
import { usePortfolioContext } from '../hooks/PortfolioContext';
import { useCurrency } from '../../../app/providers/CurrencyProvider';

import { CreatePortfolioModal } from '../components/CreatePortfolioModal';
import { RenamePortfolioModal } from '../components/RenamePortfolioModal';

import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { PerformanceChart } from '../components/PerformanceChart';

const SUMMARY_STATS = [
  { id: 'totalStocks', label: 'Total Stocks' },
  { id: 'totalPnL', label: 'Total P&L' },
  { id: 'netInvested', label: 'Net Invested' },
  { id: 'maxNetInvested', label: 'Max Invested' },
  { id: 'dayGain', label: 'Day Gain' },
  { id: 'unrealizedPnL', label: 'Unrealized P&L' },
  { id: 'realizedPnL', label: 'Realized P&L' },
  { id: 'currentValue', label: 'Current Value' },
  { id: 'xirr', label: 'XIRR' },
  { id: 'totalDividend', label: 'Total Dividend' },
  { id: 'brokerage', label: 'Total Brokerage & Tax' },
];

function SortableMenuItem({ stat, isVisible, onToggle }: { stat: any, isVisible: boolean, onToggle: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: stat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-full flex items-center px-2 py-1 text-[9px] text-left hover:bg-background text-primary transition-colors ${isDragging ? 'bg-surface shadow-md border border-divider rounded-md' : ''}`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="w-4 flex justify-center mr-1 shrink-0 cursor-grab active:cursor-grabbing text-secondary/50 hover:text-secondary"
      >
        <GripVertical className="w-3 h-3" />
      </div>
      <div className="w-4 flex justify-center mr-1 shrink-0 cursor-pointer" onClick={() => onToggle(stat.id)}>
        {isVisible && <Check className="w-3 h-3 text-primary" />}
      </div>
      <span className="flex-1 cursor-pointer select-none" onClick={() => onToggle(stat.id)}>{stat.label}</span>
    </div>
  );
}

function SortablePortfolioRow({ id, children }: { id: string, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
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
      className={`group/row border-b border-divider hover:bg-surface-hover transition-colors ${isDragging ? 'bg-surface shadow-lg relative z-50' : ''}`}
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

function AutoScaleRow({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    inner.style.transform = 'scale(1)';
    const availableWidth = container.clientWidth;
    const contentWidth = inner.scrollWidth;
    const naturalHeight = inner.offsetHeight;
    let s = 1;
    const isMobile = window.innerWidth < 640;
    
    if (!isMobile && contentWidth > availableWidth) {
      s = Math.max(0.85, availableWidth / contentWidth);
    }
    
    setScale(s);
    setHeight(naturalHeight * s);
    inner.style.transform = `scale(${s})`;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateScale]);

  useEffect(() => {
    updateScale();
  });

  return (
    <div ref={containerRef} className={`overflow-x-auto no-scrollbar ${className}`}>
      <div style={{ height }}>
        <div
          ref={innerRef}
          className="flex items-center gap-2 w-max"
          style={{ transform: `scale(${scale})`, transformOrigin: 'left top' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function HomeDashboard() {
  const { portfolios, setPortfolios, stocks, setIsCreateModalOpen, isCreateModalOpen, fetchData, settings, updateSettings, settingsLoading } = usePortfolioContext();
  const { currencySymbol, formatCurrency: fmtCurrency, formatCurrencyCompact, convert } = useCurrency();
  const navigate = useNavigate();
  const [homeStats, setHomeStats] = useState<any>(null);
  const [portfolioSummaries, setPortfolioSummaries] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [isChartVisible, setIsChartVisible] = useState(false);
  
  const [selectedSummaryPortfolioIds, setSelectedSummaryPortfolioIds] = useState<string[] | null>(null);
  const [isSummaryDropdownOpen, setIsSummaryDropdownOpen] = useState(false);
  const summaryDropdownRef = useRef<HTMLDivElement>(null);

  // Summary Layout State (shared by global summary card and portfolio list)
  const [summaryOrder, setSummaryOrder] = useState<string[]>(SUMMARY_STATS.map(s => s.id));
  const [visibleStats, setVisibleStats] = useState<Set<string>>(new Set(SUMMARY_STATS.map(s => s.id)));
  const [portfolioOrder, setPortfolioOrder] = useState<string[]>([]);
  const [isSettingsInitialized, setIsSettingsInitialized] = useState(false);
  
  const [navbarPortalElement, setNavbarPortalElement] = useState<HTMLElement | null>(null);
  const [navbarLeftPortalElement, setNavbarLeftPortalElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNavbarPortalElement(document.getElementById('navbar-actions-portal'));
    setNavbarLeftPortalElement(document.getElementById('navbar-left-portal'));
  }, []);

  useEffect(() => {
    if (!settingsLoading && !isSettingsInitialized) {
      if (settings?.home_summary_order) {
        const order = settings.home_summary_order;
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
    }
  }, [settings, settingsLoading, isSettingsInitialized]);

  // Sync state changes back to settings
  useEffect(() => {
    if (isSettingsInitialized) {
      updateSettings({
        home_summary_order: summaryOrder,
        home_summary_visible: Array.from(visibleStats),
        home_portfolio_order: portfolioOrder,
      });
    }
  }, [summaryOrder, visibleStats, portfolioOrder, isSettingsInitialized, updateSettings]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Auto-scaling summary stats
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const statsInnerRef = useRef<HTMLDivElement>(null);
  const [statsScale, setStatsScale] = useState(1);
  const [statsHeight, setStatsHeight] = useState<number | undefined>(undefined);

  const updateStatsScale = useCallback(() => {
    const container = statsContainerRef.current;
    const inner = statsInnerRef.current;
    if (!container || !inner) return;

    // Temporarily reset scale to measure natural width
    inner.style.transform = 'scale(1)';
    const cs = getComputedStyle(container);
    const availableWidth = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const contentWidth = inner.scrollWidth;
    const naturalHeight = inner.offsetHeight;
    
    let scale = 1;
    const isMobile = window.innerWidth < 640;
    
    if (!isMobile && contentWidth > availableWidth) {
      // Limit the shrinking to a minimum of 0.85 so fonts don't become unreadable on medium screens
      scale = Math.max(0.85, availableWidth / contentWidth);
    }
    
    setStatsScale(scale);
    setStatsHeight(naturalHeight * scale);
    inner.style.transform = `scale(${scale})`;
  }, []);

  useEffect(() => {
    const container = statsContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(updateStatsScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateStatsScale]);

  useEffect(() => {
    updateStatsScale();
  }, [visibleStats, summaryOrder, homeStats, updateStatsScale]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedPortfolioOrder = React.useMemo(() => {
    if (!sortField) return portfolioOrder;
    const sorted = [...portfolioOrder];
    sorted.sort((a, b) => {
      const pA = portfolios.find(p => p.id === a);
      const pB = portfolios.find(p => p.id === b);
      const psA = portfolioSummaries[a];
      const psB = portfolioSummaries[b];
      
      let valA: any = 0;
      let valB: any = 0;
      
      if (sortField === 'name') {
        valA = pA?.name || '';
        valB = pB?.name || '';
      } else if (sortField === 'totalStocks') {
        const pStocksA = stocks.filter(s => s.portfolio_id === a && Number(s.entry_price) > 0);
        valA = new Set(pStocksA.map(s => s.symbol)).size;
        const pStocksB = stocks.filter(s => s.portfolio_id === b && Number(s.entry_price) > 0);
        valB = new Set(pStocksB.map(s => s.symbol)).size;
      } else if (sortField === 'maxNetInvested') {
        valA = psA?.maxNetInvested || 0;
        valB = psB?.maxNetInvested || 0;
      } else if (sortField === 'netInvested') {
        valA = psA?.totalInvestment || 0;
        valB = psB?.totalInvestment || 0;
      } else if (sortField === 'unrealizedPnL') {
        valA = psA?.totalUnrealizedPnL || 0;
        valB = psB?.totalUnrealizedPnL || 0;
      } else if (sortField === 'realizedPnL') {
        valA = psA?.totalRealizedPnL || 0;
        valB = psB?.totalRealizedPnL || 0;
      } else if (sortField === 'totalDividend') {
        valA = psA?.totalDividend || 0;
        valB = psB?.totalDividend || 0;
      } else if (sortField === 'dayGain') {
        valA = psA?.totalDayGain || 0;
        valB = psB?.totalDayGain || 0;
      } else if (sortField === 'totalPnL') {
        valA = psA?.totalPnL || 0;
        valB = psB?.totalPnL || 0;
      } else if (sortField === 'currentValue') {
        valA = psA?.totalCurrentValue || 0;
        valB = psB?.totalCurrentValue || 0;
      } else if (sortField === 'brokerage') {
        valA = (psA?.totalBrokerage || 0) + (psA?.totalGovtTax || 0);
        valB = (psB?.totalBrokerage || 0) + (psB?.totalGovtTax || 0);
      } else if (sortField === 'xirr') {
        valA = psA?.xirr || 0;
        valB = psB?.xirr || 0;
      }

      valA = valA ?? 0;
      valB = valB ?? 0;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [portfolioOrder, sortField, sortDirection, portfolios, portfolioSummaries, stocks]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  useEffect(() => {
    setPortfolioOrder(prev => {
      const actualIds = portfolios.map(p => p.id);
      const newOrder = prev.filter(id => actualIds.includes(id));
      actualIds.forEach(id => {
        if (!newOrder.includes(id)) newOrder.push(id);
      });
      return newOrder;
    });
  }, [portfolios]);

  const handlePortfolioDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPortfolioOrder((items) => {
        const currentOrder = sortField ? [...sortedPortfolioOrder] : items;
        const oldIndex = currentOrder.indexOf(active.id as string);
        const newIndex = currentOrder.indexOf(over.id as string);
        return arrayMove(currentOrder, oldIndex, newIndex);
      });
      setSortField(null);
    }
  };

  // Modal states
  const [renamePortfolioId, setRenamePortfolioId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{bottom: number, right: number} | null>(null);

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

  const [confirmationConfig, setConfirmationConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDestructive?: boolean;
    requireInputToConfirm?: string;
  } | null>(null);

  const handleDeletePortfolio = async (id: string) => {
    try {
      await api.delete(`/api/portfolios/${id}`);
      setPortfolios(prev => prev.filter(p => p.id !== id));
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyPortfolio = async (id: string) => {
    try {
      const p = portfolios.find(p => p.id === id);
      if (!p) return;
      await api.post(`/api/portfolios/${id}/duplicate`, { name: `${p.name} (Copy)` });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

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

  const handleStatDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSummaryOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleStat = (id: string) => {
    setVisibleStats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const prevPortfoliosRef = useRef(portfolios);
  useEffect(() => {
    if (portfolios.length > 0 && selectedSummaryPortfolioIds === null) {
      setSelectedSummaryPortfolioIds(portfolios.map(p => p.id));
    } else if (selectedSummaryPortfolioIds !== null) {
      const prevIds = new Set(prevPortfoliosRef.current.map(p => p.id));
      const newPortfolios = portfolios.filter(p => !prevIds.has(p.id));
      if (newPortfolios.length > 0) {
        setSelectedSummaryPortfolioIds(prev => [...(prev || []), ...newPortfolios.map(p => p.id)]);
      }
    }
    prevPortfoliosRef.current = portfolios;
  }, [portfolios, selectedSummaryPortfolioIds]);

  useEffect(() => {
    if (selectedSummaryPortfolioIds === null) return;

    const fetchStats = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (selectedSummaryPortfolioIds.length > 0) {
          queryParams.set('portfolioIds', selectedSummaryPortfolioIds.join(','));
        } else {
          queryParams.set('portfolioIds', 'NONE');
        }
        const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
        const result = await api.get(`/api/calculations/dashboard/stats${qs}`);
        setHomeStats(result?.summary || null);
        setPortfolioSummaries(result?.portfolioSummaries || {});
      } catch (err) {
        console.error('Failed to fetch dashboard stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [portfolios, stocks, selectedSummaryPortfolioIds]); // Re-fetch when underlying data changes

  const toggleSummaryPortfolioSelection = (id: string) => {
    setSelectedSummaryPortfolioIds(prev => {
      if (!prev) return [id];
      if (prev.includes(id)) {
        return prev.filter(pId => pId !== id);
      }
      return [...prev, id];
    });
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-tertiary" /></div>;
  }

  if (!homeStats) return null;

  // Compute derived global stats for totalStocks and brokerage
  const selectedStocks = stocks.filter(s => {
    if (!selectedSummaryPortfolioIds) return true;
    return selectedSummaryPortfolioIds.includes(s.portfolio_id);
  });
  const totalUniqueStocks = new Set(selectedStocks.filter(s => Number(s.entry_price) > 0).map(s => s.symbol)).size;
  const totalBrokerageAndTax = Object.entries(portfolioSummaries)
    .filter(([pid]) => !selectedSummaryPortfolioIds || selectedSummaryPortfolioIds.includes(pid))
    .reduce((sum, [, ps]) => sum + ((ps?.totalBrokerage || 0) + (ps?.totalGovtTax || 0)), 0);

  const renderGlobalStat = (id: string) => {
    if (!visibleStats.has(id)) return null;
    switch (id) {
      case 'totalStocks': return (
          <div key="totalStocks" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">Total Stocks</span>
            <span className="text-sm sm:text-[15px] font-semibold text-primary">{totalUniqueStocks}</span>
          </div>
      );
      case 'totalPnL': return (
          <div key="totalPnL" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">Total P&L</span>
            <span className={`text-sm sm:text-[15px] font-semibold ${homeStats.totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
              {homeStats.totalPnL >= 0 ? '+' : ''}{fmtCurrency(Math.abs(homeStats.totalPnL))}
              <span className="ml-1.5 text-[10px] sm:text-xs opacity-90 font-medium">({homeStats.totalPnLPercent >= 0 ? '+' : ''}{homeStats.totalPnLPercent.toFixed(2)}%)</span>
            </span>
          </div>
      );
      case 'netInvested': return (
          <div key="netInvested" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">Net Invested</span>
            <span className="text-sm sm:text-[15px] font-semibold text-primary">{fmtCurrency(homeStats.totalInvestment)}</span>
          </div>
      );
      case 'maxNetInvested': return (
          <div key="maxNetInvested" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">Max Invested</span>
            <span className="text-sm sm:text-[15px] font-semibold text-primary">{fmtCurrency(homeStats.maxNetInvested)}</span>
          </div>
      );
      case 'dayGain': return (
          <div key="dayGain" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">Day Gain</span>
            <span className={`text-sm sm:text-[15px] font-semibold ${homeStats.totalDayGain >= 0 ? 'text-success' : 'text-danger'}`}>
              {homeStats.totalDayGain >= 0 ? '+' : ''}{fmtCurrency(Math.abs(homeStats.totalDayGain || 0))}
              <span className="ml-1.5 opacity-90 text-[10px] sm:text-sm font-medium">
                ({homeStats.totalDayGainPercent >= 0 ? '+' : ''}{(homeStats.totalDayGainPercent || 0).toFixed(2)}%)
              </span>
            </span>
          </div>
      );
      case 'unrealizedPnL': return (
          <div key="unrealizedPnL" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">Unrealized P&L</span>
            <span className={`text-sm sm:text-[15px] font-semibold ${homeStats.totalUnrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
              {homeStats.totalUnrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(Math.abs(homeStats.totalUnrealizedPnL))}
              <span className="ml-1.5 opacity-90 text-[10px] sm:text-sm font-medium">
                ({homeStats.totalUnrealizedPnL >= 0 ? '+' : ''}{homeStats.totalInvestment > 0 ? ((homeStats.totalUnrealizedPnL / homeStats.totalInvestment) * 100).toFixed(2) : '0.00'}%)
              </span>
            </span>
          </div>
      );
      case 'realizedPnL': return (
          <div key="realizedPnL" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">Realized P&L</span>
            <span className={`text-sm sm:text-[15px] font-semibold ${homeStats.totalRealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
              {homeStats.totalRealizedPnL >= 0 ? '+' : ''}{fmtCurrency(Math.abs(homeStats.totalRealizedPnL))}
            </span>
          </div>
      );
      case 'currentValue': return (
          <div key="currentValue" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">Current Value</span>
            <span className="text-sm sm:text-[15px] font-semibold text-primary">{fmtCurrency(homeStats.totalCurrentValue)}</span>
          </div>
      );
      case 'xirr': return (
          <div key="xirr" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">XIRR</span>
            <span className={`text-sm sm:text-[15px] font-semibold ${(homeStats.xirr || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
              {(homeStats.xirr || 0) >= 0 ? '+' : ''}{((homeStats.xirr || 0) * 100).toFixed(2)}%
            </span>
          </div>
      );
      case 'totalDividend': return (
          <div key="totalDividend" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">Total Dividend</span>
            <span className="text-sm sm:text-[15px] font-semibold text-primary">
              {fmtCurrency(homeStats.totalDividend)}
              <span className="ml-1.5 opacity-90 text-[10px] sm:text-sm font-medium text-success">
                ({homeStats.totalInvestment > 0 ? ((homeStats.totalDividend / homeStats.totalInvestment) * 100).toFixed(2) : '0.00'}%)
              </span>
            </span>
          </div>
      );
      case 'brokerage': return (
          <div key="brokerage" className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-secondary mb-1 flex items-center gap-1">Brokerage & Tax</span>
            <span className="text-sm sm:text-[15px] font-semibold text-danger">
              -{fmtCurrency(totalBrokerageAndTax)}
            </span>
          </div>
      );
      default: return null;
    }
  };

  const renderTotalCell = (id: string) => {
    if (!visibleStats.has(id)) return null;
    
    const cellClass = "px-2 py-2 text-[9px] sm:text-[10px] font-mono text-right whitespace-nowrap";
    switch (id) {
      case 'totalStocks': return <td key={id} className={`${cellClass} text-primary font-bold`}>{totalUniqueStocks}</td>;
      case 'maxNetInvested': return <td key={id} className={`${cellClass} text-primary font-bold`}>{fmtCurrency(homeStats.maxNetInvested)}</td>;
      case 'netInvested': return <td key={id} className={`${cellClass} text-primary font-bold`}>{fmtCurrency(homeStats.totalInvestment)}</td>;
      case 'unrealizedPnL': return <td key={id} className={`${cellClass} ${homeStats.totalUnrealizedPnL >= 0 ? 'text-success' : 'text-danger'} font-bold`}>
        {homeStats.totalUnrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(Math.abs(homeStats.totalUnrealizedPnL))} <span className="text-[8px] sm:text-[9px] font-medium opacity-80">({homeStats.totalUnrealizedPnL >= 0 ? '+' : ''}{homeStats.totalInvestment > 0 ? ((homeStats.totalUnrealizedPnL / homeStats.totalInvestment) * 100).toFixed(2) : '0.00'}%)</span>
      </td>;
      case 'realizedPnL': return <td key={id} className={`${cellClass} ${homeStats.totalRealizedPnL >= 0 ? 'text-success' : 'text-danger'} font-bold`}>
        {homeStats.totalRealizedPnL >= 0 ? '+' : ''}{fmtCurrency(Math.abs(homeStats.totalRealizedPnL))}
      </td>;
      case 'totalDividend': return <td key={id} className={`${cellClass} text-primary font-bold`}>
        {fmtCurrency(homeStats.totalDividend)} <span className="text-[8px] sm:text-[9px] font-medium opacity-80 text-success">({homeStats.totalInvestment > 0 ? ((homeStats.totalDividend / homeStats.totalInvestment) * 100).toFixed(2) : '0.00'}%)</span>
      </td>;
      case 'dayGain': return <td key={id} className={`${cellClass} ${homeStats.totalDayGain >= 0 ? 'text-success' : 'text-danger'} font-bold`}>
        {homeStats.totalDayGain >= 0 ? '+' : ''}{fmtCurrency(Math.abs(homeStats.totalDayGain || 0))} <span className="text-[8px] sm:text-[9px] font-medium opacity-80">({homeStats.totalDayGainPercent >= 0 ? '+' : ''}{(homeStats.totalDayGainPercent || 0).toFixed(2)}%)</span>
      </td>;
      case 'totalPnL': return <td key={id} className={`${cellClass} ${homeStats.totalPnL >= 0 ? 'text-success' : 'text-danger'} font-bold`}>
        {homeStats.totalPnL >= 0 ? '+' : ''}{fmtCurrency(Math.abs(homeStats.totalPnL))} <span className="text-[8px] sm:text-[9px] font-medium opacity-80">({homeStats.totalPnLPercent >= 0 ? '+' : ''}{(homeStats.totalPnLPercent || 0).toFixed(2)}%)</span>
      </td>;
      case 'currentValue': return <td key={id} className={`${cellClass} text-primary font-bold`}>{fmtCurrency(homeStats.totalCurrentValue)}</td>;
      case 'brokerage': return <td key={id} className={`${cellClass} text-danger font-bold`}>-{fmtCurrency(totalBrokerageAndTax)}</td>;
      case 'xirr': return <td key={id} className={`${cellClass} ${homeStats.xirr >= 0 ? 'text-success' : 'text-danger'} font-bold`}>
        {homeStats.xirr >= 0 ? '+' : ''}{((homeStats.xirr || 0) * 100).toFixed(2)}%
      </td>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col">
      {/* Summary Section */}
      {navbarLeftPortalElement && createPortal(
        <div className="relative z-40" ref={summaryDropdownRef}>
          <button 
            onClick={() => setIsSummaryDropdownOpen(!isSummaryDropdownOpen)}
            className="flex items-center justify-between gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-primary hover:opacity-80 transition-opacity bg-surface py-1 sm:py-1.5 px-1.5 sm:px-3 rounded border border-divider min-w-[110px] sm:w-[140px]"
          >
            <span className="truncate text-left">
            {selectedSummaryPortfolioIds === null || selectedSummaryPortfolioIds.length === portfolios.length 
              ? 'All Portfolios' 
              : selectedSummaryPortfolioIds.length === 1 
                ? portfolios.find(p => p.id === selectedSummaryPortfolioIds[0])?.name || 'Selected'
                : selectedSummaryPortfolioIds.length === 0 
                  ? 'None Selected'
                  : `${selectedSummaryPortfolioIds.length} Portfolios Selected`}
            </span>
            <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-secondary transition-transform ${isSummaryDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isSummaryDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-56 bg-surface border border-divider rounded-lg shadow-xl shadow-black/20 py-1 max-h-64 overflow-y-auto z-50">
              <button
                onClick={() => {
                  const allSelected = selectedSummaryPortfolioIds?.length === portfolios.length;
                  if (allSelected) {
                    setSelectedSummaryPortfolioIds([]);
                  } else {
                    setSelectedSummaryPortfolioIds(portfolios.map(p => p.id));
                  }
                }}
                className="w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center gap-2 border-b border-divider text-primary hover:bg-surface-hover font-medium mb-1"
              >
                <div className={`w-3.5 h-3.5 shrink-0 rounded-sm border ${selectedSummaryPortfolioIds?.length === portfolios.length ? 'bg-primary border-primary flex items-center justify-center' : 'border-secondary'}`}>
                  {selectedSummaryPortfolioIds?.length === portfolios.length && <Check className="w-2.5 h-2.5 text-background" />}
                </div>
                <span>{selectedSummaryPortfolioIds?.length === portfolios.length ? 'Unselect All' : 'Select All'}</span>
              </button>
              {portfolios.map(p => {
                const isSelected = selectedSummaryPortfolioIds?.includes(p.id) || false;
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleSummaryPortfolioSelection(p.id)}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 truncate ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}
                    title={p.name}
                  >
                    <div className={`w-3.5 h-3.5 shrink-0 rounded-sm border ${isSelected ? 'bg-primary border-primary flex items-center justify-center' : 'border-secondary'}`}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-background" />}
                    </div>
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>,
        navbarLeftPortalElement
      )}
      {navbarPortalElement && createPortal(
        <>
          {sortField !== null && (
            <button
              onClick={() => {
                setSortField(null);
              }}
              className="flex items-center justify-center gap-1 sm:gap-1.5 p-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium text-secondary hover:text-primary hover:bg-surface-hover transition-colors rounded border border-divider"
              title="Clear sorting"
            >
              <FilterX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center justify-center gap-1 sm:gap-1.5 p-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium bg-primary text-background hover:opacity-90 transition-opacity rounded"
                title="Create New Portfolio"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Create New Portfolio</span>
              </button>

              <div className="relative flex" ref={settingsRef}>
                <button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-surface hover:bg-surface-hover border border-divider rounded text-secondary hover:text-primary transition-colors"
                  title="Customize Summary"
                >
                  <Columns className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                
                {isSettingsOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-surface border border-divider rounded-lg shadow-xl shadow-black/20 py-1 max-h-80 overflow-y-auto z-50">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleStatDragEnd}
                    >
                      <SortableContext items={summaryOrder} strategy={verticalListSortingStrategy}>
                        {summaryOrder.map(id => {
                          const stat = SUMMARY_STATS.find(s => s.id === id);
                          if (!stat) return null;
                          return (
                            <SortableMenuItem
                              key={id}
                              stat={stat}
                              isVisible={visibleStats.has(id)}
                              onToggle={toggleStat}
                            />
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </div>
            </>,
            navbarPortalElement
          )}
      
      {isChartVisible && <PerformanceChart selectedPortfolioId={selectedSummaryPortfolioIds?.length ? selectedSummaryPortfolioIds.join(',') : 'NONE'} />}

      {/* Portfolio List */}
      <div className="flex flex-col mt-4 mb-4">
        {portfolios.length > 0 ? (
          <div className="bg-surface overflow-x-auto rounded-lg border border-divider shadow-sm relative">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-surface sticky top-0 z-40">
                <tr className="border-b border-divider">
                  <th className="w-6 px-2 py-1.5 bg-surface z-30 sticky left-0"></th>
                  <th className="px-2 py-1.5 text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold text-secondary min-w-[120px] bg-surface cursor-pointer hover:bg-surface-hover transition-colors group z-30 sticky left-6 border-r border-divider" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1 justify-start">
                      <span>Portfolio</span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-tertiary group-hover:text-secondary transition-colors shrink-0 opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  {summaryOrder.map(id => {
                    if (!visibleStats.has(id)) return null;
                    const stat = SUMMARY_STATS.find(s => s.id === id);
                    return (
                      <th key={id} className="px-2 py-1.5 text-[7px] sm:text-[9px] uppercase tracking-wider font-semibold text-secondary bg-surface cursor-pointer hover:bg-surface-hover transition-colors group" onClick={() => handleSort(id)}>
                        <div className="flex items-center gap-1 justify-end">
                          <span>{stat?.label}</span>
                          {sortField === id ? (
                            sortDirection === 'asc' ? <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-tertiary group-hover:text-secondary transition-colors shrink-0 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-1.5 text-[7px] sm:text-[9px] uppercase tracking-wider font-semibold text-secondary bg-surface text-right">Actions</th>
                </tr>
                <tr className="bg-surface-hover border-b-[3px] border-divider shadow-sm">
                  <td className="w-6 px-2 py-2 sticky left-0 bg-surface-hover z-30"></td>
                  <td className="px-2 py-2 text-[10px] sm:text-[11px] font-semibold text-primary sticky left-6 bg-surface-hover z-30 border-r border-divider">Total</td>
                  {summaryOrder.map(id => renderTotalCell(id))}
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1 relative shrink-0">
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const isAlreadyTotal = selectedSummaryPortfolioIds?.length === portfolios.length;
                          if (isChartVisible && isAlreadyTotal) {
                            setIsChartVisible(false);
                          } else {
                            setSelectedSummaryPortfolioIds(portfolios.map(p => p.id));
                            setIsChartVisible(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className={`p-1 sm:p-1.5 rounded transition-colors ${isChartVisible && selectedSummaryPortfolioIds?.length === portfolios.length ? 'bg-surface-hover text-primary border border-divider' : 'text-tertiary hover:text-primary hover:bg-surface-hover'}`}
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
                  onDragEnd={handlePortfolioDragEnd}
                >
                  <SortableContext items={sortedPortfolioOrder} strategy={verticalListSortingStrategy}>
                    {sortedPortfolioOrder.filter(pid => !selectedSummaryPortfolioIds || selectedSummaryPortfolioIds.includes(pid)).map(pid => {
                      const p = portfolios.find(p => p.id === pid);
                      if (!p) return null;
                      
                      const pStocks = stocks.filter(s => s.portfolio_id === p.id && Number(s.entry_price) > 0);
                      const pSymbols = [...new Set(pStocks.map(s => s.symbol))];
                      const ps = portfolioSummaries[p.id];

                      const renderTableCell = (value: React.ReactNode, valueClass: string = "text-primary", key: string) => (
                        <td key={key} className={`px-2 py-2 text-[9px] sm:text-[10px] font-mono text-right whitespace-nowrap ${valueClass}`}>
                          {value}
                        </td>
                      );

                      const renderListStat = (id: string, ps: any, pSymbols: any) => {
                        if (!visibleStats.has(id)) return null;
                        if (!ps) return <td key={id} className="px-2 py-2 text-right text-secondary">—</td>;
                        
                        switch (id) {
                          case 'totalStocks': return renderTableCell(pSymbols.length, "text-primary font-semibold", id);
                          case 'maxNetInvested': return renderTableCell(fmtCurrency(ps.maxNetInvested), "text-primary", id);
                          case 'netInvested': return renderTableCell(fmtCurrency(ps.totalInvestment), "text-primary", id);
                          case 'unrealizedPnL': return renderTableCell(
                            <span>{ps.totalUnrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(Math.abs(ps.totalUnrealizedPnL))} <span className="text-[8px] sm:text-[9px] font-medium opacity-80">({ps.totalUnrealizedPnL >= 0 ? '+' : ''}{ps.unrealizedPnLPercent.toFixed(2)}%)</span></span>,
                            ps.totalUnrealizedPnL >= 0 ? 'text-success' : 'text-danger',
                            id
                          );
                          case 'realizedPnL': return renderTableCell(
                            `${ps.totalRealizedPnL >= 0 ? '+' : ''}${fmtCurrency(Math.abs(ps.totalRealizedPnL))}`,
                            ps.totalRealizedPnL >= 0 ? 'text-success' : 'text-danger',
                            id
                          );
                          case 'totalDividend': return renderTableCell(
                            <span>{fmtCurrency(ps.totalDividend)} <span className="text-[8px] sm:text-[9px] font-medium opacity-80">({ps.totalInvestment > 0 ? ((ps.totalDividend / ps.totalInvestment) * 100).toFixed(2) : '0.00'}%)</span></span>,
                            "text-primary",
                            id
                          );
                          case 'dayGain': return renderTableCell(
                            <span>{ps.totalDayGain >= 0 ? '+' : ''}{fmtCurrency(Math.abs(ps.totalDayGain || 0))} <span className="text-[8px] sm:text-[9px] font-medium opacity-80">({ps.totalDayGainPercent >= 0 ? '+' : ''}{ps.totalDayGainPercent.toFixed(2)}%)</span></span>,
                            ps.totalDayGain >= 0 ? 'text-success' : 'text-danger',
                            id
                          );
                          case 'totalPnL': return renderTableCell(
                            <span>{ps.totalPnL >= 0 ? '+' : ''}{fmtCurrency(Math.abs(ps.totalPnL))} <span className="text-[8px] sm:text-[9px] font-medium opacity-80">({ps.totalPnLPercent >= 0 ? '+' : ''}{ps.totalPnLPercent.toFixed(2)}%)</span></span>,
                            ps.totalPnL >= 0 ? 'text-success' : 'text-danger',
                            id
                          );
                          case 'currentValue': return renderTableCell(
                            fmtCurrency(ps.totalCurrentValue),
                            "text-primary font-semibold",
                            id
                          );
                          case 'brokerage': return renderTableCell(
                            `-${fmtCurrency((ps.totalBrokerage || 0) + (ps.totalGovtTax || 0))}`,
                            "text-danger",
                            id
                          );
                          case 'xirr': return renderTableCell(
                            `${ps.xirr >= 0 ? '+' : ''}${(ps.xirr * 100).toFixed(2)}%`,
                            `font-bold ${ps.xirr >= 0 ? 'text-success' : 'text-danger'}`,
                            id
                          );
                          default: return null;
                        }
                      };

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
                          {summaryOrder.map(id => renderListStat(id, ps, pSymbols))}
                          <td className="px-2 py-2 text-right">
                            <div className="flex items-center justify-end gap-1 relative shrink-0">
                              <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  const isAlreadyThisPortfolio = selectedSummaryPortfolioIds?.length === 1 && selectedSummaryPortfolioIds[0] === p.id;
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
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (activeMenuId === p.id) {
                                    setActiveMenuId(null);
                                    setMenuPosition(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMenuPosition({ bottom: window.innerHeight - rect.top, right: window.innerWidth - rect.right });
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
                                  style={{ bottom: `${menuPosition.bottom + 4}px`, right: `${menuPosition.right}px` }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => { setRenamePortfolioId(p.id); setActiveMenuId(null); }}
                                    className="w-full text-left px-4 py-2 text-xs text-secondary hover:bg-background hover:text-primary transition-colors"
                                  >
                                    Rename
                                  </button>
                                  <button
                                    onClick={() => { handleCopyPortfolio(p.id); setActiveMenuId(null); }}
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
                                          handleDeletePortfolio(p.id);
                                          setConfirmationConfig(null);
                                        }
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-surface-hover rounded-xl flex items-center justify-center mb-4">
              <Briefcase className="w-6 h-6 text-tertiary" />
            </div>
            <p className="text-sm text-secondary mb-2">No active portfolio.</p>
            <p className="text-xs text-tertiary max-w-xs mb-4">Create your first portfolio to start tracking your investments.</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreatePortfolioModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => fetchData()}
      />

      <RenamePortfolioModal
        isOpen={!!renamePortfolioId}
        onClose={() => setRenamePortfolioId(null)}
        onRenamed={() => fetchData()}
        portfolioId={renamePortfolioId}
        currentName={portfolios.find(p => p.id === renamePortfolioId)?.name || ''}
      />


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
    </div>
  );
}
