import React, { useState } from 'react';
import {
  Briefcase,
  Activity,
  BarChart3,
  TrendingUp,
  Sliders,
  Repeat,
  Coins,
  Check,
} from 'lucide-react';

type PreviewTab = 'ledger' | 'backtest' | 'research';
type BacktestModePreview = 'STRATEGY' | 'SIP' | 'ONE_TIME';

interface SampleHolding {
  symbol: string;
  qty: number;
  avg: string;
  ltp: string;
  pnl: string;
  pnlPct: string;
  positive: boolean;
  rsi: string;
  rsiBadge?: { text: string; tone: 'os' | 'div' };
  dma200: string;
  dma200Diff: string;
  dma200Above: boolean;
  strategyActive: boolean;
  strategyAction: 'BUY' | 'Executed' | '—';
}

const SAMPLE_HOLDINGS: SampleHolding[] = [
  {
    symbol: 'RELIANCE.NS',
    qty: 85,
    avg: '1,248.40',
    ltp: '1,342.15',
    pnl: '+₹7,968.75',
    pnlPct: '+7.51%',
    positive: true,
    rsi: '41.8',
    dma200: '1,245.60',
    dma200Diff: '+7.8%',
    dma200Above: true,
    strategyActive: true,
    strategyAction: '—',
  },
  {
    symbol: 'TCS.NS',
    qty: 42,
    avg: '3,680.00',
    ltp: '4,118.50',
    pnl: '+₹18,417.00',
    pnlPct: '+11.92%',
    positive: true,
    rsi: '28.9',
    rsiBadge: { text: 'OS', tone: 'os' },
    dma200: '3,742.10',
    dma200Diff: '+10.1%',
    dma200Above: true,
    strategyActive: true,
    strategyAction: 'BUY',
  },
  {
    symbol: 'HDFCBANK.NS',
    qty: 110,
    avg: '1,592.10',
    ltp: '1,748.80',
    pnl: '+₹17,237.00',
    pnlPct: '+9.84%',
    positive: true,
    rsi: '54.2',
    rsiBadge: { text: 'Bull Div ↗', tone: 'div' },
    dma200: '1,622.50',
    dma200Diff: '+7.8%',
    dma200Above: true,
    strategyActive: true,
    strategyAction: 'Executed',
  },
  {
    symbol: 'INFY.NS',
    qty: 75,
    avg: '1,842.00',
    ltp: '1,786.30',
    pnl: '-₹4,177.50',
    pnlPct: '-3.02%',
    positive: false,
    rsi: '46.5',
    dma200: '1,840.20',
    dma200Diff: '-2.9%',
    dma200Above: false,
    strategyActive: false,
    strategyAction: '—',
  },
];

interface BacktestModeData {
  badge: string;
  dateWindow: string;
  ruleSummary: string;
  capitalLabel: string;
  capitalVal: string;
  netProfit: string;
  netProfitPct: string;
  cagr: string;
  portfolioEquity: string;
  peakEquity: string;
  peakEquityDate: string;
  maxDdPct: string;
  maxDdAmt: string;
  maxDdDuration: string;
  effAvgBuyPrice: string;
  tradingDaysCount: string;
  sidebarDays: Array<{ date: string; tag?: string; equity: string }>;
  yearRow: {
    year: string;
    months: Array<{ m: string; val: string; pos: boolean }>;
    total: string;
    totalPos: boolean;
    maxDd: string;
  };
}

