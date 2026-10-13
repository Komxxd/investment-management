import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api/client';

export type DisplayCurrency = 'INR' | 'USD';

interface CurrencyContextType {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (c: DisplayCurrency) => void;
  currencySymbol: string;
  /** Convert a value from its native currency to the display currency */
  convert: (value: number, fromCurrency?: string) => number;
  /** Format a number with the display currency symbol, applying conversion */
  formatCurrency: (value: number, fromCurrency?: string) => string;
  /** Format a large number with abbreviation (Cr/L for INR, B/M for USD) */
  formatCurrencyCompact: (value: number, fromCurrency?: string) => string;
  exchangeRate: number | null; // USD→INR rate
  rateLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  INR: '₹',
  USD: '$',
};

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [displayCurrency, setDisplayCurrencyRaw] = useState<DisplayCurrency>(() => {
    return (localStorage.getItem('portfolioDisplayCurrency') as DisplayCurrency) || 'INR';
  });

  // USD→INR exchange rate
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  const setDisplayCurrency = (c: DisplayCurrency) => {
    setDisplayCurrencyRaw(c);
    localStorage.setItem('portfolioDisplayCurrency', c);
  };

  // Fetch exchange rate on mount and when display currency changes
  useEffect(() => {
    const fetchRate = async () => {
      setRateLoading(true);
      try {
        const apiBase = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiBase}/api/exchange-rate?from=USD&to=INR`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setExchangeRate(data.rate);
        }
      } catch (err) {
        console.error('Failed to fetch exchange rate:', err);
      } finally {
        setRateLoading(false);
      }
    };
    fetchRate();
    // Refresh every 5 minutes
    const interval = setInterval(fetchRate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const currencySymbol = CURRENCY_SYMBOLS[displayCurrency];

  /**
   * Convert a value from its native currency to the display currency.
   * If no fromCurrency is provided, assumes INR (legacy behavior).
   */
  const convert = useCallback((value: number, fromCurrency?: string): number => {
    if (!exchangeRate || typeof value !== 'number' || isNaN(value)) return value;

    const from = (fromCurrency || 'INR').toUpperCase();
    const to = displayCurrency;

    if (from === to) return value;

    // INR → USD: divide by rate
    if (from === 'INR' && to === 'USD') {
      return value / exchangeRate;
    }
    // USD → INR: multiply by rate
    if (from === 'USD' && to === 'INR') {
      return value * exchangeRate;
    }

    // For other currencies, fallback (no conversion)
    return value;
  }, [exchangeRate, displayCurrency]);

  /**
   * Format a number with the display currency symbol, applying conversion.
   */
  const formatCurrency = useCallback((value: number, fromCurrency?: string): string => {
    const converted = convert(value, fromCurrency);
    const formatted = (typeof converted === 'number' && !isNaN(converted))
      ? converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0.00';
    return `${currencySymbol}${formatted}`;
  }, [convert, currencySymbol]);

  /**
   * Format a large number with abbreviation.
   * INR: Cr (crore) / L (lakh)
   * USD: B (billion) / M (million) / K (thousand)
   */
  const formatCurrencyCompact = useCallback((value: number, fromCurrency?: string): string => {
    const converted = convert(value, fromCurrency);
    const abs = Math.abs(converted);
    const sign = converted < 0 ? '-' : '';

    if (displayCurrency === 'INR') {
      if (abs >= 10000000) {
        return `${sign}${currencySymbol}${(abs / 10000000).toFixed(2)}Cr`;
      }
      if (abs >= 100000) {
        return `${sign}${currencySymbol}${(abs / 100000).toFixed(2)}L`;
      }
    } else {
      // USD
      if (abs >= 1000000000) {
        return `${sign}${currencySymbol}${(abs / 1000000000).toFixed(2)}B`;
      }
      if (abs >= 1000000) {
        return `${sign}${currencySymbol}${(abs / 1000000).toFixed(2)}M`;
      }
      if (abs >= 1000) {
        return `${sign}${currencySymbol}${(abs / 1000).toFixed(2)}K`;
      }
    }

    return `${sign}${currencySymbol}${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }, [convert, currencySymbol, displayCurrency]);

  return (
    <CurrencyContext.Provider value={{
      displayCurrency,
      setDisplayCurrency,
      currencySymbol,
      convert,
      formatCurrency,
      formatCurrencyCompact,
      exchangeRate,
      rateLoading,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
