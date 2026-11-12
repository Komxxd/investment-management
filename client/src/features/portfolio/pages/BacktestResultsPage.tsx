import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layers, ArrowLeft, Activity, Sliders } from 'lucide-react';
import type { StrategyRule } from '../utils/strategyConfig';
import { normalizeRule } from '../utils/strategyConfig';
import type { BacktestResponse, InitialInvestmentInfo } from '../services/backtestService';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { useTheme } from '../../../app/providers/ThemeProvider';
import {
  type BacktestSessionState,
  extractUsedIndicators,
  buildTimelineRows,
  buildTradingDays,
  groupTradingDaysByMonth,
  buildYearReturnsMatrix,
  computeDisplayCagr,
  computePeakEquityInfo,
  computeMaxDrawdownRangeInfo,
  computeDisplayMaxDrawdownValue,
  computePortfolioSimulationMetrics,
  buildDayCandles,
} from '../components/backtest/backtestResultsUtils';
import { BacktestTradingDaysSidebar } from '../components/backtest/BacktestTradingDaysSidebar';
import { BacktestAnalyticsOverview } from '../components/backtest/BacktestAnalyticsOverview';
import { BacktestDayCandlesView } from '../components/backtest/BacktestDayCandlesView';
import { BacktestConfigModal } from '../components/backtest/BacktestConfigModal';

