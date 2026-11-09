import type { StrategyRule, StrategyCondition, IndicatorType } from '../components/StrategyBuilderModal';

export interface StockMarketData {
  livePrice: number;
  changePercent?: number;
  indicators?: {
    rsi?: number | null;
    dma50?: number | null;
    dma200?: number | null;
    ema20?: number | null;
    ema50?: number | null;
    ema200?: number | null;
    rsiDivergence?: 'BULLISH' | 'BEARISH' | null;
    rsiBullishDiv?: number | null;
    rsiBearishDiv?: number | null;
    macd?: number | null;
    macdSignal?: number | null;
    macdHist?: number | null;
    bbUpper?: number | null;
    bbMiddle?: number | null;
    bbLower?: number | null;
    bbBandwidth?: number | null;
    bbPercentB?: number | null;
    vwap?: number | null;
    avgVolume?: number | null;
    obv?: number | null;
    obvSignal?: number | null;
  };
}

export interface StockStrategyStatus {
  hasActiveStrategy: boolean;
  strategyName?: string;
  signal: 'BUY' | 'SELL' | 'NONE';
  matchedRule?: StrategyRule;
}

function getIndicatorValue(type: IndicatorType | '', data: StockMarketData): number | null {
  if (!type) return null;
  switch (type) {
    case 'price':
      return typeof data.livePrice === 'number' && !isNaN(data.livePrice) ? data.livePrice : null;
    case 'changePct':
      return typeof data.changePercent === 'number' && !isNaN(data.changePercent) ? data.changePercent : null;
    case 'rsi':
      return typeof data.indicators?.rsi === 'number' && !isNaN(data.indicators.rsi) ? data.indicators.rsi : null;
    case 'dma50':
      return typeof data.indicators?.dma50 === 'number' && !isNaN(data.indicators.dma50) ? data.indicators.dma50 : null;
    case 'dma200':
      return typeof data.indicators?.dma200 === 'number' && !isNaN(data.indicators.dma200) ? data.indicators.dma200 : null;
    case 'ema20':
      return typeof data.indicators?.ema20 === 'number' && !isNaN(data.indicators.ema20) ? data.indicators.ema20 : null;
    case 'ema50':
      return typeof data.indicators?.ema50 === 'number' && !isNaN(data.indicators.ema50) ? data.indicators.ema50 : null;
    case 'ema200':
      return typeof data.indicators?.ema200 === 'number' && !isNaN(data.indicators.ema200) ? data.indicators.ema200 : null;
    case 'macd':
      return typeof data.indicators?.macd === 'number' && !isNaN(data.indicators.macd) ? data.indicators.macd : null;
    case 'macdSignal':
      return typeof data.indicators?.macdSignal === 'number' && !isNaN(data.indicators.macdSignal) ? data.indicators.macdSignal : null;
    case 'macdHist':
      return typeof data.indicators?.macdHist === 'number' && !isNaN(data.indicators.macdHist) ? data.indicators.macdHist : null;
    case 'bbUpper':
      return typeof data.indicators?.bbUpper === 'number' && !isNaN(data.indicators.bbUpper) ? data.indicators.bbUpper : null;
    case 'bbMiddle':
      return typeof data.indicators?.bbMiddle === 'number' && !isNaN(data.indicators.bbMiddle) ? data.indicators.bbMiddle : null;
    case 'bbLower':
      return typeof data.indicators?.bbLower === 'number' && !isNaN(data.indicators.bbLower) ? data.indicators.bbLower : null;
    case 'bbBandwidth':
      return typeof data.indicators?.bbBandwidth === 'number' && !isNaN(data.indicators.bbBandwidth) ? data.indicators.bbBandwidth : null;
    case 'bbPercentB':
      return typeof data.indicators?.bbPercentB === 'number' && !isNaN(data.indicators.bbPercentB) ? data.indicators.bbPercentB : null;
    case 'vwap':
      return typeof data.indicators?.vwap === 'number' && !isNaN(data.indicators.vwap) ? data.indicators.vwap : null;
    case 'avgVolume':
      return typeof data.indicators?.avgVolume === 'number' && !isNaN(data.indicators.avgVolume) ? data.indicators.avgVolume : null;
    case 'obv':
      return typeof data.indicators?.obv === 'number' && !isNaN(data.indicators.obv) ? data.indicators.obv : null;
    case 'obvSignal':
      return typeof data.indicators?.obvSignal === 'number' && !isNaN(data.indicators.obvSignal) ? data.indicators.obvSignal : null;
    case 'volume':
      return typeof (data as any)?.volume === 'number' && !isNaN((data as any).volume) ? (data as any).volume : null;
    case 'rsiBullishDiv':
      return data.indicators?.rsiBullishDiv ?? (data.indicators?.rsiDivergence === 'BULLISH' ? 1 : 0);
    case 'rsiBearishDiv':
      return data.indicators?.rsiBearishDiv ?? (data.indicators?.rsiDivergence === 'BEARISH' ? 1 : 0);
    default:
      return null;
  }
}

