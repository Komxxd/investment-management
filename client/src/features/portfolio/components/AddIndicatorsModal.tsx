import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Activity, Sliders, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';

interface AddIndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  visibleColumns: Set<string>;
  onApplyIndicators: (selectedIds: string[]) => void;
  symbols: string[];
  onIndicatorsUpdated?: (indicators: Record<string, any>) => void;
}

type CategoryType = 'Momentum' | 'Trend' | 'Volatility';

interface IndicatorItem {
  id: string;
  name: string;
  category: CategoryType;
  badgeCode: string;
  description: string;
  isAvailable: boolean;
  defaultPeriod: number;
}

const INDICATORS: IndicatorItem[] = [
  // Momentum
  {
    id: 'rsi',
    name: 'RSI (14)',
    category: 'Momentum',
    badgeCode: "WILDER'S 14D",
    description: "Relative Strength Index. Identifies momentum conditions and potential price reversal zones from historical candles.",
    isAvailable: true,
    defaultPeriod: 14,
  },
  {
    id: 'macd',
    name: 'MACD (12, 26, 9)',
    category: 'Momentum',
    badgeCode: 'MACD',
    description: 'Moving Average Convergence Divergence with 9-period signal line.',
    isAvailable: false,
    defaultPeriod: 26,
  },
  {
    id: 'stoch',
    name: 'Stochastic Oscillator',
    category: 'Momentum',
    badgeCode: 'STOCH',
    description: 'Compares a particular closing price to a range of prices over a certain period.',
    isAvailable: false,
    defaultPeriod: 14,
  },

  // Trend
  {
    id: 'dma50',
    name: '50 DMA',
    category: 'Trend',
    badgeCode: 'MEDIUM TERM',
    description: '50-day Simple Moving Average. Identifies medium-term trend direction and key dynamic support/resistance.',
    isAvailable: true,
    defaultPeriod: 50,
  },
  {
    id: 'dma200',
    name: '200 DMA',
    category: 'Trend',
    badgeCode: 'LONG TERM',
    description: '200-day Simple Moving Average. The primary macro bull/bear regime filter for equities.',
    isAvailable: true,
    defaultPeriod: 200,
  },
  {
    id: 'ema20',
    name: '20 EMA',
    category: 'Trend',
    badgeCode: '20 EMA',
    description: '20-period Exponential Moving Average for short-term momentum and dynamic support.',
    isAvailable: false,
    defaultPeriod: 20,
  },

  // Volatility
  {
    id: 'bbands',
    name: 'Bollinger Bands',
    category: 'Volatility',
    badgeCode: 'BB',
    description: '20-day SMA with upper and lower bands set 2 standard deviations away.',
    isAvailable: false,
    defaultPeriod: 20,
  },
  {
    id: 'atr',
    name: 'Average True Range (ATR)',
    category: 'Volatility',
    badgeCode: 'ATR',
    description: 'Measures market volatility by decomposing the entire range of an asset price.',
    isAvailable: false,
    defaultPeriod: 14,
  },
];

const CATEGORIES: { name: CategoryType; count: number }[] = [
  { name: 'Momentum', count: 1 },
  { name: 'Trend', count: 2 },
  { name: 'Volatility', count: 0 },
];

