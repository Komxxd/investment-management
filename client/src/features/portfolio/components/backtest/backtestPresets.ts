import { api } from '../../../../services/api/client';
import { normalizeRule, type StrategyRule } from '../../utils/strategyConfig';
import type { Portfolio, Stock } from '../../hooks/usePortfolioData';

export interface StrategyWithLegacyPortfolio extends StrategyRule {
  portfolio_id?: string;
}

/**
 * Resolves the owning portfolio ID for a strategy using explicit ID, target symbol lookup, or fallback.
 */
function resolveStrategyPortfolioId(
  strat: StrategyWithLegacyPortfolio,
  portfolios: Portfolio[],
  stocks: Stock[]
): string | undefined {
  const directId = strat.portfolioId || strat.portfolio_id;
  if (directId && portfolios.some(p => p.id === directId)) {
    return directId;
  }
  if (strat.targetSymbol && stocks.length > 0) {
    const matchedStock = stocks.find(st => st.symbol === strat.targetSymbol);
    if (matchedStock && matchedStock.portfolio_id) {
      return matchedStock.portfolio_id;
    }
  }
  return portfolios[0]?.id || undefined;
}

/**
 * Loads saved strategies from the backend API merged with any localStorage fallbacks.
 */
export async function loadAllBacktestStrategies(
  portfolios: Portfolio[],
  stocks: Stock[]
): Promise<StrategyRule[]> {
  let serverStrategies: StrategyWithLegacyPortfolio[] = [];
  try {
    const data = await api.get('/api/strategies');
    if (Array.isArray(data)) {
      serverStrategies = data.filter(
        (s): s is StrategyWithLegacyPortfolio => Boolean(s && s.id !== 'rule-default')
      );
    }
  } catch (err) {
    console.warn('Could not fetch strategies from server, reading local storage', err);
  }

  const strategiesMap = new Map<string, StrategyRule>();
  serverStrategies.forEach(s => {
    if (s && s.id) {
      strategiesMap.set(s.id, {
        ...normalizeRule(s),
        portfolioId: resolveStrategyPortfolioId(s, portfolios, stocks),
      });
    }
  });

  portfolios.forEach(p => {
    try {
      const raw = localStorage.getItem(`portfolio_strategies_${p.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((s: StrategyWithLegacyPortfolio) => {
            if (s && s.id && s.id !== 'rule-default' && !strategiesMap.has(s.id)) {
              strategiesMap.set(s.id, {
                ...normalizeRule(s),
                portfolioId: s.portfolioId || s.portfolio_id || p.id,
              });
            }
          });
        }
      }
    } catch {
      // Ignore malformed localStorage cache entries
    }
  });

  try {
    const raw = localStorage.getItem('portfolio_strategies_global');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((s: StrategyWithLegacyPortfolio) => {
          if (s && s.id && s.id !== 'rule-default' && !strategiesMap.has(s.id)) {
            strategiesMap.set(s.id, {
              ...normalizeRule(s),
              portfolioId: resolveStrategyPortfolioId(s, portfolios, stocks),
            });
          }
        });
      }
    }
  } catch {
    // Ignore malformed global cache entries
  }

  return Array.from(strategiesMap.values());
}

/**
 * Builds preset sample strategies seeded on demand when a user has no saved strategies.
 */
export function buildSampleBacktestStrategies(
  targetPortId: string | null,
  stocks: Stock[]
): StrategyRule[] {
  const primarySymbol = stocks[0]?.symbol || 'RELIANCE.NS';
  const secondarySymbol = stocks[1]?.symbol || 'TCS.NS';
  const now = Date.now();
  const createdAt = new Date().toISOString();
  const portfolioId = targetPortId || undefined;

  return [
    {
      id: `rule-sample-rsi-${now}`,
      name: 'RSI Divergence & Oversold Reversal (14-period)',
      scope: 'stock',
      targetSymbol: primarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled: true,
      frequency: 'daily',
      createdAt,
      conditions: [
        {
          id: 'c1_entry',
          leftIndicator: 'rsi',
          operator: 'CROSSINGOVER',
          rightType: 'value',
          rightValue: 30,
        },
      ],
      entryConditions: [
        {
          id: 'c1_entry1',
          leftIndicator: 'rsi',
          operator: 'CROSSINGOVER',
          rightType: 'value',
          rightValue: 30,
        },
        {
          id: 'c1_entry2',
          connector: 'OR',
          leftIndicator: 'rsi',
          operator: 'BULLISH_DIVERGENCE',
          rightType: 'value',
        },
      ],
      exitConditions: [
        {
          id: 'c1_exit1',
          leftIndicator: 'rsi',
          operator: 'CROSSINGUNDER',
          rightType: 'value',
          rightValue: 70,
        },
        {
          id: 'c1_exit2',
          connector: 'OR',
          leftIndicator: 'rsi',
          operator: 'BEARISH_DIVERGENCE',
          rightType: 'value',
        },
      ],
      exitSizingType: 'DECREASE_PCT',
      exitSizingValue: 100,
      portfolioId,
    },
    {
      id: `rule-sample-golden-${now + 1}`,
      name: 'Golden Cross (50/200 DMA)',
      scope: 'stock',
      targetSymbol: secondarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 15,
      enabled: true,
      frequency: 'daily',
      createdAt,
      conditions: [
        {
          id: 'c2',
          leftIndicator: 'dma50',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'dma200',
        },
      ],
      portfolioId,
    },
    {
      id: `rule-sample-ema-golden-${now + 2}`,
      name: 'EMA Golden / Death Cross (50/200 EMA)',
      scope: 'stock',
      targetSymbol: primarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled: true,
      frequency: 'daily',
      createdAt,
      conditions: [
        {
          id: 'c3',
          leftIndicator: 'ema50',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'ema200',
        },
      ],
      entryConditions: [
        {
          id: 'c3_entry',
          leftIndicator: 'ema50',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'ema200',
        },
      ],
      exitConditions: [
        {
          id: 'c3_exit',
          leftIndicator: 'ema50',
          operator: 'CROSSINGUNDER',
          rightType: 'indicator',
          rightIndicator: 'ema200',
        },
      ],
      exitSizingType: 'DECREASE_PCT',
      exitSizingValue: 100,
      portfolioId,
    },
    {
      id: `rule-sample-macd-${now + 3}`,
      name: 'MACD Momentum Crossover (12, 26, 9)',
      scope: 'stock',
      targetSymbol: primarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled: true,
      frequency: 'daily',
      createdAt,
      conditions: [
        {
          id: 'c4_entry1',
          leftIndicator: 'macd',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'macdSignal',
        },
        {
          id: 'c4_entry2',
          connector: 'AND',
          leftIndicator: 'macd',
          operator: '<',
          rightType: 'value',
          rightValue: 0,
        },
        {
          id: 'c4_entry3',
          connector: 'AND',
          leftIndicator: 'macdHist',
          operator: '>',
          rightType: 'value',
          rightValue: 0,
        },
      ],
      entryConditions: [
        {
          id: 'c4_entry1',
          leftIndicator: 'macd',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'macdSignal',
        },
        {
          id: 'c4_entry2',
          connector: 'AND',
          leftIndicator: 'macd',
          operator: '<',
          rightType: 'value',
          rightValue: 0,
        },
        {
          id: 'c4_entry3',
          connector: 'AND',
          leftIndicator: 'macdHist',
          operator: '>',
          rightType: 'value',
          rightValue: 0,
        },
      ],
      exitConditions: [
        {
          id: 'c4_exit1',
          leftIndicator: 'macd',
          operator: 'CROSSINGUNDER',
          rightType: 'indicator',
          rightIndicator: 'macdSignal',
        },
        {
          id: 'c4_exit2',
          connector: 'OR',
          leftIndicator: 'macdHist',
          operator: '<=',
          rightType: 'value',
          rightValue: 0,
        },
      ],
      exitSizingType: 'DECREASE_PCT',
      exitSizingValue: 100,
      portfolioId,
    },
    {
      id: `rule-sample-bb-${now + 4}`,
      name: 'Bollinger Band Mean Reversion (20, 2)',
      scope: 'stock',
      targetSymbol: secondarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled: true,
      frequency: 'daily',
      createdAt,
      conditions: [
        {
          id: 'c5_entry',
          leftIndicator: 'price',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'bbLower',
        },
      ],
      entryConditions: [
        {
          id: 'c5_entry',
          leftIndicator: 'price',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'bbLower',
        },
      ],
      exitConditions: [
        {
          id: 'c5_exit1',
          leftIndicator: 'price',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'bbUpper',
        },
        {
          id: 'c5_exit2',
          connector: 'OR',
          leftIndicator: 'price',
          operator: 'CROSSINGUNDER',
          rightType: 'indicator',
          rightIndicator: 'bbMiddle',
        },
      ],
      exitSizingType: 'DECREASE_PCT',
      exitSizingValue: 100,
      portfolioId,
    },
    {
      id: `rule-sample-vwap-${now + 5}`,
      name: 'VWAP Institutional Breakout',
      scope: 'stock',
      targetSymbol: primarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled: true,
      frequency: 'daily',
      createdAt,
      conditions: [
        {
          id: 'c6_entry1',
          leftIndicator: 'price',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'vwap',
        },
        {
          id: 'c6_entry2',
          connector: 'AND',
          leftIndicator: 'volume',
          operator: '>',
          rightType: 'indicator',
          rightIndicator: 'avgVolume',
        },
      ],
      entryConditions: [
        {
          id: 'c6_entry1',
          leftIndicator: 'price',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'vwap',
        },
        {
          id: 'c6_entry2',
          connector: 'AND',
          leftIndicator: 'volume',
          operator: '>',
          rightType: 'indicator',
          rightIndicator: 'avgVolume',
        },
      ],
      exitConditions: [
        {
          id: 'c6_exit',
          leftIndicator: 'price',
          operator: 'CROSSINGUNDER',
          rightType: 'indicator',
          rightIndicator: 'vwap',
        },
      ],
      exitSizingType: 'DECREASE_PCT',
      exitSizingValue: 100,
      portfolioId,
    },
    {
      id: `rule-sample-obv-${now + 6}`,
      name: 'OBV & Volume Breakout Confirmation',
      scope: 'stock',
      targetSymbol: primarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled: true,
      frequency: 'daily',
      createdAt,
      conditions: [
        {
          id: 'c7_entry1',
          leftIndicator: 'obv',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'obvSignal',
        },
        {
          id: 'c7_entry2',
          connector: 'AND',
          leftIndicator: 'volume',
          operator: '>',
          rightType: 'indicator',
          rightIndicator: 'avgVolume',
        },
      ],
      entryConditions: [
        {
          id: 'c7_entry1',
          leftIndicator: 'obv',
          operator: 'CROSSINGOVER',
          rightType: 'indicator',
          rightIndicator: 'obvSignal',
        },
        {
          id: 'c7_entry2',
          connector: 'AND',
          leftIndicator: 'volume',
          operator: '>',
          rightType: 'indicator',
          rightIndicator: 'avgVolume',
        },
      ],
      exitConditions: [
        {
          id: 'c7_exit',
          leftIndicator: 'obv',
          operator: 'CROSSINGUNDER',
          rightType: 'indicator',
          rightIndicator: 'obvSignal',
        },
      ],
      exitSizingType: 'DECREASE_PCT',
      exitSizingValue: 100,
      portfolioId,
    },
  ];
}

/**
 * Seeds preset sample strategies via API with localStorage fallback.
 */
export async function seedSampleBacktestStrategies(
  targetPortId: string | null,
  stocks: Stock[]
): Promise<void> {
  const samples = buildSampleBacktestStrategies(targetPortId, stocks);
  try {
    for (const s of samples) {
      await api.post('/api/strategies', {
        name: s.name,
        portfolio_id: targetPortId,
        scope: s.scope,
        target_symbol: s.targetSymbol,
        action: s.action,
        sizing_type: s.sizingType,
        sizing_value: s.sizingValue,
        conditions: s.conditions,
        enabled: s.enabled,
        frequency: s.frequency,
      });
    }
  } catch {
    const key = `portfolio_strategies_${targetPortId || 'global'}`;
    try {
      localStorage.setItem(key, JSON.stringify(samples));
    } catch {
      // Ignore storage quota errors
    }
  }
}