export function evaluateCondition(cond: StrategyCondition, data: StockMarketData): boolean {
  if (!cond.leftIndicator || !cond.operator) return false;

  if (cond.operator === 'BULLISH_DIVERGENCE') {
    return data.indicators?.rsiDivergence === 'BULLISH' || data.indicators?.rsiBullishDiv === 1;
  }
  if (cond.operator === 'BEARISH_DIVERGENCE') {
    return data.indicators?.rsiDivergence === 'BEARISH' || data.indicators?.rsiBearishDiv === 1;
  }

  const leftVal = getIndicatorValue(cond.leftIndicator, data);
  if (leftVal === null) return false;

  let rightVal: number | null = null;
  if (cond.rightType === 'value') {
    if (cond.rightValue === '' || cond.rightValue === undefined || cond.rightValue === null) return false;
    const num = Number(cond.rightValue);
    if (isNaN(num)) return false;
    rightVal = num;
  } else if (cond.rightType === 'indicator') {
    rightVal = getIndicatorValue(cond.rightIndicator || '', data);
  }

  if (rightVal === null) return false;

  switch (cond.operator) {
    case '<':
      return leftVal < rightVal;
    case '>':
      return leftVal > rightVal;
    case '<=':
      return leftVal <= rightVal;
    case '>=':
      return leftVal >= rightVal;
    case '==':
      return Math.abs(leftVal - rightVal) < 0.0001;
    case 'CROSSINGOVER':
      return leftVal > rightVal;
    case 'CROSSINGUNDER':
      return leftVal < rightVal;
    default:
      return false;
  }
}

export function evaluateConditionList(conditions: StrategyCondition[], data: StockMarketData): boolean {
  if (!conditions || conditions.length === 0) return false;
  let result = evaluateCondition(conditions[0], data);

  for (let i = 1; i < conditions.length; i++) {
    const cond = conditions[i];
    const condRes = evaluateCondition(cond, data);
    const connector = cond.connector || 'AND';

    if (connector === 'AND') {
      result = result && condRes;
    } else if (connector === 'OR') {
      result = result || condRes;
    }
  }

  return result;
}

export function evaluateRule(rule: StrategyRule, data: StockMarketData): { matched: boolean; action: 'BUY' | 'SELL' | 'NONE' } {
  if (!rule.enabled) {
    return { matched: false, action: 'NONE' };
  }

  const entryConds = (Array.isArray(rule.entryConditions) && rule.entryConditions.length > 0)
    ? rule.entryConditions
    : (rule.action !== 'SELL' && Array.isArray(rule.conditions) ? rule.conditions : []);

  const exitConds = (Array.isArray(rule.exitConditions) && rule.exitConditions.length > 0)
    ? rule.exitConditions
    : (rule.action === 'SELL' && Array.isArray(rule.conditions) ? rule.conditions : []);

  // 1. Check Exit conditions first
  if (exitConds.length > 0 && evaluateConditionList(exitConds, data)) {
    return { matched: true, action: 'SELL' };
  }

  // 2. Check Entry conditions
  if (entryConds.length > 0 && evaluateConditionList(entryConds, data)) {
    return { matched: true, action: 'BUY' };
  }

  // 3. Fallback for generic legacy rules
  if (rule.conditions && rule.conditions.length > 0 && evaluateConditionList(rule.conditions, data)) {
    const action = (rule.action === 'BUY' || rule.action === 'SELL') ? rule.action : 'NONE';
    return { matched: true, action };
  }

  return { matched: false, action: 'NONE' };
}

export function evaluateStockStrategies(
  rules: StrategyRule[],
  symbol: string,
  data: StockMarketData
): StockStrategyStatus {
  if (!Array.isArray(rules) || rules.length === 0) {
    return { hasActiveStrategy: false, signal: 'NONE' };
  }

  // 1. Separate rules: Stock-specific vs Global
  const stockRules = rules.filter(r => r.enabled && r.scope === 'stock' && r.targetSymbol === symbol);
  const globalRules = rules.filter(r => r.enabled && (r.scope === 'global' || r.targetSymbol === 'ALL' || !r.targetSymbol));

  // Priority 1: Stock-specific rules with a triggered signal
  for (const rule of stockRules) {
    const evaluation = evaluateRule(rule, data);
    if (evaluation.matched && evaluation.action !== 'NONE') {
      return {
        hasActiveStrategy: true,
        strategyName: rule.name || 'Stock Strategy',
        signal: evaluation.action,
        matchedRule: rule
      };
    }
  }

  // Priority 2: Global rules with a triggered signal
  for (const rule of globalRules) {
    const evaluation = evaluateRule(rule, data);
    if (evaluation.matched && evaluation.action !== 'NONE') {
      return {
        hasActiveStrategy: true,
        strategyName: rule.name || 'Global Strategy',
        signal: evaluation.action,
        matchedRule: rule
      };
    }
  }

  // Priority 3: No signal triggered, but an active strategy applies to this stock
  if (stockRules.length > 0) {
    return {
      hasActiveStrategy: true,
      strategyName: stockRules[0].name || 'Stock Strategy',
      signal: 'NONE',
      matchedRule: stockRules[0]
    };
  }

  if (globalRules.length > 0) {
    return {
      hasActiveStrategy: true,
      strategyName: globalRules[0].name || 'Global Strategy',
      signal: 'NONE',
      matchedRule: globalRules[0]
    };
  }

  return { hasActiveStrategy: false, signal: 'NONE' };
}
