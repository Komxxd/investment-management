import React, { useState, useEffect } from 'react';
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../../services/api/client';

import { useSettings } from '../../app/providers/SettingsProvider';

export const REGIONS = {
  India: [
    { symbol: '^NSEI', name: 'NIFTY' },
    { symbol: '^BSESN', name: 'SENSEX' },
    { symbol: '^NSEBANK', name: 'BANKNIFTY' },
    { symbol: 'BSE-BANK.BO', name: 'BANKEX' },
    { symbol: 'NIFTY_MIDCAP_100.NS', name: 'MIDCPNIFTY' },
    { symbol: 'NIFTY_FIN_SERVICE.NS', name: 'FINNIFTY' },
    { symbol: '^INDIAVIX', name: 'INDIA VIX' },
    { symbol: '^NSMIDCP', name: 'NIFTYNXT50' }
  ],
  USA: [
    { symbol: '^GSPC', name: 'S&P 500' },
    { symbol: '^DJI', name: 'Dow Jones' },
    { symbol: '^IXIC', name: 'Nasdaq' },
    { symbol: '^RUT', name: 'Russell 2000' },
    { symbol: 'DX-Y.NYB', name: 'Dollar Index' },
    { symbol: '^TNX', name: 'US 10 YR Treasury' },
    { symbol: '^GSPTSE', name: 'TSX' }
  ],
  Europe: [
    { symbol: '^FTSE', name: 'FTSE 100' },
    { symbol: '^FCHI', name: 'CAC 40' },
    { symbol: '^GDAXI', name: 'DAX' },
    { symbol: '^N100', name: 'Euronext 100' },
    { symbol: '^OMX', name: 'OMX' }
  ],
  Asia: [
    { symbol: '^N225', name: 'Nikkei 225' },
    { symbol: '000001.SS', name: 'SSE Composite' },
    { symbol: '^HSI', name: 'Hang Seng' },
    { symbol: '^AXJO', name: 'S&P/ASX 200' }
  ]
};

type Region = keyof typeof REGIONS;

export function MarketTicker() {
  const { settings } = useSettings();
  const [activeRegion, setActiveRegion] = useState<Region>('India');
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filter indices based on user settings
  const hiddenIndices = settings.hiddenIndices || [];
  const visibleIndices = REGIONS[activeRegion].filter(idx => !hiddenIndices.includes(idx.symbol));

  useEffect(() => {
    // Fetch initial prices for the selected region
    const symbols = visibleIndices.map(idx => idx.symbol).join(',');
    
    if (!symbols) {
      setPrices({});
      return;
    }
    
    // We'll just fetch via REST to keep it simple, or SSE. 
    // Since we don't have a reliable SSE mock, let's use the REST endpoint and poll every 30s.
    const fetchPrices = async () => {
      try {
        const result = await api.get(`/api/prices?symbols=${symbols}`);
        setPrices(result || {});
      } catch (err) {
        console.error('Failed to fetch indices prices', err);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [activeRegion, visibleIndices.map(idx => idx.symbol).join(',')]);

  return (
    <div className="h-8 sm:h-10 bg-surface border-b border-divider flex items-center shrink-0 text-[10px] sm:text-xs w-full select-none relative z-20">
      
      {/* Region Selector */}
      <div className="relative h-full flex items-center border-r border-divider bg-surface px-2 sm:px-4 shadow-[4px_0_12px_rgba(0,0,0,0.05)] shrink-0 z-10">
        <button 
          className="flex items-center gap-1 sm:gap-1.5 font-semibold text-primary focus:outline-none uppercase tracking-wide text-[9px] sm:text-[10px]"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          {activeRegion} Indices
          <ChevronDown className="w-3.5 h-3.5 text-secondary" />
        </button>

        {isDropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
            <div className="absolute top-full left-0 mt-0 w-36 bg-surface border border-divider rounded-b-lg shadow-xl py-1 z-20 overflow-hidden">
              {(Object.keys(REGIONS) as Region[]).map(region => (
                <button
                  key={region}
                  onClick={() => {
                    setActiveRegion(region);
                    setIsDropdownOpen(false);
                    setPrices({}); // clear old prices to avoid flicker
                  }}
                  className={`w-full text-left px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium hover:bg-background transition-colors ${activeRegion === region ? 'text-primary bg-background' : 'text-secondary'}`}
                >
                  {region}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Still Ticker */}
      <div className="flex-1 overflow-hidden relative h-full flex items-center group">
        <div className="flex items-center whitespace-nowrap px-2 sm:px-4 overflow-x-auto no-scrollbar w-full">
          {visibleIndices.length === 0 && (
            <span className="text-secondary text-xs italic">No indices selected</span>
          )}
          {visibleIndices.map((indexInfo, i) => {
            const data = prices[indexInfo.symbol];
            const change = data?.change || 0;
            const changePercent = data?.changePercent || 0;
            const price = data?.price || 0;
            const isPositive = change >= 0;

            return (
              <div key={`${indexInfo.symbol}-${i}`} className="flex items-center gap-2 sm:gap-4 mr-6 sm:mr-12 shrink-0">
                <span className="font-semibold text-primary">{indexInfo.name}</span>
                {data ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-primary">{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className={`flex items-center text-[9px] sm:text-[10px] font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                      {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                      {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                    </span>
                  </div>
                ) : (
                  <div className="w-16 h-2 bg-divider rounded animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
