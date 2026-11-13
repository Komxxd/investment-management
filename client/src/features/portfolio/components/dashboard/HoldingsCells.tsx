import React from 'react';
import { Check, History, Loader2 } from 'lucide-react';
import type { IndicatorConfig } from '../AddIndicatorsModal';
import type { DailyExecutionEntry } from './dashboardConfig';
import type { IndicatorsMap, SymbolGroup } from './dashboardTypes';
import type { StockStrategyStatus } from '../../utils/strategyEvaluator';
import type { ExecuteStrategySignalHandler } from '../../utils/portfolioSorting';

const fmt = (n: unknown) =>
  typeof n === 'number' && !isNaN(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

const fmtCompactVolume = (num: number) => {
  const abs = Math.abs(num);
  if (abs >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
};

export interface PortfolioTotalsSummary {
  totalInvestment: number;
  totalCurrentValue: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  portfolioRealizedCostBasis: number;
  portfolioTotalDividend: number;
  portfolioTotalBrokerage: number;
  portfolioTotalGovtTax: number;
  maxNetInvested: number;
  portfolioXIRR: number;
  portfolioTotalDayGain: number;
  portfolioDayGainPct: number;
}

export function renderTotalRowCell(
  colId: string,
  totals: PortfolioTotalsSummary,
  currencySymbol: string
): React.ReactNode {
  const {
    totalInvestment,
    totalCurrentValue,
    totalUnrealizedPnL,
    totalRealizedPnL,
    portfolioRealizedCostBasis,
    portfolioTotalDividend,
    portfolioTotalBrokerage,
    portfolioTotalGovtTax,
    maxNetInvested,
    portfolioXIRR,
    portfolioTotalDayGain,
    portfolioDayGainPct,
  } = totals;

  const unrealizedPct = totalInvestment > 0 ? (totalUnrealizedPnL / totalInvestment) * 100 : 0;
  const totalNetPnL = totalUnrealizedPnL + totalRealizedPnL + portfolioTotalDividend - portfolioTotalBrokerage - portfolioTotalGovtTax;
  const portfolioRealizedPct = portfolioRealizedCostBasis > 0 ? (totalRealizedPnL / portfolioRealizedCostBasis) * 100 : 0;
  const totalNetPct = maxNetInvested > 0 ? (totalNetPnL / maxNetInvested) * 100 : 0;

  switch (colId) {
    case 'netCostBasis':
      return <td key="netCostBasis" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono text-primary">{currencySymbol}{fmt(totalInvestment)}</td>;
    case 'currentValue':
      return <td key="currentValue" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono text-primary">{currencySymbol}{fmt(totalCurrentValue)}</td>;
    case 'unrealizedPnL':
      return (
        <td key="unrealizedPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono">
          <span className={totalUnrealizedPnL >= 0 ? 'text-success' : 'text-danger'}>
            {totalUnrealizedPnL >= 0 ? '+' : ''}{currencySymbol}{fmt(totalUnrealizedPnL)}
          </span>
        </td>
      );
    case 'unrealizedPnLPct':
      return (
        <td key="unrealizedPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono">
          <span className={unrealizedPct >= 0 ? 'text-success' : 'text-danger'}>
            {unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%
          </span>
        </td>
      );
    case 'realizedPnL':
      return (
        <td key="realizedPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono">
          <span className={totalRealizedPnL >= 0 ? 'text-success' : 'text-danger'}>
            {totalRealizedPnL >= 0 ? '+' : ''}{currencySymbol}{fmt(totalRealizedPnL)}
          </span>
        </td>
      );
    case 'realizedPnLPct':
      return (
        <td key="realizedPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono">
          {portfolioRealizedCostBasis > 0 ? (
            <span className={portfolioRealizedPct >= 0 ? 'text-success' : 'text-danger'}>
              {portfolioRealizedPct >= 0 ? '+' : ''}{portfolioRealizedPct.toFixed(2)}%
            </span>
          ) : (
            <span className="text-tertiary">—</span>
          )}
        </td>
      );
    case 'totalDividend':
      return (
        <td key="totalDividend" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono text-success">
          {currencySymbol}{fmt(portfolioTotalDividend)}
        </td>
      );
    case 'brokerage':
      return <td key="brokerage" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono text-primary">{currencySymbol}{fmt(portfolioTotalBrokerage)}</td>;
    case 'govtTax':
      return <td key="govtTax" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono text-primary">{currencySymbol}{fmt(portfolioTotalGovtTax)}</td>;
    case 'totalPnL':
      return (
        <td key="totalPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono">
          <span className={totalNetPnL >= 0 ? 'text-success' : 'text-danger'}>
            {totalNetPnL >= 0 ? '+' : ''}{currencySymbol}{fmt(totalNetPnL)}
          </span>
        </td>
      );
    case 'totalPnLPct':
      return (
        <td key="totalPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono">
          <span className={totalNetPct >= 0 ? 'text-success' : 'text-danger'}>
            {totalNetPct >= 0 ? '+' : ''}{totalNetPct.toFixed(2)}%
          </span>
        </td>
      );
    case 'xirr':
      return (
        <td key="xirr" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono">
          <span className={portfolioXIRR >= 0 ? 'text-success' : 'text-danger'}>
            {portfolioXIRR >= 0 ? '+' : ''}{(portfolioXIRR * 100).toFixed(2)}%
          </span>
        </td>
      );
    case 'dayGain':
      return (
        <td key="dayGain" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono">
          <span className={portfolioTotalDayGain >= 0 ? 'text-success' : 'text-danger'}>
            {portfolioTotalDayGain >= 0 ? '+' : ''}{currencySymbol}{fmt(portfolioTotalDayGain)}
          </span>
        </td>
      );
    case 'dayGainPct':
      return (
        <td key="dayGainPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono">
          <span className={portfolioDayGainPct >= 0 ? 'text-success' : 'text-danger'}>
            {portfolioDayGainPct >= 0 ? '+' : ''}{portfolioDayGainPct.toFixed(2)}%
          </span>
        </td>
      );
    default:
      return <td key={colId} className="px-2 py-1.5 text-[9px] sm:text-[10px] text-center font-mono text-tertiary">—</td>;
  }
}

interface HoldingCellContext {
  totalInvestment: number;
  totalCurrentValue: number;
  currencySymbol: string;
  fmtCurrency: (amount: number, currency?: string) => string;
  formatCurrencyCompact: (amount: number, currency?: string) => string;
  indicators: IndicatorsMap;
  indicatorsLoading: boolean;
  indicatorConfig: IndicatorConfig;
  todayExecutions: Record<string, DailyExecutionEntry>;
  executingSignalSymbol: string | null;
  getStockStrategyEvaluation: (symbol: string) => StockStrategyStatus;
  onExecuteStrategySignal: ExecuteStrategySignalHandler;
  onOpenStrategyLogs: (symbol: string) => void;
}

function renderMovingAverageCell(
  colId: string,
  label: string,
  value: number | null | undefined,
  group: SymbolGroup,
  indicatorsLoading: boolean,
  fmtCurrency: (amount: number, currency?: string) => string
) {
  const liveP = group.livePrice || 0;
  const color = value == null ? 'text-tertiary' : liveP >= value ? 'text-success' : 'text-danger';
  const diffPct = value && liveP ? ((liveP - value) / value) * 100 : 0;
  const tooltip =
    value && liveP
      ? `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}% ${liveP >= value ? 'above' : 'below'} ${label} (Live: ${fmtCurrency(liveP, group.liveData?.currency)})`
      : undefined;

  return (
    <td key={colId} className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center font-medium truncate ${color}`} title={tooltip}>
      {indicatorsLoading && value == null ? (
        <span className="text-tertiary animate-pulse">…</span>
      ) : value != null ? (
        <div className="flex items-center justify-center gap-1.5">
          <span>{fmtCurrency(value, group.liveData?.currency)}</span>
          {liveP > 0 && (
            <span className={`text-[8px] font-sans px-1 rounded font-semibold shrink-0 ${liveP >= value ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
              {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
            </span>
          )}
        </div>
      ) : (
        '—'
      )}
    </td>
  );
}

export function renderHoldingBodyCell(
  colId: string,
  group: SymbolGroup,
  ctx: HoldingCellContext
): React.ReactNode {
  const {
    totalInvestment,
    totalCurrentValue,
    currencySymbol,
    fmtCurrency,
    formatCurrencyCompact,
    indicators,
    indicatorsLoading,
    indicatorConfig,
    todayExecutions,
    executingSignalSymbol,
    getStockStrategyEvaluation,
    onExecuteStrategySignal,
    onOpenStrategyLogs,
  } = ctx;

  const symIndicators = indicators[group.symbol];

  switch (colId) {
    case 'netQty':
      return <td key="netQty" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center font-semibold text-primary truncate">{group.netQty.toLocaleString()}</td>;
    case 'avgBuyPrice':
      return <td key="avgBuyPrice" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-secondary truncate">{fmtCurrency(group.avgBuyPrice, group.liveData?.currency)}</td>;
    case 'netCostBasis':
      return <td key="netCostBasis" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-secondary truncate" title="Avg buy price × remaining shares — money still at work">{fmtCurrency(group.netCostBasis, group.liveData?.currency)}</td>;
    case 'portfolioWeight': {
      const weight = totalInvestment > 0 ? (group.netCostBasis / totalInvestment) * 100 : 0;
      return <td key="portfolioWeight" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-secondary truncate">{weight.toFixed(2)}%</td>;
    }
    case 'currentValueWeight': {
      const cvWeight = totalCurrentValue > 0 ? (group.currentValue / totalCurrentValue) * 100 : 0;
      return <td key="currentValueWeight" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-secondary truncate">{cvWeight.toFixed(2)}%</td>;
    }
    case 'livePrice':
      return <td key="livePrice" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center font-medium text-primary truncate">{fmtCurrency(group.livePrice, group.liveData?.currency)}</td>;
    case 'currentValue':
      return <td key="currentValue" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center font-medium text-primary truncate">{fmtCurrency(group.currentValue, group.liveData?.currency)}</td>;
    case 'unrealizedPnL':
      return (
        <td key="unrealizedPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center truncate">
          <span className={`font-medium ${group.unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
            {group.unrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(group.unrealizedPnL, group.liveData?.currency)}
          </span>
        </td>
      );
    case 'unrealizedPnLPct':
      return (
        <td key="unrealizedPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center truncate">
          <span className={`font-medium ${group.unrealizedPnLPct >= 0 ? 'text-success' : 'text-danger'}`}>
            {group.unrealizedPnLPct >= 0 ? '+' : ''}{group.unrealizedPnLPct.toFixed(2)}%
          </span>
        </td>
      );
    case 'realizedPnL':
      return (
        <td key="realizedPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center truncate">
          {group.totalSoldQty > 0 ? (
            <span className={`font-medium ${group.realizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
              {group.realizedPnL >= 0 ? '+' : ''}{fmtCurrency(group.realizedPnL, group.liveData?.currency)}
            </span>
          ) : (
            <span className="text-tertiary">—</span>
          )}
        </td>
      );
    case 'realizedPnLPct':
      return (
        <td key="realizedPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center truncate">
          {group.totalSoldQty > 0 ? (
            <span className={`font-medium ${group.realizedPnLPct >= 0 ? 'text-success' : 'text-danger'}`}>
              {group.realizedPnLPct >= 0 ? '+' : ''}{group.realizedPnLPct.toFixed(2)}%
            </span>
          ) : (
            <span className="text-tertiary">—</span>
          )}
        </td>
      );
    case 'totalDividend':
      return (
        <td key="totalDividend" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center truncate">
          {group.totalDividend > 0 ? (
            <span className="font-medium text-success">{fmtCurrency(group.totalDividend, group.liveData?.currency)}</span>
          ) : (
            <span className="text-tertiary">—</span>
          )}
        </td>
      );
    case 'brokerage':
      return <td key="brokerage" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-secondary truncate">{fmtCurrency(group.brokerage, group.liveData?.currency)}</td>;
    case 'govtTax':
      return <td key="govtTax" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-secondary truncate">{fmtCurrency(group.govtTax, group.liveData?.currency)}</td>;
    case 'totalPnL':
      return (
        <td key="totalPnL" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center truncate">
          <span className={`font-medium ${group.totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
            {group.totalPnL >= 0 ? '+' : ''}{fmtCurrency(group.totalPnL, group.liveData?.currency)}
          </span>
        </td>
      );
    case 'totalPnLPct':
      return (
        <td key="totalPnLPct" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center truncate">
          <span className={`font-medium ${group.totalPnLPct >= 0 ? 'text-success' : 'text-danger'}`}>
            {group.totalPnLPct >= 0 ? '+' : ''}{group.totalPnLPct.toFixed(2)}%
          </span>
        </td>
      );
    case 'xirr':
      return (
        <td key="xirr" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-bold text-center ${group.xirr >= 0 ? 'text-success' : 'text-danger'} truncate`}>
          {group.xirr >= 0 ? '+' : ''}{(group.xirr * 100).toFixed(2)}%
        </td>
      );
    case 'priceChange': {
      const priceChange = group.liveData?.change || 0;
      return (
        <td key="priceChange" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-medium text-center ${priceChange >= 0 ? 'text-success' : 'text-danger'} truncate`}>
          {priceChange >= 0 ? '+' : ''}{fmtCurrency(priceChange, group.liveData?.currency)}
        </td>
      );
    }
    case 'changePercent': {
      const changePercent = group.liveData?.changePercent || 0;
      return (
        <td key="changePercent" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-medium text-center ${changePercent >= 0 ? 'text-success' : 'text-danger'} truncate`}>
          {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
        </td>
      );
    }
    case 'dayHigh':
      return <td key="dayHigh" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-primary truncate">{group.liveData?.dayHigh ? `${currencySymbol}${fmt(group.liveData.dayHigh)}` : '—'}</td>;
    case 'dayLow':
      return <td key="dayLow" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-primary truncate">{group.liveData?.dayLow ? `${currencySymbol}${fmt(group.liveData.dayLow)}` : '—'}</td>;
    case '52wkHigh':
      return <td key="52wkHigh" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-primary truncate">{group.liveData?.fiftyTwoWeekHigh ? `${currencySymbol}${fmt(group.liveData.fiftyTwoWeekHigh)}` : '—'}</td>;
    case '52wkLow':
      return <td key="52wkLow" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-primary truncate">{group.liveData?.fiftyTwoWeekLow ? `${currencySymbol}${fmt(group.liveData.fiftyTwoWeekLow)}` : '—'}</td>;
    case 'marketCap':
      return (
        <td key="marketCap" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-primary truncate">
          {group.liveData?.marketCap ? formatCurrencyCompact(group.liveData.marketCap, group.liveData?.currency) : '—'}
        </td>
      );
    case 'volume':
      return <td key="volume" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-primary truncate">{group.liveData?.volume ? group.liveData.volume.toLocaleString() : '—'}</td>;
    case 'avgVolume':
      return <td key="avgVolume" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-primary truncate">{group.liveData?.avgVolume ? group.liveData.avgVolume.toLocaleString() : '—'}</td>;
    case 'tradeValue': {
      const tradeVal = (group.liveData?.volume || 0) * (group.liveData?.price || 0);
      return (
        <td key="tradeValue" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center text-primary truncate">
          {tradeVal > 0 ? formatCurrencyCompact(tradeVal, group.liveData?.currency) : '—'}
        </td>
      );
    }
    case 'dayGain': {
      const dayGain = group.netQty * (group.liveData?.change || 0);
      return (
        <td key="dayGain" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-medium text-center ${dayGain >= 0 ? 'text-success' : 'text-danger'} truncate`}>
          {dayGain >= 0 ? '+' : ''}{fmtCurrency(dayGain, group.liveData?.currency)}
        </td>
      );
    }
    case 'dayGainPct': {
      const dayGainPct = group.liveData?.changePercent || 0;
      return (
        <td key="dayGainPct" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-medium text-center ${dayGainPct >= 0 ? 'text-success' : 'text-danger'} truncate`}>
          {dayGainPct >= 0 ? '+' : ''}{dayGainPct.toFixed(2)}%
        </td>
      );
    }
    case 'rsi': {
      const rsiVal = symIndicators?.rsi;
      const rsiColor =
        rsiVal == null ? 'text-tertiary' : rsiVal >= 70 ? 'text-danger' : rsiVal <= 30 ? 'text-success' : 'text-primary';
      return (
        <td
          key="rsi"
          className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center font-medium truncate ${rsiColor}`}
          title={rsiVal != null ? `RSI(14): ${rsiVal.toFixed(2)} (${rsiVal >= 70 ? 'Overbought >= 70' : rsiVal <= 30 ? 'Oversold <= 30' : 'Neutral 30-70'})` : undefined}
        >
          {indicatorsLoading && rsiVal == null ? (
            <span className="text-tertiary animate-pulse">…</span>
          ) : rsiVal != null ? (
            <div className="flex items-center justify-center gap-1">
              <span>{rsiVal.toFixed(2)}</span>
              {symIndicators?.rsiDivergence === 'BULLISH' && (
                <span className="text-[8px] font-sans px-1 rounded bg-success/20 text-success font-semibold" title="Bullish Divergence: Price Lower Low while RSI Higher Low">
                  Bull Div ↗
                </span>
              )}
              {symIndicators?.rsiDivergence === 'BEARISH' && (
                <span className="text-[8px] font-sans px-1 rounded bg-danger/20 text-danger font-semibold" title="Bearish Divergence: Price Higher High while RSI Lower High">
                  Bear Div ↘
                </span>
              )}
              {rsiVal >= 70 && (
                <span className="text-[8px] font-sans px-1 rounded bg-danger/20 text-danger font-semibold" title="Overbought (>= 70)">
                  OB
                </span>
              )}
              {rsiVal <= 30 && (
                <span className="text-[8px] font-sans px-1 rounded bg-success/20 text-success font-semibold" title="Oversold (<= 30)">
                  OS
                </span>
              )}
            </div>
          ) : (
            '—'
          )}
        </td>
      );
    }
    case 'macd': {
      const m = symIndicators?.macd;
      const s = symIndicators?.macdSignal;
      const h = symIndicators?.macdHist;
      const tooltip =
        m != null && s != null
          ? `MACD (12, 26): ${m.toFixed(2)} | Signal (9): ${s.toFixed(2)} | Hist: ${h != null ? (h >= 0 ? '+' : '') + h.toFixed(2) : '—'}`
          : undefined;
      return (
        <td key="macd" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center font-medium truncate" title={tooltip}>
          {indicatorsLoading && m == null ? (
            <span className="text-tertiary animate-pulse">…</span>
          ) : m != null && s != null ? (
            <div className="flex items-center justify-center gap-1.5">
              <span className={m >= s ? 'text-success' : 'text-danger'}>{m.toFixed(2)}</span>
              <span className="text-[8px] text-tertiary">/ {s.toFixed(2)}</span>
              {h != null && (
                <span className={`text-[8px] font-sans px-1 rounded font-semibold shrink-0 ${h >= 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                  {h >= 0 ? '+' : ''}{h.toFixed(1)}
                </span>
              )}
            </div>
          ) : (
            '—'
          )}
        </td>
      );
    }
    case 'bollinger': {
      const u = symIndicators?.bbUpper;
      const m = symIndicators?.bbMiddle;
      const l = symIndicators?.bbLower;
      const bw = symIndicators?.bbBandwidth;
      const liveP = group.livePrice || 0;
      const pctB = u != null && l != null && u > l && liveP > 0 ? (liveP - l) / (u - l) : symIndicators?.bbPercentB;
      const tooltip =
        u != null && l != null && m != null
          ? `Bollinger (${indicatorConfig.bbPeriod}, ${indicatorConfig.bbStdDev}): Upper=${u.toFixed(2)} | Mid=${m.toFixed(2)} | Lower=${l.toFixed(2)} | BW=${bw != null ? bw.toFixed(1) + '%' : '—'} | %B=${pctB != null ? pctB.toFixed(2) : '—'}`
          : undefined;
      return (
        <td
          key="bollinger"
          className="px-2 py-1.5 text-[10px] font-mono text-center text-primary whitespace-nowrap font-medium"
          title={tooltip}
        >
          {indicatorsLoading && u == null ? (
            <span className="text-tertiary animate-pulse">…</span>
          ) : u != null && l != null && m != null ? (
            <div className="flex items-center justify-center gap-2.5 text-[10px] font-mono text-primary whitespace-nowrap font-medium">
              <span>U: {u >= 1000 ? u.toFixed(1) : u.toFixed(2)}</span>
              <span>Mid: {m >= 1000 ? m.toFixed(1) : m.toFixed(2)}</span>
              <span>L: {l >= 1000 ? l.toFixed(1) : l.toFixed(2)}</span>
              <span>BW: {bw != null ? `${bw.toFixed(1)}%` : '—'}</span>
              <span>%B: {pctB != null ? pctB.toFixed(2) : '—'}</span>
            </div>
          ) : (
            '—'
          )}
        </td>
      );
    }
    case 'vwap': {
      const vwapVal = symIndicators?.vwap;
      const avgVol = symIndicators?.avgVolume;
      const liveP = group.livePrice || 0;
      const vwapColor = vwapVal == null ? 'text-tertiary' : liveP >= vwapVal ? 'text-success' : 'text-danger';
      const diffPct = vwapVal && liveP ? ((liveP - vwapVal) / vwapVal) * 100 : 0;
      const tooltip =
        vwapVal != null
          ? `VWAP: ${fmtCurrency(vwapVal, group.liveData?.currency)} (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}% ${liveP >= vwapVal ? 'above' : 'below'} VWAP)${avgVol ? ` | 20d Avg Vol: ${avgVol.toLocaleString()}` : ''}`
          : undefined;
      return (
        <td key="vwap" className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center font-medium truncate ${vwapColor}`} title={tooltip}>
          {indicatorsLoading && vwapVal == null ? (
            <span className="text-tertiary animate-pulse">…</span>
          ) : vwapVal != null ? (
            <div className="flex items-center justify-center gap-1">
              <span>{fmtCurrency(vwapVal, group.liveData?.currency)}</span>
              {liveP > 0 && (
                <span className={`text-[8px] font-sans px-1 rounded font-semibold shrink-0 ${liveP >= vwapVal ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                  {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                </span>
              )}
            </div>
          ) : (
            '—'
          )}
        </td>
      );
    }
    case 'obv': {
      const obvVal = symIndicators?.obv;
      const obvSig = symIndicators?.obvSignal;
      const isBullish = obvVal != null && obvSig != null ? obvVal >= obvSig : null;
      const tooltip =
        obvVal != null
          ? `OBV: ${obvVal.toLocaleString()}${obvSig != null ? ` | Signal (20): ${obvSig.toLocaleString()} (${isBullish ? 'Bullish Accumulation' : 'Bearish Distribution'})` : ''}`
          : undefined;
      return (
        <td key="obv" className="px-2 py-1.5 text-[9px] sm:text-[10px] font-mono text-center font-medium truncate" title={tooltip}>
          {indicatorsLoading && obvVal == null ? (
            <span className="text-tertiary animate-pulse">…</span>
          ) : obvVal != null ? (
            <div className="flex items-center justify-center gap-1">
              <span className={isBullish === true ? 'text-success' : isBullish === false ? 'text-danger' : 'text-primary'}>
                {fmtCompactVolume(obvVal)}
              </span>
              {isBullish != null && (
                <span className={`text-[8px] font-sans px-1 rounded font-semibold shrink-0 ${isBullish ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                  {isBullish ? 'Bull ↗' : 'Bear ↘'}
                </span>
              )}
            </div>
          ) : (
            '—'
          )}
        </td>
      );
    }
    case 'dma50':
      return renderMovingAverageCell('dma50', '50 DMA', group.liveData?.dma50 ?? symIndicators?.dma50, group, indicatorsLoading, fmtCurrency);
    case 'dma200':
      return renderMovingAverageCell('dma200', '200 DMA', group.liveData?.dma200 ?? symIndicators?.dma200, group, indicatorsLoading, fmtCurrency);
    case 'ema20':
      return renderMovingAverageCell('ema20', '20 EMA', symIndicators?.ema20, group, indicatorsLoading, fmtCurrency);
    case 'ema50':
      return renderMovingAverageCell('ema50', '50 EMA', symIndicators?.ema50, group, indicatorsLoading, fmtCurrency);
    case 'ema200':
      return renderMovingAverageCell('ema200', '200 EMA', symIndicators?.ema200, group, indicatorsLoading, fmtCurrency);
    case 'strategy': {
      const stratStatus = getStockStrategyEvaluation(group.symbol);
      const executedToday = todayExecutions[group.symbol];
      const isExecuting = executingSignalSymbol === group.symbol;
      return (
        <td key="strategy" className="px-2 py-1 text-[9px] sm:text-[10px] border-r border-divider text-center align-middle">
          <div className="grid grid-cols-3 divide-x divide-divider/70 items-center justify-center text-center h-full min-h-[24px]">
            <div className="px-1.5 flex items-center justify-center">
              {stratStatus.hasActiveStrategy ? (
                <span
                  className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[8px] sm:text-[9px] font-semibold tracking-wide whitespace-nowrap"
                  title={`Active Strategy: ${stratStatus.strategyName || 'Global Strategy'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_4px_rgba(52,211,153,0.8)]"></span>
                  Active
                </span>
              ) : (
                <span className="text-tertiary font-mono text-xs">—</span>
              )}
            </div>
            <div className="px-1.5 flex items-center justify-center">
              {executedToday ? (
                <span
                  className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-medium bg-surface-hover text-secondary border border-divider cursor-default select-none tracking-normal whitespace-nowrap"
                  title={`Executed today (${executedToday.action} ${executedToday.quantity || ''} shares @ ₹${executedToday.price || ''}) — 1 action per day limit`}
                >
                  <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                  Executed
                </span>
              ) : stratStatus.signal === 'BUY' || stratStatus.signal === 'SELL' ? (
                <button
                  type="button"
                  disabled={isExecuting}
                  onClick={e => {
                    e.stopPropagation();
                    onExecuteStrategySignal(group, stratStatus.signal as 'BUY' | 'SELL', stratStatus.matchedRule);
                  }}
                  className={`group/sig relative inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded font-bold text-[8px] sm:text-[9px] uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                    stratStatus.signal === 'BUY'
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.35)] hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_14px_rgba(16,185,129,0.7)]'
                      : 'bg-rose-500/25 text-rose-300 border border-rose-500/60 shadow-[0_0_10px_rgba(244,63,94,0.35)] hover:bg-rose-500 hover:text-white hover:shadow-[0_0_14px_rgba(244,63,94,0.7)]'
                  } ${isExecuting ? 'opacity-60 cursor-wait' : 'animate-pulse'}`}
                  title={`Click to automatically ${stratStatus.signal} ${
                    stratStatus.matchedRule?.sizingValue
                      ? `(${stratStatus.matchedRule.sizingType}: ${stratStatus.matchedRule.sizingValue})`
                      : ''
                  } via ${stratStatus.strategyName || 'strategy'}`}
                >
                  {isExecuting ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <>
                      <span
                        className={`w-1.5 h-1.5 rounded-full group-hover/sig:bg-white animate-ping mr-0.5 ${
                          stratStatus.signal === 'BUY' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      ></span>
                      {stratStatus.signal}
                    </>
                  )}
                </button>
              ) : (
                <span className="text-tertiary font-mono text-xs">—</span>
              )}
            </div>
            <div className="px-1.5 flex items-center justify-center">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onOpenStrategyLogs(group.symbol);
                }}
                className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-medium bg-surface-hover/70 hover:bg-primary/15 text-secondary hover:text-primary border border-divider hover:border-primary/40 transition-colors cursor-pointer whitespace-nowrap"
                title={`View strategy execution logs for ${group.symbol}`}
              >
                <History className="w-2.5 h-2.5 shrink-0" />
                Logs
              </button>
            </div>
          </div>
        </td>
      );
    }
    default:
      return null;
  }
}

