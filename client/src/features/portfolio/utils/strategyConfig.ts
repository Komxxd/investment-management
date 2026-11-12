export type SizingType = 'QTY' | 'VALUE' | 'INCREASE_PCT' | 'DECREASE_PCT';
export type ActionType = 'BUY' | 'SELL' | 'ALERT';
export type IndicatorType =
  | 'rsi'
  | 'rsiBullishDiv'
  | 'rsiBearishDiv'
  | 'dma50'
  | 'dma200'
  | 'ema20'
  | 'ema50'
  | 'ema200'
  | 'macd'
  | 'macdSignal'
  | 'macdHist'
  | 'bbUpper'
  | 'bbMiddle'
  | 'bbLower'
  | 'bbBandwidth'
  | 'bbPercentB'
  | 'vwap'
  | 'volume'
  | 'avgVolume'
  | 'obv'
  | 'obvSignal'
  | 'price'
  | 'changePct';

export type ComparisonOperator =
  | '<'
  | '>'
  | '<='
  | '>='
  | 'CROSSINGOVER'
  | 'CROSSINGUNDER'
  | 'BULLISH_DIVERGENCE'
  | 'BEARISH_DIVERGENCE'
  | '==';

export type LogicalConnector = 'AND' | 'OR';

export interface StrategyCondition {
  id: string;
  connector?: LogicalConnector;
  leftIndicator: IndicatorType | '';
  operator: ComparisonOperator | '';
  rightType: 'value' | 'indicator';
  rightValue?: number | '';
  rightIndicator?: IndicatorType | '';
}

export interface StrategyRule {
  id: string;
  portfolioId?: string;
  portfolio_id?: string;
  name: string;
  scope: 'global' | 'stock';
  targetSymbol?: string;
  action?: ActionType | '';
  sizingType?: SizingType | '';
  sizingValue?: number | '';
  conditions: StrategyCondition[];
  entryConditions?: StrategyCondition[];
  entrySizingType?: SizingType | '';
  entrySizingValue?: number | '';
  exitConditions?: StrategyCondition[];
  exitSizingType?: SizingType | '';
  exitSizingValue?: number | '';
  stopLossPct?: number | '';
  takeProfitPct?: number | '';
  enabled: boolean;
  createdAt: string;
  frequency: 'daily' | 'realtime';
}

export const BLANK_RULE: StrategyRule = {
  id: '',
  name: '',
  scope: 'global',
  targetSymbol: 'ALL',
  action: 'BUY',
  sizingType: 'QTY',
  sizingValue: 10,
  conditions: [],
  entryConditions: [],
  entrySizingType: 'QTY',
  entrySizingValue: 10,
  exitConditions: [],
  exitSizingType: 'DECREASE_PCT',
  exitSizingValue: 100,
  stopLossPct: '',
  takeProfitPct: '',
  enabled: true,
  createdAt: '',
  frequency: 'daily',
};

export const LEFT_INDICATOR_OPTIONS: Array<{ value: IndicatorType; label: string }> = [
  { value: 'rsi', label: 'RSI(14, day)' },
  { value: 'rsiBullishDiv', label: 'RSI Bullish Divergence' },
  { value: 'rsiBearishDiv', label: 'RSI Bearish Divergence' },
  { value: 'dma50', label: 'DMA(50)' },
  { value: 'dma200', label: 'DMA(200)' },
  { value: 'ema20', label: 'EMA(20)' },
  { value: 'ema50', label: 'EMA(50)' },
  { value: 'ema200', label: 'EMA(200)' },
  { value: 'macd', label: 'MACD Line (12, 26)' },
  { value: 'macdSignal', label: 'MACD Signal (9)' },
  { value: 'macdHist', label: 'MACD Histogram' },
  { value: 'bbUpper', label: 'BB Upper (20, 2)' },
  { value: 'bbMiddle', label: 'BB Middle (20 SMA)' },
  { value: 'bbLower', label: 'BB Lower (20, 2)' },
  { value: 'bbBandwidth', label: 'BB Bandwidth %' },
  { value: 'bbPercentB', label: 'BB %B' },
  { value: 'vwap', label: 'VWAP' },
  { value: 'volume', label: 'Candle Volume' },
  { value: 'avgVolume', label: '20-Period Avg Volume' },
  { value: 'obv', label: 'OBV (On-Balance Volume)' },
  { value: 'obvSignal', label: 'OBV Signal (20 SMA)' },
  { value: 'price', label: 'Current Price' },
  { value: 'changePct', label: 'Day Change %' },
];

