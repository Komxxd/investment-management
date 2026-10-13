import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api/client';
import { useAuth } from '../../../app/providers/AuthProvider';
export interface Portfolio { id: string; name: string; created_at: string; }
export interface Stock { id: string; portfolio_id: string; symbol: string; quantity: number; entry_price: number; brokerage?: number; govt_tax?: number; entry_date: string; }
export interface SoldStock { id: string; portfolio_id: string; symbol: string; quantity: number; exit_price: number; brokerage?: number; govt_tax?: number; exit_date: string; }

export function usePortfolioData() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [soldStocks, setSoldStocks] = useState<SoldStock[]>([]);
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<any>({});
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Real-time prices state
  const [livePrices, setLivePrices] = useState<Record<string, { 
    price: number; 
    name: string;
    currency?: string;
    change?: number;
    changePercent?: number;
    dayHigh?: number;
    dayLow?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    marketCap?: number;
    volume?: number;
    avgVolume?: number;
    previousClose?: number;
  }>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { session } = useAuth();

  const fetchData = useCallback(async (onPortfoliosLoaded?: (portfolios: Portfolio[]) => void) => {
    if (!session) return;
    setLoading(true);
    try {
      let settingsData: any = {};
      try {
        settingsData = await api.get('/api/settings');
        setSettings(settingsData || {});
      } catch (err) {
        console.error('Failed to load settings', err);
      }
      setSettingsLoading(false);

      const portfoliosDataArray = await api.get('/api/portfolios') || [];

      const savedOrder = settingsData?.portfolioOrder || [];
      
      if (savedOrder && savedOrder.length > 0) {
        portfoliosDataArray.sort((a: any, b: any) => {
          const idxA = savedOrder.indexOf(a.id);
          const idxB = savedOrder.indexOf(b.id);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }
      
      setPortfolios(portfoliosDataArray);
      if (onPortfoliosLoaded) onPortfoliosLoaded(portfoliosDataArray);

      if (portfoliosDataArray.length > 0) {
        const stocksData = await api.get('/api/stocks');
        setStocks(stocksData || []);

        const soldStocksData = await api.get('/api/sold-stocks');
        setSoldStocks(soldStocksData || []);
      }
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        console.error('Error fetching data:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  const updateSettings = useCallback(async (newSettings: any) => {
    setSettings((prev: any) => {
      const merged = { ...prev, ...newSettings };
      // Fire and forget API call to persist settings
      api.put('/api/settings', merged).catch(err => {
        console.error('Failed to save settings to backend:', err);
      });
      return merged;
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    portfolios,
    setPortfolios,
    stocks,
    setStocks,
    soldStocks,
    setSoldStocks,
    loading,
    setLoading,
    livePrices,
    setLivePrices,
    pricesLoading,
    setPricesLoading,
    fetchData,
    isCreateModalOpen,
    setIsCreateModalOpen,
    settings,
    updateSettings,
    settingsLoading
  };
}