export function AddIndicatorsModal({
  isOpen,
  onClose,
  visibleColumns,
  onApplyIndicators,
  symbols,
  onIndicatorsUpdated,
}: AddIndicatorsModalProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('Momentum');

  // Track selected indicators
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (visibleColumns.has('rsi')) initial.add('rsi');
    if (visibleColumns.has('dma50')) initial.add('dma50');
    if (visibleColumns.has('dma200')) initial.add('dma200');
    if (initial.size === 0) {
      initial.add('rsi');
      initial.add('dma50');
      initial.add('dma200');
    }
    return initial;
  });

  // Configurable parameters
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);
  const [rsiOverbought, setRsiOverbought] = useState<number>(70);
  const [rsiOversold, setRsiOversold] = useState<number>(30);

  // Sync / progress states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [currentSyncSymbol, setCurrentSyncSymbol] = useState<string>('');
  const [syncStatusLines, setSyncStatusLines] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  // Synchronize with active visible columns whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const initial = new Set<string>();
      if (visibleColumns.has('rsi')) initial.add('rsi');
      if (visibleColumns.has('dma50')) initial.add('dma50');
      if (visibleColumns.has('dma200')) initial.add('dma200');
      if (initial.size === 0) {
        initial.add('rsi');
        initial.add('dma50');
        initial.add('dma200');
      }
      setSelectedIds(initial);
      setIsSyncing(false);
      setSyncProgress(0);
      setIsComplete(false);
      setSyncStatusLines([]);
      setCurrentSyncSymbol('');
    }
  }, [isOpen, visibleColumns]);

  if (!isOpen) return null;

  const handleToggle = (id: string, isAvailable: boolean) => {
    if (!isAvailable) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApply = async () => {
    const chosenList = Array.from(selectedIds);
    onApplyIndicators(chosenList);

    // If RSI is selected and we have symbols, run the incremental sync stream with visual progress
    if (symbols && symbols.length > 0 && selectedIds.has('rsi')) {
      setIsSyncing(true);
      setSyncProgress(10);
      setIsComplete(false);

      const initialStatus: string[] = [];
      if (selectedIds.has('dma50')) initialStatus.push('• 50 DMA: Ready via Live Quotes ✅');
      if (selectedIds.has('dma200')) initialStatus.push('• 200 DMA: Ready via Live Quotes ✅');
      if (selectedIds.has('rsi')) initialStatus.push(`• RSI (14): Starting incremental sync (${symbols.length} stocks)... ⏳`);
      setSyncStatusLines(initialStatus);

      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        const url = `${apiBase}/api/prices/indicators/sync-stream?symbols=${encodeURIComponent(symbols.join(','))}`;
        const evtSource = new EventSource(url);

        evtSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'progress') {
              setCurrentSyncSymbol(data.symbol);
              setSyncProgress(Math.max(15, data.percent));
              setSyncStatusLines(prev => {
                const updated = [...prev];
                const rsiIdx = updated.findIndex(line => line.startsWith('• RSI'));
                const newLine = `• RSI (14): Syncing ${data.symbol} (${data.current}/${data.total} stocks)... ⏳`;
                if (rsiIdx !== -1) updated[rsiIdx] = newLine;
                else updated.push(newLine);
                return updated;
              });
            } else if (data.type === 'complete') {
              setSyncProgress(100);
              setCurrentSyncSymbol('');
              setIsComplete(true);
              setSyncStatusLines(prev => {
                const updated = [...prev];
                const rsiIdx = updated.findIndex(line => line.startsWith('• RSI'));
                const newLine = `• RSI (14): All ${symbols.length} stocks synced & cached to disk ✅`;
                if (rsiIdx !== -1) updated[rsiIdx] = newLine;
                else updated.push(newLine);
                return updated;
              });
              if (onIndicatorsUpdated && data.indicators) {
                onIndicatorsUpdated(data.indicators);
              }
              evtSource.close();
              setTimeout(() => {
                setIsSyncing(false);
                onClose();
              }, 1000);
            }
          } catch (err) {
            console.error('Failed to parse sync progress', err);
          }
        };

        evtSource.onerror = () => {
          evtSource.close();
          fetch(`${apiBase}/api/prices/indicators?symbols=${encodeURIComponent(symbols.join(','))}`)
            .then(r => r.json())
            .then(data => {
              if (onIndicatorsUpdated) onIndicatorsUpdated(data);
              setSyncProgress(100);
              setIsComplete(true);
              setTimeout(() => {
                setIsSyncing(false);
                onClose();
              }, 600);
            })
            .catch(() => {
              setIsSyncing(false);
              onClose();
            });
        };
      } catch (err) {
        setIsSyncing(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  const currentCategoryIndicators = INDICATORS.filter(ind => ind.category === activeCategory);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Dark backdrop with blur matching Indices Setting UI */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity" 
        onClick={!isSyncing ? onClose : undefined} 
      />

      {/* Modal Dialog Matching Indices Setting UI */}
      <div className="relative w-full max-w-2xl sm:max-w-3xl h-[85vh] md:h-[540px] max-h-[calc(100vh-2rem)] bg-surface border border-divider rounded-xl shadow-2xl flex flex-col overflow-hidden text-primary">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-divider shrink-0 bg-surface">
          <h2 className="text-base sm:text-lg font-semibold text-primary">Technical Indicators</h2>
          {!isSyncing && (
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 -mr-1 sm:-mr-2 text-secondary hover:text-primary hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>

        {/* Body (Two Column Layout) */}
        <div className="p-4 sm:p-6 overflow-hidden flex-1 flex flex-row gap-3 sm:gap-6 min-h-0 bg-surface">
          
          {/* Left Column: Categories List */}
          <div className="w-28 sm:w-40 md:w-48 shrink-0 flex flex-col min-h-0 pr-2 sm:pr-4 border-r border-divider">
            <h3 className="text-xs sm:text-sm font-medium text-primary mb-2 sm:mb-3 px-2 sm:px-3">Categories</h3>
            <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1 pb-4">
              {CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setActiveCategory(cat.name)}
                    className={`text-left px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-secondary hover:bg-surface-hover hover:text-primary'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Indicators & Configurations */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto pr-1 pb-2">
            <div className="mb-3 sm:mb-4 shrink-0">
              <h3 className="text-xs sm:text-sm font-medium text-primary mb-0.5 sm:mb-1">{activeCategory} Indicators</h3>
              <p className="text-[10px] sm:text-xs text-secondary">
                Select indicators and fine-tune their input parameters.
              </p>
            </div>

            <div className="space-y-3 pb-2">
              {currentCategoryIndicators.map(ind => {
                const isChecked = selectedIds.has(ind.id);
                const isAvail = ind.isAvailable;

                return (
                  <div
                    key={ind.id}
                    onClick={() => handleToggle(ind.id, isAvail)}
                    className={`rounded-xl border transition-all p-3.5 sm:p-4 ${
                      !isAvail
                        ? 'border-divider/50 bg-surface opacity-50 cursor-not-allowed'
                        : isChecked
                          ? 'border-primary/40 bg-surface-hover/60 cursor-pointer shadow-xs'
                          : 'border-divider bg-surface hover:border-primary/50 cursor-pointer'
                    }`}
                  >
                    {/* Top Row: Checkbox, Name, Badges */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          !isAvail
                            ? 'border-divider bg-surface'
                            : isChecked
                              ? 'bg-primary border-primary text-surface'
                              : 'border-secondary bg-surface'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-medium text-primary">{ind.name}</span>
                            <span className="px-2 py-0.5 rounded bg-surface-hover text-secondary text-[10px] font-mono font-medium tracking-wide border border-divider">
                              {ind.badgeCode}
                            </span>
                            {isAvail && (
                              <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[10px] font-mono font-semibold tracking-wide border border-blue-500/30">
                                LOCAL SYNC
                              </span>
                            )}
                          </div>
                          {!isAvail && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-surface-hover text-tertiary font-medium border border-divider">
                              Coming Soon
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-secondary mt-1.5 sm:mt-2 leading-relaxed">
                          {ind.description}
                        </p>

                        {/* ── RSI Configuration Panel ── */}
                        {ind.id === 'rsi' && isChecked && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-4 pt-3 border-t border-divider space-y-3"
                          >
                            {/* Inner section header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                <Sliders className="w-3.5 h-3.5 text-secondary" />
                                <span>RSI Configuration</span>
                              </div>
                              <span className="text-[10px] text-tertiary font-normal">
                                User-Centric Customization
                              </span>
                            </div>

                            {/* Lookback Period Box with [7D] [14D] [21D] presets */}
                            <div className="p-3 rounded-lg bg-background border border-divider">
                              <div className="flex items-center justify-between mb-1.5 gap-2">
                                <span className="text-xs font-medium text-secondary whitespace-nowrap">
                                  Lookback Period (Days)
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {[7, 14, 21].map(d => {
                                    const isPillActive = rsiPeriod === d;
                                    return (
                                      <button
                                        key={d}
                                        type="button"
                                        onClick={() => setRsiPeriod(d)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                          isPillActive
                                            ? 'bg-primary text-surface font-bold shadow-xs'
                                            : 'bg-surface text-secondary hover:text-primary border border-divider'
                                        }`}
                                      >
                                        {d}D
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Input with custom up/down spinner arrows */}
                              <div className="relative flex items-center mt-2">
                                <input
                                  type="number"
                                  min={2}
                                  max={50}
                                  value={rsiPeriod}
                                  onChange={(e) => setRsiPeriod(Math.max(2, Math.min(50, Number(e.target.value) || 14)))}
                                  className="w-full pl-3 pr-8 py-1.5 bg-surface border border-divider rounded-lg text-sm text-primary font-mono focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <div className="absolute right-1.5 flex flex-col items-center justify-center -space-y-0.5 text-secondary">
                                  <button
                                    type="button"
                                    onClick={() => setRsiPeriod(prev => Math.min(50, prev + 1))}
                                    className="p-0.5 hover:text-primary transition-colors"
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRsiPeriod(prev => Math.max(2, prev - 1))}
                                    className="p-0.5 hover:text-primary transition-colors"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-tertiary mt-1.5">
                                Standard is 14. Use 7 for sensitive swing signals, or 21 for smooth trend-filtering.
                              </p>
                            </div>

                            {/* Overbought and Oversold 2-Column Grid */}
                            <div className="grid grid-cols-2 gap-3">
                              {/* Overbought (>) */}
                              <div className="p-3 rounded-lg bg-background border border-divider min-w-0">
                                <div className="flex items-center justify-between mb-1.5 gap-1.5">
                                  <span className="text-xs font-medium text-rose-400 whitespace-nowrap shrink-0">
                                    Overbought (&gt;)
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {[70, 75, 80].map(v => {
                                      const isObActive = rsiOverbought === v;
                                      return (
                                        <button
                                          key={v}
                                          type="button"
                                          onClick={() => setRsiOverbought(v)}
                                          className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-mono transition-colors shrink-0 ${
                                            isObActive
                                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold'
                                              : 'bg-surface text-secondary hover:text-primary border border-divider'
                                          }`}
                                        >
                                          {v}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="relative flex items-center mt-2">
                                  <input
                                    type="number"
                                    min={50}
                                    max={95}
                                    value={rsiOverbought}
                                    onChange={(e) => setRsiOverbought(Math.max(50, Math.min(95, Number(e.target.value) || 70)))}
                                    className="w-full pl-3 pr-8 py-1.5 bg-surface border border-divider rounded-lg text-sm text-primary font-mono focus:border-rose-500/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <div className="absolute right-1.5 flex flex-col items-center justify-center -space-y-0.5 text-secondary">
                                    <button
                                      type="button"
                                      onClick={() => setRsiOverbought(prev => Math.min(95, prev + 1))}
                                      className="p-0.5 hover:text-primary transition-colors"
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRsiOverbought(prev => Math.max(50, prev - 1))}
                                      className="p-0.5 hover:text-primary transition-colors"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Oversold (<) */}
                              <div className="p-3 rounded-lg bg-background border border-divider min-w-0">
                                <div className="flex items-center justify-between mb-1.5 gap-1.5">
                                  <span className="text-xs font-medium text-emerald-400 whitespace-nowrap shrink-0">
                                    Oversold (&lt;)
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {[20, 25, 30].map(v => {
                                      const isOsActive = rsiOversold === v;
                                      return (
                                        <button
                                          key={v}
                                          type="button"
                                          onClick={() => setRsiOversold(v)}
                                          className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-mono transition-colors shrink-0 ${
                                            isOsActive
                                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold'
                                              : 'bg-surface text-secondary hover:text-primary border border-divider'
                                          }`}
                                        >
                                          {v}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="relative flex items-center mt-2">
                                  <input
                                    type="number"
                                    min={5}
                                    max={50}
                                    value={rsiOversold}
                                    onChange={(e) => setRsiOversold(Math.max(5, Math.min(50, Number(e.target.value) || 30)))}
                                    className="w-full pl-3 pr-8 py-1.5 bg-surface border border-divider rounded-lg text-sm text-primary font-mono focus:border-emerald-500/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <div className="absolute right-1.5 flex flex-col items-center justify-center -space-y-0.5 text-secondary">
                                    <button
                                      type="button"
                                      onClick={() => setRsiOversold(prev => Math.min(50, prev + 1))}
                                      className="p-0.5 hover:text-primary transition-colors"
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRsiOversold(prev => Math.max(5, prev - 1))}
                                      className="p-0.5 hover:text-primary transition-colors"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sync Progress Bar UX inside Modal */}
            {isSyncing && (
              <div className="mt-2 p-3 rounded-xl border border-divider bg-surface-hover/80 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs font-semibold text-primary mb-1.5">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <span>Fetching & calculating indicators...</span>
                  </div>
                  <span className="font-mono text-blue-400">{syncProgress}%</span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-divider overflow-hidden mb-2">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>

                <div className="space-y-0.5 text-[10px] font-mono text-secondary">
                  {syncStatusLines.map((line, idx) => (
                    <div key={idx} className={line.includes('Ready') || line.includes('✅') ? 'text-emerald-400' : 'text-primary'}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Matching Indices Setting UI */}
        <div className="px-6 py-3.5 border-t border-divider bg-surface flex items-center justify-between shrink-0">
          <div className="text-xs text-secondary">
            {selectedIds.size} indicators selected
          </div>

          <div className="flex items-center gap-3">
            {!isSyncing && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleApply}
              disabled={isSyncing}
              className="px-5 py-2 rounded-lg bg-primary hover:opacity-90 text-surface text-xs font-semibold shadow transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-surface" />
                  <span>Syncing...</span>
                </>
              ) : isComplete ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3] text-surface" />
                  <span>Applied</span>
                </>
              ) : (
                <span>Apply Indicators</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