export const RIGHT_INDICATOR_OPTIONS: Array<{ value: IndicatorType; label: string }> = [
  { value: 'dma200', label: 'DMA(200)' },
  { value: 'dma50', label: 'DMA(50)' },
  { value: 'ema200', label: 'EMA(200)' },
  { value: 'ema50', label: 'EMA(50)' },
  { value: 'ema20', label: 'EMA(20)' },
  { value: 'macd', label: 'MACD Line (12, 26)' },
  { value: 'macdSignal', label: 'MACD Signal (9)' },
  { value: 'macdHist', label: 'MACD Histogram' },
  { value: 'bbUpper', label: 'BB Upper (20, 2)' },
  { value: 'bbMiddle', label: 'BB Middle (20 SMA)' },
  { value: 'bbLower', label: 'BB Lower (20, 2)' },
  { value: 'bbBandwidth', label: 'BB Bandwidth %' },
  { value: 'bbPercentB', label: 'BB %B' },
  { value: 'vwap', label: 'VWAP' },
  { value: 'volume', label: 'Candle Volume' },
  { value: 'avgVolume', label: '20-Period Avg Volume' },
  { value: 'obv', label: 'OBV (On-Balance Volume)' },
  { value: 'obvSignal', label: 'OBV Signal (20 SMA)' },
  { value: 'rsi', label: 'RSI(14)' },
  { value: 'price', label: 'Current Price' },
];

export const OPERATOR_OPTIONS: Array<{ value: ComparisonOperator; label: string }> = [
  { value: '<', label: '<' },
  { value: '>', label: '>' },
  { value: '<=', label: '<=' },
  { value: '>=', label: '>=' },
  { value: 'CROSSINGOVER', label: 'CROSSINGOVER' },
  { value: 'CROSSINGUNDER', label: 'CROSSINGUNDER' },
  { value: 'BULLISH_DIVERGENCE', label: 'BULLISH DIVERGENCE' },
  { value: 'BEARISH_DIVERGENCE', label: 'BEARISH DIVERGENCE' },
  { value: '==', label: '==' },
];

const INDICATOR_FORMULA_LABELS: Record<IndicatorType, string> = {
  rsi: 'RSI(day)',
  rsiBullishDiv: 'RSI Bullish Div',
  rsiBearishDiv: 'RSI Bearish Div',
  dma50: 'DMA(50)',
  dma200: 'DMA(200)',
  ema20: 'EMA(20)',
  ema50: 'EMA(50)',
  ema200: 'EMA(200)',
  macd: 'MACD(12,26)',
  macdSignal: 'MACD Signal(9)',
  macdHist: 'MACD Hist',
  bbUpper: 'BB Upper(20,2)',
  bbMiddle: 'BB Middle(20)',
  bbLower: 'BB Lower(20,2)',
  bbBandwidth: 'BB Bandwidth%',
  bbPercentB: 'BB %B',
  vwap: 'VWAP',
  volume: 'VOLUME',
  avgVolume: 'AVG VOL(20)',
  obv: 'OBV',
  obvSignal: 'OBV Signal(20)',
  price: 'PRICE',
  changePct: 'CHANGE%',
};

interface StructuredRawConditions {
  entry?: StrategyCondition[];
  exit?: StrategyCondition[];
  entrySizingType?: SizingType | '';
  entrySizingValue?: number | '';
  exitSizingType?: SizingType | '';
  exitSizingValue?: number | '';
  stopLossPct?: number | '';
  takeProfitPct?: number | '';
}

export function normalizeRule(r: StrategyRule): StrategyRule {
  if (!r) return BLANK_RULE;

  const rawConditions = r.conditions as StrategyCondition[] | StructuredRawConditions | undefined;
  const structured =
    rawConditions && !Array.isArray(rawConditions) ? (rawConditions as StructuredRawConditions) : undefined;

  let entryConds: StrategyCondition[] = [];
  if (Array.isArray(r.entryConditions) && r.entryConditions.length > 0) {
    entryConds = r.entryConditions;
  } else if (structured && Array.isArray(structured.entry) && structured.entry.length > 0) {
    entryConds = structured.entry;
  } else if (r.action !== 'SELL' && Array.isArray(rawConditions) && rawConditions.length > 0) {
    entryConds = rawConditions;
  }

  let exitConds: StrategyCondition[] = [];
  if (Array.isArray(r.exitConditions) && r.exitConditions.length > 0) {
    exitConds = r.exitConditions;
  } else if (structured && Array.isArray(structured.exit) && structured.exit.length > 0) {
    exitConds = structured.exit;
  } else if (r.action === 'SELL' && Array.isArray(rawConditions) && rawConditions.length > 0) {
    exitConds = rawConditions;
  }

  const entrySizingType = r.entrySizingType || structured?.entrySizingType || r.sizingType || 'QTY';
  const entrySizingValue =
    r.entrySizingValue !== undefined && r.entrySizingValue !== ''
      ? r.entrySizingValue
      : structured?.entrySizingValue !== undefined && structured.entrySizingValue !== ''
        ? structured.entrySizingValue
        : r.sizingValue !== '' && r.sizingValue !== undefined
          ? r.sizingValue
          : 10;

  const exitSizingType = r.exitSizingType || structured?.exitSizingType || 'DECREASE_PCT';
  const exitSizingValue =
    r.exitSizingValue !== undefined && r.exitSizingValue !== ''
      ? r.exitSizingValue
      : structured?.exitSizingValue !== undefined && structured.exitSizingValue !== ''
        ? structured.exitSizingValue
        : 100;

  const stopLossPct = r.stopLossPct ?? structured?.stopLossPct ?? '';
  const takeProfitPct = r.takeProfitPct ?? structured?.takeProfitPct ?? '';

  return {
    ...r,
    entryConditions: entryConds,
    entrySizingType,
    entrySizingValue,
    exitConditions: exitConds,
    exitSizingType,
    exitSizingValue,
    stopLossPct,
    takeProfitPct,
    conditions: entryConds.length > 0 ? entryConds : exitConds,
  };
}

