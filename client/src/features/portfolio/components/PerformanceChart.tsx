import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { api } from '../../../services/api/client';
import { usePortfolioContext } from '../hooks/PortfolioContext';
import { useCurrency } from '../../../app/providers/CurrencyProvider';

type Timeframe = '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface HistoricalDataPoint {
  date: number;
  value: number;
  invested: number;
  pnlPercent?: number;
  pnl?: number;
}

interface PerformanceChartProps {
  selectedPortfolioId?: string;
}

export function PerformanceChart({ selectedPortfolioId = 'ALL' }: PerformanceChartProps) {
  const { formatCurrencyCompact, formatCurrency, currencySymbol } = useCurrency();
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>('1Y');
  
  const { stocks } = usePortfolioContext();



  // Generate a signature based on current holdings to automatically invalidate cache when trades occur
  const portfolioSignature = React.useMemo(() => {
    return stocks.reduce((sum, s) => sum + s.quantity, 0).toString();
  }, [stocks]);

  const formatXAxisDate = (timestamp: number) => {
    const d = new Date(timestamp);
    if (timeframe === '1M' || timeframe === '3M') {
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  };

  useEffect(() => {
    let isMounted = true;

    const fetchHistoricalData = async () => {
      const cacheKey = `chart_${timeframe}_${selectedPortfolioId}_${portfolioSignature}`;
      const cachedStr = sessionStorage.getItem(cacheKey);
      
      if (cachedStr) {
        try {
          const parsed = JSON.parse(cachedStr);
          setData(parsed);
          setLoading(false);
          return;
        } catch (e) {
          // ignore cache parse errors and fetch fresh
        }
      }

      setLoading(true);
      try {
        const response = await api.get(`/api/calculations/historical?timeframe=${timeframe}&portfolioId=${selectedPortfolioId}`);
        if (isMounted) {
          setData(response || []);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(response || []));
          } catch (e) {
            // ignore quota errors
          }
        }
      } catch (error) {
        console.error('Failed to fetch historical performance:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchHistoricalData();

    return () => {
      isMounted = false;
    };
  }, [timeframe, selectedPortfolioId, portfolioSignature]);

  const formatCurrencyLabel = (value: number) => {
    return formatCurrencyCompact(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pnlPercent = payload[0].payload.pnlPercent || 0;
      const pnl = payload[0].payload.pnl || 0;
      const isPositive = pnlPercent >= 0;

      return (
        <div className="bg-surface border border-divider p-3 rounded shadow-xl">
          <p className="text-xs text-secondary mb-2 font-medium">{formatDate(label)}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-primary">PnL:</span>
              <span className={`text-sm font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-divider">
              <span className="text-xs text-secondary">Absolute:</span>
              <span className={`text-xs ${isPositive ? 'text-success' : 'text-danger'}`}>
                {isPositive ? '+' : ''}{formatCurrency(Math.abs(pnl))}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Ensure there's enough data to show a chart, otherwise just show an empty state
  if (!loading && data.length < 2) {
    return (
      <div className="w-full h-80 flex flex-col items-center justify-center border border-divider rounded-lg bg-surface mt-6 p-6 text-center">
        <h3 className="text-primary font-medium mb-1">Not enough data</h3>
        <p className="text-secondary text-sm">We need at least a couple of days of transaction history to generate a performance chart.</p>
      </div>
    );
  }

  // Determine chart colors based on overall profitability in this timeframe
  const isProfitable = data.length > 0 && (data[data.length - 1].pnlPercent || 0) >= 0;
  const strokeColor = isProfitable ? '#059669' : '#e11d48'; // Tailwind success/danger

  return (
    <div className="w-full mt-6 mb-8 relative bg-surface border border-divider rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-primary">Performance History</h2>
        <div className="flex items-center bg-surface border border-divider rounded overflow-hidden shadow-sm text-xs">
          {(['1M', '3M', '6M', '1Y', 'ALL'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 font-medium transition-colors ${timeframe === tf
                ? 'bg-primary text-background'
                : 'text-secondary hover:bg-surface-hover hover:text-primary'
                } ${tf !== 'ALL' ? 'border-r border-divider' : ''}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6 w-full h-[280px] relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
            <div className="w-8 h-8 border-2 border-divider border-t-primary rounded-full animate-spin" />
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-divider)" opacity={0.5} />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxisDate}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
              tickLine={{ stroke: '#9ca3af' }}
              minTickGap={30}
              dy={10}
            />
            <YAxis
              tickFormatter={formatPercentage}
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="pnlPercent"
              stroke={strokeColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
