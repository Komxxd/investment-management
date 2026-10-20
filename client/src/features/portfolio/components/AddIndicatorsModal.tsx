import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Activity, Sliders, Loader2 } from 'lucide-react';

export interface IndicatorDefinition {
  id: string;
  name: string;
  category: 'Momentum' | 'Trend';
  badge: string;
  description: string;
  status: 'available' | 'requires-sync' | 'coming-soon';
  columnId: string;
}

export interface IndicatorConfig {
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
}

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30
};

export const AVAILABLE_INDICATORS: IndicatorDefinition[] = [
  {
    id: 'rsi',
    name: 'RSI',
    category: 'Momentum',
    badge: 'Momentum Oscillator',
    description: 'Relative Strength Index. Identifies momentum conditions and potential price reversal zones from historical candles.',
    status: 'requires-sync',
    columnId: 'rsi'
  },
  {
    id: 'dma50',
    name: '50 DMA',
    category: 'Trend',
    badge: '50-Day Avg',
    description: '50-Day Moving Average. Evaluates intermediate-term market trend and dynamic support/resistance.',
    status: 'available',
    columnId: 'dma50'
  },
  {
    id: 'dma200',
    name: '200 DMA',
    category: 'Trend',
    badge: '200-Day Avg',
    description: '200-Day Moving Average. The gold standard for institutional long-term bull vs. bear market regime.',
    status: 'available',
    columnId: 'dma200'
  }
];

const CATEGORIES = ['Momentum', 'Trend'] as const;

export interface AddIndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbols?: string[];
  visibleColumns: Set<string>;
  config?: Partial<IndicatorConfig>;
  onApplyIndicators: (selectedColumnIds: string[], config?: IndicatorConfig) => void;
  onIndicatorsUpdated?: (indicators: Record<string, any>) => void;
  onSyncComplete?: (results: Record<string, any>) => void;
}