export function formatRuleFormula(rule: StrategyRule): string {
  if (!rule) return 'Configure Entry (BUY) and Exit (SELL) parameters above to preview formula';

  const formatIndicator = (ind?: IndicatorType | '') =>
    ind ? INDICATOR_FORMULA_LABELS[ind] || ind : '[INDICATOR]';

  const formatConds = (conds: StrategyCondition[]) =>
    conds
      .map((cond, idx) => {
        const conn = idx > 0 ? ` ${cond.connector || 'AND'} ` : '';
        const left = formatIndicator(cond.leftIndicator);
        const op = cond.operator || '[OP]';

        if (op === 'BULLISH_DIVERGENCE') return `${conn}${left} HAS BULLISH DIVERGENCE`;
        if (op === 'BEARISH_DIVERGENCE') return `${conn}${left} HAS BEARISH DIVERGENCE`;

        const right =
          cond.rightType === 'indicator'
            ? formatIndicator(cond.rightIndicator)
            : cond.rightValue !== '' && cond.rightValue !== undefined
              ? String(cond.rightValue)
              : '[VALUE]';

        const opFormatted = op === 'CROSSINGOVER' || op === 'CROSSINGUNDER' ? ` ${op} ` : op;
        return `${conn}${left}${opFormatted.startsWith(' ') ? '' : ' '}${opFormatted}${opFormatted.endsWith(' ') ? '' : ' '}${right}`;
      })
      .join('');

  const formatSizing = (sType?: string, sVal?: number | '' | null) => {
    const val = sVal !== '' && sVal !== undefined && sVal !== null ? sVal : '?';
    if (sType === 'QTY') return `QTY(${val})`;
    if (sType === 'VALUE') return `VALUE(${val})`;
    if (sType === 'INCREASE_PCT') return `INCREASE%(${val})`;
    if (sType === 'DECREASE_PCT') return `DECREASE%(${val})`;
    if (sVal !== '' && sVal !== undefined && sVal !== null) return `(${sVal})`;
    return '[SIZING]';
  };

  const norm = normalizeRule(rule);
  const target = norm.scope === 'global' ? 'ALL_PORTFOLIO' : norm.targetSymbol || 'TARGET';
  const entryConds = norm.entryConditions || [];
  const exitConds = norm.exitConditions || [];

  const parts: string[] = [];

  const hasEntry =
    entryConds.length > 0 ||
    (norm.entrySizingValue !== '' && norm.entrySizingValue !== undefined && norm.entrySizingValue !== null);
  if (hasEntry) {
    const entrySizing = formatSizing(norm.entrySizingType, norm.entrySizingValue);
    const condStr = entryConds.length > 0 ? ` IF ${formatConds(entryConds)}` : '';
    parts.push(`BUY ${target} ${entrySizing}${condStr}`);
  }

  const hasExit =
    exitConds.length > 0 ||
    (norm.stopLossPct !== '' && norm.stopLossPct !== undefined && norm.stopLossPct !== null) ||
    (norm.takeProfitPct !== '' && norm.takeProfitPct !== undefined && norm.takeProfitPct !== null);
  if (hasExit) {
    const exitSizing = formatSizing(norm.exitSizingType, norm.exitSizingValue);
    const condStr = exitConds.length > 0 ? ` IF ${formatConds(exitConds)}` : '';
    let riskStr = '';
    if (norm.stopLossPct) riskStr += ` [SL -${norm.stopLossPct}%]`;
    if (norm.takeProfitPct) riskStr += ` [TP +${norm.takeProfitPct}%]`;
    parts.push(`SELL ${exitSizing}${condStr}${riskStr}`);
  }

  return parts.length > 0
    ? parts.join(' | ')
    : 'Configure Entry (BUY) and Exit (SELL) parameters above to preview formula';
}

