import {
  BarMarketData,
  StrategyRule,
  BacktestTrade,
  DailyEquityPoint,
  SimulationOptions,
  SimulationResult,
} from './types';
import { evaluateRuleOnBar } from './signal-evaluator.service';

interface PendingOrder {
  action: 'BUY' | 'SELL';
  rule: StrategyRule;
  signalDate: string;
  reason: string;
}

interface PositionState {
  qty: number;
  avgPrice: number;
  totalCost: number;
  entryDate: string;
  entryReason: string;
}

/**
 * Executes a full backtest simulation bar-by-bar across historical daily data.
 *
 * Execution Model:
 * 1. Signals generated at bar t Close.
 * 2. Orders executed at bar t+1 Open with configurable slippage & transaction fees.
 * 3. Daily portfolio equity marked-to-market at bar Close.
 * 4. Maximum 1 execution per day enforced.
 */
export function runSimulation(
  symbol: string,
  bars: BarMarketData[],
  rules: StrategyRule[],
  options: SimulationOptions = {}
): SimulationResult {
  const initialCapital = options.initialCapital ?? 100000;
  const slippagePct = options.slippagePct ?? 0.0005; // 0.05% slippage
  const feePct = options.feePct ?? 0.001;           // 0.1% fees/taxes
  const nominalStartDate = options.nominalStartDate;
  const nominalEndDate = options.nominalEndDate;

  let cash = initialCapital;
  const position: PositionState = {
    qty: 0,
    avgPrice: 0,
    totalCost: 0,
    entryDate: '',
    entryReason: '',
  };

  const trades: BacktestTrade[] = [];
  const equityCurve: DailyEquityPoint[] = [];
  let pendingOrder: PendingOrder | null = null;
  let peakEquity = initialCapital;
  let benchmarkInitialQty = 0;

  // Find start index matching nominalStartDate (skipping warmup bars)
  let startIndex = 0;
  if (nominalStartDate) {
    const idx = bars.findIndex((b) => b.date >= nominalStartDate);
    if (idx !== -1) startIndex = idx;
  }

  for (let i = startIndex; i < bars.length; i++) {
    const bar = bars[i];
    const prevBar = i > 0 ? bars[i - 1] : undefined;

    if (nominalEndDate && bar.date > nominalEndDate) {
      break;
    }

    // =========================================================================
    // 1. EXECUTE PENDING ORDER AT TODAY'S OPEN
    // =========================================================================
    if (pendingOrder) {
      if (pendingOrder.action === 'BUY') {
        const execPrice = parseFloat((bar.open * (1 + slippagePct)).toFixed(2));
        const rule = pendingOrder.rule;

        // Determine target quantity based on sizingType
        let targetQty = 0;
        if (rule.sizingType === 'QTY') {
          targetQty = Math.floor(Number(rule.sizingValue));
        } else if (rule.sizingType === 'VALUE') {
          targetQty = Math.floor(Number(rule.sizingValue) / execPrice);
        } else if (rule.sizingType === 'INCREASE_PCT') {
          const pct = Number(rule.sizingValue) / 100;
          if (position.qty > 0) {
            targetQty = Math.floor(position.qty * pct);
          } else {
            targetQty = Math.floor((cash * pct) / execPrice);
          }
        } else {
          // Default fallback
          targetQty = Math.floor(Number(rule.sizingValue || 10));
        }

        // Cap targetQty by available cash (including fee)
        const feeMultiplier = 1 + feePct;
        const maxAffordable = Math.floor(cash / (execPrice * feeMultiplier));
        const fillQty = Math.min(targetQty, maxAffordable);

        if (fillQty > 0) {
          const grossCost = fillQty * execPrice;
          const fee = grossCost * feePct;
          const totalOutlay = grossCost + fee;
          cash -= totalOutlay;

          // Update position weighted average price
          const newTotalCost = position.totalCost + grossCost;
          const newQty = position.qty + fillQty;
          position.qty = newQty;
          position.avgPrice = newTotalCost / newQty;
          position.totalCost = newTotalCost;

          if (position.qty === fillQty) {
            position.entryDate = bar.date;
            position.entryReason = pendingOrder.reason;
          }
        }
      } else if (pendingOrder.action === 'SELL' && position.qty > 0) {
        const execPrice = parseFloat((bar.open * (1 - slippagePct)).toFixed(2));
        const rule = pendingOrder.rule;

        let sellQty = 0;
        if (rule.sizingType === 'DECREASE_PCT') {
          const pct = Math.min(100, Math.max(1, Number(rule.sizingValue))) / 100;
          sellQty = Math.min(position.qty, Math.max(1, Math.round(position.qty * pct)));
        } else if (rule.sizingType === 'QTY') {
          sellQty = Math.min(position.qty, Math.floor(Number(rule.sizingValue)));
        } else if (rule.sizingType === 'VALUE') {
          sellQty = Math.min(position.qty, Math.max(1, Math.floor(Number(rule.sizingValue) / execPrice)));
        } else {
          // Default sell all
          sellQty = position.qty;
        }

        if (sellQty > 0) {
          const grossProceeds = sellQty * execPrice;
          const fee = grossProceeds * feePct;
          const netProceeds = grossProceeds - fee;
          const costBasis = sellQty * position.avgPrice;
          const pnl = netProceeds - costBasis;
          const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

          cash += netProceeds;

          const d1 = new Date(position.entryDate).getTime();
          const d2 = new Date(bar.date).getTime();
          const holdingDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));

          trades.push({
            id: `trade_${trades.length + 1}`,
            symbol,
            entryDate: position.entryDate || bar.date,
            entryPrice: parseFloat(position.avgPrice.toFixed(2)),
            exitDate: bar.date,
            exitPrice: execPrice,
            qty: sellQty,
            totalCost: parseFloat(costBasis.toFixed(2)),
            totalProceeds: parseFloat(netProceeds.toFixed(2)),
            pnl: parseFloat(pnl.toFixed(2)),
            pnlPercent: parseFloat(pnlPercent.toFixed(2)),
            holdingPeriodDays: holdingDays,
            status: 'CLOSED',
            entryReason: position.entryReason || 'Strategy Buy',
            exitReason: pendingOrder.reason,
          });

          // Deduct from position
          const remQty = position.qty - sellQty;
          position.qty = remQty;
          position.totalCost = remQty * position.avgPrice;
        }
      }

      pendingOrder = null;
    }

    // =========================================================================
    // 2. MARK-TO-MARKET AT TODAY'S CLOSE
    // =========================================================================
    const holdingsVal = position.qty * bar.close;
    const currentEquity = cash + holdingsVal;
    peakEquity = Math.max(peakEquity, currentEquity);
    const ddPercent =
      peakEquity > 0
        ? parseFloat((((peakEquity - currentEquity) / peakEquity) * 100).toFixed(2))
        : 0;

    if (benchmarkInitialQty === 0 && bar.close > 0) {
      benchmarkInitialQty = initialCapital / bar.close;
    }
    const benchmarkEquity = parseFloat((benchmarkInitialQty * bar.close).toFixed(2));

    equityCurve.push({
      date: bar.date,
      equity: parseFloat(currentEquity.toFixed(2)),
      cash: parseFloat(cash.toFixed(2)),
      holdingsValue: parseFloat(holdingsVal.toFixed(2)),
      heldQty: position.qty,
      stockClose: bar.close,
      benchmarkEquity,
      drawdownPercent: ddPercent,
    });

    // =========================================================================
    // 3. EVALUATE STRATEGY RULES AT CLOSE (QUEUE PENDING ORDER FOR TOMORROW)
    // =========================================================================
    for (const rule of rules) {
      const evalRes = evaluateRuleOnBar(rule, bar, prevBar);
      if (evalRes.matched && evalRes.action !== 'NONE') {
        // Skip redundant signals
        if (evalRes.action === 'SELL' && position.qty <= 0) continue;
        if (evalRes.action === 'BUY' && cash < bar.close) continue;

        pendingOrder = {
          action: evalRes.action,
          rule,
          signalDate: bar.date,
          reason: evalRes.reason,
        };
        break; // Max 1 action queued per day
      }
    }
  }

  // Handle open position at simulation end
  const finalBar = bars[bars.length - 1];
  if (position.qty > 0 && finalBar) {
    const costBasis = position.qty * position.avgPrice;
    const currentVal = position.qty * finalBar.close;
    const unrealizedPnl = currentVal - costBasis;
    const unrealizedPnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
    const d1 = new Date(position.entryDate).getTime();
    const d2 = new Date(finalBar.date).getTime();
    const holdingDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));

    trades.push({
      id: `trade_${trades.length + 1}`,
      symbol,
      entryDate: position.entryDate,
      entryPrice: parseFloat(position.avgPrice.toFixed(2)),
      exitDate: finalBar.date,
      exitPrice: finalBar.close,
      qty: position.qty,
      totalCost: parseFloat(costBasis.toFixed(2)),
      totalProceeds: parseFloat(currentVal.toFixed(2)),
      pnl: parseFloat(unrealizedPnl.toFixed(2)),
      pnlPercent: parseFloat(unrealizedPnlPct.toFixed(2)),
      holdingPeriodDays: holdingDays,
      status: 'OPEN',
      entryReason: position.entryReason,
      exitReason: 'Simulation End (Mark-to-Market)',
    });
  }

  const finalEquity =
    equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : initialCapital;

  return {
    symbol,
    initialCapital,
    finalEquity,
    cash: parseFloat(cash.toFixed(2)),
    holdingsValue: parseFloat((position.qty * (finalBar?.close || 0)).toFixed(2)),
    heldQty: position.qty,
    trades,
    equityCurve,
  };
}
