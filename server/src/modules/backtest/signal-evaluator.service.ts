import {
  IndicatorType,
  StrategyCondition,
  StrategyRule,
  BarMarketData,
  BacktestSignal,
} from './types';

/**
 * Extracts numeric value of an indicator from a given bar.
 */
export function getIndicatorValue(
  type: IndicatorType | '',
  bar: BarMarketData
): number | null {
  if (!type || !bar) return null;
  switch (type) {
    case 'price':
      return typeof bar.close === 'number' && !isNaN(bar.close) ? bar.close : null;
    case 'changePct':
      return typeof bar.changePercent === 'number' && !isNaN(bar.changePercent)
        ? bar.changePercent
        : null;
    case 'rsi':
      return typeof bar.indicators?.rsi === 'number' && !isNaN(bar.indicators.rsi)
        ? bar.indicators.rsi
        : null;
    case 'dma50':
      return typeof bar.indicators?.dma50 === 'number' && !isNaN(bar.indicators.dma50)
        ? bar.indicators.dma50
        : null;
    case 'dma200':
      return typeof bar.indicators?.dma200 === 'number' && !isNaN(bar.indicators.dma200)
        ? bar.indicators.dma200
        : null;
    default:
      return null;
  }
}

/**
 * Evaluates a single condition against current bar and previous bar.
 * Supports true crossover and crossunder detection using bar t vs bar t-1.
 */
export function evaluateConditionOnBar(
  cond: StrategyCondition,
  currentBar: BarMarketData,
  prevBar?: BarMarketData
): boolean {
  if (!cond.leftIndicator || !cond.operator) return false;

  const currentLeft = getIndicatorValue(cond.leftIndicator, currentBar);
  if (currentLeft === null) return false;

  let currentRight: number | null = null;
  if (cond.rightType === 'value') {
    if (cond.rightValue === '' || cond.rightValue === undefined || cond.rightValue === null) {
      return false;
    }
    const num = Number(cond.rightValue);
    if (isNaN(num)) return false;
    currentRight = num;
  } else if (cond.rightType === 'indicator') {
    currentRight = getIndicatorValue(cond.rightIndicator || '', currentBar);
  }

  if (currentRight === null) return false;

  switch (cond.operator) {
    case '<':
      return currentLeft < currentRight;
    case '>':
      return currentLeft > currentRight;
    case '<=':
      return currentLeft <= currentRight;
    case '>=':
      return currentLeft >= currentRight;
    case '==':
      return Math.abs(currentLeft - currentRight) < 0.0001;
    case 'CROSSINGOVER': {
      if (!prevBar) return currentLeft > currentRight;
      const prevLeft = getIndicatorValue(cond.leftIndicator, prevBar);
      const prevRight =
        cond.rightType === 'value'
          ? Number(cond.rightValue)
          : getIndicatorValue(cond.rightIndicator || '', prevBar);

      if (prevLeft === null || prevRight === null) return currentLeft > currentRight;
      // Previous bar was below/equal, current bar is strictly above
      return prevLeft <= prevRight && currentLeft > currentRight;
    }
    case 'CROSSINGUNDER': {
      if (!prevBar) return currentLeft < currentRight;
      const prevLeft = getIndicatorValue(cond.leftIndicator, prevBar);
      const prevRight =
        cond.rightType === 'value'
          ? Number(cond.rightValue)
          : getIndicatorValue(cond.rightIndicator || '', prevBar);

      if (prevLeft === null || prevRight === null) return currentLeft < currentRight;
      // Previous bar was above/equal, current bar is strictly below
      return prevLeft >= prevRight && currentLeft < currentRight;
    }
    default:
      return false;
  }
}

/**
 * Evaluates an entire StrategyRule against the bar.
 */
export function evaluateRuleOnBar(
  rule: StrategyRule,
  currentBar: BarMarketData,
  prevBar?: BarMarketData
): { matched: boolean; action: 'BUY' | 'SELL' | 'NONE'; reason: string } {
  if (rule.enabled === false || !rule.conditions || rule.conditions.length === 0) {
    return { matched: false, action: 'NONE', reason: '' };
  }

  let result = evaluateConditionOnBar(rule.conditions[0], currentBar, prevBar);

  for (let i = 1; i < rule.conditions.length; i++) {
    const cond = rule.conditions[i];
    const condRes = evaluateConditionOnBar(cond, currentBar, prevBar);
    const connector = cond.connector || 'AND';

    if (connector === 'AND') {
      result = result && condRes;
    } else if (connector === 'OR') {
      result = result || condRes;
    }
  }

  if (result) {
    const action = rule.action === 'BUY' || rule.action === 'SELL' ? rule.action : 'NONE';
    const reason = rule.conditions
      .map(
        (c) =>
          `${c.leftIndicator} ${c.operator} ${
            c.rightType === 'value' ? c.rightValue : c.rightIndicator
          }`
      )
      .join(' AND ');
    return { matched: true, action, reason };
  }

  return { matched: false, action: 'NONE', reason: '' };
}

/**
 * Replays rules bar-by-bar across a historical timeline and returns all generated signals.
 * Skips warmup bars (bars with date < nominalStartDate).
 */
export function generateSignalsSeries(
  bars: BarMarketData[],
  rules: StrategyRule[],
  nominalStartDate?: string
): BacktestSignal[] {
  const signals: BacktestSignal[] = [];

  for (let i = 0; i < bars.length; i++) {
    const currentBar = bars[i];
    const prevBar = i > 0 ? bars[i - 1] : undefined;

    // Skip warmup bars prior to nominal backtest start date
    if (nominalStartDate && currentBar.date < nominalStartDate) {
      continue;
    }

    for (const rule of rules) {
      const evalRes = evaluateRuleOnBar(rule, currentBar, prevBar);
      if (evalRes.matched && evalRes.action !== 'NONE') {
        signals.push({
          barIndex: i,
          date: currentBar.date,
          action: evalRes.action,
          price: currentBar.close,
          reason: evalRes.reason,
          ruleName: rule.name || 'Strategy Rule',
          rule,
        });
        // At most 1 signal per day per stock
        break;
      }
    }
  }

  return signals;
}