const BACKTEST_MODE_DATA: Record<BacktestModePreview, BacktestModeData> = {
  STRATEGY: {
    badge: 'Rule-Based Engine · 60m Candles',
    dateWindow: '2024-11-18 to 2026-11-06 (487 Trading Days)',
    ruleSummary:
      'ENTRY: RSI (14) <= 30 AND Price > 200 DMA -> BUY · EXIT: RSI >= 70 · SL: 6% · TP: 18%',
    capitalLabel: 'Initial Capital',
    capitalVal: '₹5,00,000',
    netProfit: '+₹1,24,010',
    netProfitPct: '+24.80%',
    cagr: '+13.42%',
    portfolioEquity: '₹6,24,010',
    peakEquity: '₹6,41,250',
    peakEquityDate: '2026-10-14',
    maxDdPct: '-5.84%',
    maxDdAmt: '-₹36,420',
    maxDdDuration: '18 days',
    effAvgBuyPrice: '₹1,264.80',
    tradingDaysCount: '487',
    sidebarDays: [
      { date: '2026-11-06', equity: '₹6,24,010' },
      { date: '2026-11-05', tag: 'BUY', equity: '₹6,21,850' },
      { date: '2026-11-04', equity: '₹6,18,420' },
      { date: '2026-11-03', tag: 'SELL', equity: '₹6,19,900' },
    ],
    yearRow: {
      year: '2026',
      months: [
        { m: 'Jan', val: '+2.4%', pos: true },
        { m: 'Feb', val: '-0.8%', pos: false },
        { m: 'Mar', val: '+3.1%', pos: true },
        { m: 'Apr', val: '+1.9%', pos: true },
        { m: 'May', val: '+4.2%', pos: true },
        { m: 'Jun', val: '-1.1%', pos: false },
      ],
      total: '+14.8%',
      totalPos: true,
      maxDd: '-5.84%',
    },
  },
  SIP: {
    badge: 'Monthly SIP · 60m Candles',
    dateWindow: '5th of Month · 09:15 IST (Prev Trading Day Fallback)',
    ruleSummary:
      'SCHEDULE: Fixed monthly ₹25,000 split equally across selected portfolio constituent stocks',
    capitalLabel: 'Total Capital Invested',
    capitalVal: '₹6,00,000',
    netProfit: '+₹1,11,900',
    netProfitPct: '+18.65%',
    cagr: '+15.10%',
    portfolioEquity: '₹7,11,900',
    peakEquity: '₹7,26,400',
    peakEquityDate: '2026-10-19',
    maxDdPct: '-4.92%',
    maxDdAmt: '-₹29,140',
    maxDdDuration: '14 days',
    effAvgBuyPrice: 'Equal Split / Cycle',
    tradingDaysCount: '487',
    sidebarDays: [
      { date: '2026-11-06', equity: '₹7,11,900' },
      { date: '2026-11-05', tag: 'SIP BUY', equity: '₹7,09,320' },
      { date: '2026-10-05', tag: 'SIP BUY', equity: '₹6,84,110' },
      { date: '2026-09-04', tag: 'SIP BUY', equity: '₹6,49,750' },
    ],
    yearRow: {
      year: '2026',
      months: [
        { m: 'Jan', val: '+1.6%', pos: true },
        { m: 'Feb', val: '+0.9%', pos: true },
        { m: 'Mar', val: '+2.8%', pos: true },
        { m: 'Apr', val: '-0.4%', pos: false },
        { m: 'May', val: '+3.5%', pos: true },
        { m: 'Jun', val: '+2.1%', pos: true },
      ],
      total: '+11.4%',
      totalPos: true,
      maxDd: '-4.92%',
    },
  },
  ONE_TIME: {
    badge: 'One-Time Allocation · Daily Candles',
    dateWindow: '2021-01-01 to 2026-11-06 (1,446 Trading Days)',
    ruleSummary:
      'ALLOCATION: Initial lump-sum divided equally across selected stocks at start date daily open',
    capitalLabel: 'Initial Capital',
    capitalVal: '₹5,00,000',
    netProfit: '+₹4,21,000',
    netProfitPct: '+84.20%',
    cagr: '+11.18%',
    portfolioEquity: '₹9,21,000',
    peakEquity: '₹9,48,600',
    peakEquityDate: '2026-09-28',
    maxDdPct: '-11.40%',
    maxDdAmt: '-₹78,900',
    maxDdDuration: '64 days',
    effAvgBuyPrice: 'Start Date Equal Split',
    tradingDaysCount: '1,446',
    sidebarDays: [
      { date: '2026-11-06', equity: '₹9,21,000' },
      { date: '2026-11-05', equity: '₹9,17,450' },
      { date: '2026-11-04', equity: '₹9,14,120' },
      { date: '2021-01-01', tag: 'BUY', equity: '₹5,00,000' },
    ],
    yearRow: {
      year: '2025',
      months: [
        { m: 'Jan', val: '+1.2%', pos: true },
        { m: 'Feb', val: '-1.9%', pos: false },
        { m: 'Mar', val: '+2.7%', pos: true },
        { m: 'Apr', val: '+3.1%', pos: true },
        { m: 'May', val: '+1.8%', pos: true },
        { m: 'Jun', val: '+2.4%', pos: true },
      ],
      total: '+16.8%',
      totalPos: true,
      maxDd: '-8.20%',
    },
  },
};

