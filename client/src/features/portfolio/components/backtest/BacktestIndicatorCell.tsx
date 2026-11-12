import type { BarIndicators } from '../../services/backtestService';

export interface IndicatorRowData {
  indicators?: BarIndicators;
  changePercent?: number;
  volume?: number;
}

interface BacktestIndicatorCellProps {
  type: string;
  data: IndicatorRowData | null;
  currencySymbol: string;
}

function formatCompactVolume(num: number): string {
  if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCurrencyValue(val: number, currencySymbol: string): string {
  return `${currencySymbol}${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a technical indicator value cell inside the day-candles simulation table.
 */
export function BacktestIndicatorCell({ type, data, currencySymbol }: BacktestIndicatorCellProps) {
  if (!data) return <span className="text-secondary">—</span>;

  const indicators = data.indicators;

  switch (type) {
    case 'rsi': {
      const val = indicators?.rsi;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      const num = Number(val);
      const isOversold = num <= 30;
      const isOverbought = num >= 70;
      const divergence = indicators?.rsiDivergence;
      return (
        <div className="inline-flex items-center gap-1.5">
          <span
            className={`font-mono font-semibold ${
              isOversold ? 'text-success' : isOverbought ? 'text-amber-500' : 'text-primary'
            }`}
          >
            {num.toFixed(2)}
          </span>
          {divergence === 'BULLISH' && (
            <span
              className="px-1 py-0.5 rounded text-[8px] font-sans font-semibold bg-success/20 text-success"
              title="Bullish Divergence: Price Lower Low while RSI Higher Low"
            >
              Bull Div ↗
            </span>
          )}
          {divergence === 'BEARISH' && (
            <span
              className="px-1 py-0.5 rounded text-[8px] font-sans font-semibold bg-danger/20 text-danger"
              title="Bearish Divergence: Price Higher High while RSI Lower High"
            >
              Bear Div ↘
            </span>
          )}
        </div>
      );
    }
    case 'dma50':
    case 'dma200':
    case 'ema20':
    case 'ema50':
    case 'ema200':
    case 'bbUpper':
    case 'bbMiddle':
    case 'bbLower':
    case 'vwap': {
      const val = indicators?.[type];
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      return (
        <span className="font-mono text-primary font-medium">
          {formatCurrencyValue(Number(val), currencySymbol)}
        </span>
      );
    }
    case 'macd':
    case 'macdSignal': {
      const val = indicators?.[type];
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      const num = Number(val);
      return (
        <span className={`font-mono font-semibold ${num >= 0 ? 'text-success' : 'text-danger'}`}>
          {num.toFixed(2)}
        </span>
      );
    }
    case 'macdHist': {
      const val = indicators?.macdHist;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      const num = Number(val);
      const sign = num > 0 ? '+' : '';
      return (
        <span className={`font-mono font-semibold ${num >= 0 ? 'text-success' : 'text-danger'}`}>
          {sign}
          {num.toFixed(2)}
        </span>
      );
    }
    case 'bbBandwidth': {
      const val = indicators?.bbBandwidth;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      return <span className="font-mono text-primary font-medium">{Number(val).toFixed(2)}%</span>;
    }
    case 'bbPercentB': {
      const val = indicators?.bbPercentB;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      const num = Number(val);
      return (
        <span
          className={`font-mono font-semibold ${
            num <= 0 ? 'text-success' : num >= 1 ? 'text-danger' : 'text-primary'
          }`}
        >
          {num.toFixed(2)}
        </span>
      );
    }
    case 'avgVolume':
    case 'volume': {
      const val = type === 'volume' ? data.volume : indicators?.avgVolume;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      return <span className="font-mono text-primary font-medium">{Number(val).toLocaleString()}</span>;
    }
    case 'changePct': {
      const val = data.changePercent;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      const num = Number(val);
      const sign = num > 0 ? '+' : '';
      return (
        <span
          className={`font-mono font-semibold ${
            num > 0 ? 'text-success' : num < 0 ? 'text-danger' : 'text-primary'
          }`}
        >
          {sign}
          {num.toFixed(2)}%
        </span>
      );
    }
    case 'obv': {
      const val = indicators?.obv;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      const num = Number(val);
      return (
        <span className={`font-mono font-medium ${num >= 0 ? 'text-primary' : 'text-danger'}`}>
          {formatCompactVolume(num)}
        </span>
      );
    }
    case 'obvSignal': {
      const val = indicators?.obvSignal;
      if (val === null || val === undefined) return <span className="text-secondary">—</span>;
      return (
        <span className="font-mono text-secondary font-medium">
          {formatCompactVolume(Number(val))}
        </span>
      );
    }
    default:
      return <span className="text-secondary">—</span>;
  }
}

