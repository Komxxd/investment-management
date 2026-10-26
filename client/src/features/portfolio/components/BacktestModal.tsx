import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  Loader2,
  AlertCircle,
  Calendar,
  DollarSign,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  ListFilter,
  Layers,
  ShieldAlert,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { StrategyRule } from './StrategyBuilderModal';
import { runBacktest, type BacktestResponse, type BacktestTrade } from '../services/backtestService';

interface BacktestModalProps {
  isOpen: boolean;
  onClose: () => void;
  rule: StrategyRule;
  stocks: Array<{ id: string; symbol: string; quantity: number; entry_price: number }>;
  currencySymbol?: string;
  onBacktestCompleted?: (result: BacktestResponse) => void;
}

type ActiveViewTab = 'charts' | 'trades' | 'metrics';

export function BacktestModal({
  isOpen,
  onClose,
  rule,
  stocks,
  currencySymbol = '₹',
  onBacktestCompleted,
}: BacktestModalProps) {
  const defaultSymbol =
    rule.targetSymbol && rule.targetSymbol !== 'ALL'
      ? rule.targetSymbol
      : stocks[0]?.symbol || 'RELIANCE.NS';

  const [symbol, setSymbol] = useState(defaultSymbol);
  const [customSymbol, setCustomSymbol] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [years, setYears] = useState<number>(3);
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [slippagePct] = useState<number>(0.05); // 0.05%
  const [feePct] = useState<number>(0.1);      // 0.1%

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveViewTab>('charts');

  // Trade blotter filtering state
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'OPEN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync symbol on rule change
  useEffect(() => {
    if (rule.targetSymbol && rule.targetSymbol !== 'ALL') {
      setSymbol(rule.targetSymbol);
      setIsCustom(false);
    } else if (stocks.length > 0) {
      setSymbol(stocks[0].symbol);
      setIsCustom(false);
    }
    setError(null);
  }, [rule, stocks]);

  if (!isOpen) return null;

  const activeSymbol = isCustom ? customSymbol.trim().toUpperCase() : symbol;

  const handleExecuteBacktest = async () => {
    if (!activeSymbol) {
      setError('Please select or enter a valid stock symbol.');
      return;
    }

    if (!rule.conditions || rule.conditions.length === 0) {
      setError('Strategy must have at least one condition to backtest.');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const res = await runBacktest({
        symbol: activeSymbol,
        rules: [rule],
        years,
        initialCapital: Number(initialCapital) || 100000,
        slippagePct: (Number(slippagePct) || 0) / 100,
        feePct: (Number(feePct) || 0) / 100,
      });

      setResult(res);
      if (onBacktestCompleted) {
        onBacktestCompleted(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete backtest. Verify stock symbol and historical data.');
    } finally {
      setIsRunning(false);
    }
  };

  // Format axis date label: e.g. "2024-05-15" -> "May '24"
  const formatAxisDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Format currency compact for Y-axis ticks
  const formatCompactY = (val: number) => {
    if (Math.abs(val) >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
    if (Math.abs(val) >= 100000) return `${(val / 100000).toFixed(1)}L`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return `${val}`;
  };

  // Filtered trades list
  const filteredTrades = (result?.trades || []).filter((t: BacktestTrade) => {
    if (tradeFilter === 'WIN' && (t.status !== 'CLOSED' || (t.pnl || 0) <= 0)) return false;
    if (tradeFilter === 'LOSS' && (t.status !== 'CLOSED' || (t.pnl || 0) >= 0)) return false;
    if (tradeFilter === 'OPEN' && t.status !== 'OPEN') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDate = t.entryDate.toLowerCase().includes(q) || (t.exitDate || '').toLowerCase().includes(q);
      const matchReason = (t.entryReason || '').toLowerCase().includes(q) || (t.exitReason || '').toLowerCase().includes(q);
      if (!matchDate && !matchReason) return false;
    }

    return true;
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background border border-divider rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-primary">Strategy Backtester</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-surface border border-divider text-secondary">
                  Institutional Replay
                </span>
              </div>
              <p className="text-xs text-secondary truncate max-w-[500px]">
                Rule: <span className="font-semibold text-primary">{rule.name || 'Untitled Strategy'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Controls Bar */}
          <div className="p-4 bg-surface rounded-xl border border-divider space-y-3 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Target Symbol */}
              <div>
                <label className="block text-[11px] font-medium text-secondary mb-1">
                  Target Stock
                </label>
                {isCustom ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. RELIANCE.NS"
                      value={customSymbol}
                      onChange={(e) => setCustomSymbol(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-divider bg-background text-primary focus:outline-none focus:border-primary uppercase font-mono font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustom(false)}
                      className="px-2.5 py-1.5 text-[11px] text-secondary hover:text-primary border border-divider rounded-lg hover:bg-surface-hover shrink-0 cursor-pointer"
                    >
                      Holdings
                    </button>
                  </div>
                ) : (
                  <select
                    value={symbol}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setIsCustom(true);
                      } else {
                        setSymbol(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-divider bg-background text-primary focus:outline-none focus:border-primary font-medium cursor-pointer"
                  >
                    {stocks.map((s) => (
                      <option key={s.id || s.symbol} value={s.symbol}>
                        {s.symbol} ({s.quantity} shares held)
                      </option>
                    ))}
                    <option value="RELIANCE.NS">RELIANCE.NS</option>
                    <option value="TCS.NS">TCS.NS</option>
                    <option value="INFY.NS">INFY.NS</option>
                    <option value="AAPL">AAPL</option>
                    <option value="__CUSTOM__">+ Other Symbol...</option>
                  </select>
                )}
              </div>

              {/* Time Horizon */}
              <div>
                <label className="block text-[11px] font-medium text-secondary mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Lookback Period
                </label>
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-background border border-divider rounded-lg">
                  {[1, 3, 5].map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setYears(y)}
                      className={`py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                        years === y
                          ? 'bg-primary text-surface shadow font-semibold'
                          : 'text-secondary hover:text-primary'
                      }`}
                    >
                      {y} Year{y > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Starting Capital */}
              <div>
                <label className="block text-[11px] font-medium text-secondary mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  Initial Capital
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-secondary font-mono">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="1000"
                    step="10000"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(Math.max(1000, Number(e.target.value)))}
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-divider bg-background text-primary font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Run Action */}
            <div className="pt-2 border-t border-divider flex items-center justify-between text-[11px] text-secondary">
              <span>Zero-lookahead execution (Open $t+1$) • 0.05% slippage • 0.1% fees</span>
              <button
                type="button"
                onClick={handleExecuteBacktest}
                disabled={isRunning}
                className="px-5 py-2 rounded-xl bg-primary hover:opacity-90 disabled:opacity-50 text-surface text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-surface" />
                    <span>Replaying Market Data...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current text-surface" />
                    <span>Run Backtest</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-500 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Backtest Failed</div>
                <div className="text-[11px] opacity-90">{error}</div>
              </div>
            </div>
          )}

          {/* Results Analytics Dashboard */}
          {result && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Scorecard Hero Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {/* Net Profit */}
                <div className="p-3.5 rounded-xl bg-surface border border-divider shadow-sm">
                  <div className="text-[10px] text-secondary uppercase tracking-wider font-medium">Net Return</div>
                  <div
                    className={`text-base font-bold font-mono mt-1 ${
                      result.summary.totalReturnPct >= 0 ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {result.summary.totalReturnPct >= 0 ? '+' : ''}
                    {result.summary.totalReturnPct}%
                  </div>
                  <div className="text-[11px] text-secondary font-mono mt-0.5">
                    {result.summary.netProfit >= 0 ? '+' : ''}
                    {currencySymbol}
                    {result.summary.netProfit.toLocaleString()}
                  </div>
                </div>

                {/* CAGR */}
                <div className="p-3.5 rounded-xl bg-surface border border-divider shadow-sm">
                  <div className="text-[10px] text-secondary uppercase tracking-wider font-medium">CAGR (Annual)</div>
                  <div
                    className={`text-base font-bold font-mono mt-1 ${
                      result.summary.cagrPct >= 0 ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {result.summary.cagrPct}%
                  </div>
                  <div className="text-[11px] text-secondary mt-0.5">
                    B&H: {result.summary.benchmarkCagrPct}%
                  </div>
                </div>

                {/* Alpha */}
                <div className="p-3.5 rounded-xl bg-surface border border-divider shadow-sm">
                  <div className="text-[10px] text-secondary uppercase tracking-wider font-medium">Alpha vs B&H</div>
                  <div
                    className={`text-base font-bold font-mono mt-1 ${
                      result.summary.alphaPct >= 0 ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {result.summary.alphaPct >= 0 ? '+' : ''}
                    {result.summary.alphaPct}%
                  </div>
                  <div className="text-[11px] text-secondary mt-0.5">
                    Excess vs stock
                  </div>
                </div>

                {/* Max Drawdown */}
                <div className="p-3.5 rounded-xl bg-surface border border-divider shadow-sm">
                  <div className="text-[10px] text-secondary uppercase tracking-wider font-medium">Max Drawdown</div>
                  <div className="text-base font-bold font-mono text-amber-500 mt-1">
                    {result.summary.maxDrawdownPct}%
                  </div>
                  <div className="text-[11px] text-secondary mt-0.5">
                    Peak pullback
                  </div>
                </div>

                {/* Win Rate */}
                <div className="p-3.5 rounded-xl bg-surface border border-divider shadow-sm col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-secondary uppercase tracking-wider font-medium">Win Rate</div>
                  <div className="text-base font-bold font-mono text-primary mt-1">
                    {result.summary.winRatePct}%
                  </div>
                  <div className="text-[11px] text-secondary mt-0.5">
                    {result.summary.winningTrades}W / {result.summary.losingTrades}L
                  </div>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="border-b border-divider flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('charts')}
                    className={`px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'charts'
                        ? 'border-primary text-primary font-semibold'
                        : 'border-transparent text-secondary hover:text-primary'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Equity Curve & Drawdown</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('trades')}
                    className={`px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'trades'
                        ? 'border-primary text-primary font-semibold'
                        : 'border-transparent text-secondary hover:text-primary'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>Trade Blotter ({result.trades.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('metrics')}
                    className={`px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'metrics'
                        ? 'border-primary text-primary font-semibold'
                        : 'border-transparent text-secondary hover:text-primary'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Scorecard & Risk</span>
                  </button>
                </div>

                <div className="text-[11px] text-secondary font-mono">
                  {result.summary.startDate} to {result.summary.endDate} ({result.summary.tradingDays} days)
                </div>
              </div>

              {/* TAB 1: CHARTS */}
              {activeTab === 'charts' && (
                <div className="space-y-5">
                  {/* Equity Curve Chart */}
                  <div className="p-4 bg-surface rounded-xl border border-divider space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary">Equity Curve</span>
                        <span className="text-[10px] text-secondary">
                          Portfolio Value vs Buy & Hold Benchmark ({currencySymbol})
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                          <span className="text-primary font-medium">Strategy Equity</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-1.5 border-t-2 border-dashed border-gray-400 inline-block" />
                          <span className="text-secondary">Buy & Hold ({result.symbol})</span>
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-[260px] pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={result.equityCurve} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={formatAxisDate}
                            tick={{ fontSize: 10, fill: '#888' }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={40}
                          />
                          <YAxis
                            tickFormatter={formatCompactY}
                            tick={{ fontSize: 10, fill: '#888' }}
                            tickLine={false}
                            axisLine={false}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const pt = payload[0].payload;
                                return (
                                  <div className="p-3 bg-surface border border-divider rounded-xl shadow-xl text-xs space-y-1 font-mono">
                                    <div className="text-secondary font-sans text-[11px] pb-1 border-b border-divider">
                                      {pt.date}
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-emerald-500 font-semibold">
                                      <span>Strategy:</span>
                                      <span>{currencySymbol}{pt.equity?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-secondary">
                                      <span>Buy & Hold:</span>
                                      <span>{currencySymbol}{pt.benchmarkEquity?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-amber-500 text-[11px]">
                                      <span>Drawdown:</span>
                                      <span>-{pt.drawdownPercent}%</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-secondary text-[10px] pt-1 border-t border-divider font-sans">
                                      <span>Inventory:</span>
                                      <span>{pt.heldQty} shares ({currencySymbol}{pt.holdingsValue?.toLocaleString()})</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="benchmarkEquity"
                            stroke="#888"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="equity"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Drawdown Underwater Area Chart */}
                  <div className="p-4 bg-surface rounded-xl border border-divider space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        <span>Drawdown Underwater Curve (%)</span>
                      </div>
                      <span className="text-[11px] text-amber-500 font-mono font-medium">
                        Max Drawdown: -{result.summary.maxDrawdownPct}%
                      </span>
                    </div>

                    <div className="w-full h-[120px] pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={result.equityCurve} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={formatAxisDate}
                            tick={{ fontSize: 9, fill: '#888' }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={40}
                          />
                          <YAxis
                            tickFormatter={(v) => `-${v}%`}
                            tick={{ fontSize: 9, fill: '#888' }}
                            tickLine={false}
                            axisLine={false}
                            domain={[0, 'auto']}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const pt = payload[0].payload;
                                return (
                                  <div className="p-2 bg-surface border border-divider rounded-lg shadow-lg text-[11px] font-mono text-amber-500">
                                    {pt.date}: -{pt.drawdownPercent}% drawdown
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="drawdownPercent"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.2}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TRADE BLOTTER */}
              {activeTab === 'trades' && (
                <div className="space-y-3">
                  {/* Filter & Search Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 p-1 bg-surface border border-divider rounded-xl">
                      {(['ALL', 'WIN', 'LOSS', 'OPEN'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setTradeFilter(f)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                            tradeFilter === f
                              ? 'bg-primary text-surface shadow font-semibold'
                              : 'text-secondary hover:text-primary'
                          }`}
                        >
                          {f === 'ALL'
                            ? `All (${result.trades.length})`
                            : f === 'WIN'
                            ? `Wins (${result.summary.winningTrades})`
                            : f === 'LOSS'
                            ? `Losses (${result.summary.losingTrades})`
                            : `Open (${result.trades.filter((t) => t.status === 'OPEN').length})`}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                      <input
                        type="text"
                        placeholder="Search by date or rule..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-divider bg-surface text-primary focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Trades Table */}
                  <div className="border border-divider rounded-xl overflow-hidden bg-surface shadow-sm">
                    <div className="overflow-x-auto max-h-[380px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-surface-hover/80 text-[11px] text-secondary sticky top-0 border-b border-divider font-semibold uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Qty</th>
                            <th className="py-2.5 px-3">Entry</th>
                            <th className="py-2.5 px-3">Exit</th>
                            <th className="py-2.5 px-3 text-right">Net P&L</th>
                            <th className="py-2.5 px-3 text-right">Hold</th>
                            <th className="py-2.5 px-3">Triggers</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-divider font-mono">
                          {filteredTrades.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-secondary font-sans">
                                No trades matched your filter criteria.
                              </td>
                            </tr>
                          ) : (
                            filteredTrades.map((t, idx) => {
                              const isWin = (t.pnl || 0) > 0;
                              const isLoss = (t.pnl || 0) < 0;
                              return (
                                <tr key={t.id} className="hover:bg-surface-hover/50 transition-colors">
                                  <td className="py-2 px-3 text-secondary">{idx + 1}</td>
                                  <td className="py-2 px-3">
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full font-sans font-semibold ${
                                        t.status === 'OPEN'
                                          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/30'
                                          : isWin
                                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                                          : 'bg-red-500/10 text-red-500 border border-red-500/30'
                                      }`}
                                    >
                                      {t.status === 'OPEN' ? 'OPEN' : isWin ? 'WIN' : 'LOSS'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-primary">{t.qty}</td>
                                  <td className="py-2 px-3 text-secondary text-[11px]">
                                    <div>{t.entryDate}</div>
                                    <div className="text-primary">@{currencySymbol}{t.entryPrice.toFixed(2)}</div>
                                  </td>
                                  <td className="py-2 px-3 text-secondary text-[11px]">
                                    <div>{t.exitDate || '—'}</div>
                                    <div className="text-primary">
                                      {t.exitPrice ? `@${currencySymbol}${t.exitPrice.toFixed(2)}` : '—'}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <div
                                      className={`font-bold ${
                                        isWin ? 'text-emerald-500' : isLoss ? 'text-red-500' : 'text-secondary'
                                      }`}
                                    >
                                      {(t.pnl || 0) >= 0 ? '+' : ''}
                                      {currencySymbol}
                                      {(t.pnl || 0).toLocaleString()}
                                    </div>
                                    <div
                                      className={`text-[10px] ${
                                        isWin ? 'text-emerald-500' : isLoss ? 'text-red-500' : 'text-secondary'
                                      }`}
                                    >
                                      {(t.pnlPercent || 0) >= 0 ? '+' : ''}
                                      {(t.pnlPercent || 0).toFixed(2)}%
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-right text-secondary text-[11px]">
                                    {t.holdingPeriodDays}d
                                  </td>
                                  <td className="py-2 px-3 text-[10px] text-secondary font-sans truncate max-w-[200px]">
                                    <div className="truncate text-primary">{t.entryReason}</div>
                                    <div className="truncate text-secondary/80">{t.exitReason}</div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: DETAILED SCORECARD & RISK */}
              {activeTab === 'metrics' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Strategy vs Benchmark Table */}
                  <div className="p-4 bg-surface rounded-xl border border-divider space-y-3">
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Comparative Performance
                    </h3>
                    <div className="divide-y divide-divider text-xs">
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">Total Return</span>
                        <span className="font-mono font-semibold text-primary">
                          {result.summary.totalReturnPct}% vs {result.summary.benchmarkReturnPct}% (B&H)
                        </span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">CAGR (Annualized Return)</span>
                        <span className="font-mono font-semibold text-primary">
                          {result.summary.cagrPct}% vs {result.summary.benchmarkCagrPct}% (B&H)
                        </span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">Strategy Alpha</span>
                        <span
                          className={`font-mono font-bold ${
                            result.summary.alphaPct >= 0 ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {result.summary.alphaPct >= 0 ? '+' : ''}
                          {result.summary.alphaPct}%
                        </span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">Max Drawdown</span>
                        <span className="font-mono font-bold text-amber-500">
                          {result.summary.maxDrawdownPct}%
                        </span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">Market Exposure (% in stocks)</span>
                        <span className="font-mono text-primary font-medium">
                          {result.summary.marketExposurePct}% of days
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Trade Statistics Table */}
                  <div className="p-4 bg-surface rounded-xl border border-divider space-y-3">
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Risk & Accuracy Metrics
                    </h3>
                    <div className="divide-y divide-divider text-xs">
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">Win Rate %</span>
                        <span className="font-mono font-bold text-primary">
                          {result.summary.winRatePct}% ({result.summary.winningTrades}W / {result.summary.losingTrades}L)
                        </span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">Profit Factor</span>
                        <span className="font-mono font-semibold text-primary">
                          {result.summary.profitFactor !== null ? result.summary.profitFactor : 'N/A'}
                        </span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">Average Win vs Loss</span>
                        <span className="font-mono text-primary">
                          {currencySymbol}{result.summary.avgWin.toLocaleString()} / {currencySymbol}{result.summary.avgLoss.toLocaleString()}
                        </span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">Win / Loss Ratio</span>
                        <span className="font-mono text-primary font-medium">
                          {result.summary.winLossRatio !== null ? result.summary.winLossRatio : 'N/A'}
                        </span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">Sharpe Ratio (Annualized)</span>
                        <span className="font-mono font-bold text-primary">
                          {result.summary.sharpeRatio !== null ? result.summary.sharpeRatio : 'N/A'}
                        </span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-secondary">Sortino Ratio (Downside)</span>
                        <span className="font-mono font-bold text-primary">
                          {result.summary.sortinoRatio !== null ? result.summary.sortinoRatio : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!result && !isRunning && !error && (
            <div className="p-10 text-center text-xs text-secondary border border-dashed border-divider rounded-2xl space-y-2">
              <BarChart3 className="w-10 h-10 text-secondary/40 mx-auto mb-2" />
              <div className="font-semibold text-sm text-primary">Ready to Backtest</div>
              <p className="max-w-md mx-auto text-secondary text-xs">
                Select your target stock and time span above, then click <strong>"Run Backtest"</strong> to simulate this strategy across historical daily candles with zero lookahead bias.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-divider bg-surface flex items-center justify-between shrink-0">
          <div className="text-xs text-secondary">
            {result ? (
              <span>
                Final Portfolio Equity:{' '}
                <strong className="text-primary font-mono font-semibold">
                  {currencySymbol}{result.summary.finalEquity.toLocaleString()}
                </strong>
              </span>
            ) : (
              <span>Historical simulation will run on daily OHLCV candles</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
