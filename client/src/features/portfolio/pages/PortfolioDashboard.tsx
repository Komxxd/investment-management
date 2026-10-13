import React, { useState, useEffect, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { calculateXIRR } from '../../../utils/xirr'
import { Plus, Briefcase, Trash2, Pencil, ChevronDown, ChevronRight, ChevronUp, ArrowUpCircle, ArrowDownCircle, PanelLeftClose, PanelLeftOpen, Copy, FilterX, ArrowUpDown, Columns, Check, Info, User, LogOut, Folder, Download, Upload, Home, LayoutDashboard, RefreshCw, Sun, Moon, GripVertical, MoreVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../../services/api/client'
import { usePortfolioContext } from '../hooks/PortfolioContext'
import { useTheme } from '../../../app/providers/ThemeProvider'
import { useCurrency } from '../../../app/providers/CurrencyProvider'
import { useAuth } from '../../../app/providers/AuthProvider'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { AddStockModal } from '../../stocks/components/AddStockModal'
import { SellStockModal } from '../../stocks/components/SellStockModal'
import { EditStockModal } from '../../stocks/components/EditStockModal'
import { EditSoldStockModal } from '../../stocks/components/EditSoldStockModal'
import { RenamePortfolioModal } from '../components/RenamePortfolioModal'
import { CorporateActionModal } from '../../stocks/components/CorporateActionModal'
import { CorporateActionsViewerModal } from '../../stocks/components/CorporateActionsViewerModal'
import { AssetSearch } from '../../stocks/components/AssetSearch'
import { PortfolioInfoModal } from '../components/PortfolioInfoModal'
import { RebalanceModal } from '../../stocks/components/RebalanceModal'
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal'

const ALL_SUMMARY_STATS = [
  { id: 'totalStocks', label: 'Total Stocks' },
  { id: 'maxNetInvested', label: 'Max Invested' },
  { id: 'netInvested', label: 'Net Invested' },
  { id: 'currentValue', label: 'Current Value' },
  { id: 'unrealizedPnL', label: 'Unrealized P&L' },
  { id: 'realizedPnL', label: 'Realized P&L' },
  { id: 'totalDividend', label: 'Total Dividend' },
  { id: 'brokerage', label: 'Total Brokerage & Tax' },
  { id: 'totalPnL', label: 'Total P&L' },
  { id: 'dayGain', label: 'Day Gain' },
  { id: 'xirr', label: 'XIRR' }
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

function SortableStatCard({ id, children }: { id: string, children: React.ReactNode }) {
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
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

function SortableColumnMenuItem({ col, isVisible, onToggle }: { col: any, isVisible: boolean, onToggle: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: col.id });

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
      <div className="w-4 flex justify-center mr-1 shrink-0 cursor-pointer" onClick={() => onToggle(col.id)}>
        {isVisible && <Check className="w-3 h-3 text-primary" />}
      </div>
      <span className="flex-1 cursor-pointer select-none" onClick={() => onToggle(col.id)}>{col.label}</span>
    </div>
  );
}

function SortableHeaderCell({ 
  field, 
  label, 
  width, 
  isNumber, 
  sortField, 
  sortDirection, 
  resizingColId,
  onSort, 
  onResizeStart,
  className
}: { 
  field: string, 
  label: string, 
  width: number, 
  isNumber: boolean, 
  sortField: string | null, 
  sortDirection: 'asc' | 'desc', 
  resizingColId: string | undefined,
  onSort: (field: string) => void, 
  onResizeStart: (e: React.MouseEvent, id: string, w: number) => void,
  className?: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };
  
  if (isDragging) {
    style.zIndex = 100;
  }

  return (
    <th 
      ref={setNodeRef}
      style={{ ...style, width, minWidth: width, maxWidth: width }}
      {...listeners}
      className={`px-1.5 py-1.5 sm:px-3 sm:py-2 text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold text-secondary cursor-pointer hover:bg-surface-hover transition-colors select-none group relative ${resizingColId === field ? 'bg-surface-hover' : ''} ${isDragging ? 'shadow-md border border-divider cursor-grabbing' : 'bg-surface'} ${isNumber ? 'text-right' : 'text-left'} ${className || ''}`}
      onClick={(e) => {
        // Prevent sorting if we are dragging or resizing
        if (isDragging) return;
        onSort(field);
      }}
    >
      <div className={`flex items-center gap-1 overflow-hidden ${isNumber ? 'justify-end' : 'justify-start'}`}>
        <span className="truncate">{label}</span>
        {sortField === field ? (
          sortDirection === 'asc' ? <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" />
        ) : (
          <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-tertiary group-hover:text-secondary transition-colors shrink-0" />
        )}
      </div>
      
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block z-50 whitespace-nowrap bg-surface text-primary text-[8px] sm:text-[10px] font-medium px-2 py-1 rounded border border-divider pointer-events-none normal-case tracking-normal">
        {label}
      </div>

      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(e, field, width);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
}

const ALL_COLUMNS = [
  { id: 'symbol', label: 'Symbol' },
  { id: 'netQty', label: 'Net Qty' },
  { id: 'avgBuyPrice', label: 'Avg Buy' },
  { id: 'netCostBasis', label: 'Invested' },
  { id: 'livePrice', label: 'Live Price' },
  { id: 'currentValue', label: 'Current Value' },
  { id: 'unrealizedPnL', label: 'Unrealized PnL' },
  { id: 'unrealizedPnLPct', label: 'Unrealized %' },
  { id: 'realizedPnL', label: 'Realized PnL' },
  { id: 'realizedPnLPct', label: 'Realized %' },
  { id: 'totalDividend', label: 'Dividend' },
  { id: 'brokerage', label: 'Brokerage' },
  { id: 'govtTax', label: 'Govt Tax' },
  { id: 'totalPnL', label: 'Total PnL' },
  { id: 'totalPnLPct', label: 'Total PnL %' },
  { id: 'xirr', label: 'XIRR' },
  { id: 'portfolioWeight', label: '% Invested' },
  { id: 'currentValueWeight', label: '% Current Value' },
  { id: 'priceChange', label: 'Change' },
  { id: 'changePercent', label: 'Change %' },
  { id: 'dayHigh', label: 'Day High' },
  { id: 'dayLow', label: 'Day Low' },
  { id: '52wkHigh', label: '52W High' },
  { id: '52wkLow', label: '52W Low' },
  { id: 'marketCap', label: 'Mkt Cap' },
  { id: 'volume', label: 'Volume' },
  { id: 'avgVolume', label: 'Avg Volume (3M)' },
  { id: 'tradeValue', label: 'Trade Value' },
  { id: 'dayGain', label: 'Day Gain' },
  { id: 'dayGainPct', label: 'Day Gain %' }
];



interface Stock {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  entry_price: number;
  brokerage?: number;
  govt_tax?: number;
  entry_date: string;
}

interface SoldStock {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  exit_price: number;
  brokerage?: number;
  govt_tax?: number;
  exit_date: string;
}



export function PortfolioDashboard() {
  const { 
    portfolios, setPortfolios, 
    stocks, setStocks, 
    soldStocks, setSoldStocks, 
    loading, setLoading,
    livePrices, setLivePrices, 
    pricesLoading, setPricesLoading,
    fetchData
  } = usePortfolioContext();
  const navigate = useNavigate();
  const { currencySymbol, formatCurrency: fmtCurrency, formatCurrencyCompact, convert } = useCurrency();
  const { portfolioId } = useParams<{ portfolioId: string }>();

  const activePortfolioId = portfolioId || null;
  const calculationTime = React.useMemo(() => Date.now(), []);
  const [isPortfolioInfoModalOpen, setIsPortfolioInfoModalOpen] = useState(false);
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [addStockPortfolioId, setAddStockPortfolioId] = useState<string | null>(null);
  const [addStockInitialSymbol, setAddStockInitialSymbol] = useState<string>('');
  const [addStockInitialPrice, setAddStockInitialPrice] = useState<number | undefined>(undefined);
  const [sellStockPortfolioId, setSellStockPortfolioId] = useState<string | null>(null);
  const [sellStockInitialSymbol, setSellStockInitialSymbol] = useState<string>('');
  const [sellStockInitialPrice, setSellStockInitialPrice] = useState<number | undefined>(undefined);
  const [editStockId, setEditStockId] = useState<string | null>(null);
  const [editSoldStockId, setEditSoldStockId] = useState<string | null>(null);
  const [renamePortfolioId, setRenamePortfolioId] = useState<string | null>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [corporateActionType, setCorporateActionType] = useState<'bonus' | 'split' | 'dividend' | null>(null);
  const [viewCorporateActionsSymbol, setViewCorporateActionsSymbol] = useState<string | null>(null);
  const [portfolioFilters, setPortfolioFilters] = useState<Record<string, { filterType: 'open' | 'closed' | 'all'; searchSelectedSymbols: string[]; sortField: string | null; sortDirection: 'asc' | 'desc' }>>({});

  const currentFilters = activePortfolioId && portfolioFilters[activePortfolioId] 
    ? portfolioFilters[activePortfolioId] 
    : { filterType: 'open' as const, searchSelectedSymbols: [] as string[], sortField: null as string | null, sortDirection: 'desc' as const };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filterType = currentFilters.filterType;
  const searchSelectedSymbols = currentFilters.searchSelectedSymbols;
  const sortField = currentFilters.sortField;
  const sortDirection = currentFilters.sortDirection;

  const setFilterType = (val: 'open' | 'closed' | 'all') => {
    if (!activePortfolioId) return;
    setPortfolioFilters(prev => ({ ...prev, [activePortfolioId]: { ...(prev[activePortfolioId] || { filterType: 'open', searchSelectedSymbols: [], sortField: null, sortDirection: 'desc' }), filterType: val } }));
  };

  const setSearchSelectedSymbols = (val: string[] | ((prev: string[]) => string[])) => {
    if (!activePortfolioId) return;
    setPortfolioFilters(prev => {
      const current = prev[activePortfolioId] || { filterType: 'open', searchSelectedSymbols: [], sortField: null, sortDirection: 'desc' };
      const nextVal = typeof val === 'function' ? val(current.searchSelectedSymbols) : val;
      return { ...prev, [activePortfolioId]: { ...current, searchSelectedSymbols: nextVal } };
    });
  };

  const setSortField = (val: string | null | ((prev: string | null) => string | null)) => {
    if (!activePortfolioId) return;
    setPortfolioFilters(prev => {
      const current = prev[activePortfolioId] || { filterType: 'open', searchSelectedSymbols: [], sortField: null, sortDirection: 'desc' };
      const nextVal = typeof val === 'function' ? val(current.sortField) : val;
      return { ...prev, [activePortfolioId]: { ...current, sortField: nextVal } };
    });
  };

  const setSortDirection = (val: 'asc' | 'desc' | ((prev: 'asc' | 'desc') => 'asc' | 'desc')) => {
    if (!activePortfolioId) return;
    setPortfolioFilters(prev => {
      const current = prev[activePortfolioId] || { filterType: 'open', searchSelectedSymbols: [], sortField: null, sortDirection: 'desc' };
      const nextVal = typeof val === 'function' ? val(current.sortDirection) : val;
      return { ...prev, [activePortfolioId]: { ...current, sortDirection: nextVal } };
    });
  };



  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());

  const [isColumnsDropdownOpen, setIsColumnsDropdownOpen] = useState(false);
  const [confirmationConfig, setConfirmationConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDestructive?: boolean;
    requireInputToConfirm?: string;
  } | null>(null);

  const [portfolioVisibleSummaryStats, setPortfolioVisibleSummaryStats] = useState<Record<string, Set<string>>>({});

  const [isSummaryDropdownOpen, setIsSummaryDropdownOpen] = useState(false);

  const [portfolioSummaryStatsOrder, setPortfolioSummaryStatsOrder] = useState<Record<string, string[]>>({});

  const activeVisibleSummaryStats = (() => {
    if (activePortfolioId && portfolioVisibleSummaryStats[activePortfolioId]) {
      return new Set(portfolioVisibleSummaryStats[activePortfolioId]);
    }
    if (portfolioVisibleSummaryStats['global_fallback']) {
      return new Set(portfolioVisibleSummaryStats['global_fallback']);
    }
    return new Set(ALL_SUMMARY_STATS.map(s => s.id));
  })();

  const activeSummaryStatsOrder = (() => {
    let order = (activePortfolioId && portfolioSummaryStatsOrder[activePortfolioId])
      ? [...portfolioSummaryStatsOrder[activePortfolioId]]
      : portfolioSummaryStatsOrder['global_fallback']
        ? [...portfolioSummaryStatsOrder['global_fallback']]
        : ALL_SUMMARY_STATS.map(s => s.id);

    const missingStats = ALL_SUMMARY_STATS.map(s => s.id).filter(id => !order.includes(id));
    if (missingStats.length > 0) {
      order.push(...missingStats);
    }
    return order;
  })();

  const handleSummaryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && activePortfolioId) {
      setPortfolioSummaryStatsOrder(prev => {
        const currentOrder = activeSummaryStatsOrder;
        const oldIndex = currentOrder.indexOf(active.id as string);
        const newIndex = currentOrder.indexOf(over.id as string);
        const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
        return { ...prev, [activePortfolioId]: newOrder };
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const toggleSummaryStat = (id: string) => {
    if (!activePortfolioId) return;
    setPortfolioVisibleSummaryStats(prev => {
      const current = prev[activePortfolioId] || (prev['global_fallback'] ? new Set(prev['global_fallback']) : new Set(ALL_SUMMARY_STATS.map(s => s.id)));
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [activePortfolioId]: next };
    });
  };

  const resetSummaryStats = () => {
    if (!activePortfolioId) return;
    setPortfolioVisibleSummaryStats(prev => {
      const next = { ...prev };
      delete next[activePortfolioId];
      return next;
    });
    setPortfolioSummaryStatsOrder(prev => {
      const next = { ...prev };
      delete next[activePortfolioId];
      return next;
    });
    setIsSummaryDropdownOpen(false);
  };

  const applySummaryLayoutToAll = () => {
    if (!activePortfolioId) return;
    const currentOrder = activeSummaryStatsOrder;
    const currentVisible = activeVisibleSummaryStats;

    const newOrderState: Record<string, string[]> = {};
    const newVisibleState: Record<string, Set<string>> = {};

    portfolios.forEach(p => {
      newOrderState[p.id] = [...currentOrder];
      newVisibleState[p.id] = new Set(currentVisible);
    });

    setPortfolioSummaryStatsOrder(newOrderState);
    setPortfolioVisibleSummaryStats(newVisibleState);
    setIsSummaryDropdownOpen(false);
  };

  const [portfolioVisibleColumns, setPortfolioVisibleColumns] = useState<Record<string, Set<string>>>({});
  const [portfolioColumnOrder, setPortfolioColumnOrder] = useState<Record<string, string[]>>({});
  const [portfolioColumnWidths, setPortfolioColumnWidths] = useState<Record<string, Record<string, number>>>({});

  const { settings, updateSettings, settingsLoading } = usePortfolioContext();
  const [isSettingsInitialized, setIsSettingsInitialized] = useState(false);

  useEffect(() => {
    if (!settingsLoading && !isSettingsInitialized) {
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
          result[key] = new Set(settings.portfolioVisibleColumns[key]);
        }
        setPortfolioVisibleColumns(result);
      }
      
      if (settings?.portfolioColumnOrder) setPortfolioColumnOrder(settings.portfolioColumnOrder);
      if (settings?.portfolioColumnWidths) setPortfolioColumnWidths(settings.portfolioColumnWidths);
      
      setIsSettingsInitialized(true);
    }
  }, [settings, settingsLoading, isSettingsInitialized]);

  // Sync settings back to backend
  useEffect(() => {
    if (isSettingsInitialized) {
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
        portfolioColumnWidths
      });
    }
  }, [
    portfolioFilters, 
    expandedSymbols, 
    portfolioVisibleSummaryStats, 
    portfolioSummaryStatsOrder, 
    portfolioVisibleColumns, 
    portfolioColumnOrder, 
    portfolioColumnWidths, 
    isSettingsInitialized,
    updateSettings
  ]);

  const [resizingCol, setResizingCol] = useState<{ id: string, startX: number, startWidth: number } | null>(null);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    if (!resizingCol || !activePortfolioId) return;

    const handleMouseMove = (e: MouseEvent) => {
      hasDraggedRef.current = true;
      const deltaX = e.clientX - resizingCol.startX;
      const newWidth = Math.max(50, resizingCol.startWidth + deltaX);
      setPortfolioColumnWidths(prev => ({
        ...prev,
        [activePortfolioId]: {
          ...(prev[activePortfolioId] || {}),
          [resizingCol.id]: newWidth
        }
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

  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  const visibleColumns = (() => {
    return (activePortfolioId && portfolioVisibleColumns[activePortfolioId]) 
      ? new Set(portfolioVisibleColumns[activePortfolioId]) 
      : new Set(ALL_COLUMNS.map(c => c.id));
  })();

  const activeColumnOrder = (() => {
    let order = (activePortfolioId && portfolioColumnOrder[activePortfolioId])
      ? [...portfolioColumnOrder[activePortfolioId]]
      : ALL_COLUMNS.map(c => c.id);
    
    const missingCols = ALL_COLUMNS.map(c => c.id).filter(id => !order.includes(id));
    if (missingCols.length > 0) {
      missingCols.forEach(missingCol => {
        let inserted = false;
        if (missingCol === 'unrealizedPnLPct') {
          const idx = order.indexOf('unrealizedPnL');
          if (idx !== -1) { order.splice(idx + 1, 0, missingCol); inserted = true; }
        } else if (missingCol === 'realizedPnLPct') {
          const idx = order.indexOf('realizedPnL');
          if (idx !== -1) { order.splice(idx + 1, 0, missingCol); inserted = true; }
        } else if (missingCol === 'totalPnLPct') {
          const idx = order.indexOf('totalPnL');
          if (idx !== -1) { order.splice(idx + 1, 0, missingCol); inserted = true; }
        }
        
        if (!inserted) {
          order.push(missingCol);
        }
      });
    }
    return order;
  })();

  const toggleColumn = (colId: string) => {
    if (!activePortfolioId) return;
    setPortfolioVisibleColumns(prev => {
      const current = prev[activePortfolioId] || new Set(ALL_COLUMNS.map(c => c.id));
      const next = new Set(current);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return { ...prev, [activePortfolioId]: next };
    });
  };

  const resetColumns = () => {
    if (!activePortfolioId) return;
    setPortfolioColumnOrder(prev => {
      const next = { ...prev };
      delete next[activePortfolioId];
      return next;
    });
    setPortfolioVisibleColumns(prev => {
      const next = { ...prev };
      delete next[activePortfolioId];
      return next;
    });
    setPortfolioColumnWidths(prev => {
      const next = { ...prev };
      delete next[activePortfolioId];
      return next;
    });
  };

  const applyColumnLayoutToAll = () => {
    if (!activePortfolioId) return;
    
    const currentOrder = activeColumnOrder;
    const currentVisible = portfolioVisibleColumns[activePortfolioId] || new Set(ALL_COLUMNS.map(c => c.id));
    const currentWidths = portfolioColumnWidths[activePortfolioId] || {};

    const newOrderState: Record<string, string[]> = {};
    const newVisibleState: Record<string, Set<string>> = {};
    const newWidthsState: Record<string, Record<string, number>> = {};

    portfolios.forEach(p => {
      newOrderState[p.id] = [...currentOrder];
      newVisibleState[p.id] = new Set(currentVisible);
      newWidthsState[p.id] = { ...currentWidths };
    });

    setPortfolioColumnOrder(newOrderState);
    setPortfolioVisibleColumns(newVisibleState);
    setPortfolioColumnWidths(newWidthsState);
    setIsColumnsDropdownOpen(false);
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && activePortfolioId) {
      setPortfolioColumnOrder((prev) => {
        const currentOrder = activeColumnOrder;
        const oldIndex = currentOrder.indexOf(active.id as string);
        const newIndex = currentOrder.indexOf(over.id as string);
        const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
        return { ...prev, [activePortfolioId]: newOrder };
      });
    }
  };



  // Real-time prices state


  const executeDeleteAsset = async (symbol: string) => {
    if (!activePortfolio) return;
    try {
      // Find all stocks to delete for this symbol in this portfolio
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
    } catch (err: any) {
      console.error('Error deleting asset:', err.message);
      alert(`Failed to delete ${symbol}. Please try again.`);
    }
  };

  const handleDeleteStock = (stockId: string) => {
    const stockToDelete = stocks.find(s => s.id === stockId);
    if (stockToDelete && stockToDelete.entry_price > 0) {
      const otherBuys = stocks.filter(s => s.symbol === stockToDelete.symbol && s.id !== stockId && s.entry_price > 0);
      if (otherBuys.length === 0) {
        const hasOtherEntries = stocks.some(s => s.symbol === stockToDelete.symbol && s.id !== stockId) || 
                                soldStocks.some(s => s.symbol === stockToDelete.symbol);
        if (hasOtherEntries) {
           setConfirmationConfig({
             isOpen: true,
             title: 'Delete Asset entirely?',
             message: `Deleting the last Buy entry for ${stockToDelete.symbol} will also delete all associated Sells and Corporate Actions. Continue?`,
             confirmText: 'Delete All',
             isDestructive: true,
             onConfirm: () => executeDeleteAsset(stockToDelete.symbol)
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
        } catch (err: any) {
          console.error('Error deleting stock:', err.message);
          alert('Failed to delete asset. Please try again.');
        }
      }
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
        } catch (err: any) {
          console.error('Error deleting sold stock:', err.message);
          alert('Failed to delete sold asset. Please try again.');
        }
      }
    });
  };

  const handleDeleteAsset = (symbol: string) => {
    setConfirmationConfig({
      isOpen: true,
      title: `Delete Asset: ${symbol}`,
      message: `Are you sure you want to delete ALL records for ${symbol}? This cannot be undone.`,
      confirmText: 'Delete Asset',
      isDestructive: true,
      onConfirm: () => executeDeleteAsset(symbol)
    });
  };

  const handleDeletePortfolio = (id: string) => {
    const portfolioName = portfolios.find(p => p.id === id)?.name;
    setConfirmationConfig({
      isOpen: true,
      title: 'Delete Portfolio',
      message: `Are you sure you want to delete "${portfolioName}"? It will be moved to the Recycle Bin and can be recovered within 30 days.`,
      confirmText: 'Delete',
      isDestructive: true,
      requireInputToConfirm: portfolioName,
      onConfirm: async () => {
        try {
          await api.put(`/api/portfolios/${id}`, { deleted_at: new Date().toISOString() });

          if (activePortfolioId === id) {
            navigate(`/portfolio/${portfolios.length > 1 ? portfolios.find(p => p.id !== id)?.id || 'home' : 'home'}`);
          }

          await fetchData();
        } catch (err: any) {
          console.error('Error deleting portfolio:', err);
          alert('Failed to delete portfolio. Please try again.');
        }
      }
    });
  };

  const handleCopyPortfolio = async (id: string, originalName: string) => {
    try {
      setLoading(true);
      const newName = `${originalName} (Copy)`;
      const newPortfolio = await api.post('/api/portfolios', { name: newName });
      
      const originalStocks = stocks.filter(s => s.portfolio_id === id);
      const originalSoldStocks = soldStocks.filter(s => s.portfolio_id === id);

      const stocksToInsert = originalStocks.map(s => ({ symbol: s.symbol, quantity: s.quantity, entry_price: s.entry_price, entry_date: s.entry_date, portfolio_id: newPortfolio.id }));
      const soldStocksToInsert = originalSoldStocks.map(s => ({ symbol: s.symbol, quantity: s.quantity, exit_price: s.exit_price, exit_date: s.exit_date, portfolio_id: newPortfolio.id }));

      if (stocksToInsert.length > 0) {
        await api.post('/api/stocks/bulk', { inserts: stocksToInsert });
      }
      if (soldStocksToInsert.length > 0) {
        await api.post('/api/sold-stocks/bulk', { inserts: soldStocksToInsert });
      }

      await fetchData();
    } catch (err: any) {
      console.error('Error copying portfolio:', err.message);
      alert('Failed to copy portfolio. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const activePortfolio = portfolios.find(p => p.id === activePortfolioId);
  const activeStocks = stocks.filter(s => s.portfolio_id === activePortfolioId);
  const activeSoldStocks = soldStocks.filter(s => s.portfolio_id === activePortfolioId);
  const activeSymbols = [...new Set([...activeStocks, ...activeSoldStocks].map(s => s.symbol))];

  // Fetch live prices for ALL symbols across all portfolios
  const allSymbols = [...new Set(stocks.map(s => s.symbol))];
  const allStockSymbols = allSymbols.sort().join(',');

  useEffect(() => {
    if (!allStockSymbols) {
      setPricesLoading(false);
      return;
    }
    setPricesLoading(true);

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    // EventSource doesn't support custom headers (like Authorization), but since we use HttpOnly cookies, we can pass withCredentials: true
    const evtSource = new EventSource(`${apiBase}/api/prices/stream?symbols=${encodeURIComponent(allStockSymbols)}`, { withCredentials: true });

    evtSource.onmessage = (event) => {
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

    evtSource.onerror = (err) => {
      console.error('SSE Error:', err);
      evtSource.close();
      setPricesLoading(false);
    };

    return () => evtSource.close();
  }, [allStockSymbols]);

  const toggleSymbol = (symbol: string) => {
    setExpandedSymbols(prev => {
      const next = new Set(prev);
      next.has(symbol) ? next.delete(symbol) : next.add(symbol);
      return next;
    });
  };

  const [serverStats, setServerStats] = useState<{ summary: any, symbolGroups: any[] } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      if (!activePortfolioId) return;
      setStatsLoading(true);
      try {
        const result = await api.get(`/api/calculations/portfolio/${activePortfolioId}/summary`);
        setServerStats(result);
      } catch (err) {
        console.error('Failed to fetch portfolio stats', err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [activePortfolioId, stocks, soldStocks]);


  const symbolGroups = serverStats?.symbolGroups || [];

  let filteredSymbolGroups = symbolGroups;
  if (filterType === 'open') {
    filteredSymbolGroups = symbolGroups.filter((g: any) => g.netQty > 0);
  } else if (filterType === 'closed') {
    filteredSymbolGroups = symbolGroups.filter((g: any) => g.netQty === 0 && g.totalBoughtQty > 0);
  }

  if (searchSelectedSymbols.length > 0) {
    filteredSymbolGroups = filteredSymbolGroups.filter((g: any) => searchSelectedSymbols.includes(g.symbol));
  }

  const summary = serverStats?.summary || {
    totalStocks: 0,
    maxNetInvested: 0,
    totalInvestment: 0,
    totalCurrentValue: 0,
    totalUnrealizedPnL: 0,
    unrealizedPnLPercent: 0,
    totalRealizedPnL: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    totalDividend: 0,
    xirr: 0
  };

  let totalInvestment = filteredSymbolGroups.reduce((sum, g: any) => sum + convert(g.netCostBasis || 0, livePrices[g.symbol]?.currency), 0);
  let totalCurrentValue = filteredSymbolGroups.reduce((sum, g: any) => {
    const currentPrice = livePrices[g.symbol]?.price || g.avgBuyPrice || 0;
    return sum + convert(g.netQty * currentPrice, livePrices[g.symbol]?.currency);
  }, 0);
  let totalUnrealizedPnL = filteredSymbolGroups.reduce((sum, g: any) => {
    const currentPrice = livePrices[g.symbol]?.price || g.avgBuyPrice || 0;
    const currentValue = g.netQty * currentPrice;
    return sum + convert(currentValue - g.netCostBasis, livePrices[g.symbol]?.currency);
  }, 0);
  let totalRealizedPnL = filteredSymbolGroups.reduce((sum, g: any) => sum + convert(g.realizedPnL || 0, livePrices[g.symbol]?.currency), 0);
  let portfolioTotalBrokerage = filteredSymbolGroups.reduce((sum, g: any) => sum + convert(g.brokerage || 0, livePrices[g.symbol]?.currency), 0);
  let portfolioTotalGovtTax = filteredSymbolGroups.reduce((sum, g: any) => sum + convert(g.govtTax || 0, livePrices[g.symbol]?.currency), 0);
  let portfolioTotalDividend = filteredSymbolGroups.reduce((sum, g: any) => sum + convert(g.totalDividend || 0, livePrices[g.symbol]?.currency), 0);
  let portfolioTotalDayGain = filteredSymbolGroups.reduce((sum, g: any) => sum + convert(g.netQty * (g.liveData?.change || 0), livePrices[g.symbol]?.currency), 0);
  let portfolioRealizedCostBasis = filteredSymbolGroups.reduce((sum, g: any) => sum + convert(g.totalBuyCost - g.netCostBasis, livePrices[g.symbol]?.currency), 0);
  let maxNetInvested = convert(summary.maxNetInvested, 'INR');

  const portfolioCashFlows = filteredSymbolGroups.flatMap((g: any) => 
    (g.cashFlows || []).map((cf: any) => ({
      ...cf,
      amount: convert(cf.amount, livePrices[g.symbol]?.currency)
    }))
  );
  let portfolioXIRR = 0;
  if (totalCurrentValue > 0 || portfolioCashFlows.length > 0) {
    const xirrCF = [...portfolioCashFlows];
    if (totalCurrentValue > 0) xirrCF.push({ date: Date.now(), amount: totalCurrentValue });
    portfolioXIRR = calculateXIRR(xirrCF);
  }

  if (sortField) {
    filteredSymbolGroups.sort((a, b) => {
      let valA: any = a[sortField as keyof typeof a];
      let valB: any = b[sortField as keyof typeof b];

      if (sortField === 'totalPnL') {
        valA = a.unrealizedPnL + a.realizedPnL;
        valB = b.unrealizedPnL + b.realizedPnL;
      } else if (sortField === 'portfolioWeight') {
        valA = totalInvestment > 0 ? (a.netCostBasis / totalInvestment) * 100 : 0;
        valB = totalInvestment > 0 ? (b.netCostBasis / totalInvestment) * 100 : 0;
      } else if (sortField === 'currentValueWeight') {
        valA = totalCurrentValue > 0 ? (a.currentValue / totalCurrentValue) * 100 : 0;
        valB = totalCurrentValue > 0 ? (b.currentValue / totalCurrentValue) * 100 : 0;
      } else if (sortField === 'dayGain') {
        valA = a.netQty * (a.liveData?.change || 0);
        valB = b.netQty * (b.liveData?.change || 0);
      } else if (sortField === 'dayGainPct' || sortField === 'changePercent') {
        valA = a.liveData?.changePercent || 0;
        valB = b.liveData?.changePercent || 0;
      } else if (sortField === 'priceChange') {
        valA = a.liveData?.change || 0;
        valB = b.liveData?.change || 0;
      } else if (sortField === 'dayHigh') {
        valA = a.liveData?.dayHigh || 0;
        valB = b.liveData?.dayHigh || 0;
      } else if (sortField === 'dayLow') {
        valA = a.liveData?.dayLow || 0;
        valB = b.liveData?.dayLow || 0;
      } else if (sortField === '52wkHigh') {
        valA = a.liveData?.fiftyTwoWeekHigh || 0;
        valB = b.liveData?.fiftyTwoWeekHigh || 0;
      } else if (sortField === '52wkLow') {
        valA = a.liveData?.fiftyTwoWeekLow || 0;
        valB = b.liveData?.fiftyTwoWeekLow || 0;
      } else if (sortField === 'marketCap') {
        valA = a.liveData?.marketCap || 0;
        valB = b.liveData?.marketCap || 0;
      } else if (sortField === 'volume') {
        valA = a.liveData?.volume || 0;
        valB = b.liveData?.volume || 0;
      } else if (sortField === 'avgVolume') {
        valA = a.liveData?.avgVolume || 0;
        valB = b.liveData?.avgVolume || 0;
      } else if (sortField === 'tradeValue') {
        valA = (a.liveData?.volume || 0) * (a.liveData?.price || 0);
        valB = (b.liveData?.volume || 0) * (b.liveData?.price || 0);
      }

      // Handle nulls/undefined safely for all number comparisons
      valA = valA ?? 0;
      valB = valB ?? 0;

      // Handle string comparisons (e.g., symbol)
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleSort = (field: string) => {
    if (hasDraggedRef.current) return;
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const activeColumnWidths = activePortfolioId && portfolioColumnWidths[activePortfolioId] ? portfolioColumnWidths[activePortfolioId] : {};

  const handleResizeStart = (e: React.MouseEvent, id: string, currentWidth: number) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingCol({ id, startX: e.clientX, startWidth: currentWidth });
  };


  useEffect(() => {
    if (isSettingsInitialized && portfolios.length > 0) {
      updateSettings({ portfolioOrder: portfolios.map(p => p.id) });
    }
  }, [portfolios, isSettingsInitialized, updateSettings]);

  const totalPnL = totalUnrealizedPnL + totalRealizedPnL + portfolioTotalDividend - portfolioTotalBrokerage - portfolioTotalGovtTax;
  const totalPnLPercent = maxNetInvested > 0 ? (totalPnL / maxNetInvested) * 100 : 0;
  const unrealizedPnLPercent = totalInvestment > 0 ? (totalUnrealizedPnL / totalInvestment) * 100 : 0;
  const portfolioRealizedPct = portfolioRealizedCostBasis > 0 ? (totalRealizedPnL / portfolioRealizedCostBasis) * 100 : 0;
  const portfolioPreviousValue = totalCurrentValue - portfolioTotalDayGain;
  const portfolioDayGainPct = portfolioPreviousValue > 0 ? (portfolioTotalDayGain / portfolioPreviousValue) * 100 : 0;

  const exportToExcel = () => {
    if (!activePortfolio || filteredSymbolGroups.length === 0) return;

    // 1. Create Summary Sheet Data
    const summaryData = filteredSymbolGroups.map(group => {
      const currentPrice = livePrices[group.symbol]?.price || 0;
      const currentValue = group.netQty * currentPrice;
      const pnl = currentValue - group.netCostBasis;
      const pnlPct = group.netCostBasis > 0 ? (pnl / group.netCostBasis) * 100 : 0;
      
      return {
        Ticker: group.symbol,
        'Total Quantity': group.netQty,
        'Avg Buy Price': group.avgBuyPrice,
        'Current Price': currentPrice,
        'Invested Value': group.netCostBasis,
        'Current Value': currentValue,
        'P&L': pnl,
        'P&L %': pnlPct,
        'Total Dividend': group.totalDividend
      };
    });

    // 2. Create Details Sheet Data
    const detailsData: any[] = [];
    filteredSymbolGroups.forEach(group => {
      group.events.forEach((ev: any) => {
        if (ev.type === 'BUY') {
          detailsData.push({
            Type: 'BUY',
            Date: ev.raw.entry_date,
            Ticker: group.symbol,
            Quantity: ev.raw.quantity,
            Price: ev.raw.entry_price,
            'Total Amount': ev.raw.quantity * ev.raw.entry_price
          });
        } else if (ev.type === 'SELL') {
          detailsData.push({
            Type: 'SELL',
            Date: ev.raw.exit_date,
            Ticker: group.symbol,
            Quantity: ev.raw.quantity,
            Price: ev.raw.exit_price,
            'Total Amount': ev.raw.quantity * ev.raw.exit_price
          });
        } else if (ev.type === 'DIVIDEND') {
          detailsData.push({
            Type: 'DIVIDEND',
            Date: ev.raw.entry_date,
            Ticker: group.symbol,
            Quantity: ev.totalShares ?? '-',
            Price: ev.raw.quantity,
            'Total Amount': ev.totalAmount ?? '-'
          });
        } else if (ev.type === 'SPLIT') {
          detailsData.push({
            Type: 'SPLIT',
            Date: ev.raw.entry_date,
            Ticker: group.symbol,
            Quantity: ev.totalShares ?? '-',
            Price: ev.raw.quantity,
            'Total Amount': '-'
          });
        } else if (ev.type === 'BONUS') {
          detailsData.push({
            Type: 'BONUS',
            Date: ev.raw.entry_date,
            Ticker: group.symbol,
            Quantity: ev.totalShares ?? '-',
            Price: ev.raw.quantity,
            'Total Amount': '-'
          });
        }
      });
    });

    // 3. Create Workbook
    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsDetails = XLSX.utils.json_to_sheet(detailsData);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Details');

    XLSX.writeFile(wb, `${activePortfolio?.name || 'Portfolio'}_Export.xlsx`);
  };

  const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });

      const wsDetailsName = wb.SheetNames.find(n => n.toLowerCase() === 'details');
      if (!wsDetailsName) {
        alert('Could not find a "Details" sheet in the uploaded Excel file. Please upload a file with the correct format.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const wsDetails = wb.Sheets[wsDetailsName];
      const data: any[] = XLSX.utils.sheet_to_json(wsDetails);

      if (data.length === 0) {
        alert('The "Details" sheet is empty.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const portfolioName = prompt('Enter a name for the imported portfolio:', file.name.replace(/\.[^/.]+$/, ""));
      if (!portfolioName) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      try {
        setLoading(true);
        const newPortfolio = await api.post('/api/portfolios', { name: portfolioName });

        const buysToInsert: any[] = [];
        const sellsToInsert: any[] = [];

        data.forEach(row => {
          const type = row['Type']?.toString().toUpperCase();
          const symbol = row['Ticker'];
          
          let rawQty = 0;
          let rawPrice = 0;

          if (type === 'DIVIDEND') {
            rawQty = Number(row['Price']); // Dividend amount per share was exported in the 'Price' column
            rawPrice = -2;
          } else if (type === 'SPLIT') {
            rawQty = Number(row['Quantity']); // Multiplier was exported in the 'Quantity' column
            rawPrice = -1;
          } else if (type === 'BONUS') {
            rawQty = Number(row['Quantity']); // Multiplier was exported in the 'Quantity' column
            rawPrice = 0;
          } else {
            rawQty = Number(row['Quantity']);
            rawPrice = Number(row['Price']);
          }

          let parsedDate;
          const dateStr = row['Date'];
          if (typeof dateStr === 'number') {
            const date = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
            parsedDate = date.toISOString().split('T')[0];
          } else if (typeof dateStr === 'string') {
            parsedDate = new Date(dateStr).toISOString().split('T')[0];
          } else {
             parsedDate = new Date().toISOString().split('T')[0];
          }

          if (type === 'BUY' || type === 'DIVIDEND' || type === 'SPLIT' || type === 'BONUS') {
            buysToInsert.push({ portfolio_id: newPortfolio.id, symbol, quantity: rawQty, entry_price: rawPrice, entry_date: parsedDate });
          } else if (type === 'SELL') {
            sellsToInsert.push({ portfolio_id: newPortfolio.id, symbol, quantity: rawQty, exit_price: rawPrice, exit_date: parsedDate });
          }
        });

        if (buysToInsert.length > 0) {
          await api.post('/api/stocks/bulk', { inserts: buysToInsert });
        }

        if (sellsToInsert.length > 0) {
          await api.post('/api/sold-stocks/bulk', { inserts: sellsToInsert });
        }

        await fetchData();
        navigate(`/portfolio/${newPortfolio.id}`);
      } catch (err) {
        console.error('Import Error:', err);
        alert('Failed to import portfolio. Please check console for details.');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const renderStatCard = (id: string) => {
    if (!activeVisibleSummaryStats.has(id)) return null;
    
    let content = null;
    switch (id) {
      case 'totalStocks':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span>Total Stocks</span>
            </div>
            <div className="text-[10px] lg:text-xs font-bold text-primary">{filteredSymbolGroups.length}</div>
          </div>
        );
        break;
      case 'maxNetInvested':
        content = (
          <div className="bg-background px-2.5 py-1.5 flex flex-col justify-center rounded-sm h-full w-full">
            <div className="flex items-center gap-1 text-[8px] lg:text-[9px] uppercase tracking-normal lg:tracking-wider font-medium text-secondary mb-[1px]">
              <span>Max Invested</span>
            </div>
            <div className="text-[10px] lg:text-xs font-bold text-primary whitespace-nowrap" title={`${currencySymbol}${maxNetInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              {currencySymbol}{maxNetInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <div className="text-[10px] lg:text-xs font-bold text-primary whitespace-nowrap" title={`${currencySymbol}${totalInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              {currencySymbol}{totalInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <div className="text-[10px] lg:text-xs font-bold text-primary whitespace-nowrap" title={`${currencySymbol}${totalCurrentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              {currencySymbol}{totalCurrentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap ${totalUnrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`} title={`${currencySymbol}${totalUnrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''}{currencySymbol}{totalUnrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap ${totalRealizedPnL >= 0 ? 'text-success' : 'text-danger'}`} title={`${currencySymbol}${totalRealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              {totalRealizedPnL >= 0 ? '+' : ''}{currencySymbol}{totalRealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  ({totalInvestment > 0 ? ((portfolioTotalDividend / totalInvestment) * 100).toFixed(2) : '0.00'}%)
                </span>
              </span>
            </div>
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap text-primary`} title={`${currencySymbol}${portfolioTotalDividend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              {currencySymbol}{portfolioTotalDividend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap text-danger`} title={`${currencySymbol}${(portfolioTotalBrokerage + portfolioTotalGovtTax).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              -{currencySymbol}{(portfolioTotalBrokerage + portfolioTotalGovtTax).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap ${totalPnL >= 0 ? 'text-success' : 'text-danger'}`} title={`${currencySymbol}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              {totalPnL >= 0 ? '+' : ''}{currencySymbol}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <div className={`text-[10px] lg:text-xs font-bold whitespace-nowrap ${portfolioTotalDayGain >= 0 ? 'text-success' : 'text-danger'}`} title={`${currencySymbol}${portfolioTotalDayGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              {portfolioTotalDayGain >= 0 ? '+' : ''}{currencySymbol}{portfolioTotalDayGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
    <>
    <div className="flex-1 w-full flex flex-col min-h-0">
              {/* Stats Cards & Customize */}
              <div className="flex gap-2 mb-2 md:mb-3">
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSummaryDragEnd}
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
                            onClick={applySummaryLayoutToAll}
                            className="w-full flex items-center justify-center px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-blue-400 hover:text-blue-800 hover:bg-blue-500/10 rounded transition-colors"
                          >
                            Apply to All Portfolios
                          </button>
                          <button
                            onClick={resetSummaryStats}
                            className="w-full flex items-center justify-center px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-secondary hover:text-secondary hover:bg-background rounded transition-colors"
                          >
                            Reset to Default
                          </button>
                        </div>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleSummaryDragEnd}
                        >
                          <SortableContext items={activeSummaryStatsOrder} strategy={verticalListSortingStrategy}>
                            {activeSummaryStatsOrder.map(id => {
                              const stat = ALL_SUMMARY_STATS.find(s => s.id === id);
                              if (!stat) return null;
                              return (
                                <SortableMenuItem
                                  key={stat.id}
                                  stat={stat}
                                  isVisible={activeVisibleSummaryStats.has(stat.id)}
                                  onToggle={toggleSummaryStat}
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

              {/* Data Table */}
              <div className="bg-surface border border-divider rounded-lg flex flex-col flex-1 min-h-0">
                <div className="px-3 py-2 border-b border-divider flex flex-wrap justify-between items-center gap-2 bg-surface shrink-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base text-primary">Assets</h3>
                      <button 
                        onClick={() => setIsPortfolioInfoModalOpen(true)}
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
                    
                    <div className="relative">
                      <button
                        onClick={() => setIsColumnsDropdownOpen(!isColumnsDropdownOpen)}
                        className="flex items-center gap-1 px-2 py-1 bg-surface border border-divider rounded-md  text-[10px] font-medium text-secondary hover:text-primary transition-colors"
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
                                onClick={applyColumnLayoutToAll}
                                className="w-full flex items-center justify-center px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-blue-400 hover:text-blue-800 hover:bg-blue-500/10 rounded transition-colors"
                              >
                                Apply to All Portfolios
                              </button>
                              <button
                                onClick={resetColumns}
                                className="w-full flex items-center justify-center px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-secondary hover:text-secondary hover:bg-background rounded transition-colors"
                              >
                                Reset to Default
                              </button>
                            </div>
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleColumnDragEnd}
                            >
                              <SortableContext items={activeColumnOrder} strategy={verticalListSortingStrategy}>
                                {activeColumnOrder.map(colId => {
                                  const col = ALL_COLUMNS.find(c => c.id === colId)!;
                                  return (
                                    <SortableColumnMenuItem
                                      key={col.id}
                                      col={col}
                                      isVisible={visibleColumns.has(col.id)}
                                      onToggle={toggleColumn}
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
                      onClick={() => setAddStockPortfolioId(activePortfolioId)}
                      className="text-xs font-medium text-secondary hover:text-primary transition-colors"
                    >
                      + Buy Asset
                    </button>
                    <button
                      onClick={() => setSellStockPortfolioId(activePortfolioId)}
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
                              onClick={() => { setIsRebalanceModalOpen(true); setIsActionMenuOpen(false); }}
                              className="px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-surface-hover transition-colors"
                            >
                              Rebalance
                            </button>
                            <div className="border-t border-divider my-0.5"></div>
                            <button
                              onClick={() => { setCorporateActionType('bonus'); setIsActionMenuOpen(false); }}
                              className="px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-surface-hover transition-colors"
                            >
                              Add Bonus
                            </button>
                            <button
                              onClick={() => { setCorporateActionType('split'); setIsActionMenuOpen(false); }}
                              className="px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-surface-hover transition-colors"
                            >
                              Add Split
                            </button>
                            <button
                              onClick={() => { setCorporateActionType('dividend'); setIsActionMenuOpen(false); }}
                              className="px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-surface-hover transition-colors"
                            >
                              Add Dividend
                            </button>
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
                      onClick={exportToExcel}
                      disabled={filteredSymbolGroups.length === 0}
                      className="text-xs font-medium text-secondary hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                  </div>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleColumnDragEnd}
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
                              resizingColId={resizingCol?.id}
                              onSort={handleSort}
                              onResizeStart={handleResizeStart}
                              className="sticky left-6 z-30 bg-surface border-r border-divider"
                            />
                          )}
                          <SortableContext items={activeColumnOrder.filter(id => visibleColumns.has(id) && id !== 'symbol')} strategy={horizontalListSortingStrategy}>
                            {activeColumnOrder.filter(id => id !== 'symbol').map(colId => {
                              if (!visibleColumns.has(colId)) return null;
                              const col = ALL_COLUMNS.find(c => c.id === colId)!;
                              return (
                                <SortableHeaderCell 
                                  key={col.id}
                                  field={col.id}
                                  label={col.label}
                                  width={activeColumnWidths[col.id] || 100}
                                  isNumber={col.id !== 'symbol'}
                                  sortField={sortField}
                                  sortDirection={sortDirection}
                                  resizingColId={resizingCol?.id}
                                  onSort={handleSort}
                                  onResizeStart={handleResizeStart}
                                />
                              );
                            })}
                          </SortableContext>
                          <th className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right w-8 bg-surface"></th>
                        </tr>
                        {filteredSymbolGroups.length > 0 && (() => {
                          const fmt = (n: any) => (typeof n === 'number' && !isNaN(n)) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
                          const unrealizedPct = totalInvestment > 0 ? (totalUnrealizedPnL / totalInvestment) * 100 : 0;
                          const totalNetPnL = totalUnrealizedPnL + totalRealizedPnL + portfolioTotalDividend - portfolioTotalBrokerage - portfolioTotalGovtTax;
                          
                          const portfolioRealizedPct = portfolioRealizedCostBasis > 0 ? (totalRealizedPnL / portfolioRealizedCostBasis) * 100 : 0;
                          const totalNetPct = maxNetInvested > 0 ? (totalNetPnL / maxNetInvested) * 100 : 0;
                          
                          return (
                            <tr className="border-b-[3px] border-divider bg-surface-hover font-semibold shadow-sm">
                              <td className="px-2 py-1.5 text-[9px] sm:text-[10px] sticky left-0 z-30 bg-surface-hover"></td>
                              {visibleColumns.has('symbol') && (
                                <td key="symbol" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-primary uppercase tracking-wider sticky left-6 z-30 bg-surface-hover border-r border-divider">Total</td>
                              )}
                              {activeColumnOrder.filter(id => id !== 'symbol').map(colId => {
                                if (!visibleColumns.has(colId)) return null;
                                switch (colId) {
                                  case 'netCostBasis':
                                    return <td key="netCostBasis" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono text-primary">{currencySymbol}{fmt(totalInvestment)}</td>;
                                  case 'currentValue':
                                    return <td key="currentValue" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono text-primary">{currencySymbol}{fmt(totalCurrentValue)}</td>;
                                  case 'unrealizedPnL':
                                    return (
                                      <td key="unrealizedPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono">
                                        <span className={totalUnrealizedPnL >= 0 ? 'text-success' : 'text-danger'}>
                                          {totalUnrealizedPnL >= 0 ? '+' : ''}{currencySymbol}{fmt(totalUnrealizedPnL)}
                                        </span>
                                      </td>
                                    );
                                  case 'unrealizedPnLPct':
                                    return (
                                      <td key="unrealizedPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono">
                                        <span className={unrealizedPct >= 0 ? 'text-success' : 'text-danger'}>
                                          {unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%
                                        </span>
                                      </td>
                                    );
                                  case 'realizedPnL':
                                    return (
                                      <td key="realizedPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono">
                                        <span className={totalRealizedPnL >= 0 ? 'text-success' : 'text-danger'}>
                                          {totalRealizedPnL >= 0 ? '+' : ''}{currencySymbol}{fmt(totalRealizedPnL)}
                                        </span>
                                      </td>
                                    );
                                  case 'realizedPnLPct':
                                    return (
                                      <td key="realizedPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono">
                                        {portfolioRealizedCostBasis > 0 ? (
                                          <span className={portfolioRealizedPct >= 0 ? 'text-success' : 'text-danger'}>
                                            {portfolioRealizedPct >= 0 ? '+' : ''}{portfolioRealizedPct.toFixed(2)}%
                                          </span>
                                        ) : (
                                          <span className="text-tertiary">—</span>
                                        )}
                                      </td>
                                    );
                                  case 'totalDividend':
                                    return (
                                      <td key="totalDividend" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono text-success">
                                        {currencySymbol}{fmt(portfolioTotalDividend)}
                                      </td>
                                    );
                                  case 'brokerage':
                                    return <td key="brokerage" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono text-primary">{currencySymbol}{fmt(portfolioTotalBrokerage)}</td>;
                                  case 'govtTax':
                                    return <td key="govtTax" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono text-primary">{currencySymbol}{fmt(portfolioTotalGovtTax)}</td>;
                                  case 'totalPnL':
                                    return (
                                      <td key="totalPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono">
                                        <span className={totalNetPnL >= 0 ? 'text-success' : 'text-danger'}>
                                          {totalNetPnL >= 0 ? '+' : ''}{currencySymbol}{fmt(totalNetPnL)}
                                        </span>
                                      </td>
                                    );
                                  case 'totalPnLPct':
                                    return (
                                      <td key="totalPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono">
                                        <span className={totalNetPct >= 0 ? 'text-success' : 'text-danger'}>
                                          {totalNetPct >= 0 ? '+' : ''}{totalNetPct.toFixed(2)}%
                                        </span>
                                      </td>
                                    );
                                  case 'xirr':
                                    return (
                                      <td key="xirr" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono">
                                        <span className={portfolioXIRR >= 0 ? 'text-success' : 'text-danger'}>
                                          {portfolioXIRR >= 0 ? '+' : ''}{(portfolioXIRR * 100).toFixed(2)}%
                                        </span>
                                      </td>
                                    );
                                  case 'dayGain':
                                    return (
                                      <td key="dayGain" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono">
                                        <span className={portfolioTotalDayGain >= 0 ? 'text-success' : 'text-danger'}>
                                          {portfolioTotalDayGain >= 0 ? '+' : ''}{currencySymbol}{fmt(portfolioTotalDayGain)}
                                        </span>
                                      </td>
                                    );
                                  case 'dayGainPct':
                                    return (
                                      <td key="dayGainPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono">
                                        <span className={portfolioDayGainPct >= 0 ? 'text-success' : 'text-danger'}>
                                          {portfolioDayGainPct >= 0 ? '+' : ''}{portfolioDayGainPct.toFixed(2)}%
                                        </span>
                                      </td>
                                    );
                                  default:
                                    return <td key={colId} className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right font-mono text-tertiary">—</td>;
                                }
                              })}
                              <td className="px-2 py-1.5 text-[9px] sm:text-[10px]"></td>
                            </tr>
                          );
                        })()}
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
                          const fmt = (n: any) => (typeof n === 'number' && !isNaN(n)) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
                          return (
                            <React.Fragment key={group.symbol}>
                              {/* ── Summary row ── */}
                              <tr
                                className="border-b border-divider divide-x divide-divider hover:bg-background transition-colors group"
                              >
                                <td 
                                  onClick={() => toggleSymbol(group.symbol)}
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
                                          onClick={() => navigate(`/stocks/${group.symbol}`)}
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
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setAddStockInitialSymbol(group.symbol);
                                              setAddStockInitialPrice(group.livePrice);
                                              setAddStockPortfolioId(activePortfolioId);
                                            }}
                                            className="text-success hover:text-success hover:underline transition-colors focus:outline-none"
                                            title={`Buy more ${group.symbol}`}
                                          >
                                            Buy
                                          </button>
                                          <span>·</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSellStockInitialSymbol(group.symbol);
                                              setSellStockInitialPrice(group.livePrice);
                                              setSellStockPortfolioId(activePortfolioId);
                                            }}
                                            className="text-danger hover:text-danger hover:underline transition-colors focus:outline-none"
                                            title={`Sell ${group.symbol}`}
                                          >
                                            Sell
                                          </button>
                                          <span>·</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setViewCorporateActionsSymbol(group.symbol);
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

                                {activeColumnOrder.filter(id => id !== 'symbol').map(colId => {
                                  if (!visibleColumns.has(colId)) return null;
                                  switch (colId) {

                                    case 'netQty':
                                      return <td key="netQty" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right font-semibold text-primary truncate">{group.netQty.toLocaleString()}</td>;
                                    case 'avgBuyPrice':
                                      return <td key="avgBuyPrice" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-secondary truncate">{fmtCurrency(group.avgBuyPrice, group.liveData?.currency)}</td>;
                                    case 'netCostBasis':
                                      return <td key="netCostBasis" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-secondary truncate" title="Avg buy price × remaining shares — money still at work">{fmtCurrency(group.netCostBasis, group.liveData?.currency)}</td>;
                                    case 'portfolioWeight':
                                      const weight = totalInvestment > 0 ? (group.netCostBasis / totalInvestment) * 100 : 0;
                                      return (
                                        <td key="portfolioWeight" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-secondary truncate">
                                          {weight.toFixed(2)}%
                                        </td>
                                      );
                                    case 'currentValueWeight':
                                      const cvWeight = totalCurrentValue > 0 ? (group.currentValue / totalCurrentValue) * 100 : 0;
                                      return (
                                        <td key="currentValueWeight" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-secondary truncate">
                                          {cvWeight.toFixed(2)}%
                                        </td>
                                      );
                                    case 'livePrice':
                                      return <td key="livePrice" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right font-medium text-primary truncate">{fmtCurrency(group.livePrice, group.liveData?.currency)}</td>;
                                    case 'currentValue':
                                      return <td key="currentValue" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right font-medium text-primary truncate">{fmtCurrency(group.currentValue, group.liveData?.currency)}</td>;
                                    case 'unrealizedPnL':
                                      return (
                                        <td key="unrealizedPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right truncate">
                                          <span className={`font-medium ${group.unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {group.unrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(group.unrealizedPnL, group.liveData?.currency)}
                                          </span>
                                        </td>
                                      );
                                    case 'unrealizedPnLPct':
                                      return (
                                        <td key="unrealizedPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right truncate">
                                          <span className={`font-medium ${group.unrealizedPnLPct >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {group.unrealizedPnLPct >= 0 ? '+' : ''}{group.unrealizedPnLPct.toFixed(2)}%
                                          </span>
                                        </td>
                                      );
                                    case 'realizedPnL':
                                      return (
                                        <td key="realizedPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right truncate">
                                          {group.totalSoldQty > 0 ? (
                                            <span className={`font-medium ${group.realizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                              {group.realizedPnL >= 0 ? '+' : ''}{fmtCurrency(group.realizedPnL, group.liveData?.currency)}
                                            </span>
                                          ) : (
                                            <span className="text-tertiary">—</span>
                                          )}
                                        </td>
                                      );
                                    case 'realizedPnLPct':
                                      return (
                                        <td key="realizedPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right truncate">
                                          {group.totalSoldQty > 0 ? (
                                            <span className={`font-medium ${group.realizedPnLPct >= 0 ? 'text-success' : 'text-danger'}`}>
                                              {group.realizedPnLPct >= 0 ? '+' : ''}{group.realizedPnLPct.toFixed(2)}%
                                            </span>
                                          ) : (
                                            <span className="text-tertiary">—</span>
                                          )}
                                        </td>
                                      );
                                    case 'totalDividend':
                                      return (
                                        <td key="totalDividend" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right truncate">
                                          {group.totalDividend > 0 ? (
                                            <span className="font-medium text-success">
                                              {fmtCurrency(group.totalDividend, group.liveData?.currency)}
                                            </span>
                                          ) : (
                                            <span className="text-tertiary">—</span>
                                          )}
                                        </td>
                                      );
                                    case 'brokerage':
                                      return <td key="brokerage" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-secondary truncate">{fmtCurrency(group.brokerage, group.liveData?.currency)}</td>;
                                    case 'govtTax':
                                      return <td key="govtTax" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-secondary truncate">{fmtCurrency(group.govtTax, group.liveData?.currency)}</td>;
                                    case 'totalPnL':
                                      return (
                                        <td key="totalPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right truncate">
                                          <span className={`font-medium ${group.totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {group.totalPnL >= 0 ? '+' : ''}{fmtCurrency(group.totalPnL, group.liveData?.currency)}
                                          </span>
                                        </td>
                                      );
                                    case 'totalPnLPct':
                                      return (
                                        <td key="totalPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right truncate">
                                          <span className={`font-medium ${group.totalPnLPct >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {group.totalPnLPct >= 0 ? '+' : ''}{group.totalPnLPct.toFixed(2)}%
                                          </span>
                                        </td>
                                      );
                                    case 'xirr':
                                      return (
                                        <td key="xirr" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-bold ${group.xirr >= 0 ? 'text-success' : 'text-danger'} truncate`}>
                                          {group.xirr >= 0 ? '+' : ''}{(group.xirr * 100).toFixed(2)}%
                                        </td>
                                      );
                                    case 'priceChange':
                                      const priceChange = group.liveData?.change || 0;
                                      return (
                                        <td key="priceChange" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-medium ${priceChange >= 0 ? 'text-success' : 'text-danger'} truncate`}>
                                          {priceChange >= 0 ? '+' : ''}{fmtCurrency(priceChange, group.liveData?.currency)}
                                        </td>
                                      );
                                    case 'changePercent':
                                      const changePercent = group.liveData?.changePercent || 0;
                                      return (
                                        <td key="changePercent" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-medium ${changePercent >= 0 ? 'text-success' : 'text-danger'} truncate`}>
                                          {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                                        </td>
                                      );
                                    case 'dayHigh':
                                      return <td key="dayHigh" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-primary truncate">{group.liveData?.dayHigh ? `${currencySymbol}${fmt(group.liveData.dayHigh)}` : '—'}</td>;
                                    case 'dayLow':
                                      return <td key="dayLow" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-primary truncate">{group.liveData?.dayLow ? `${currencySymbol}${fmt(group.liveData.dayLow)}` : '—'}</td>;
                                    case '52wkHigh':
                                      return <td key="52wkHigh" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-primary truncate">{group.liveData?.fiftyTwoWeekHigh ? `${currencySymbol}${fmt(group.liveData.fiftyTwoWeekHigh)}` : '—'}</td>;
                                    case '52wkLow':
                                      return <td key="52wkLow" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-primary truncate">{group.liveData?.fiftyTwoWeekLow ? `${currencySymbol}${fmt(group.liveData.fiftyTwoWeekLow)}` : '—'}</td>;
                                    case 'marketCap':
                                      return (
                                        <td key="marketCap" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-primary truncate">
                                          {group.liveData?.marketCap ? formatCurrencyCompact(group.liveData.marketCap, group.liveData?.currency) : '—'}
                                        </td>
                                      );
                                    case 'volume':
                                      return <td key="volume" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-primary truncate">{group.liveData?.volume ? group.liveData.volume.toLocaleString() : '—'}</td>;
                                    case 'avgVolume':
                                      return <td key="avgVolume" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-primary truncate">{group.liveData?.avgVolume ? group.liveData.avgVolume.toLocaleString() : '—'}</td>;
                                    case 'tradeValue':
                                      const tradeVal = (group.liveData?.volume || 0) * (group.liveData?.price || 0);
                                      return (
                                        <td key="tradeValue" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-right text-primary truncate">
                                          {tradeVal > 0 ? formatCurrencyCompact(tradeVal, group.liveData?.currency) : '—'}
                                        </td>
                                      );
                                    case 'dayGain':
                                      const dayGain = group.netQty * (group.liveData?.change || 0);
                                      return (
                                        <td key="dayGain" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-medium ${dayGain >= 0 ? 'text-success' : 'text-danger'} truncate`}>
                                          {dayGain >= 0 ? '+' : ''}{fmtCurrency(dayGain, group.liveData?.currency)}
                                        </td>
                                      );
                                    case 'dayGainPct':
                                      const dayGainPct = group.liveData?.changePercent || 0;
                                      return (
                                        <td key="dayGainPct" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-medium ${dayGainPct >= 0 ? 'text-success' : 'text-danger'} truncate`}>
                                          {dayGainPct >= 0 ? '+' : ''}{dayGainPct.toFixed(2)}%
                                        </td>
                                      );
                                    default:
                                      return null;
                                  }
                                })}
                                <td className="px-2 py-1.5 text-[9px] sm:text-[10px] text-right">
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteAsset(group.symbol); }} className="p-1 text-tertiary hover:text-danger rounded hover:bg-danger/10 transition-colors" title={`Delete ${group.symbol}`}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>

                              {/* ── Expanded detail side-by-side FIFO section ── */}
                              {isExpanded && (
                                <tr className="border-t border-b border-divider bg-background/70">
                                  <td colSpan={visibleColumns.size + 2} className="p-2">
                                    <div className="space-y-2">
                                      {group.fifoBuyLots.length === 0 ? (
                                        <p className="text-[9px] sm:text-[10px] text-tertiary py-2 text-center">No buy entries found.</p>
                                      ) : (
                                        group.fifoBuyLots.map((lot: any, lotIdx: number) => (
                                          <div key={`lot-${lot.buy.id}`} className="bg-surface border border-divider rounded-lg p-2 shadow-xs">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              {/* Left Column: BUY Lot Details */}
                                              <div className="pr-0 md:pr-2 border-b md:border-b-0 md:border-r border-divider pb-2 md:pb-0">
                                                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-divider">
                                                  <div className="flex items-center gap-1.5 font-semibold text-xs text-success">
                                                    <ArrowUpCircle className="w-4 h-4 text-success" />
                                                    <span>Buy Position{group.fifoBuyLots.length > 1 ? ` #${lotIdx + 1}` : ''}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold ${lot.status === 'CLOSED'
                                                        ? 'bg-surface-hover text-secondary'
                                                        : lot.status === 'PARTIALLY_SOLD'
                                                          ? 'bg-amber-100 text-amber-700'
                                                          : 'bg-success/20 text-success'
                                                      }`}>
                                                      {lot.status === 'CLOSED'
                                                        ? `CLOSED (${lot.buyQty}/${lot.buyQty} sold)`
                                                        : lot.status === 'PARTIALLY_SOLD'
                                                          ? `PARTIAL (${lot.soldQty}/${lot.buyQty} sold)`
                                                          : `OPEN (${lot.remainingQty} held)`}
                                                    </span>
                                                  </div>
                                                </div>

                                                <table className="w-full text-left text-[9px] sm:text-[10px] whitespace-nowrap">
                                                  <thead>
                                                    <tr className="text-[9px] sm:text-[10px] text-tertiary uppercase border-b border-divider">
                                                      <th className="pb-1 font-medium">Type</th>
                                                      <th className="pb-1 font-medium">Date</th>
                                                      <th className="pb-1 font-medium">Qty</th>
                                                      <th className="pb-1 font-medium">Price</th>
                                                      <th className="pb-1 font-medium">Value</th>
                                                      <th className="pb-1 font-medium">Brokerage</th>
                                                      <th className="pb-1 font-medium">Govt Tax</th>
                                                      <th className="pb-1 font-medium">Unrealized PnL</th>
                                                      <th className="pb-1 text-right font-medium">Actions</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {/* Current Combined State Row */}
                                                    {lot.history && lot.history.length > 0 && (
                                                      <tr className="bg-blue-500/10/30">
                                                        <td className="py-1">
                                                          <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-blue-500/20 text-blue-300">COMBINED</span>
                                                        </td>
                                                        <td className="py-1 text-secondary font-medium">
                                                          {new Date(lot.history[lot.history.length - 1].date).toLocaleDateString()}
                                                        </td>
                                                        <td className="py-1 font-bold text-primary">{lot.buyQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</td>
                                                        <td className="py-1 text-secondary font-semibold">{fmtCurrency(lot.entryPrice, group.liveData?.currency)}</td>
                                                        <td className="py-1 text-secondary font-medium">{fmtCurrency(lot.cost, group.liveData?.currency)}</td>
                                                        <td></td>
                                                        <td></td>
                                                        <td className="py-1 font-medium">
                                                          <span className={lot.unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}>
                                                            {lot.unrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(lot.unrealizedPnL, group.liveData?.currency)}
                                                          </span>
                                                          <span className="text-[9px] sm:text-[10px] ml-1 text-tertiary">({lot.unrealizedPct >= 0 ? '+' : ''}{lot.unrealizedPct.toFixed(2)}%)</span>
                                                        </td>
                                                        <td className="py-1 text-right"></td>
                                                      </tr>
                                                    )}

                                                    {/* History Events Rows */}
                                                    {[...(lot.history || [])].reverse().map((ev: any, idx: number) => {
                                                      const isBuy = ev.type === 'BUY';
                                                      const eventCost = ev.qty * (ev.price || 0);
                                                      const eventUnrealizedPnL = isBuy ? ev.qty * (group.livePrice - (ev.price || 0)) : 0;
                                                      const eventUnrealizedPct = eventCost > 0 ? (eventUnrealizedPnL / eventCost) * 100 : 0;
                                                      
                                                      return (
                                                        <tr key={`${ev.type}-${idx}`} className="border-t border-divider">
                                                          <td className="py-1">
                                                            {ev.type === 'BONUS' ? (
                                                              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-purple-500/20 text-purple-300">BONUS</span>
                                                            ) : ev.type === 'SPLIT' ? (
                                                              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-amber-100 text-amber-700">SPLIT</span>
                                                            ) : ev.type === 'DIVIDEND' ? (
                                                              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-blue-500/20 text-blue-300">DIVIDEND</span>
                                                            ) : (
                                                              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-success/20 text-success">BUY</span>
                                                            )}
                                                          </td>
                                                          <td className="py-1 text-tertiary">{new Date(ev.date).toLocaleDateString()}</td>
                                                          <td className="py-1 font-medium text-secondary">
                                                            {ev.type === 'SPLIT' 
                                                              ? `x${ev.qty.toFixed(2)}` 
                                                              : ev.qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                                          </td>
                                                          <td className="py-1 text-tertiary">
                                                            {ev.type === 'SPLIT' ? '—' : ev.type === 'DIVIDEND' ? `${currencySymbol}${fmt(ev.qty)}/sh` : (ev.price !== undefined ? `${currencySymbol}${fmt(ev.price)}` : `${currencySymbol}0.00`)}
                                                          </td>
                                                          <td className="py-1 text-secondary font-medium">{eventCost > 0 ? `${currencySymbol}${fmt(eventCost)}` : '—'}</td>
                                                          <td className="py-1 text-secondary text-[9px] sm:text-[10px]">
                                                            {ev.brokerage ? `${currencySymbol}${fmt(ev.brokerage)}` : '—'}
                                                          </td>
                                                          <td className="py-1 text-secondary text-[9px] sm:text-[10px]">
                                                            {ev.govtTax ? `${currencySymbol}${fmt(ev.govtTax)}` : '—'}
                                                          </td>
                                                          <td className="py-1 font-medium">
                                                            {isBuy ? (
                                                              <>
                                                                <span className={eventUnrealizedPnL >= 0 ? 'text-success' : 'text-danger'}>
                                                                  {eventUnrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(eventUnrealizedPnL, group.liveData?.currency)}
                                                                </span>
                                                                <span className="text-[9px] sm:text-[10px] ml-1 text-tertiary">({eventUnrealizedPct >= 0 ? '+' : ''}{eventUnrealizedPct.toFixed(2)}%)</span>
                                                              </>
                                                            ) : '—'}
                                                          </td>
                                                          <td className="py-1 text-right">
                                                            {ev.id && (
                                                              <div className="flex items-center justify-end gap-1">
                                                                <button onClick={(e) => { e.stopPropagation(); setEditStockId(ev.id); }} className="p-1 text-secondary hover:text-primary rounded hover:bg-surface-hover transition-colors" title="Edit Entry">
                                                                  <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteStock(ev.id); }} className="p-1 text-secondary hover:text-danger rounded hover:bg-danger/10 transition-colors" title="Delete Entry">
                                                                  <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                              </div>
                                                            )}
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                    
                                                    {/* If no history (fallback for older DB structures before refactor) */}
                                                    {(!lot.history || lot.history.length === 0) && (
                                                      <tr>
                                                        <td className="py-1">
                                                          {lot.entryPrice === 0 ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-purple-500/20 text-purple-300">BONUS</span>
                                                          ) : (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-success/20 text-success">BUY</span>
                                                          )}
                                                        </td>
                                                        <td className="py-1 text-secondary">{new Date(lot.buy.entry_date).toLocaleDateString()}</td>
                                                        <td className="py-1 font-medium text-primary">{lot.buyQty.toLocaleString()}</td>
                                                        <td className="py-1 text-secondary">{fmtCurrency(lot.entryPrice, group.liveData?.currency)}</td>
                                                        <td className="py-1 text-secondary font-medium">{fmtCurrency(lot.cost, group.liveData?.currency)}</td>
                                                        <td className="py-1 font-medium">
                                                          <span className={lot.unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}>
                                                            {lot.unrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(lot.unrealizedPnL, group.liveData?.currency)}
                                                          </span>
                                                          <span className="text-[9px] sm:text-[10px] ml-1 text-tertiary">({lot.unrealizedPct >= 0 ? '+' : ''}{lot.unrealizedPct.toFixed(2)}%)</span>
                                                        </td>
                                                        <td className="py-1 text-right">
                                                          <div className="flex items-center justify-end gap-1">
                                                            <button onClick={(e) => { e.stopPropagation(); setEditStockId(lot.buy.id); }} className="p-1 text-secondary hover:text-primary rounded hover:bg-surface-hover transition-colors" title="Edit Buy">
                                                              <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteStock(lot.buy.id); }} className="p-1 text-secondary hover:text-danger rounded hover:bg-danger/10 transition-colors" title="Delete Buy">
                                                              <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                          </div>
                                                        </td>
                                                      </tr>
                                                    )}
                                                  </tbody>
                                                </table>
                                              </div>

                                              {/* Right Column: Sell Positions */}
                                              <div>
                                                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-divider">
                                                  <div className="flex items-center gap-1.5 font-semibold text-[10px] text-danger">
                                                    <ArrowDownCircle className="w-4 h-4 text-danger" />
                                                    <span>Sell Positions</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-secondary font-medium">
                                                      {lot.soldQty.toLocaleString()} / {lot.buyQty.toLocaleString()} sold
                                                    </span>
                                                    {lot.matchedSells.length > 0 && (
                                                      <span className={`text-[10px] font-semibold ${lot.realizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                                        (Realized: {lot.realizedPnL >= 0 ? '+' : ''}{fmtCurrency(lot.realizedPnL, group.liveData?.currency)})
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>

                                                {lot.matchedSells.length === 0 ? (
                                                  <p className="text-[10px] text-tertiary py-2 text-center">No sell entries recorded yet.</p>
                                                ) : (
                                                  <table className="w-full text-left text-[10px] whitespace-nowrap">
                                                    <thead>
                                                      <tr className="text-[9px] text-tertiary uppercase border-b border-divider">
                                                        <th className="pb-1 font-medium">Type</th>
                                                        <th className="pb-1 font-medium">Date</th>
                                                        <th className="pb-1 font-medium">Qty</th>
                                                        <th className="pb-1 font-medium">Price</th>
                                                        <th className="pb-1 font-medium">Value</th>
                                                        <th className="pb-1 font-medium">Brokerage</th>
                                                        <th className="pb-1 font-medium">Govt Tax</th>
                                                        <th className="pb-1 font-medium">Realized PnL</th>
                                                        <th className="pb-1 text-right font-medium">Actions</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                      {lot.matchedSells.map((sellAlloc: any) => {
                                                        const realPnlPct = lot.entryPrice > 0 ? ((sellAlloc.exit_price - lot.entryPrice) / lot.entryPrice) * 100 : 0;
                                                        return (
                                                          <tr key={`alloc-${sellAlloc.sellId}`} className="hover:bg-danger/10/40 transition-colors">
                                                            <td className="py-1">
                                                              {sellAlloc.type === 'DIVIDEND' ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/20 text-blue-300">DIVIDEND</span>
                                                              ) : (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-danger/20 text-danger">SELL</span>
                                                              )}
                                                            </td>
                                                            <td className="py-1 text-secondary">{new Date(sellAlloc.exit_date).toLocaleDateString()}</td>
                                                            <td className="py-1 font-medium text-primary">{sellAlloc.quantity.toLocaleString()}</td>
                                                            <td className="py-1 text-secondary">{fmtCurrency(sellAlloc.exit_price, group.liveData?.currency)}</td>
                                                            <td className="py-1 text-secondary font-medium">{fmtCurrency(sellAlloc.proceeds, group.liveData?.currency)}</td>
                                                            <td className="py-1 text-secondary text-[10px]">{sellAlloc.brokerage ? `${currencySymbol}${fmt(sellAlloc.brokerage)}` : '—'}</td>
                                                            <td className="py-1 text-secondary text-[10px]">{sellAlloc.govtTax ? `${currencySymbol}${fmt(sellAlloc.govtTax)}` : '—'}</td>
                                                            <td className="py-1 font-medium">
                                                              <span className={sellAlloc.realizedPnL >= 0 ? 'text-success' : 'text-danger'}>
                                                                {sellAlloc.realizedPnL >= 0 ? '+' : ''}{fmtCurrency(sellAlloc.realizedPnL, group.liveData?.currency)}
                                                              </span>
                                                              {sellAlloc.type !== 'DIVIDEND' && (
                                                                <span className="text-[9px] ml-1 text-tertiary">({realPnlPct >= 0 ? '+' : ''}{realPnlPct.toFixed(2)}%)</span>
                                                              )}
                                                            </td>
                                                            <td className="py-1 text-right">
                                                              <div className="flex items-center justify-end gap-1">
                                                                <button onClick={(e) => { e.stopPropagation(); sellAlloc.type === 'DIVIDEND' ? setEditStockId(sellAlloc.sellId) : setEditSoldStockId(sellAlloc.sellId); }} className="p-1 text-secondary hover:text-primary rounded hover:bg-surface-hover transition-colors" title={sellAlloc.type === 'DIVIDEND' ? "Edit Dividend" : "Edit Sell"}>
                                                                  <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); sellAlloc.type === 'DIVIDEND' ? handleDeleteStock(sellAlloc.sellId) : handleDeleteSoldStock(sellAlloc.sellId); }} className="p-1 text-secondary hover:text-danger rounded hover:bg-danger/10 transition-colors" title={sellAlloc.type === 'DIVIDEND' ? "Delete Dividend" : "Delete Sell"}>
                                                                  <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                              </div>
                                                            </td>
                                                          </tr>
                                                        );
                                                      })}
                                                    </tbody>
                                                  </table>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </DndContext>

                {symbolGroups.length > 0 && (
                  <div className="px-4 py-2 border-t border-divider bg-background/50 text-[10px] text-secondary flex justify-between items-center">
                    <span>Click a row to expand transactions</span>
                  </div>
                )}
              </div>
            </div>

      <AddStockModal
        isOpen={!!addStockPortfolioId}
        portfolioId={addStockPortfolioId}
        initialSymbol={addStockInitialSymbol}
        initialPrice={addStockInitialPrice}
        existingSymbols={!addStockInitialSymbol ? [...new Set(stocks.filter(s => s.portfolio_id === addStockPortfolioId).map(s => s.symbol))] : []}
        onClose={() => { setAddStockPortfolioId(null); setAddStockInitialSymbol(''); setAddStockInitialPrice(undefined); }}
        onAdded={fetchData}
      />

      <SellStockModal
        isOpen={!!sellStockPortfolioId}
        portfolioId={sellStockPortfolioId}
        initialSymbol={sellStockInitialSymbol}
        initialPrice={sellStockInitialPrice}
        onClose={() => { setSellStockPortfolioId(null); setSellStockInitialSymbol(''); setSellStockInitialPrice(undefined); }}
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

      <PortfolioInfoModal
        isOpen={isPortfolioInfoModalOpen}
        onClose={() => setIsPortfolioInfoModalOpen(false)}
        symbols={allSymbols.map(sym => ({ symbol: sym, name: livePrices[sym]?.name || '' }))}
        portfolioId={activePortfolioId || ''}
        onSuccess={fetchData}
        existingEvents={symbolGroups.flatMap(g => g.events.map((e: any) => ({ ...e, symbol: g.symbol })))}
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

      <RebalanceModal
        isOpen={isRebalanceModalOpen}
        onClose={() => setIsRebalanceModalOpen(false)}
        portfolioId={activePortfolioId || ''}
        symbolGroups={filteredSymbolGroups}
        totalCurrentValue={totalCurrentValue}
        onSuccess={() => {
          fetchData();
        }}
      />
    </>
  )
}


