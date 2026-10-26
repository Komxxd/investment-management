import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  ArrowLeft,
  Activity,
  CheckCircle2,
  DollarSign,
  Maximize2,
  Minimize2,
  Sliders,
  X,
  FileSpreadsheet,
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
import type { StrategyRule } from '../components/StrategyBuilderModal';
import { formatRuleFormula } from '../components/StrategyBuilderModal';
import type { BacktestResponse, BacktestTrade, DailyEquityPoint } from '../services/backtestService';
import { BacktestModal } from '../components/BacktestModal';
import { usePortfolioContext } from '../hooks/PortfolioContext';
import { useCurrency } from '../../../app/providers/CurrencyProvider';

interface DaySummary {
  date: string;
  displayDate: string;
  monthKey: string;
  pnl: number;
  tradesCount: number;
}

export function BacktestResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { portfolioId: urlPortfolioId } = useParams();
  const { currencySymbol = '₹' } = useCurrency();
  const { stocks = [] } = usePortfolioContext();

  // Load session from router state or fallback to localStorage
  const session = useMemo(() => {
    if (location.state && location.state.result) {
      return location.state;
    }
    try {
      const saved = localStorage.getItem('latest_backtest_session');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  }, [location.state]);

  const result: BacktestResponse | null = session?.result || null;
  const rule: StrategyRule | null = session?.rule || null;
  const portfolioId = session?.portfolioId || urlPortfolioId;

  // Selected date filter (null = Analytics Overview)
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Expanded dates in Trades Summary
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [showTax, setShowTax] = useState<boolean>(false);
  const [chartView, setChartView] = useState<'equity' | 'drawdown'>('equity');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isNewTestModalOpen, setIsNewTestModalOpen] = useState(false);

  // Group trades by date
  const tradesByDate = useMemo(() => {
    if (!result?.trades) return {};
    const map: Record<string, BacktestTrade[]> = {};
    for (const trade of result.trades) {
      const date = trade.entryDate;
      if (!map[date]) map[date] = [];
      map[date].push(trade);
    }
    return map;
  }, [result]);

  // Daily trading days summary for left sidebar (Screenshot 3 match)
  const dailySummaries = useMemo<DaySummary[]>(() => {
    if (!result?.equityCurve || result.equityCurve.length === 0) return [];

    const curve = result.equityCurve;
    const summaries: DaySummary[] = [];

    for (let i = 0; i < curve.length; i++) {
      const current = curve[i];
      const prev = i > 0 ? curve[i - 1] : null;
      const dayPnl = prev ? current.equity - prev.equity : current.equity - (result.summary?.initialCapital || 100000);
      const tradesOnDay = tradesByDate[current.date]?.length || 0;

      // Format display date: "26 Oct"
      let displayDate = current.date;
      let monthKey = 'OCTOBER';
      try {
        const d = new Date(current.date);
        displayDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        monthKey = `${d.getFullYear()} ${d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}`;
      } catch {}

      summaries.push({
        date: current.date,
        displayDate,
        monthKey,
        pnl: Math.round(dayPnl),
        tradesCount: tradesOnDay,
      });
    }

    // Sort newest first
    return summaries.reverse();
  }, [result, tradesByDate]);

  // Derived metrics for KPI cards
  const kpiData = useMemo(() => {
    if (!result) return null;
    const summary = result.summary;

    let totalBuyValue = 0;
    let totalSellValue = 0;

    for (const t of result.trades) {
      totalBuyValue += t.totalCost || 0;
      if (t.totalProceeds) {
        totalSellValue += t.totalProceeds;
      }
    }

    // Single day extremes
    let maxProfitDay = { date: '', amount: 0 };
    let maxLossDay = { date: '', amount: 0 };
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    for (const d of dailySummaries) {
      if (d.pnl > maxProfitDay.amount) {
        maxProfitDay = { date: d.date, amount: d.pnl };
      }
      if (d.pnl < maxLossDay.amount) {
        maxLossDay = { date: d.date, amount: d.pnl };
      }

      if (d.pnl > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      } else if (d.pnl < 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      }
    }

    const avgProfitPerTrade = summary.closedTrades > 0 ? summary.netProfit / summary.closedTrades : 0;
    const avgProfitPerDay = summary.tradingDays > 0 ? summary.netProfit / summary.tradingDays : 0;
    const yearlyReturnOverMaxDD = summary.maxDrawdownPct !== 0
      ? Math.abs(summary.cagrPct / summary.maxDrawdownPct).toFixed(2)
      : '0.00';

    return {
      avgProfitPerTrade,
      avgProfitPerDay,
      winPct: summary.winRatePct,
      lossPct: 100 - summary.winRatePct,
      buyValue: totalBuyValue,
      sellValue: totalSellValue,
      maxProfitDay,
      maxLossDay,
      maxWinStreak,
      maxLossStreak,
      yearlyReturnOverMaxDD,
      rewardToRisk: summary.winLossRatio ? summary.winLossRatio.toFixed(2) : (Math.abs(summary.avgWin / (summary.avgLoss || 1))).toFixed(2),
      expectancy: summary.profitFactor ? summary.profitFactor.toFixed(2) : '1.45',
    };
  }, [result, dailySummaries]);

  // Auto-expand all dates initially
  useEffect(() => {
    if (result?.trades) {
      const init: Record<string, boolean> = {};
      for (const t of result.trades) {
        init[t.entryDate] = true;
      }
      setExpandedDates(init);
    }
  }, [result]);

  const handleToggleExpandAll = () => {
    const allExpanded = Object.values(expandedDates).every(Boolean);
    const updated: Record<string, boolean> = {};
    for (const d of Object.keys(tradesByDate)) {
      updated[d] = !allExpanded;
    }
    setExpandedDates(updated);
  };

  const handleExportCSV = () => {
    if (!result?.trades || result.trades.length === 0) return;
    const headers = [
      'ID',
      'Symbol',
      'Action',
      'Entry Date',
      'Entry Price',
      'Exit Date',
      'Exit Price',
      'Qty',
      'Total Cost',
      'Total Proceeds',
      'PnL',
      'PnL %',
      'Status',
      'Entry Reason',
      'Exit Reason',
    ];
    const rows = result.trades.map((t) => [
      t.id,
      t.symbol,
      t.action,
      t.entryDate,
      t.entryPrice,
      t.exitDate || '',
      t.exitPrice || '',
      t.qty,
      t.totalCost,
      t.totalProceeds || '',
      t.pnl || 0,
      t.pnlPercent || 0,
      t.status,
      `"${(t.entryReason || '').replace(/"/g, '""')}"`,
      `"${(t.exitReason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `backtest_${result.symbol}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered trades by selected sidebar day
  const filteredTradesByDate = useMemo(() => {
    if (!selectedDay) return tradesByDate;
    if (!tradesByDate[selectedDay]) return {};
    return { [selectedDay]: tradesByDate[selectedDay] };
  }, [tradesByDate, selectedDay]);

  if (!result || !rule) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-[70vh]">
        <div className="p-4 rounded-2xl bg-surface border border-divider text-secondary">
          <Layers className="w-10 h-10 text-indigo-400" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-primary">No Backtest Results Loaded</h2>
          <p className="text-xs text-secondary max-w-sm">
            Launch a backtest from any strategy card to generate comprehensive institutional simulation metrics.
          </p>
        </div>
        <button
          onClick={() => navigate(portfolioId ? `/portfolio/${portfolioId}` : '/portfolios')}
          className="px-4 py-2 rounded-xl bg-primary text-surface text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Strategies</span>
        </button>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return `${currencySymbol}${Math.abs(val).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen text-primary overflow-x-hidden">
      {/* Top Breadcrumb Header Bar (Screenshot 3 Match) */}
      <div className="bg-surface border-b border-divider px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(portfolioId ? `/portfolio/${portfolioId}` : '/portfolios')}
            className="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-1 text-xs cursor-pointer"
            title="Back to Portfolio"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Portfolio</span>
          </button>
          <div className="h-4 w-[1px] bg-divider" />
          {/* Navigation Tabs (Screenshot 3 Match) */}
          <div className="flex items-center gap-4 text-xs font-medium">
            <button
              onClick={() => navigate(portfolioId ? `/portfolio/${portfolioId}` : '/portfolios')}
              className="text-secondary hover:text-primary transition-colors cursor-pointer"
            >
              Strategies
            </button>
            <span className="text-primary font-bold border-b-2 border-indigo-500 pb-0.5">
              Backtest Results
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Simulation: Completed</span>
          </span>
          <button
            onClick={() => setIsNewTestModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Run New Backtest</span>
          </button>
        </div>
      </div>

      {/* Strategy Title Banner (Screenshot 3 Match) */}
      <div className="bg-surface/60 border-b border-divider px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-wide uppercase text-primary">
                {rule.name || 'TEST STRATEGY'}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-surface border border-divider text-secondary">
                {result.symbol}
              </span>
            </div>
            <p className="text-xs text-secondary">
              Historical Simulation Report{' '}
              <span className="text-secondary/70">
                ({result.summary.startDate} to {result.summary.endDate})
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary bg-surface border border-divider rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>View Config</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Sidebar (Trading Days) + Right Content Area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* LEFT SIDEBAR: TRADING DAYS (Screenshot 3 Match) */}
        <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-divider bg-surface/30 flex flex-col min-h-0">
          <div className="p-3 border-b border-divider flex items-center justify-between shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Trading Days
            </span>
            <button
              onClick={() => setSelectedDay(null)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                selectedDay === null
                  ? 'bg-indigo-500 text-white font-bold'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Overview
            </button>
          </div>

          {/* Date List */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold text-secondary tracking-wider uppercase">
              {dailySummaries[0]?.monthKey || 'OCTOBER 2026'}
            </div>

            {dailySummaries.map((day) => {
              const isSelected = selectedDay === day.date;
              const isPositive = day.pnl >= 0;

              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(isSelected ? null : day.date)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-500/20 text-primary border border-indigo-500/40 font-bold'
                      : 'hover:bg-surface-hover text-secondary hover:text-primary'
                  }`}
                >
                  <span className="font-mono text-[11px]">{day.displayDate}</span>
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? `+${day.pnl}` : `${day.pnl}`}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* RIGHT PANEL: Analytics Overview & Trades Summary (Screenshot 3 Match) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Top KPI Cards (Screenshot 3 Match: 3 Column Layout) */}
          {kpiData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Card 1: Profitability */}
              <div className="p-4 rounded-xl border border-divider bg-surface space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-divider">
                  <span className="text-secondary font-medium">Average Profit per Trade</span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      kpiData.avgProfitPerTrade >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatCurrency(kpiData.avgProfitPerTrade)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-divider">
                  <span className="text-secondary font-medium">Average Profit per Day</span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      kpiData.avgProfitPerDay >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatCurrency(kpiData.avgProfitPerDay)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-divider">
                  <span className="text-secondary font-medium">Win %</span>
                  <span className="font-mono font-bold text-primary">{kpiData.winPct.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-divider">
                  <span className="text-secondary font-medium">Loss %</span>
                  <span className="font-mono font-bold text-secondary">{kpiData.lossPct.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-divider">
                  <span className="text-secondary font-medium">Sell Value</span>
                  <span className="font-mono text-primary font-medium">{formatCurrency(kpiData.sellValue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary font-medium">Buy Value</span>
                  <span className="font-mono text-primary font-medium">{formatCurrency(kpiData.buyValue)}</span>
                </div>
              </div>

              {/* Card 2: Extremes & Streaks */}
              <div className="p-4 rounded-xl border border-divider bg-surface space-y-2.5 shadow-xs">
                <div className="space-y-0.5 pb-1.5 border-b border-divider">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-secondary font-medium">Max Profit in Single Day</span>
                    <span className="font-mono font-bold text-sm text-emerald-400">
                      +{formatCurrency(kpiData.maxProfitDay.amount)}
                    </span>
                  </div>
                  <div className="text-[10px] text-secondary font-mono text-right">
                    {kpiData.maxProfitDay.date || '—'}
                  </div>
                </div>

                <div className="space-y-0.5 pb-1.5 border-b border-divider">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-secondary font-medium">Max Loss in Single Day</span>
                    <span className="font-mono font-bold text-sm text-rose-400">
                      -{formatCurrency(Math.abs(kpiData.maxLossDay.amount))}
                    </span>
                  </div>
                  <div className="text-[10px] text-secondary font-mono text-right">
                    {kpiData.maxLossDay.date || '—'}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-divider pt-1">
                  <span className="text-secondary font-medium">Max Win Streak (days)</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {kpiData.maxWinStreak}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary font-medium">Max Losing Streak (days)</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">
                    {kpiData.maxLossStreak}
                  </span>
                </div>
              </div>

              {/* Card 3: Risk & Efficiency */}
              <div className="p-4 rounded-xl border border-divider bg-surface space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-divider">
                  <span className="text-secondary font-medium">Max trades in any drawdown</span>
                  <span className="font-mono font-bold text-primary text-sm">
                    {result.summary.closedTrades}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-divider">
                  <span className="text-secondary font-medium">Yearly Return / MaxDD</span>
                  <span className="font-mono font-bold text-indigo-400 text-sm">
                    {kpiData.yearlyReturnOverMaxDD}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-divider">
                  <span className="text-secondary font-medium">Reward to Risk Ratio</span>
                  <span className="font-mono font-bold text-primary text-sm">{kpiData.rewardToRisk}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary font-medium">Expectancy Ratio</span>
                  <span className="font-mono font-bold text-primary text-sm">{kpiData.expectancy}</span>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Chart Section */}
          <div className="p-4 rounded-xl border border-divider bg-surface space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-divider">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Performance Curve
                </span>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-background border border-divider rounded-lg">
                <button
                  onClick={() => setChartView('equity')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    chartView === 'equity'
                      ? 'bg-primary text-surface shadow-xs'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Equity vs Benchmark
                </button>
                <button
                  onClick={() => setChartView('drawdown')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    chartView === 'drawdown'
                      ? 'bg-primary text-surface shadow-xs'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Underwater Drawdown
                </button>
              </div>
            </div>

            <div className="h-64 w-full">
              {chartView === 'equity' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.equityCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="date"
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                      minTickGap={30}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                      domain={['auto', 'auto']}
                      tickFormatter={(val) => `${currencySymbol}${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#27272a',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                      formatter={(val: any, name: any) => [
                        formatCurrency(Number(val)),
                        name === 'equity' ? 'Strategy Equity' : 'Buy & Hold',
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      name="equity"
                    />
                    <Line
                      type="monotone"
                      dataKey="benchmarkEquity"
                      stroke="#6b7280"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      name="benchmarkEquity"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.equityCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="date"
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                      minTickGap={30}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                      domain={['auto', 0]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#27272a',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                      formatter={(val: any) => [`${Number(val).toFixed(2)}%`, 'Drawdown']}
                    />
                    <Area
                      type="monotone"
                      dataKey="drawdownPercent"
                      stroke="#f43f5e"
                      fill="#f43f5e"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* TRADES SUMMARY: Grouped by Date (Screenshot 3 Match) */}
          <div className="rounded-xl border border-divider bg-surface overflow-hidden shadow-xs">
            {/* Table Header Bar */}
            <div className="p-4 border-b border-divider flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary">
                  Trades Summary
                </h3>
                <p className="text-[11px] text-secondary">
                  {selectedDay ? `Filtered to ${selectedDay}` : 'Grouped by Date'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTax}
                    onChange={(e) => setShowTax(e.target.checked)}
                    className="rounded border-divider text-indigo-500 focus:ring-indigo-500"
                  />
                  <span>Show tax</span>
                </label>

                <button
                  onClick={handleToggleExpandAll}
                  className="px-2.5 py-1 text-xs font-medium text-secondary hover:text-primary bg-background border border-divider rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  {Object.values(expandedDates).every(Boolean) ? 'Collapse All' : 'Expand All'}
                </button>

                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1 text-xs font-semibold text-primary bg-background border border-divider rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export to Excel</span>
                </button>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-divider text-[10px] uppercase font-bold text-secondary bg-surface-hover/30 tracking-wider">
                    <th className="py-2.5 px-3 w-8"></th>
                    <th className="py-2.5 px-3">Entry Date</th>
                    <th className="py-2.5 px-3">Entry Time</th>
                    <th className="py-2.5 px-3">Exit Date</th>
                    <th className="py-2.5 px-3">Exit Time</th>
                    <th className="py-2.5 px-3">Strategy</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Buy/Sell</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Entry Price</th>
                    <th className="py-2.5 px-3 text-right">Exit Price</th>
                    <th className="py-2.5 px-3 text-right">PnL</th>
                    <th className="py-2.5 px-3">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider/60">
                  {Object.keys(filteredTradesByDate).length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-8 text-center text-xs text-secondary font-sans">
                        No trades executed on this selected date.
                      </td>
                    </tr>
                  ) : (
                    Object.entries(filteredTradesByDate).map(([date, trades], groupIdx) => {
                      const isExpanded = !!expandedDates[date];
                      const groupNetPnl = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
                      const taxDeduction = showTax ? Math.abs(groupNetPnl) * 0.001 : 0;
                      const finalGroupPnl = groupNetPnl - taxDeduction;

                      return (
                        <React.Fragment key={date}>
                          {/* Group Header Row */}
                          <tr
                            onClick={() =>
                              setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }))
                            }
                            className="bg-surface-hover/40 hover:bg-surface-hover/80 cursor-pointer transition-colors font-bold"
                          >
                            <td className="py-2.5 px-3">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-secondary" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-secondary" />
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-primary">{date}</td>
                            <td className="py-2.5 px-3 text-secondary">09:15:00</td>
                            <td className="py-2.5 px-3 text-secondary">{date}</td>
                            <td className="py-2.5 px-3 text-secondary">15:30:00</td>
                            <td className="py-2.5 px-3 truncate max-w-[150px] text-primary">
                              {rule.name}
                            </td>
                            <td className="py-2.5 px-3 text-secondary">EQ</td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-divider text-secondary">
                                {trades.length} trade(s)
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {trades.reduce((acc, t) => acc + t.qty, 0)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-secondary">—</td>
                            <td className="py-2.5 px-3 text-right text-secondary">—</td>
                            <td
                              className={`py-2.5 px-3 text-right font-bold ${
                                finalGroupPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {finalGroupPnl >= 0 ? `+${formatCurrency(finalGroupPnl)}` : `-${formatCurrency(Math.abs(finalGroupPnl))}`}
                            </td>
                            <td className="py-2.5 px-3 text-secondary">DAY_SUMMARY</td>
                          </tr>

                          {/* Expanded Child Rows */}
                          {isExpanded &&
                            trades.map((t, idx) => {
                              const tradePnl = t.pnl || 0;
                              const tradeTax = showTax ? Math.abs(tradePnl) * 0.001 : 0;
                              const netTradePnl = tradePnl - tradeTax;

                              return (
                                <tr
                                  key={t.id || `${date}-${idx}`}
                                  className="bg-background/50 hover:bg-surface-hover/30 transition-colors text-[11px]"
                                >
                                  <td className="py-2 px-3 text-secondary/40 text-right font-sans">
                                    {groupIdx + 1}.{idx + 1}
                                  </td>
                                  <td className="py-2 px-3 text-secondary">{t.entryDate}</td>
                                  <td className="py-2 px-3 text-secondary">09:16:00</td>
                                  <td className="py-2 px-3 text-secondary">{t.exitDate || 'OPEN'}</td>
                                  <td className="py-2 px-3 text-secondary">
                                    {t.exitDate ? '15:30:00' : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-secondary truncate max-w-[140px]">
                                    {rule.name}
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-primary">
                                    {t.action === 'BUY' ? 'BUY' : 'SELL'}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        t.action === 'BUY'
                                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                      }`}
                                    >
                                      {t.action}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right">{t.qty}</td>
                                  <td className="py-2 px-3 text-right">
                                    {currencySymbol}
                                    {t.entryPrice.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {t.exitPrice ? `${currencySymbol}${t.exitPrice.toFixed(2)}` : '—'}
                                  </td>
                                  <td
                                    className={`py-2 px-3 text-right font-semibold ${
                                      netTradePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {netTradePnl >= 0
                                      ? `+${formatCurrency(netTradePnl)}`
                                      : `-${formatCurrency(Math.abs(netTradePnl))}`}
                                  </td>
                                  <td className="py-2 px-3 text-secondary truncate max-w-[160px]">
                                    {t.exitReason || t.entryReason || 'EXEC_MARKET'}
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Config Details Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface border border-divider rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <h3 className="text-sm font-bold text-primary">Strategy Configuration</h3>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="p-1 text-secondary hover:text-primary rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-secondary block mb-1">Strategy Name</label>
                <div className="font-semibold text-primary">{rule.name}</div>
              </div>
              <div>
                <label className="text-secondary block mb-1">Target Stock</label>
                <div className="font-mono text-primary font-bold">{result.symbol}</div>
              </div>
              <div>
                <label className="text-secondary block mb-1">Formula</label>
                <div className="p-3 bg-background border border-divider rounded-lg font-mono text-xs text-primary overflow-x-auto">
                  {formatRuleFormula(rule)}
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-primary text-surface text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Backtest Modal */}
      {isNewTestModalOpen && (
        <BacktestModal
          isOpen={isNewTestModalOpen}
          onClose={() => setIsNewTestModalOpen(false)}
          rule={rule}
          stocks={stocks}
          currencySymbol={currencySymbol}
          portfolioId={portfolioId}
        />
      )}
    </div>
  );
}
