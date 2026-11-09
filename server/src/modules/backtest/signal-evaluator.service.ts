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
    case 'rsiBullishDiv':
      return bar.indicators?.rsiBullishDiv ?? (bar.indicators?.rsiDivergence === 'BULLISH' ? 1 : 0);
    case 'rsiBearishDiv':
      return bar.indicators?.rsiBearishDiv ?? (bar.indicators?.rsiDivergence === 'BEARISH' ? 1 : 0);
    case 'dma50':
      return typeof bar.indicators?.dma50 === 'number' && !isNaN(bar.indicators.dma50)
        ? bar.indicators.dma50
        : null;
    case 'dma200':
      return typeof bar.indicators?.dma200 === 'number' && !isNaN(bar.indicators.dma200)
        ? bar.indicators.dma200
        : null;
    case 'ema20':
      return typeof bar.indicators?.ema20 === 'number' && !isNaN(bar.indicators.ema20)
        ? bar.indicators.ema20
        : null;
    case 'ema50':
      return typeof bar.indicators?.ema50 === 'number' && !isNaN(bar.indicators.ema50)
        ? bar.indicators.ema50
        : null;
    case 'ema200':
      return typeof bar.indicators?.ema200 === 'number' && !isNaN(bar.indicators.ema200)
        ? bar.indicators.ema200
        : null;
    case 'macd':
      return typeof bar.indicators?.macd === 'number' && !isNaN(bar.indicators.macd)
        ? bar.indicators.macd
        : null;
    case 'macdSignal':
      return typeof bar.indicators?.macdSignal === 'number' && !isNaN(bar.indicators.macdSignal)
        ? bar.indicators.macdSignal
        : null;
    case 'macdHist':
      return typeof bar.indicators?.macdHist === 'number' && !isNaN(bar.indicators.macdHist)
        ? bar.indicators.macdHist
        : null;
    case 'bbUpper':
      return typeof bar.indicators?.bbUpper === 'number' && !isNaN(bar.indicators.bbUpper)
        ? bar.indicators.bbUpper
        : null;
    case 'bbMiddle':
      return typeof bar.indicators?.bbMiddle === 'number' && !isNaN(bar.indicators.bbMiddle)
        ? bar.indicators.bbMiddle
        : null;
    case 'bbLower':
      return typeof bar.indicators?.bbLower === 'number' && !isNaN(bar.indicators.bbLower)
        ? bar.indicators.bbLower
        : null;
    case 'bbBandwidth':
      return typeof bar.indicators?.bbBandwidth === 'number' && !isNaN(bar.indicators.bbBandwidth)
        ? bar.indicators.bbBandwidth
        : null;
    case 'bbPercentB':
      return typeof bar.indicators?.bbPercentB === 'number' && !isNaN(bar.indicators.bbPercentB)
        ? bar.indicators.bbPercentB
        : null;
    case 'vwap':
      return typeof bar.indicators?.vwap === 'number' && !isNaN(bar.indicators.vwap)
        ? bar.indicators.vwap
        : null;
    case 'avgVolume':
      return typeof bar.indicators?.avgVolume === 'number' && !isNaN(bar.indicators.avgVolume)
        ? bar.indicators.avgVolume
        : null;
    case 'volume':
      return typeof bar.volume === 'number' && !isNaN(bar.volume)
        ? bar.volume
        : null;
    case 'obv':
      return typeof bar.indicators?.obv === 'number' && !isNaN(bar.indicators.obv)
        ? bar.indicators.obv
        : null;
    case 'obvSignal':
      return typeof bar.indicators?.obvSignal === 'number' && !isNaN(bar.indicators.obvSignal)
        ? bar.indicators.obvSignal
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

  // Direct divergence checks without needing a right operand
  if (cond.operator === 'BULLISH_DIVERGENCE') {
    return currentBar.indicators?.rsiDivergence === 'BULLISH' || currentBar.indicators?.rsiBullishDiv === 1;
  }
  if (cond.operator === 'BEARISH_DIVERGENCE') {
    return currentBar.indicators?.rsiDivergence === 'BEARISH' || currentBar.indicators?.rsiBearishDiv === 1;
  }

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