export function AddIndicatorsModal({
  isOpen,
  onClose,
  symbols = [],
  visibleColumns,
  config,
  onApplyIndicators,
  onIndicatorsUpdated,
  onSyncComplete
}: AddIndicatorsModalProps) {
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>('Momentum');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    AVAILABLE_INDICATORS.forEach(ind => {
      if (visibleColumns.has(ind.columnId)) {
        initial.add(ind.id);
      }
    });
    return initial;
  });

  // Sync selection when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial = new Set<string>();
      AVAILABLE_INDICATORS.forEach(ind => {
        if (visibleColumns.has(ind.columnId)) {
          initial.add(ind.id);
        }
      });
      setSelectedIds(initial);
    }
  }, [isOpen, visibleColumns]);

  // Configurable RSI state
  const [rsiPeriod, setRsiPeriod] = useState<number>(config?.rsiPeriod || 14);
  const [rsiOverbought, setRsiOverbought] = useState<number>(config?.rsiOverbought || 70);
  const [rsiOversold, setRsiOversold] = useState<number>(config?.rsiOversold || 30);

  useEffect(() => {
    if (config?.rsiPeriod) setRsiPeriod(config.rsiPeriod);
    if (config?.rsiOverbought) setRsiOverbought(config.rsiOverbought);
    if (config?.rsiOversold) setRsiOversold(config.rsiOversold);
  }, [config]);

  // Sync / progress states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('');

  if (!isOpen) return null;

  const toggleIndicator = (id: string, status: string) => {
    if (status === 'coming-soon' || isSyncing) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = async () => {
    const activeConfig: IndicatorConfig = {
      rsiPeriod: Math.max(2, Math.min(100, Number(rsiPeriod) || 14)),
      rsiOverbought: Math.max(50, Math.min(95, Number(rsiOverbought) || 70)),
      rsiOversold: Math.max(5, Math.min(50, Number(rsiOversold) || 30))
    };

    const selectedColumns = AVAILABLE_INDICATORS
      .filter(ind => selectedIds.has(ind.id) && ind.status !== 'coming-soon')
      .map(ind => ind.columnId);

    // Check if RSI is selected and we have symbols to sync
    const needsRsiSync = selectedIds.has('rsi') && symbols.length > 0;

    if (!needsRsiSync) {
      onApplyIndicators(selectedColumns, activeConfig);
      onClose();
      return;
    }

    // Start SSE progress stream for historical candle & RSI sync
    setIsSyncing(true);
    setSyncProgress(5);
    setSyncStatusText(`Preparing local cache for ${symbols.length} assets (RSI ${activeConfig.rsiPeriod})...`);

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    const querySymbols = encodeURIComponent(symbols.join(','));
    const url = `${apiBase}/api/prices/indicators/sync-stream?symbols=${querySymbols}&rsiPeriod=${activeConfig.rsiPeriod}`;

    try {
      const evtSource = new EventSource(url, { withCredentials: true });

      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'start') {
            setSyncStatusText(data.message || `Syncing ${data.total} assets...`);
            setSyncProgress(10);
          } else if (data.type === 'progress') {
            setSyncProgress(data.percent || 15);
            setSyncStatusText(data.message || `Processing ${data.symbol || ''}...`);
          } else if (data.type === 'complete') {
            setSyncProgress(100);
            setSyncStatusText('All indicators computed & cached successfully!');
            evtSource.close();

            if (data.indicators && onIndicatorsUpdated) {
              onIndicatorsUpdated(data.indicators);
            }
            if (data.results && onSyncComplete) {
              onSyncComplete(data.results);
            }

            setTimeout(() => {
              setIsSyncing(false);
              onApplyIndicators(selectedColumns, activeConfig);
              onClose();
            }, 600);
          }
        } catch (parseErr) {
          console.error('Failed to parse sync progress', parseErr);
        }
      };

      evtSource.onerror = (err) => {
        console.error('SSE sync error:', err);
        evtSource.close();

        // Fallback fetch
        fetch(`${apiBase}/api/prices/indicators?symbols=${querySymbols}`)
          .then(r => r.json())
          .then(data => {
            if (onIndicatorsUpdated) onIndicatorsUpdated(data);
          })
          .catch(() => { })
          .finally(() => {
            setIsSyncing(false);
            onApplyIndicators(selectedColumns, activeConfig);
            onClose();
          });
      };
    } catch (err: any) {
      console.error('Failed to initiate sync', err);
      setIsSyncing(false);
      onApplyIndicators(selectedColumns, activeConfig);
      onClose();
    }
  };

  const categoryIndicators = AVAILABLE_INDICATORS.filter(ind => ind.category === activeCategory);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 transition-opacity"
        onClick={() => !isSyncing && onClose()}
      />

      <div className="relative w-full max-w-2xl h-[85vh] md:h-[540px] bg-surface border border-divider rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-divider shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-primary">Technical Indicators</h2>
              <p className="text-[10px] sm:text-xs text-secondary">Configure periods, thresholds, and customize portfolio technical views.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSyncing}
            className="p-1.5 sm:p-2 -mr-1 sm:-mr-2 text-secondary hover:text-primary hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Body (Two Column Layout matching SettingsModal) */}
        <div className="p-4 sm:p-6 overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="flex flex-row gap-3 sm:gap-6 flex-1 min-h-0">
            {/* Left Column: Categories List */}
            <div className="w-28 sm:w-40 md:w-44 flex-shrink-0 border-r border-divider pr-2 sm:pr-4 flex flex-col min-h-0">
              <h3 className="text-xs sm:text-sm font-medium text-primary mb-2 sm:mb-3 px-2 sm:px-3">Categories</h3>
              <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1 pb-4">
                {CATEGORIES.map(cat => {
                  const count = AVAILABLE_INDICATORS.filter(ind => ind.category === cat && selectedIds.has(ind.id)).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      disabled={isSyncing}
                      className={`text-left px-2.5 py-2 rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-between ${activeCategory === cat
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-secondary hover:bg-surface-hover hover:text-primary'
                        }`}
                    >
                      <span>{cat}</span>
                      {count > 0 && (
                        <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-semibold flex items-center justify-center">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Indicator Cards List */}
            <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto pr-1 pb-4">
              <div className="mb-3 shrink-0 flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-primary">{activeCategory} Indicators</h3>
                  <p className="text-[10px] sm:text-xs text-secondary">Select indicators and fine-tune their input parameters.</p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {categoryIndicators.map(ind => {
                  const isSelected = selectedIds.has(ind.id);
                  const isComingSoon = ind.status === 'coming-soon';

                  return (
                    <div
                      key={ind.id}
                      className={`p-3 rounded-lg border transition-all ${isComingSoon
                          ? 'border-divider/50 bg-background/50 opacity-60'
                          : isSelected
                            ? 'border-primary/60 bg-primary/5 shadow-xs'
                            : 'border-divider bg-surface hover:border-primary/40'
                        }`}
                    >
                      <div
                        onClick={() => toggleIndicator(ind.id, ind.status)}
                        className={`flex items-start gap-3 ${isComingSoon ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected
                              ? 'bg-primary border-primary text-surface'
                              : isComingSoon
                                ? 'border-divider bg-background'
                                : 'border-secondary bg-surface'
                            }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs sm:text-sm font-semibold text-primary truncate">
                              {ind.id === 'rsi' ? `RSI (${rsiPeriod})` : ind.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-surface-hover border border-divider text-secondary">
                              {ind.id === 'rsi' ? `Wilder's ${rsiPeriod}D` : ind.badge}
                            </span>
                            {isComingSoon && (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold border border-amber-500/20">
                                Upcoming
                              </span>
                            )}
                            {ind.status === 'requires-sync' && (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                                Local Sync
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-secondary leading-relaxed">{ind.description}</p>
                        </div>
                      </div>

                      {/* Configurable RSI Settings Drawer */}
                      {isSelected && ind.id === 'rsi' && (
                        <div
                          className="mt-3 pt-3 border-t border-divider/60 space-y-2.5 animate-fadeIn"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-xs font-semibold text-primary flex items-center gap-1">
                              <Sliders className="w-3 h-3 text-primary" />
                              RSI Configuration
                            </span>
                            <span className="text-[9px] text-tertiary">User-Centric Customization</span>
                          </div>

                          {/* Period Setting */}
                          <div className="bg-background/80 p-2.5 rounded-md border border-divider/60 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-secondary font-medium">
                                Lookback Period (Days)
                              </label>
                              <div className="flex items-center gap-1">
                                {[7, 14, 21].map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => setRsiPeriod(p)}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${rsiPeriod === p
                                        ? 'bg-primary text-surface font-semibold'
                                        : 'bg-surface hover:bg-surface-hover text-secondary border border-divider'
                                      }`}
                                  >
                                    {p}D
                                  </button>
                                ))}
                              </div>
                            </div>
                            <input
                              type="number"
                              min={2}
                              max={100}
                              value={rsiPeriod}
                              onChange={e => setRsiPeriod(Math.max(2, Math.min(100, parseInt(e.target.value) || 14)))}
                              className="w-full bg-surface border border-divider rounded px-2 py-1 text-xs text-primary font-mono focus:outline-none focus:border-primary"
                            />
                            <p className="text-[9px] text-tertiary">Standard is 14. Use 7 for sensitive swing signals, or 21 for smooth trend-filtering.</p>
                          </div>

                          {/* Thresholds Setting */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-background/80 p-2 rounded-md border border-divider/60">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-danger font-medium">Overbought (&gt;)</label>
                                <div className="flex gap-1">
                                  {[70, 75, 80].map(v => (
                                    <button
                                      key={v}
                                      type="button"
                                      onClick={() => setRsiOverbought(v)}
                                      className={`px-1 py-0.5 rounded text-[8px] font-mono ${rsiOverbought === v ? 'bg-danger text-white' : 'text-secondary hover:text-primary'
                                        }`}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <input
                                type="number"
                                min={50}
                                max={95}
                                value={rsiOverbought}
                                onChange={e => setRsiOverbought(Math.max(50, Math.min(95, parseInt(e.target.value) || 70)))}
                                className="w-full bg-surface border border-divider rounded px-2 py-1 text-xs text-primary font-mono focus:outline-none focus:border-danger"
                              />
                            </div>

                            <div className="bg-background/80 p-2 rounded-md border border-divider/60">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-success font-medium">Oversold (&lt;)</label>
                                <div className="flex gap-1">
                                  {[20, 25, 30].map(v => (
                                    <button
                                      key={v}
                                      type="button"
                                      onClick={() => setRsiOversold(v)}
                                      className={`px-1 py-0.5 rounded text-[8px] font-mono ${rsiOversold === v ? 'bg-success text-white' : 'text-secondary hover:text-primary'
                                        }`}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <input
                                type="number"
                                min={5}
                                max={50}
                                value={rsiOversold}
                                onChange={e => setRsiOversold(Math.max(5, Math.min(50, parseInt(e.target.value) || 30)))}
                                className="w-full bg-surface border border-divider rounded px-2 py-1 text-xs text-primary font-mono focus:outline-none focus:border-success"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Progress Bar & Action Buttons */}
        <div className="p-4 border-t border-divider bg-surface/50 shrink-0 flex flex-col gap-3">
          {isSyncing && (
            <div className="space-y-1.5 bg-surface border border-divider rounded-lg p-2.5">
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className="font-medium text-primary flex items-center gap-1.5 truncate">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  {syncStatusText}
                </span>
                <span className="font-mono font-semibold text-primary shrink-0 ml-2">{syncProgress}%</span>
              </div>
              <div className="w-full bg-divider/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-tertiary">
              {selectedIds.size} indicator{selectedIds.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSyncing}
                className="px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary hover:bg-surface-hover rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-primary text-surface rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  'Apply Indicators'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Export alias as well for compatibility
export { AddIndicatorsModal as IndicatorsModal };
