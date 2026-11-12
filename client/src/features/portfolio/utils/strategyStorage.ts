import { api } from '../../../services/api/client';
import { normalizeRule, type StrategyRule } from './strategyConfig';
import type { Portfolio, Stock } from '../hooks/usePortfolioData';

export type StrategyWithLegacyPortfolio = Omit<StrategyRule, 'portfolio_id'> & {
  portfolio_id?: string | null;
};

/**
 * Resolves the owning portfolio ID when it exists in the user's known portfolio set; otherwise null (global).
 */
export function resolveStrategyPortfolioId(
  rule: StrategyRule,
  knownPortfolioIds: Set<string>
): string | null {
  const pid = rule.portfolioId || (rule as StrategyWithLegacyPortfolio).portfolio_id || null;
  return pid && knownPortfolioIds.has(pid) ? pid : null;
}

/**
 * Canonical loader for saved strategies across the backend API and localStorage caches.
 */
export async function loadSavedStrategies(portfolios: Portfolio[]): Promise<StrategyRule[]> {
  const map = new Map<string, StrategyRule>();

  try {
    const data = await api.get('/api/strategies');
    if (Array.isArray(data)) {
      for (const raw of data) {
        if (!raw || raw.id === 'rule-default') continue;
        const norm = normalizeRule(raw);
        map.set(norm.id, norm);
      }
    }
  } catch (err) {
    console.warn('Could not load strategies from API, falling back to local cache:', err);
  }

  const localKeys = ['global', ...portfolios.map(p => p.id)];
  for (const suffix of localKeys) {
    try {
      const raw = localStorage.getItem(`portfolio_strategies_${suffix}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed) {
        if (!item || item.id === 'rule-default' || !item.id || map.has(item.id)) continue;
        const norm = normalizeRule(item);
        if (!norm.portfolioId && suffix !== 'global') {
          norm.portfolioId = suffix;
        }
        map.set(norm.id, norm);
      }
    } catch {
      // Ignore malformed localStorage cache entries
    }
  }

  return Array.from(map.values());
}

/**
 * Builds preset strategy templates used either as in-memory backtest templates or paused starter rules.
 */
export function buildStarterSampleStrategies(
  targetPortId: string | null,
  stocks: Stock[],
  options: { enabled?: boolean; idPrefix?: string } = {}
): StrategyRule[] {
  const { enabled = false, idPrefix = `rule-sample-${Date.now()}` } = options;
  const scopedStocks = targetPortId
    ? stocks.filter(s => s.portfolio_id === targetPortId)
    : stocks;
  const stockPool = scopedStocks.length > 0 ? scopedStocks : stocks;
  const primarySymbol = stockPool[0]?.symbol || 'RELIANCE.NS';
  const secondarySymbol = stockPool[1]?.symbol || primarySymbol || 'TCS.NS';
  const createdAt = new Date().toISOString();
  const portfolioId = targetPortId || undefined;

  return [
    {
      id: `${idPrefix}-rsi`,
      name: 'RSI Divergence & Oversold Reversal (14-period)',
      scope: 'stock',
      targetSymbol: primarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled,
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
      id: `${idPrefix}-golden-dma`,
      name: 'Golden Cross (50/200 DMA)',
      scope: 'stock',
      targetSymbol: secondarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 15,
      enabled,
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
      id: `${idPrefix}-golden-ema`,
      name: 'EMA Golden / Death Cross (50/200 EMA)',
      scope: 'stock',
      targetSymbol: primarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled,
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
      id: `${idPrefix}-macd`,
      name: 'MACD Momentum Crossover (12, 26, 9)',
      scope: 'stock',
      targetSymbol: primarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled,
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
      id: `${idPrefix}-bb`,
      name: 'Bollinger Band Mean Reversion (20, 2)',
      scope: 'stock',
      targetSymbol: secondarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled,
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
      id: `${idPrefix}-vwap`,
      name: 'VWAP Institutional Breakout',
      scope: 'stock',
      targetSymbol: primarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled,
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
      id: `${idPrefix}-obv`,
      name: 'OBV & Volume Breakout Confirmation',
      scope: 'stock',
      targetSymbol: primarySymbol,
      action: 'BUY',
      sizingType: 'QTY',
      sizingValue: 10,
      enabled,
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
 * Seeds paused starter strategy templates via API with localStorage fallback on StrategyPage.
 */
export async function seedStarterStrategies(
  targetPortId: string | null,
  stocks: Stock[]
): Promise<void> {
  const samples = buildStarterSampleStrategies(targetPortId, stocks, { enabled: false });
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
        entryConditions: s.entryConditions,
        exitConditions: s.exitConditions,
        exitSizingType: s.exitSizingType,
        exitSizingValue: s.exitSizingValue,
        enabled: false,
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