export function WorkspacePreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('ledger');
  const [backtestMode, setBacktestMode] = useState<BacktestModePreview>('STRATEGY');

  const activeBt = BACKTEST_MODE_DATA[backtestMode];

  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl border border-divider bg-surface shadow-2xl overflow-hidden text-left min-w-0">
      {/* Window Header & Module Tabs */}
      <div className="px-3 sm:px-5 py-2.5 border-b border-divider bg-background/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'bg-primary text-background font-semibold shadow-2xs'
                : 'text-secondary hover:text-primary hover:bg-surface-hover'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>01. Portfolio Ledger</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backtest')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'backtest'
                ? 'bg-primary text-background font-semibold shadow-2xs'
                : 'text-secondary hover:text-primary hover:bg-surface-hover'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>02. Backtest Engine</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('research')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'research'
                ? 'bg-primary text-background font-semibold shadow-2xs'
                : 'text-secondary hover:text-primary hover:bg-surface-hover'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>03. Stock Research</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-tertiary uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span>Illustrative Workspace View</span>
        </div>
      </div>

      {/* Tab 1: Portfolio Ledger matching PortfolioDashboard */}
      {activeTab === 'ledger' && (
        <div className="p-4 sm:p-6 space-y-4">
          {/* Regional Ticker Bar Preview */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-lg bg-background border border-divider text-[11px] font-mono min-w-0">
            <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar max-w-full min-w-0">
              <span className="text-tertiary uppercase font-semibold tracking-wider shrink-0">
                India ▾
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-secondary">NIFTY</span>
                <span className="text-primary font-semibold">24,188.65</span>
                <span className="text-success">+0.62%</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-secondary">SENSEX</span>
                <span className="text-primary font-semibold">79,541.79</span>
                <span className="text-success">+0.58%</span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 shrink-0">
                <span className="text-secondary">INDIA VIX</span>
                <span className="text-primary font-semibold">13.94</span>
                <span className="text-danger">-2.10%</span>
              </div>
            </div>
            <span className="text-[10px] text-tertiary hidden lg:inline">
              INR (₹) / USD ($) Switchable
            </span>
          </div>

          {/* KPI Summary Strip matching PortfolioDashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 rounded-xl bg-background border border-divider space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-secondary">Net Invested</div>
              <div className="font-mono text-sm font-bold text-primary tabular-nums">₹5,73,955</div>
            </div>
            <div className="p-3 rounded-xl bg-background border border-divider space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-secondary">Current Value</div>
              <div className="font-mono text-sm font-bold text-primary tabular-nums">₹6,13,400</div>
            </div>
            <div className="p-3 rounded-xl bg-background border border-divider space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-secondary">Total Net P&amp;L</div>
              <div className="font-mono text-sm font-bold text-success tabular-nums">+₹38,161 (+6.6%)</div>
            </div>
            <div className="p-3 rounded-xl bg-background border border-divider space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-secondary">Brokerage &amp; Govt Tax</div>
              <div className="font-mono text-sm font-bold text-danger tabular-nums">-₹1,284</div>
            </div>
            <div className="p-3 rounded-xl bg-background border border-divider space-y-1 col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase tracking-wider text-secondary">XIRR</div>
              <div className="font-mono text-sm font-bold text-success tabular-nums">+16.42%</div>
            </div>
          </div>

          {/* Holdings + Live Indicators & Strategy Table matching PortfolioDashboard */}
          <div className="border border-divider rounded-xl overflow-hidden bg-background">
            <div className="px-3.5 py-2 border-b border-divider bg-surface flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-primary">Core Equity Portfolio · FIFO Lots</span>
              <span className="text-tertiary font-mono hidden sm:inline">
                Rebalance · Corporate Actions · Export .xlsx
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-divider text-[10px] uppercase tracking-wider text-secondary bg-surface/50">
                    <th className="py-2 px-3.5 font-medium">Symbol</th>
                    <th className="py-2 px-3 font-medium text-right">Qty</th>
                    <th className="py-2 px-3 font-medium text-right">Avg Cost</th>
                    <th className="py-2 px-3 font-medium text-right">Market Price</th>
                    <th className="py-2 px-3 font-medium text-right">Unrealized P&amp;L</th>
                    <th className="py-2 px-3 font-medium text-right">RSI (14)</th>
                    <th className="py-2 px-3 font-medium text-right">200 DMA</th>
                    <th className="py-2 px-3.5 font-medium text-center">Strategy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider font-mono text-[11px]">
                  {SAMPLE_HOLDINGS.map((row) => (
                    <tr key={row.symbol} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="py-2.5 px-3.5 font-bold text-primary whitespace-nowrap">
                        {row.symbol}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-primary">{row.qty}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-secondary">₹{row.avg}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-primary font-semibold">
                        ₹{row.ltp}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-semibold whitespace-nowrap ${
                          row.positive ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {row.pnl} <span className="opacity-80">({row.pnlPct})</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <span
                            className={`font-semibold ${
                              row.rsiBadge?.tone === 'os' ? 'text-success' : 'text-primary'
                            }`}
                          >
                            {row.rsi}
                          </span>
                          {row.rsiBadge && (
                            <span
                              className={`text-[9px] font-sans px-1 py-0.5 rounded font-semibold ${
                                row.rsiBadge.tone === 'div'
                                  ? 'bg-emerald-500/15 text-emerald-500'
                                  : 'bg-success/15 text-success'
                              }`}
                            >
                              {row.rsiBadge.text}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums whitespace-nowrap ${
                          row.dma200Above ? 'text-success' : 'text-danger'
                        }`}
                      >
                        <div className="inline-flex items-center justify-end gap-1">
                          <span>₹{row.dma200}</span>
                          <span
                            className={`text-[9px] font-sans px-1 rounded font-semibold ${
                              row.dma200Above
                                ? 'bg-success/15 text-success'
                                : 'bg-danger/15 text-danger'
                            }`}
                          >
                            {row.dma200Diff}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-sans whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-[10px]">
                          {row.strategyActive ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="text-tertiary font-mono">—</span>
                          )}
                          <span className="text-divider">|</span>
                          {row.strategyAction === 'BUY' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 font-bold tracking-wider">
                              BUY
                            </span>
                          ) : row.strategyAction === 'Executed' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-divider text-secondary font-medium">
                              <Check className="w-2.5 h-2.5 text-emerald-500" />
                              Executed
                            </span>
                          ) : (
                            <span className="text-tertiary font-mono">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3.5 py-2 border-t border-divider bg-surface/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-secondary">
              <span>Home Dashboard charts Portfolio Value vs Net Invested across 1M, 3M, 6M, 1Y &amp; ALL</span>
              <span className="font-mono text-[10px] text-tertiary">Per-Portfolio &amp; Combined View</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Backtest Engine matching BacktestResultsPage */}
      {activeTab === 'backtest' && (
        <div className="p-4 sm:p-6 space-y-4">
          {/* Interactive Simulation Mode Selector inside Preview */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-divider">
            <div className="flex flex-wrap p-1 rounded-xl bg-background border border-divider gap-1 max-w-full">
              <button
                type="button"
                onClick={() => setBacktestMode('STRATEGY')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  backtestMode === 'STRATEGY'
                    ? 'bg-primary text-background'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Sliders className="w-3 h-3" />
                <span>Strategy Rules (60m)</span>
              </button>
              <button
                type="button"
                onClick={() => setBacktestMode('SIP')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  backtestMode === 'SIP'
                    ? 'bg-primary text-background'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Repeat className="w-3 h-3" />
                <span>Monthly SIP (60m)</span>
              </button>
              <button
                type="button"
                onClick={() => setBacktestMode('ONE_TIME')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  backtestMode === 'ONE_TIME'
                    ? 'bg-primary text-background'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Coins className="w-3 h-3" />
                <span>One-Time (Daily)</span>
              </button>
            </div>
            <span className="font-mono text-[11px] text-secondary">{activeBt.dateWindow}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            {/* Left Column: Config + Trading Days Sidebar Snippet */}
            <div className="p-4 rounded-xl bg-background border border-divider flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface border border-divider text-[10px] font-mono text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span>{activeBt.badge}</span>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-secondary mb-1">
                    Active Simulation Parameters
                  </div>
                  <p className="font-mono text-[11px] text-primary leading-relaxed bg-surface p-2.5 rounded-lg border border-divider">
                    {activeBt.ruleSummary}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-divider">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-secondary">
                  <span>Trading Days Sidebar</span>
                  <span>{activeBt.tradingDaysCount} Days</span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  {activeBt.sidebarDays.map((d, idx) => (
                    <div
                      key={d.date}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md border ${
                        idx === 0
                          ? 'bg-surface border-divider-hover text-primary font-semibold'
                          : 'bg-surface/40 border-divider text-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{d.date}</span>
                        {d.tag && (
                          <span
                            className={`text-[9px] px-1 rounded font-semibold ${
                              d.tag.includes('SELL')
                                ? 'bg-danger/15 text-danger'
                                : 'bg-success/15 text-success'
                            }`}
                          >
                            {d.tag}
                          </span>
                        )}
                      </div>
                      <span className="tabular-nums">{d.equity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 2 Columns: Exact BacktestResultsPage Cards + Year-wise Returns */}
            <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Capital & Returns Card */}
                <div className="p-4 rounded-xl bg-background border border-divider space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                    Capital &amp; Returns
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-secondary font-sans">Total Net Profit</span>
                      <span className="font-bold text-success tabular-nums">
                        {activeBt.netProfit} ({activeBt.netProfitPct})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary font-sans">Strategy CAGR</span>
                      <span className="font-bold text-success tabular-nums">{activeBt.cagr}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary font-sans">{activeBt.capitalLabel}</span>
                      <span className="text-primary tabular-nums">{activeBt.capitalVal}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary font-sans">Portfolio Equity</span>
                      <span className="text-primary font-semibold tabular-nums">
                        {activeBt.portfolioEquity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary font-sans">Peak Equity</span>
                      <span className="text-primary tabular-nums">
                        {activeBt.peakEquity}{' '}
                        <span className="text-[10px] text-tertiary">({activeBt.peakEquityDate})</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Drawdown Card */}
                <div className="p-4 rounded-xl bg-background border border-divider space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                    Drawdown
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-secondary font-sans">Max Drawdown</span>
                      <span className="font-bold text-danger tabular-nums">
                        {activeBt.maxDdPct} ({activeBt.maxDdAmt})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary font-sans">Max Drawdown Duration</span>
                      <span className="text-primary tabular-nums">{activeBt.maxDdDuration}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary font-sans">Effective Avg Buy Price</span>
                      <span className="text-primary tabular-nums">{activeBt.effAvgBuyPrice}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary font-sans">Trading Days</span>
                      <span className="text-primary tabular-nums">{activeBt.tradingDaysCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Year-wise Returns Table matching BacktestResultsPage */}
              <div className="p-4 rounded-xl bg-background border border-divider space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">Year-wise Returns</span>
                  <span className="text-[10px] font-mono text-tertiary">
                    Jan–Dec Monthly P&amp;L · Annual Total · Max Drawdown
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-divider text-[10px] text-secondary uppercase">
                        <th className="py-1.5 pr-2 font-medium">Year</th>
                        {activeBt.yearRow.months.map((m) => (
                          <th key={m.m} className="py-1.5 px-2 text-right font-medium">
                            {m.m}
                          </th>
                        ))}
                        <th className="py-1.5 px-2 text-right font-medium">Total</th>
                        <th className="py-1.5 pl-2 text-right font-medium">Max DD</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-2 pr-2 font-bold text-primary">{activeBt.yearRow.year}</td>
                        {activeBt.yearRow.months.map((m) => (
                          <td
                            key={m.m}
                            className={`py-2 px-2 text-right tabular-nums ${
                              m.pos ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {m.val}
                          </td>
                        ))}
                        <td
                          className={`py-2 px-2 text-right font-bold tabular-nums ${
                            activeBt.yearRow.totalPos ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {activeBt.yearRow.total}
                        </td>
                        <td className="py-2 pl-2 text-right font-semibold text-danger tabular-nums">
                          {activeBt.yearRow.maxDd}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="pt-2 border-t border-divider text-[11px] text-secondary">
                  Select any trading day in the sidebar to inspect candle OHLC, active indicators &amp; BUY/SELL logs.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Stock Research matching StockDetails */}
      {activeTab === 'research' && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-divider">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-primary">TCS.NS</span>
                <span className="text-xs text-secondary">Tata Consultancy Services Ltd. · NSE</span>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-background border border-divider rounded-lg p-1 font-mono text-[10px]">
              {['1D', '5D', '1M', '6M', '1Y', '5Y'].map((tf) => (
                <span
                  key={tf}
                  className={`px-2 py-0.5 rounded ${
                    tf === '1Y'
                      ? 'bg-primary text-background font-bold'
                      : 'text-secondary'
                  }`}
                >
                  {tf}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Valuation & Quarterly Financial Statements */}
            <div className="md:col-span-2 p-4 rounded-xl bg-background border border-divider space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-primary">
                  Valuation &amp; Quarterly Financials
                </span>
                <div className="inline-flex rounded-lg border border-divider overflow-hidden text-[10px] font-medium">
                  <span className="px-2.5 py-1 bg-primary text-background">Income Statement</span>
                  <span className="px-2.5 py-1 bg-surface text-secondary border-l border-divider">Balance Sheet</span>
                  <span className="px-2.5 py-1 bg-surface text-secondary border-l border-divider">Cash Flow</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-surface border border-divider">
                  <div className="text-[10px] text-secondary">Market Cap</div>
                  <div className="font-mono text-xs font-bold text-primary mt-0.5">₹14.90L Cr</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-divider">
                  <div className="text-[10px] text-secondary">P/E Ratio</div>
                  <div className="font-mono text-xs font-bold text-primary mt-0.5">30.42</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-divider">
                  <div className="text-[10px] text-secondary">Operating Cash Flow</div>
                  <div className="font-mono text-xs font-bold text-primary mt-0.5">₹48,920 Cr</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-divider">
                  <div className="text-[10px] text-secondary">Free Cash Flow</div>
                  <div className="font-mono text-xs font-bold text-primary mt-0.5">₹44,180 Cr</div>
                </div>
              </div>

              <div className="pt-2 border-t border-divider flex items-center justify-between text-[11px] text-secondary">
                <span>Includes Earnings &amp; Dividend Calendar + Historical EPS Surprise Chart</span>
                <TrendingUp className="w-3.5 h-3.5 text-success shrink-0" />
              </div>
            </div>

            {/* Ownership & Institutional Data matching StockDetails */}
            <div className="p-4 rounded-xl bg-background border border-divider space-y-3">
              <div className="text-xs font-semibold text-primary">
                Ownership &amp; Earnings Snapshot
              </div>
              <div className="space-y-2 text-[11px] font-mono">
                <div className="flex items-center justify-between py-1 border-b border-divider">
                  <span className="text-secondary font-sans">% Held by Insiders</span>
                  <span className="text-primary font-semibold">71.77%</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-divider">
                  <span className="text-secondary font-sans">% Held by Institutions</span>
                  <span className="text-primary font-semibold">17.85%</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-divider">
                  <span className="text-secondary font-sans">Top Institutional Holders</span>
                  <span className="text-primary font-semibold">Listed</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-secondary font-sans">About &amp; Latest News</span>
                  <span className="text-primary font-semibold">Included</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
