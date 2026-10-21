import type { StrategyRule, StrategyCondition, IndicatorType } from '../components/StrategyBuilderModal';

export interface StockMarketData {
  livePrice: number;
  changePercent?: number;
  indicators?: {
    rsi?: number | null;
    dma50?: number | null;
    dma200?: number | null;
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
    default:
      return null;
  }
}

export function evaluateCondition(cond: StrategyCondition, data: StockMarketData): boolean {
  if (!cond.leftIndicator || !cond.operator) return false;

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

export function evaluateRule(rule: StrategyRule, data: StockMarketData): { matched: boolean; action: 'BUY' | 'SELL' | 'NONE' } {
  if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
    return { matched: false, action: 'NONE' };
  }

  let result = evaluateCondition(rule.conditions[0], data);

  for (let i = 1; i < rule.conditions.length; i++) {
    const cond = rule.conditions[i];
    const condRes = evaluateCondition(cond, data);
    const connector = cond.connector || 'AND';

    if (connector === 'AND') {
      result = result && condRes;
    } else if (connector === 'OR') {
      result = result || condRes;
    }
  }

  if (result) {
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
