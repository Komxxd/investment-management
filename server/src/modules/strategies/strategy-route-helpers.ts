import {
  UUID_REGEX,
  isMissingTableError,
  getTodayUtcDate,
} from './strategy-execution.service';

export type StrategyLogEventType =
  | 'STRATEGY_STARTED'
  | 'STRATEGY_PAUSED'
  | 'STRATEGY_RESUMED'
  | 'SIGNAL_TRIGGERED'
  | 'ACTION_EXECUTED';

export interface StrategyLogInput {
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

export function formatStrategyLog(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    portfolioId: row.portfolio_id || null,
    strategyId: row.strategy_id || null,
    strategyName: row.strategy_name || null,
    symbol: row.symbol,
    eventType: row.event_type as StrategyLogEventType,
    actionText: row.action_text,
    signal: row.signal || null,
    eventDate: row.event_date || null,
    loggedAt: row.logged_at,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    source: 'db',
  };
}

export async function writeRouteStrategyLog(
  supabase: any,
  input: StrategyLogInput
): Promise<{ row: any; missingTable: boolean; alreadyRecorded?: boolean; needsSchemaUpdate?: boolean }> {
  const validStrategyId =
    input.strategyId && UUID_REGEX.test(String(input.strategyId))
      ? String(input.strategyId)
      : null;

  const validPortfolioId =
    input.portfolioId && UUID_REGEX.test(String(input.portfolioId))
      ? String(input.portfolioId)
      : null;

  const payload = {
    user_id: input.userId,
    portfolio_id: validPortfolioId,
    strategy_id: validStrategyId,
    strategy_name: input.strategyName || null,
    symbol: input.symbol,
    event_type: input.eventType,
    action_text: input.actionText,
    signal: input.signal || null,
    event_date: input.eventDate || getTodayUtcDate(),
    metadata: input.metadata || {},
  };

  let { data, error } = await supabase
    .from('strategy_logs')
    .insert([payload])
    .select()
    .single();

  if (error?.code === '23503' && payload.strategy_id) {
    const retry = await supabase
      .from('strategy_logs')
      .insert([{ ...payload, strategy_id: null }])
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (error.code === '23505') {
      return { row: null, missingTable: false, alreadyRecorded: true };
    }
    if (error.code === '23502' || error.code === '23514') {
      return { row: null, missingTable: true, needsSchemaUpdate: true };
    }
    if (isMissingTableError(error)) {
      return { row: null, missingTable: true };
    }
    throw error;
  }

  return { row: data, missingTable: false };
}

export async function recordStrategyToggleLog(
  supabase: any,
  userId: string,
  strategyRow: any,
  previousEnabled: boolean,
  nextEnabled: boolean,
  fallbackPortfolioId?: string | null
): Promise<{ lifecycleLog: any; lifecycleLogPersisted: boolean }> {
  if (!strategyRow || previousEnabled === nextEnabled) {
    return { lifecycleLog: null, lifecycleLogPersisted: true };
  }

  const eventType: StrategyLogEventType = nextEnabled ? 'STRATEGY_RESUMED' : 'STRATEGY_PAUSED';
  const strategyName = strategyRow.name || 'Untitled Strategy';
  const symbol = strategyRow.target_symbol || 'ALL';
  const actionText = nextEnabled
    ? `Strategy "${strategyName}" resumed`
    : `Strategy "${strategyName}" paused`;
  const metadata = {
    scope: strategyRow.scope || 'global',
    enabled: nextEnabled,
  };

  const buildFallbackLog = (pid: string | null) => ({
    id: `local-${eventType.toLowerCase()}-${strategyRow.id}-${Date.now()}`,
    portfolioId: pid,
    strategyId: strategyRow.id,
    strategyName,
    symbol,
    eventType,
    actionText,
    signal: null,
    eventDate: getTodayUtcDate(),
    loggedAt: new Date().toISOString(),
    metadata,
    source: 'local',
  });

  try {
    let result = await writeRouteStrategyLog(supabase, {
      userId,
      portfolioId: strategyRow.portfolio_id || null,
      strategyId: strategyRow.id,
      strategyName,
      symbol,
      eventType,
      actionText,
      metadata,
    });

    if (
      result.needsSchemaUpdate &&
      !strategyRow.portfolio_id &&
      fallbackPortfolioId &&
      UUID_REGEX.test(String(fallbackPortfolioId))
    ) {
      result = await writeRouteStrategyLog(supabase, {
        userId,
        portfolioId: String(fallbackPortfolioId),
        strategyId: strategyRow.id,
        strategyName,
        symbol,
        eventType,
        actionText,
        metadata,
      });
    }

    if (result.row) {
      return { lifecycleLog: formatStrategyLog(result.row), lifecycleLogPersisted: true };
    }

    return {
      lifecycleLog: buildFallbackLog(strategyRow.portfolio_id || fallbackPortfolioId || null),
      lifecycleLogPersisted: false,
    };
  } catch (logErr) {
    console.warn('Non-fatal strategy_logs toggle write error:', logErr);
    return {
      lifecycleLog: buildFallbackLog(strategyRow.portfolio_id || fallbackPortfolioId || null),
      lifecycleLogPersisted: false,
    };
  }
}

