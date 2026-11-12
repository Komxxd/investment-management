import type { DailyExecutionEntry } from '../components/dashboard/dashboardConfig';
import type { IndicatorsMap, SymbolGroup } from '../components/dashboard/dashboardTypes';
import type { StrategyRule } from '../components/StrategyBuilderModal';
import type { StockStrategyStatus } from '../utils/strategyEvaluator';

interface SortGroupsParams {
  groups: SymbolGroup[];
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  totalInvestment: number;
  totalCurrentValue: number;
  indicators: IndicatorsMap;
  todayExecutions: Record<string, DailyExecutionEntry>;
  getStockStrategyEvaluation: (symbol: string) => StockStrategyStatus;
}

const getSortValue = (
  group: SymbolGroup,
  sortField: string,
  params: Omit<SortGroupsParams, 'groups' | 'sortField' | 'sortDirection'>
): string | number => {
  const { totalInvestment, totalCurrentValue, indicators, todayExecutions, getStockStrategyEvaluation } = params;

  switch (sortField) {
    case 'totalPnL':
      return group.unrealizedPnL + group.realizedPnL;
    case 'portfolioWeight':
      return totalInvestment > 0 ? (group.netCostBasis / totalInvestment) * 100 : 0;
    case 'currentValueWeight':
      return totalCurrentValue > 0 ? (group.currentValue / totalCurrentValue) * 100 : 0;
    case 'dayGain':
      return group.netQty * (group.liveData?.change || 0);
    case 'dayGainPct':
    case 'changePercent':
      return group.liveData?.changePercent || 0;
    case 'priceChange':
      return group.liveData?.change || 0;
    case 'dayHigh':
      return group.liveData?.dayHigh || 0;
    case 'dayLow':
      return group.liveData?.dayLow || 0;
    case '52wkHigh':
      return group.liveData?.fiftyTwoWeekHigh || 0;
    case '52wkLow':
      return group.liveData?.fiftyTwoWeekLow || 0;
    case 'marketCap':
      return group.liveData?.marketCap || 0;
    case 'volume':
      return group.liveData?.volume || 0;
    case 'avgVolume':
      return group.liveData?.avgVolume || 0;
    case 'tradeValue':
      return (group.liveData?.volume || 0) * (group.liveData?.price || 0);
    case 'rsi':
      return indicators[group.symbol]?.rsi ?? -1;
    case 'macd':
      return indicators[group.symbol]?.macdHist ?? indicators[group.symbol]?.macd ?? -Infinity;
    case 'bollinger':
      return indicators[group.symbol]?.bbPercentB ?? -Infinity;
    case 'obv':
      return indicators[group.symbol]?.obv ?? -Infinity;
    case 'dma50':
      return group.liveData?.dma50 ?? indicators[group.symbol]?.dma50 ?? -1;
    case 'dma200':
      return group.liveData?.dma200 ?? indicators[group.symbol]?.dma200 ?? -1;
    case 'strategy': {
      if (todayExecutions[group.symbol]) return 2;
      const evaluation = getStockStrategyEvaluation(group.symbol);
      if (evaluation.signal === 'BUY') return 4;
      if (evaluation.signal === 'SELL') return 3;
      if (evaluation.hasActiveStrategy) return 1;
      return 0;
    }
    default: {
      const raw = group[sortField];
      return typeof raw === 'string' || typeof raw === 'number' ? raw : 0;
    }
  }
};

/**
 * Returns a sorted copy of filtered portfolio symbol groups without mutating server response arrays.
 */
export const sortSymbolGroups = ({
  groups,
  sortField,
  sortDirection,
  totalInvestment,
  totalCurrentValue,
  indicators,
  todayExecutions,
  getStockStrategyEvaluation,
}: SortGroupsParams): SymbolGroup[] => {
  if (!sortField) return groups;

  const lookupCtx = { totalInvestment, totalCurrentValue, indicators, todayExecutions, getStockStrategyEvaluation };
  return [...groups].sort((a, b) => {
    const valA = getSortValue(a, sortField, lookupCtx) ?? 0;
    const valB = getSortValue(b, sortField, lookupCtx) ?? 0;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
};

export type ExecuteStrategySignalHandler = (
  group: SymbolGroup,
  action: 'BUY' | 'SELL',
  matchedRule?: StrategyRule
) => Promise<void> | void;
