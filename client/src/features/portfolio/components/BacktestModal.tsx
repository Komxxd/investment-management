import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Play,
  Loader2,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { type StrategyRule, normalizeRule } from './StrategyBuilderModal';
import {
  runBacktest,
  type BacktestResponse,
} from '../services/backtestService';
import { BacktestDateRangePicker } from './BacktestDateRangePicker';

interface BacktestModalProps {
  isOpen: boolean;
  onClose: () => void;
  rule: StrategyRule;
  stocks: Array<{ id: string; symbol: string; quantity: number; entry_price: number }>;
  currencySymbol?: string;
  portfolioId?: string;
  onBacktestCompleted?: (result: BacktestResponse) => void;
}

function formatDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function BacktestModal({
  isOpen,
  onClose,
  rule,
  stocks,
  currencySymbol = '₹',
  portfolioId,
  onBacktestCompleted,
}: BacktestModalProps) {
  const navigate = useNavigate();

  const normalizedRule = useMemo(() => normalizeRule(rule), [rule]);

  // Target stock resolved strictly from the strategy
  const targetStock = useMemo(() => {
    if (normalizedRule.targetSymbol && normalizedRule.targetSymbol !== 'ALL') {
      return normalizedRule.targetSymbol;
    }
    return stocks[0]?.symbol || 'RELIANCE.NS';
  }, [normalizedRule.targetSymbol, stocks]);

  // Default dates: From 1st of current month to today
  const defaultDates = useMemo(() => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: formatDateString(firstOfMonth),
      to: formatDateString(today),
    };
  }, []);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [rule]);

  if (!isOpen) return null;

  const handleExecuteBacktest = async () => {
    if (!targetStock) {
      setError('Please select or specify a valid stock in the strategy.');
      return;
    }

    const hasAnyConditions = (normalizedRule.entryConditions && normalizedRule.entryConditions.length > 0) ||
      (normalizedRule.exitConditions && normalizedRule.exitConditions.length > 0) ||
      (normalizedRule.conditions && normalizedRule.conditions.length > 0) ||
      (normalizedRule.stopLossPct !== undefined && normalizedRule.stopLossPct !== '' && normalizedRule.stopLossPct !== null) ||
      (normalizedRule.takeProfitPct !== undefined && normalizedRule.takeProfitPct !== '' && normalizedRule.takeProfitPct !== null);

    if (!hasAnyConditions) {
      setError('Strategy must have at least one condition or risk guard to backtest.');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const res = await runBacktest({
        symbol: targetStock,
        rules: [normalizedRule],
        startDate: fromDate,
        endDate: toDate,
        initialCapital: 0,
        slippagePct: 0,
        feePct: 0,
      });

      // Save latest session so the Backtest Results page can load smoothly on refresh
      const backtestSession = {
        result: res,
        rule: normalizedRule,
        portfolioId: portfolioId || null,
        timestamp: Date.now(),
      };
      localStorage.setItem('latest_backtest_session', JSON.stringify(backtestSession));

      if (onBacktestCompleted) {
        onBacktestCompleted(res);
      }

      onClose();

      // Navigate to dedicated Backtest Results page
      const targetUrl = portfolioId ? `/portfolio/${portfolioId}/backtest/results` : '/backtest/results';
      navigate(targetUrl, { state: backtestSession });
    } catch (err: any) {
      setError(err.message || 'Failed to complete backtest. Verify stock symbol and historical data.');
    } finally {
      setIsRunning(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
      {/* Compact Dialog matching Screenshot 2 */}
      <div className="bg-surface border border-divider rounded-2xl w-full max-w-[410px] overflow-hidden shadow-2xl flex flex-col text-primary">
        {/* Header (Screenshot 2 Match) */}
        <div className="px-5 py-3.5 border-b border-divider flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold tracking-wider uppercase text-primary">
              Run Backtest
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-secondary hover:text-primary rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3.5">
          {/* STRATEGY Section */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
              Strategy
            </label>
            <div className="p-2.5 rounded-xl bg-surface-hover/70 border border-divider flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="text-xs font-semibold text-primary truncate">
                  {rule.name || 'Untitled Strategy'}
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-surface border border-divider text-secondary shrink-0">
                {targetStock}
              </span>
            </div>
          </div>

          {/* FROM DATE / TO DATE Inputs and Calendar */}
          <BacktestDateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            onChangeFromDate={setFromDate}
            onChangeToDate={setToDate}
            targetSymbol={targetStock}
          />

          {/* Error Notice */}
          {error && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-500 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Backtest Failed</div>
                <div className="text-[11px] opacity-90">{error}</div>
              </div>
            </div>
          )}

          {/* Full-width Start Backtest Button matching Screenshot 2 */}
          <button
            type="button"
            onClick={handleExecuteBacktest}
            disabled={isRunning}
            className="w-full py-2.5 rounded-xl bg-primary text-background hover:opacity-90 font-bold text-xs tracking-wide shadow-xs transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Simulation...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Backtest</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
