import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { REGIONS } from '../../../components/layout/MarketTicker';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, isLoading } = useSettings();
  const [activeRegion, setActiveRegion] = useState<string>(Object.keys(REGIONS)[0]);
  
  if (!isOpen) return null;

  const hiddenIndices = settings.hiddenIndices || [];

  const handleToggle = (symbol: string) => {
    let newHidden: string[];
    if (hiddenIndices.includes(symbol)) {
      newHidden = hiddenIndices.filter(s => s !== symbol);
    } else {
      newHidden = [...hiddenIndices, symbol];
    }
    updateSettings({ hiddenIndices: newHidden });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl h-[85vh] md:h-[500px] bg-surface border border-divider rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-divider shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-primary">Indices Setting</h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 -mr-1 sm:-mr-2 text-secondary hover:text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-hidden flex-1 flex flex-col">
          <div className="flex flex-row gap-3 sm:gap-6 flex-1 min-h-0">
            
            {isLoading ? (
              <div className="text-xs sm:text-sm text-secondary animate-pulse w-full">Loading settings...</div>
            ) : (
              <>
                {/* Left Column: Regions List */}
                <div className="w-24 sm:w-40 md:w-48 flex-shrink-0 border-r border-divider pr-2 sm:pr-4 flex flex-col min-h-0">
                  <h3 className="text-xs sm:text-sm font-medium text-primary mb-2 sm:mb-3 px-2 sm:px-3">Regions</h3>
                  <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1 pb-4">
                    {Object.keys(REGIONS).map(region => (
                      <button
                        key={region}
                        onClick={() => setActiveRegion(region)}
                        className={`text-left px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap ${
                          activeRegion === region 
                            ? 'bg-primary/10 text-primary font-medium' 
                            : 'text-secondary hover:bg-surface-hover hover:text-primary'
                        }`}
                      >
                        {region}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Column: Indices List */}
                <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto pr-2 pb-4">
                  <div className="mb-3 sm:mb-4 shrink-0">
                    <h3 className="text-xs sm:text-sm font-medium text-primary mb-0.5 sm:mb-1">{activeRegion} Indices</h3>
                    <p className="text-[10px] sm:text-xs text-secondary">Select which indices to display in the ticker.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {REGIONS[activeRegion as keyof typeof REGIONS].map(idx => {
                      const isSelected = !hiddenIndices.includes(idx.symbol);
                      return (
                        <label 
                          key={idx.symbol}
                          className="flex items-start gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg border border-divider bg-surface hover:border-primary/50 cursor-pointer transition-colors group"
                        >
                          <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={isSelected}
                            onChange={() => handleToggle(idx.symbol)}
                          />
                          <div className={`mt-0.5 w-3 h-3 sm:w-4 sm:h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected 
                              ? 'bg-primary border-primary text-surface' 
                              : 'border-secondary bg-surface group-hover:border-primary/50'
                          }`}>
                            {isSelected && <Check className="w-2 h-2 sm:w-3 sm:h-3" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs sm:text-sm font-medium text-primary truncate">{idx.name}</span>
                            <span className="text-[9px] sm:text-[10px] text-secondary truncate">{idx.symbol}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
