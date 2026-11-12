import type { SupabaseClient } from '@supabase/supabase-js';
import type { StrategyCondition, StrategyRule } from '../backtest/types';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type StrategyLogEventType =
  | 'STRATEGY_STARTED'
  | 'STRATEGY_PAUSED'
  | 'STRATEGY_RESUMED'
  | 'SIGNAL_TRIGGERED'
  | 'ACTION_EXECUTED';

export interface PersistedStrategyRule extends StrategyRule {
  id: string;
  userId: string;
  portfolioId: string | null;
  portfolio_id: string | null;
  name: string;
  scope: 'global' | 'stock';
  targetSymbol: string;
  enabled: boolean;
  frequency: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WriteStrategyLogInput {
  userId: string;
  portfolioId?: string | null;
  strategyId?: string | null;
  strategyName?: string | null;
  symbol: string;
  eventType: StrategyLogEventType;
  actionText: string;
  signal?: string | null;
  eventDate?: string;
  metadata?: Record<string, any>;
}

export interface ExecuteStrategyTradeInput {
  userId: string;
  portfolioId: string;
  strategyId?: string | null;
  strategyName?: string | null;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executionDate?: string;
  automated?: boolean;
  reason?: string | null;
}

export interface ExecuteStrategyTradeResult {
  alreadyExecuted: boolean;
  execution: ReturnType<typeof formatExecution>;
  trade: any;
  log: any;
}

export function isMissingTableError(error: any): boolean {
  const msg = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

export function getTodayUtcDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function isIndianSymbol(symbol: string): boolean {
  const upper = (symbol || '').trim().toUpperCase();
  return (
    upper.endsWith('.NS') ||
    upper.endsWith('.BO') ||
    upper.startsWith('^NSE') ||
    upper.startsWith('^BSE')
  );
}

export function formatCurrencyPrice(symbol: string, price: number): string {
  const prefix = isIndianSymbol(symbol) ? '₹' : '$';
  const formatted = Number(price || 0).toLocaleString(isIndianSymbol(symbol) ? 'en-IN' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${prefix}${formatted}`;
}

export function formatExecution(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    portfolio_id: row.portfolio_id,
    strategyId: row.strategy_id,
    strategyName: row.strategy_name,
    symbol: row.symbol,
    action: row.action,
    quantity: Number(row.quantity),
    price: Number(row.price),
    executionDate: row.execution_date,
    executedAt: row.executed_at,
    timestamp: row.executed_at ? new Date(row.executed_at).getTime() : Date.now(),
  };
}

export function formatStrategyLogRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    portfolio_id: row.portfolio_id,
    strategyId: row.strategy_id,
    strategyName: row.strategy_name,
    symbol: row.symbol,
    eventType: row.event_type,
    actionText: row.action_text,
    signal: row.signal ?? null,
    eventDate: row.event_date,
    loggedAt: row.logged_at,
    metadata: row.metadata || {},
  };
}

export function formatStrategyRow(row: any): PersistedStrategyRule {
  const rawConds = row?.conditions;
  const isStructured = rawConds && !Array.isArray(rawConds) && typeof rawConds === 'object';

  const entryConditions: StrategyCondition[] = isStructured
    ? Array.isArray(rawConds.entry)
      ? rawConds.entry
      : []
    : Array.isArray(rawConds) && row?.action !== 'SELL'
      ? rawConds
      : [];

  const exitConditions: StrategyCondition[] = isStructured
    ? Array.isArray(rawConds.exit)
      ? rawConds.exit
      : []
    : Array.isArray(rawConds) && row?.action === 'SELL'
      ? rawConds
      : [];

  const sizingType = row?.sizing_type || 'QTY';
  const sizingValue = row?.sizing_value !== null && row?.sizing_value !== undefined ? Number(row.sizing_value) : '';

  const entrySizingType = (isStructured && rawConds.entrySizingType) || sizingType;
  const entrySizingValue =
    isStructured && rawConds.entrySizingValue !== undefined && rawConds.entrySizingValue !== null && rawConds.entrySizingValue !== ''
      ? Number(rawConds.entrySizingValue)
      : sizingValue;

  const exitSizingType = (isStructured && rawConds.exitSizingType) || 'DECREASE_PCT';
  const exitSizingValue =
    isStructured && rawConds.exitSizingValue !== undefined && rawConds.exitSizingValue !== null && rawConds.exitSizingValue !== ''
      ? Number(rawConds.exitSizingValue)
      : 100;

  return {
    id: row.id,
    userId: row.user_id,
    portfolioId: row.portfolio_id ?? null,
    portfolio_id: row.portfolio_id ?? null,
    name: row.name || 'Untitled Strategy',
    scope: row.scope === 'stock' ? 'stock' : 'global',
    targetSymbol: row.target_symbol || 'ALL',
    action: row.action === 'SELL' ? 'SELL' : 'BUY',
    sizingType,
    sizingValue,
    conditions: entryConditions.length > 0 ? entryConditions : exitConditions,
    entryConditions,
    entrySizingType,
    entrySizingValue,
    exitConditions,
    exitSizingType,
    exitSizingValue,
    stopLossPct: isStructured ? (rawConds.stopLossPct ?? '') : '',
    takeProfitPct: isStructured ? (rawConds.takeProfitPct ?? '') : '',
    enabled: Boolean(row.enabled),
    frequency: row.frequency || 'daily',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Inserts a lifecycle or execution log row into strategy_logs.
 * Handles FK races (23503), daily signal dedupe unique constraint (23505), and unmigrated tables cleanly.
 */
export async function writeStrategyLog(
  supabase: SupabaseClient<any, any, any>,
  input: WriteStrategyLogInput
) {
  const validPortfolioId =
    input.portfolioId && UUID_REGEX.test(String(input.portfolioId)) ? String(input.portfolioId) : null;
  const validStrategyId =
    input.strategyId && UUID_REGEX.test(String(input.strategyId)) ? String(input.strategyId) : null;
  const validEventDate =
    input.eventDate && DATE_REGEX.test(input.eventDate) ? input.eventDate : getTodayUtcDate();

  const buildPayload = (strategyIdValue: string | null) => ({
    user_id: input.userId,
    portfolio_id: validPortfolioId,
    strategy_id: strategyIdValue,
    strategy_name: input.strategyName || null,
    symbol: String(input.symbol || 'ALL').trim().toUpperCase(),
    event_type: input.eventType,
    action_text: input.actionText,
    signal: input.signal ?? null,
    event_date: validEventDate,
    metadata: input.metadata || {},
  });

  let { data, error } = await supabase
    .from('strategy_logs')
    .insert([buildPayload(validStrategyId)])
    .select()
    .single();

  if (error?.code === '23503' && validStrategyId) {
    const retryRes = await supabase
      .from('strategy_logs')
      .insert([buildPayload(null)])
      .select()
      .single();
    data = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    if (error.code === '23505') {
      return { log: null, duplicate: true, missingTable: false };
    }
    if (isMissingTableError(error)) {
      return { log: null, duplicate: false, missingTable: true };
    }
    throw new Error(error.message || 'Failed to write strategy log');
  }

  return { log: formatStrategyLogRow(data), duplicate: false, missingTable: false };
}

export async function recordSignalTriggeredLog(
  supabase: SupabaseClient<any, any, any>,
  params: {
    userId: string;
    portfolioId: string;
    strategyId?: string | null;
    strategyName?: string | null;
    symbol: string;
    signal: 'BUY' | 'SELL';
    price: number;
    eventDate: string;
    automated?: boolean;
    reason?: string | null;
  }
) {
  const actionText = `${params.signal} signal came${params.strategyName ? ` (${params.strategyName})` : ''}${
    params.reason ? ` — ${params.reason}` : ''
  }`;

  return writeStrategyLog(supabase, {
    userId: params.userId,
    portfolioId: params.portfolioId,
    strategyId: params.strategyId,
    strategyName: params.strategyName,
    symbol: params.symbol,
    eventType: 'SIGNAL_TRIGGERED',
    actionText,
    signal: params.signal,
    eventDate: params.eventDate,
    metadata: {
      signal: params.signal,
      price: params.price,
      automated: Boolean(params.automated),
      ...(params.reason ? { reason: params.reason } : {}),
    },
  });
}

/**
 * Atomically enforces once-per-day per-stock execution lock, creates the BUY/SELL lot,
 * rolls back the lock on trade failure, and writes an ACTION_EXECUTED audit log.
 */
export async function executeStrategyTrade(
  supabase: SupabaseClient<any, any, any>,
  input: ExecuteStrategyTradeInput
): Promise<ExecuteStrategyTradeResult> {
  if (!input.portfolioId || !UUID_REGEX.test(input.portfolioId)) {
    throw new Error('Valid portfolio_id is required to execute strategy trade');
  }

  const normalizedSymbol = (input.symbol || '').trim().toUpperCase();
  if (!normalizedSymbol) {
    throw new Error('Symbol is required to execute strategy trade');
  }

  const numQty = Number(input.quantity);
  const numPrice = Number(input.price);
  if (!Number.isFinite(numQty) || numQty <= 0) {
    throw new Error('Trade quantity must be a positive number');
  }
  if (!Number.isFinite(numPrice) || numPrice < 0) {
    throw new Error('Trade price must be non-negative');
  }

  const execDate =
    input.executionDate && DATE_REGEX.test(input.executionDate) ? input.executionDate : getTodayUtcDate();
  const validStrategyId =
    input.strategyId && UUID_REGEX.test(String(input.strategyId)) ? String(input.strategyId) : null;

  const lockPayload = (strategyIdValue: string | null) => ({
    user_id: input.userId,
    portfolio_id: input.portfolioId,
    strategy_id: strategyIdValue,
    strategy_name: input.strategyName || null,
    symbol: normalizedSymbol,
    action: input.action,
    quantity: numQty,
    price: numPrice,
    execution_date: execDate,
  });

  let { data: execRow, error: lockErr } = await supabase
    .from('strategy_executions')
    .insert([lockPayload(validStrategyId)])
    .select()
    .single();

  if (lockErr?.code === '23503' && validStrategyId) {
    const retry = await supabase
      .from('strategy_executions')
      .insert([lockPayload(null)])
      .select()
      .single();
    execRow = retry.data;
    lockErr = retry.error;
  }

  if (lockErr) {
    if (lockErr.code === '23505') {
      return { alreadyExecuted: true, execution: null, trade: null, log: null };
    }
    throw new Error(lockErr.message || 'Failed to acquire strategy execution lock');
  }

  let tradeRow: any = null;
  let tradeErr: any = null;

  if (input.action === 'BUY') {
    const buyRes = await supabase
      .from('stocks')
      .insert([
        {
          portfolio_id: input.portfolioId,
          user_id: input.userId,
          symbol: normalizedSymbol,
          quantity: numQty,
          entry_price: numPrice,
          brokerage: 0,
          govt_tax: 0,
          entry_date: execDate,
        },
      ])
      .select()
      .single();
    tradeRow = buyRes.data;
    tradeErr = buyRes.error;
  } else {
    const sellRes = await supabase
      .from('sold_stocks')
      .insert([
        {
          portfolio_id: input.portfolioId,
          user_id: input.userId,
          symbol: normalizedSymbol,
          quantity: numQty,
          exit_price: numPrice,
          brokerage: 0,
          govt_tax: 0,
          exit_date: execDate,
        },
      ])
      .select()
      .single();
    tradeRow = sellRes.data;
    tradeErr = sellRes.error;
  }

  if (tradeErr) {
    // Release today's execution lock so a transient failure doesn't leave an orphaned lock without a lot
    await supabase.from('strategy_executions').delete().eq('id', execRow.id);
    throw new Error(tradeErr.message || `Failed to create ${input.action} lot`);
  }

  const autoTag = input.automated ? ' (Auto)' : '';
  const sign = input.action === 'BUY' ? '+' : '-';
  const actionText = `${input.action} executed${autoTag}: ${sign}${numQty} shares @ ${formatCurrencyPrice(
    normalizedSymbol,
    numPrice
  )}${input.strategyName ? ` via ${input.strategyName}` : ''}`;

  let logResult: any = null;
  try {
    const logged = await writeStrategyLog(supabase, {
      userId: input.userId,
      portfolioId: input.portfolioId,
      strategyId: validStrategyId,
      strategyName: input.strategyName,
      symbol: normalizedSymbol,
      eventType: 'ACTION_EXECUTED',
      actionText,
      signal: input.action,
      eventDate: execDate,
      metadata: {
        action: input.action,
        quantity: numQty,
        price: numPrice,
        tradeId: tradeRow?.id || null,
        executionId: execRow.id,
        automated: Boolean(input.automated),
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });
    logResult = logged.log;
  } catch (logErr: any) {
    // Never fail an already-committed trade solely because audit logging encountered an issue
    console.warn('[StrategyExecution] Action executed but failed to write ACTION_EXECUTED log:', logErr.message);
  }

  return {
    alreadyExecuted: false,
    execution: formatExecution(execRow),
    trade: tradeRow,
    log: logResult,
  };
}

