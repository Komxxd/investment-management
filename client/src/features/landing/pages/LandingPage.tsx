import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Activity,
  Scale,
  FileSpreadsheet,
  Sliders,
  Repeat,
  Coins,
  BarChart3,
  Globe,
  Split,
  LineChart,
  Sun,
  Moon,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { LandingNavbar } from '../components/LandingNavbar';
import { WorkspacePreview } from '../components/WorkspacePreview';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useTheme } from '../../../app/providers/ThemeProvider';

const PORTFOLIO_PILLARS = [
  {
    icon: Briefcase,
    title: 'Multi-Portfolio & Closed Trades Ledger',
    tag: 'ACCOUNTING',
    description:
      'Create separate portfolios, track combined cross-portfolio performance, and maintain a dedicated Sold Stocks ledger so realized and unrealized P&L stay distinct.',
    points: [
      'Annualized XIRR per stock & portfolio',
      'Brokerage & govt tax factored into net P&L',
      'Value vs Net Invested chart & closed-trades P&L',
    ],
  },
  {
    icon: Split,
    title: 'Corporate Actions & Cost Adjustments',
    tag: 'CORPORATE EVENTS',
    description:
      'Record Stock Splits, Bonus Issues, and Cash Dividends directly against your holdings with an audit timeline per symbol.',
    points: [
      'Automatic cost basis & share count adjustments',
      'Per-stock corporate action timeline viewer',
      'Clean audit trail when reviewing historical lots',
    ],
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel (.xlsx) Sync & Custom Workspace',
    tag: 'FLEXIBILITY',
    description:
      'Import existing positions or export full portfolio ledgers to Excel spreadsheets. Reorder summary cards and table columns via drag-and-drop.',
    points: [
      'One-click .xlsx export & bulk import',
      'Drag-and-drop KPI & table column ordering',
      'Built-in Recycle Bin for safe deletion recovery',
    ],
  },
  {
    icon: Scale,
    title: '1-Click Equal-Weight Rebalancer',
    tag: 'ALLOCATION',
    description:
      'When winners run ahead or positions drift, calculate the exact share sells and buys needed to bring holdings back to equal target value.',
    points: [
      'Prioritizes SELL trades before BUY allocations',
      'Computes net cash required or freed up',
      'Applies balanced trades cleanly across holdings',
    ],
  },
  {
    icon: Globe,
    title: 'INR / USD View & Regional Market Ticker',
    tag: 'GLOBAL CONTEXT',
    description:
      'Convert entire portfolio metrics between INR (₹) and USD ($) using live exchange rates while monitoring major global equity indices.',
    points: [
      'Instant currency toggle across all tables & cards',
      'Live regional ticker (India, USA, Europe, Asia)',
      'Customizable visible indices via settings',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Clear Numbers. Zero Fluff.',
    tag: 'RELIABILITY',
    description:
      'Built around strict transaction records and deterministic financial formulas rather than speculative predictions or opaque scores.',
    points: [
      'Actual brokerage & govt tax tracking per trade',
      'Transparent formula-driven indicators',
      'Account-isolated ledgers backed by database storage',
    ],
  },
];

const BACKTEST_ENGINES = [
  {
    icon: Sliders,
    index: 'ENGINE 01',
    title: 'Rule-Based Strategy Backtest',
    timeframe: '60-MIN CANDLES',
    description:
      'Design deterministic entry and exit strategies using technical indicators, crossover signals, divergence detection, and risk management guards.',
    specs: [
      'Multi-condition rules with AND / OR logical connectors',
      'Crossing Over / Crossing Under & Divergence operators',
      'Flexible sizing: Quantity, Value, Increase %, Decrease %',
      'Integrated Stop-Loss % & Take-Profit % triggers',
    ],
  },
  {
    icon: Repeat,
    index: 'ENGINE 02',
    title: 'Monthly Portfolio SIP Simulator',
    timeframe: '60-MIN CANDLES',
    description:
      'Test disciplined monthly capital deployment across any selected subset of constituent stocks inside your portfolio at real market hours.',
    specs: [
      'Configurable SIP amount, day of month (1–28), and time',
      'Equal capital distribution across selected stocks',
      'Automatic fallback to previous trading day on holidays',
      'Tracks Total Capital Invested, Equity & Peak Equity',
    ],
  },
  {
    icon: Coins,
    index: 'ENGINE 03',
    title: 'One-Time Allocation Simulator',
    timeframe: 'DAILY CANDLES',
    description:
      'Evaluate lump-sum portfolio deployment across multi-year daily historical candles to study long-term compounding and drawdown behavior.',
    specs: [
      'Distributes initial capital equally across chosen holdings',
      'Uses full daily candle history for long-horizon testing',
      'Day-by-day mark-to-market OHLC & equity inspection',
      'Calendar date window bound to verified candle data',
    ],
  },
];

const INDICATOR_GROUPS = [
  {
    category: 'Momentum',
    items: 'RSI (14) with customizable thresholds, Bullish & Bearish Divergence detection, MACD (12, 26, 9) Line, Signal & Histogram',
  },
  {
    category: 'Trend',
    items: '50-Day & 200-Day Simple Moving Averages (DMA) · 20, 50 & 200 Exponential Moving Averages (EMA)',
  },
  {
    category: 'Volatility',
    items: 'Bollinger Bands (20, 2) including Upper, Middle, Lower bands, Bandwidth %, and %B positioning',
  },
  {
    category: 'Institutional',
    items: 'VWAP (Volume Weighted Average Price) calculated across candle bars',
  },
  {
    category: 'Confirmation',
    items: 'OBV (On-Balance Volume), 20-Day OBV Signal, and 20-Day Average Volume',
  },
];

const RESEARCH_CAPABILITIES = [
  'Interactive price history charts across 1D, 5D, 1M, 6M, 1Y, and 5Y ranges',
  'Operating Cash Flow & Free Cash Flow summary metrics',
  'Quarterly Financial Statements (Income Statement, Balance Sheet, Cash Flow)',
  'Historical EPS Surprise chart & upcoming Earnings / Dividend Calendar',
  'Top Institutional Ownership breakdown & latest company news feed',
];

export function LandingPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const primaryCtaPath = session ? '/portfolios' : '/login';
  const primaryCtaLabel = session ? 'Open Your Workspace' : 'Sign In / Create Account';

  const scrollToFeatures = () => {
    const el = document.getElementById('features');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-background text-primary font-sans selection:bg-primary selection:text-background overflow-x-hidden">
      {/* Floating Pill Navbar */}
      <LandingNavbar />

      {/* Architectural Hairline Hero Section */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        {/* Subtle institutional hairline grid (monochrome, zero gradients) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--border-divider) 1px, transparent 1px), linear-gradient(to bottom, var(--border-divider) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 75% 65% at 50% 25%, black 40%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 75% 65% at 50% 25%, black 40%, transparent 100%)',
          }}
        />

        <div className="relative max-w-6xl mx-auto min-w-0 space-y-10 sm:space-y-14">
          {/* Hero Copy */}
          <div className="max-w-4xl mx-auto text-center space-y-5 sm:space-y-6 min-w-0">
            <h1 className="text-[1.75rem] sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-primary leading-[1.14]">
              Disciplined portfolio tracking.
              <br className="hidden sm:block" /> Evidence-backed backtesting.
            </h1>

            <p className="text-sm sm:text-base text-secondary max-w-2xl mx-auto leading-relaxed">
              Prism brings portfolio research, corporate actions, tax and brokerage accounting, live
              technical indicators, and historical SIP, One-Time, or rule-based strategy modeling into
              one structured view.
            </p>

            {/* Primary & Secondary Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigate(primaryCtaPath)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-background hover:opacity-90 font-semibold text-xs sm:text-sm transition-opacity cursor-pointer shadow-xs"
              >
                <span>{primaryCtaLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={scrollToFeatures}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-surface border border-divider hover:bg-surface-hover text-primary font-medium text-xs sm:text-sm transition-colors cursor-pointer"
              >
                <span>Explore Platform Overview</span>
              </button>
            </div>
          </div>

          {/* Interactive Real-Schema Preview */}
          <WorkspacePreview />
        </div>
      </section>

      {/* Section 01: Portfolio Accounting Features */}
      <section id="features" className="scroll-mt-24 py-16 sm:py-24 px-4 sm:px-6 border-t border-divider">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="max-w-2xl space-y-2.5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-secondary">
              01 / Portfolio Ledger &amp; Accounting
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
              Complete visibility across every position, exit, and corporate event.
            </h2>
            <p className="text-sm text-secondary leading-relaxed">
              Designed for investors who care about exact cost basis, brokerage charges, XIRR, and clean
              position reconciliation rather than surface-level charts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {PORTFOLIO_PILLARS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="p-5 sm:p-6 rounded-2xl bg-surface border border-divider hover:border-divider-hover transition-colors flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-9 h-9 rounded-xl bg-background border border-divider flex items-center justify-center text-primary">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-secondary px-2 py-0.5 rounded bg-background border border-divider">
                        {item.tag}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-primary">{item.title}</h3>
                    <p className="text-xs sm:text-[13px] text-secondary leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <ul className="space-y-2 pt-3 border-t border-divider">
                    {item.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-xs text-secondary">
                        <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 02: Three-Engine Backtesting Architecture */}
      <section
        id="backtesting"
        className="scroll-mt-24 py-16 sm:py-24 px-4 sm:px-6 border-t border-divider bg-surface/40"
      >
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2.5">
              <div className="font-mono text-[11px] uppercase tracking-widest text-secondary">
                02 / Historical Backtesting Engine
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
                Three distinct simulators matched to real market candles.
              </h2>
              <p className="text-sm text-secondary leading-relaxed">
                Every simulation constrains your calendar selector strictly to verified historical candle
                availability—excluding warmup buffers where technical indicators require baseline history.
              </p>
            </div>
            <div className="font-mono text-[11px] px-3 py-1.5 rounded-lg bg-surface border border-divider text-secondary shrink-0">
              Audit Output: Year-wise Returns · Drawdown · Candle Logs
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 border border-divider rounded-2xl overflow-hidden bg-surface divide-y lg:divide-y-0 lg:divide-x divide-divider">
            {BACKTEST_ENGINES.map((engine) => {
              const Icon = engine.icon;
              return (
                <div key={engine.title} className="p-6 sm:p-7 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 text-xs font-mono text-secondary">
                        <Icon className="w-4 h-4 text-primary" />
                        <span>{engine.index}</span>
                      </div>
                      <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-background border border-divider text-primary">
                        {engine.timeframe}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-primary">{engine.title}</h3>
                      <p className="text-xs sm:text-[13px] text-secondary leading-relaxed">
                        {engine.description}
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2.5 pt-4 border-t border-divider">
                    {engine.specs.map((spec) => (
                      <li key={spec} className="flex items-start gap-2 text-xs text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0 mt-1.5" />
                        <span className="text-secondary">{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Backtest Output Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Capital & Returns',
                desc: 'Total Net Profit, Strategy CAGR, Invested Capital, Equity & Peak Equity',
              },
              {
                label: 'Year-wise Returns Table',
                desc: 'Monthly Jan–Dec P&L breakdown, annual Total & yearly Max Drawdown',
              },
              {
                label: 'Drawdown & Cost Basis',
                desc: 'Max Drawdown (% & currency), duration in days & Effective Avg Buy Price',
              },
              {
                label: 'Day & Candle Inspection',
                desc: 'Trading days sidebar to inspect candle OHLC, indicators & BUY/SELL logs',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-4 rounded-xl bg-surface border border-divider space-y-1"
              >
                <div className="text-xs font-semibold text-primary">{stat.label}</div>
                <div className="text-[11px] text-secondary leading-relaxed">{stat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 03: Indicators & Fundamental Research */}
      <section id="research" className="scroll-mt-24 py-16 sm:py-24 px-4 sm:px-6 border-t border-divider">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          {/* Technical Indicators Panel */}
          <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-divider flex flex-col justify-between space-y-6">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-secondary">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>03 / Technical Signal Matrix</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
                Synced directly to holdings and usable inside backtest rules.
              </h2>
              <p className="text-xs sm:text-[13px] text-secondary leading-relaxed">
                Monitor live conditions on active holdings, trigger BUY / SELL strategy actions inside
                the table, and test the exact same mathematical definitions across historical bars.
              </p>
            </div>

            <div className="divide-y divide-divider border-t border-b border-divider">
              {INDICATOR_GROUPS.map((group) => (
                <div key={group.category} className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 items-baseline">
                  <div className="font-mono text-xs font-semibold text-primary">
                    {group.category}
                  </div>
                  <div className="sm:col-span-2 text-xs text-secondary leading-relaxed">
                    {group.items}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Single-Stock Fundamental Research Panel */}
          <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-divider flex flex-col justify-between space-y-6">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-secondary">
                <LineChart className="w-3.5 h-3.5 text-primary" />
                <span>04 / Fundamental Research View</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
                Financial statements, cash flows, and institutional ownership per ticker.
              </h2>
              <p className="text-xs sm:text-[13px] text-secondary leading-relaxed">
                Search any global or Indian equity directly from the workspace bar to inspect historical
                price action alongside company fundamentals before adding a lot.
              </p>
            </div>

            <div className="space-y-3 border-t border-divider pt-5">
              {RESEARCH_CAPABILITIES.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background border border-divider text-xs text-secondary"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 04: Simple Trustworthy Closing CTA */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 border-t border-divider">
        <div className="max-w-4xl mx-auto p-7 sm:p-12 rounded-2xl bg-surface border border-divider text-center space-y-5">
          <div className="font-mono text-[11px] uppercase tracking-widest text-secondary">
            Get Started
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
            Bring structure to your portfolios and backtesting.
          </h2>
          <p className="text-xs sm:text-sm text-secondary max-w-xl mx-auto leading-relaxed">
            Create an account or sign in to organize your portfolios, import positions from Excel,
            monitor technical indicators, and simulate SIP, One-Time, or rule-based strategies.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate(primaryCtaPath)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-background hover:opacity-90 font-semibold text-xs sm:text-sm transition-opacity cursor-pointer"
            >
              <span>{primaryCtaLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Minimal Institutional Footer */}
      <footer className="border-t border-divider bg-surface/40 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="Prism Logo" className="w-6 h-6 rounded-full" />
            <div>
              <div className="text-xs font-semibold text-primary">Prism</div>
              <div className="text-[11px] text-secondary">
                Portfolio Research, Indicators &amp; Strategy Modeling
              </div>
            </div>
          </div>

          <p className="text-[11px] text-secondary max-w-md leading-relaxed">
            Research &amp; analytical tool only. Portfolio tracking relies on recorded transactions;
            historical backtests simulate archived candle data and do not execute live brokerage orders or
            guarantee future returns.
          </p>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-divider hover:bg-surface-hover text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(primaryCtaPath)}
              className="text-xs font-medium text-primary hover:underline underline-offset-4 cursor-pointer"
            >
              {session ? 'Workspace' : 'Sign In'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