export function buildStructuredConditions(
  body: Record<string, any>,
  fallbackSizingType: string | undefined,
  fallbackSizingValue: number | null | undefined,
  routeSellConditionsToExit: boolean
) {
  const rawEntry = body.entryConditions || body.entry_conditions;
  const rawExit = body.exitConditions || body.exit_conditions;
  const conditions = body.conditions;

  const resolvedEntry = Array.isArray(rawEntry)
    ? rawEntry
    : Array.isArray(conditions) && !routeSellConditionsToExit
      ? conditions
      : [];

  const resolvedExit = Array.isArray(rawExit)
    ? rawExit
    : Array.isArray(conditions) && routeSellConditionsToExit
      ? conditions
      : [];

  return {
    entry: resolvedEntry,
    exit: resolvedExit,
    entrySizingType: body.entrySizingType || body.entry_sizing_type || fallbackSizingType || 'QTY',
    entrySizingValue: body.entrySizingValue !== undefined ? body.entrySizingValue : fallbackSizingValue,
    exitSizingType: body.exitSizingType || body.exit_sizing_type || 'DECREASE_PCT',
    exitSizingValue: body.exitSizingValue !== undefined ? body.exitSizingValue : 100,
    stopLossPct: body.stopLossPct ?? body.stop_loss_pct ?? '',
    takeProfitPct: body.takeProfitPct ?? body.take_profit_pct ?? '',
  };
}

/**
 * Normalizes a portfolio_strategies database row into backward-compatible client fields.
 */
export function formatStrategyResponse(row: any) {
  if (!row) return null;
  const rawConditions = row.conditions;
  let conditions: any[] = [];
  let entryConditions: any[] = [];
  let exitConditions: any[] = [];
  let entrySizingType = row.sizing_type || 'QTY';
  let entrySizingValue = row.sizing_value !== null && row.sizing_value !== undefined ? Number(row.sizing_value) : '';
  let exitSizingType = 'DECREASE_PCT';
  let exitSizingValue: any = 100;
  let stopLossPct: any = '';
  let takeProfitPct: any = '';

  if (Array.isArray(rawConditions)) {
    conditions = rawConditions;
    if (row.action === 'SELL') {
      exitConditions = rawConditions;
      exitSizingType = row.sizing_type || 'DECREASE_PCT';
      exitSizingValue = row.sizing_value !== null ? Number(row.sizing_value) : 100;
    } else {
      entryConditions = rawConditions;
    }
  } else if (rawConditions && typeof rawConditions === 'object') {
    entryConditions = Array.isArray(rawConditions.entry) ? rawConditions.entry : [];
    exitConditions = Array.isArray(rawConditions.exit) ? rawConditions.exit : [];
    conditions = entryConditions.length > 0 ? entryConditions : exitConditions.length > 0 ? exitConditions : [];
    entrySizingType = rawConditions.entrySizingType || row.sizing_type || 'QTY';
    entrySizingValue =
      rawConditions.entrySizingValue !== undefined
        ? rawConditions.entrySizingValue
        : row.sizing_value !== null
          ? Number(row.sizing_value)
          : '';
    exitSizingType = rawConditions.exitSizingType || 'DECREASE_PCT';
    exitSizingValue = rawConditions.exitSizingValue !== undefined ? rawConditions.exitSizingValue : 100;
    stopLossPct = rawConditions.stopLossPct ?? '';
    takeProfitPct = rawConditions.takeProfitPct ?? '';
  }

  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    portfolio_id: row.portfolio_id,
    name: row.name || 'Untitled Strategy',
    scope: row.scope || 'global',
    targetSymbol: row.target_symbol || 'ALL',
    target_symbol: row.target_symbol || 'ALL',
    action: row.action || 'BUY',
    sizingType: entrySizingType,
    sizing_type: entrySizingType,
    sizingValue: entrySizingValue,
    sizing_value: entrySizingValue,
    conditions,
    entryConditions,
    entrySizingType,
    entrySizingValue,
    exitConditions,
    exitSizingType,
    exitSizingValue,
    stopLossPct,
    takeProfitPct,
    enabled: row.enabled ?? true,
    frequency: row.frequency || 'daily',
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
  };
}