export function BacktestResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { portfolioId: urlPortfolioId } = useParams();
  const { currencySymbol = '₹' } = useCurrency();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const session = useMemo<BacktestSessionState | null>(() => {
    const routerState = location.state as BacktestSessionState | null;
    if (routerState && routerState.result) {
      return routerState;
    }
    try {
      const saved = localStorage.getItem('latest_backtest_session');
      if (saved) return JSON.parse(saved) as BacktestSessionState;
    } catch {
      // Ignore storage read failures
    }
    return null;
  }, [location.state]);

  const result: BacktestResponse | null = session?.result || null;
  const rule: StrategyRule | null = session?.rule || null;
  const portfolioId = session?.portfolioId || urlPortfolioId;
  const portfolioConfig = session?.portfolioConfig || null;

  const activeConfigRule = useMemo(() => (rule ? normalizeRule(rule) : null), [rule]);
  const entryConditionsList = useMemo(
    () => activeConfigRule?.entryConditions || [],
    [activeConfigRule]
  );
  const exitConditionsList = useMemo(
    () => activeConfigRule?.exitConditions || [],
    [activeConfigRule]
  );

  const [selectedTab, setSelectedTab] = useState<string>('overview');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const availablePortfolioStocks = useMemo<string[]>(() => {
    if (result?.stocksData && Object.keys(result.stocksData).length > 0) {
      return Object.keys(result.stocksData);
    }
    if (portfolioConfig?.constituents && Array.isArray(portfolioConfig.constituents)) {
      return portfolioConfig.constituents.map(c => (typeof c === 'string' ? c : c.symbol));
    }
    return [];
  }, [result, portfolioConfig]);

  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string>('');
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);
  const stockDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (availablePortfolioStocks.length > 0) {
        if (!selectedStockSymbol || !availablePortfolioStocks.includes(selectedStockSymbol)) {
          setSelectedStockSymbol(availablePortfolioStocks[0]);
        }
      } else {
        setSelectedStockSymbol('');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [availablePortfolioStocks, selectedStockSymbol]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stockDropdownRef.current && !stockDropdownRef.current.contains(event.target as Node)) {
        setIsStockDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const usedIndicators = useMemo(
    () => extractUsedIndicators(rule, session?.rules),
    [rule, session?.rules]
  );

  const initialInvestment = useMemo<InitialInvestmentInfo | null>(() => {
    if (!result?.initialInvestment) return null;
    const firstPoint = result.equityCurve?.[0];
    return {
      ...result.initialInvestment,
      action: result.initialInvestment.action || 'Initial Entry',
      changePercent: result.initialInvestment.changePercent ?? firstPoint?.changePercent,
      indicators: result.initialInvestment.indicators ?? firstPoint?.indicators,
    };
  }, [result]);

  const timelineRows = useMemo(
    () => buildTimelineRows(result, initialInvestment),
    [result, initialInvestment]
  );

  const tradingDays = useMemo(
    () => buildTradingDays(result, timelineRows, initialInvestment),
    [result, timelineRows, initialInvestment]
  );

  const reversedDays = useMemo(() => [...tradingDays].reverse(), [tradingDays]);
  const groupedDays = useMemo(() => groupTradingDaysByMonth(reversedDays), [reversedDays]);
  const yearReturns = useMemo(
    () => buildYearReturnsMatrix(tradingDays, result),
    [tradingDays, result]
  );
  const displayCagr = useMemo(() => computeDisplayCagr(result), [result]);
  const peakEquityInfo = useMemo(() => computePeakEquityInfo(result), [result]);
  const maxDrawdownRangeInfo = useMemo(() => computeMaxDrawdownRangeInfo(result), [result]);
  const displayMaxDrawdownValue = useMemo(
    () => computeDisplayMaxDrawdownValue(result, yearReturns, peakEquityInfo.value),
    [result, yearReturns, peakEquityInfo.value]
  );
  const portfolioMetrics = useMemo(
    () => computePortfolioSimulationMetrics(result, displayCagr, tradingDays.length),
    [result, displayCagr, tradingDays.length]
  );

  const activeDay = useMemo(() => {
    if (selectedTab === 'overview') return null;
    return tradingDays.find(d => d.dateStr === selectedTab) || null;
  }, [selectedTab, tradingDays]);

  const dayCandles = useMemo(
    () => buildDayCandles(selectedTab, timelineRows, selectedStockSymbol, result?.stocksData),
    [selectedTab, timelineRows, selectedStockSymbol, result?.stocksData]
  );

  if (!result || !rule) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-[70vh]">
        <div className="p-4 rounded-2xl bg-surface border border-divider text-secondary">
          <Layers className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-primary">No Backtest Results Loaded</h2>
          <p className="text-xs text-secondary max-w-sm">
            Launch a backtest from any strategy card to generate comprehensive institutional simulation metrics.
          </p>
        </div>
        <button
          onClick={() => navigate(portfolioId ? `/portfolio/${portfolioId}/backtest` : '/backtest')}
          className="px-4 py-2 rounded-xl bg-primary text-background text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Backtest</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-full min-h-0 text-primary overflow-hidden">
      <div
        className={`w-full border-b px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-3 shrink-0 transition-colors shadow-xs ${
          isDark ? 'bg-[#141518] border-zinc-800' : 'bg-gray-100 border-gray-200'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div
            className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 shadow-2xs ${
              isDark
                ? 'bg-zinc-800/80 border-zinc-700/60 text-zinc-200'
                : 'bg-white border-gray-200 text-gray-700'
            }`}
          >
            <Activity className="w-3 h-3" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1
                className={`text-[11px] sm:text-xs font-bold tracking-wider uppercase truncate ${
                  isDark ? 'text-zinc-100' : 'text-gray-900'
                }`}
              >
                {rule.name || 'TEST STRATEGY'}
              </h1>
              {result.symbol && (
                <span
                  className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 shadow-2xs ${
                    isDark
                      ? 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {result.symbol}
                </span>
              )}
            </div>
            <p
              className={`text-[9px] sm:text-[10px] leading-tight mt-0.5 truncate ${
                isDark ? 'text-zinc-400' : 'text-gray-500'
              }`}
            >
              Historical Simulation Report{' '}
              <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>
                ({(result.summary.startDate || '').split(' ')[0].split('T')[0]} to{' '}
                {(result.summary.endDate || '').split(' ')[0].split('T')[0]})
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border rounded-md transition-colors cursor-pointer shadow-2xs ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
            }`}
          >
            <Sliders className={`w-3 h-3 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
            <span>View Config</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <BacktestTradingDaysSidebar
          isDark={isDark}
          selectedTab={selectedTab}
          onSelectTab={setSelectedTab}
          groupedDays={groupedDays}
          tradingDaysCount={tradingDays.length}
          currencySymbol={currencySymbol}
        />

        <main className="flex-1 min-h-0 overflow-y-auto pb-16">
          {selectedTab === 'overview' ? (
            <BacktestAnalyticsOverview
              isDark={isDark}
              result={result}
              yearReturns={yearReturns}
              displayCagr={displayCagr}
              hasMode={Boolean(session?.mode)}
              peakEquityInfo={peakEquityInfo}
              maxDrawdownRangeInfo={maxDrawdownRangeInfo}
              displayMaxDrawdownValue={displayMaxDrawdownValue}
              portfolioMetrics={portfolioMetrics}
              tradingDaysCount={tradingDays.length}
              currencySymbol={currencySymbol}
            />
          ) : (
            <BacktestDayCandlesView
              isDark={isDark}
              selectedTab={selectedTab}
              activeDay={activeDay}
              resultSymbol={result.symbol}
              availablePortfolioStocks={availablePortfolioStocks}
              selectedStockSymbol={selectedStockSymbol}
              onSelectStockSymbol={setSelectedStockSymbol}
              isStockDropdownOpen={isStockDropdownOpen}
              setIsStockDropdownOpen={setIsStockDropdownOpen}
              stockDropdownRef={stockDropdownRef}
              dayCandles={dayCandles}
              usedIndicators={usedIndicators}
              currencySymbol={currencySymbol}
            />
          )}
        </main>
      </div>

      <BacktestConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        portfolioConfig={portfolioConfig}
        rule={rule}
        activeConfigRule={activeConfigRule}
        entryConditionsList={entryConditionsList}
        exitConditionsList={exitConditionsList}
        resultSymbol={result.symbol}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
