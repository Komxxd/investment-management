import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isMissingTableError(error: any): boolean {
  const msg = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

function getTodayUtcDate(): string {
  return new Date().toISOString().split('T')[0];
}

function formatExecution(row: any) {
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

type StrategyLogEventType =
  | 'STRATEGY_STARTED'
  | 'STRATEGY_PAUSED'
  | 'STRATEGY_RESUMED'
  | 'SIGNAL_TRIGGERED'
  | 'ACTION_EXECUTED';

interface StrategyLogInput {
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

function formatStrategyLog(row: any) {
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

async function writeStrategyLog(
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

async function recordStrategyToggleLog(
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
    let result = await writeStrategyLog(supabase, {
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
      result = await writeStrategyLog(supabase, {
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

// Helper to normalize DB row into client-friendly model
function formatStrategy(row: any) {
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
    conditions = entryConditions.length > 0 ? entryConditions : (exitConditions.length > 0 ? exitConditions : []);
    entrySizingType = rawConditions.entrySizingType || row.sizing_type || 'QTY';
    entrySizingValue = rawConditions.entrySizingValue !== undefined ? rawConditions.entrySizingValue : (row.sizing_value !== null ? Number(row.sizing_value) : '');
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
    updated_at: row.updated_at
  };
}

// GET /api/strategies - List strategies for authenticated user
router.get('/', authMiddleware, async (req: any, res: any) => {
  try {
    const { portfolio_id } = req.query;
    let query = req.supabase
      .from('portfolio_strategies')
      .select('*')
      .order('created_at', { ascending: false });

    if (portfolio_id) {
      // Include strategies specific to this portfolio or global strategies
      query = query.or(`portfolio_id.eq.${portfolio_id},portfolio_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      // Friendly message if user hasn't run the SQL script yet
      if (error.code === '42P01') {
        return res.status(200).json({
          warning: 'portfolio_strategies table does not exist yet. Please run the setup SQL on Supabase.',
          data: []
        });
      }
      return res.status(500).json({ error: error.message });
    }

    const formatted = (data || []).map(formatStrategy);
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch strategies' });
  }
});

// POST /api/strategies - Create a new strategy
router.post('/', authMiddleware, async (req: any, res: any) => {
  try {
    const {
      name,
      scope,
      targetSymbol,
      target_symbol,
      action,
      sizingType,
      sizing_type,
      sizingValue,
      sizing_value,
      conditions,
      enabled,
      frequency,
      portfolioId,
      portfolio_id
    } = req.body;

    const finalPortfolioId = portfolio_id || portfolioId || null;
    const finalTargetSymbol = target_symbol || targetSymbol || 'ALL';
    const finalSizingType = sizing_type || sizingType || 'QTY';
    const rawSizingValue = sizing_value !== undefined ? sizing_value : sizingValue;
    const finalSizingValue = rawSizingValue !== '' && rawSizingValue !== undefined && rawSizingValue !== null
      ? Number(rawSizingValue)
      : null;

    const resolvedEntry = Array.isArray(req.body.entryConditions || req.body.entry_conditions)
      ? (req.body.entryConditions || req.body.entry_conditions)
      : (Array.isArray(conditions) && action !== 'SELL' ? conditions : []);

    const resolvedExit = Array.isArray(req.body.exitConditions || req.body.exit_conditions)
      ? (req.body.exitConditions || req.body.exit_conditions)
      : (Array.isArray(conditions) && action === 'SELL' ? conditions : []);

    const structuredConditions = {
      entry: resolvedEntry,
      exit: resolvedExit,
      entrySizingType: req.body.entrySizingType || req.body.entry_sizing_type || finalSizingType,
      entrySizingValue: req.body.entrySizingValue !== undefined ? req.body.entrySizingValue : finalSizingValue,
      exitSizingType: req.body.exitSizingType || req.body.exit_sizing_type || 'DECREASE_PCT',
      exitSizingValue: req.body.exitSizingValue !== undefined ? req.body.exitSizingValue : 100,
      stopLossPct: req.body.stopLossPct ?? req.body.stop_loss_pct ?? '',
      takeProfitPct: req.body.takeProfitPct ?? req.body.take_profit_pct ?? '',
    };

    const insertPayload = {
      user_id: req.user.id,
      portfolio_id: finalPortfolioId,
      name: (name || '').trim() || 'Untitled Strategy',
      scope: scope || 'global',
      target_symbol: finalTargetSymbol,
      action: action || 'BUY',
      sizing_type: finalSizingType,
      sizing_value: finalSizingValue,
      conditions: structuredConditions,
      enabled: enabled !== undefined ? !!enabled : true,
      frequency: frequency || 'daily'
    };

    const { data, error } = await req.supabase
      .from('portfolio_strategies')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') {
        return res.status(400).json({
          error: 'Table "portfolio_strategies" does not exist in Supabase yet. Please execute the provided SQL script in the Supabase SQL Editor.'
        });
      }
      return res.status(500).json({ error: error.message });
    }

    if (data?.id && insertPayload.enabled) {
      try {
        await writeStrategyLog(req.supabase, {
          userId: req.user.id,
          portfolioId: finalPortfolioId && UUID_REGEX.test(String(finalPortfolioId)) ? String(finalPortfolioId) : null,
          strategyId: data.id,
          strategyName: data.name,
          symbol: finalTargetSymbol || 'ALL',
          eventType: 'STRATEGY_STARTED',
          actionText: `Strategy "${data.name}" started`,
          metadata: { scope: data.scope || 'global' },
        });
      } catch (logErr) {
        console.warn('Non-fatal strategy_logs start write error:', logErr);
      }
    }

    res.status(201).json(formatStrategy(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save strategy' });
  }
});

// GET /api/strategies/executions - Fetch daily strategy executions for a portfolio & date
router.get('/executions', authMiddleware, async (req: any, res: any) => {
  try {
    const { portfolio_id, date } = req.query;
    const executionDate =
      typeof date === 'string' && DATE_REGEX.test(date) ? date : getTodayUtcDate();

    let query = req.supabase
      .from('strategy_executions')
      .select('*')
      .eq('execution_date', executionDate)
      .order('executed_at', { ascending: false });

    if (typeof portfolio_id === 'string' && portfolio_id.trim()) {
      query = query.eq('portfolio_id', portfolio_id.trim());
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        return res.status(200).json({
          warning: 'strategy_executions table does not exist yet. Please run the setup SQL in Supabase.',
          data: [],
        });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.json((data || []).map(formatExecution));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch strategy executions' });
  }
});

// POST /api/strategies/executions - Atomically lock daily strategy execution and record trade
router.post('/executions', authMiddleware, async (req: any, res: any) => {
  try {
    const portfolioId = req.body?.portfolio_id || req.body?.portfolioId;
    const rawSymbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim() : '';
    const action = req.body?.action;
    const quantity = Number(req.body?.quantity);
    const price = Number(req.body?.price);
    const rawDate = req.body?.execution_date || req.body?.executionDate;
    const executionDate =
      typeof rawDate === 'string' && DATE_REGEX.test(rawDate) ? rawDate : getTodayUtcDate();

    const rawStrategyId = req.body?.strategy_id || req.body?.strategyId;
    const strategyId =
      typeof rawStrategyId === 'string' && UUID_REGEX.test(rawStrategyId) ? rawStrategyId : null;
    const strategyName =
      typeof (req.body?.strategy_name || req.body?.strategyName) === 'string'
        ? String(req.body?.strategy_name || req.body?.strategyName).trim() || null
        : null;

    if (!portfolioId || !UUID_REGEX.test(String(portfolioId))) {
      return res.status(400).json({ error: 'Valid portfolio_id is required.' });
    }
    if (!rawSymbol) {
      return res.status(400).json({ error: 'Stock symbol is required.' });
    }
    if (action !== 'BUY' && action !== 'SELL') {
      return res.status(400).json({ error: 'Action must be BUY or SELL.' });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0.' });
    }
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'Price must be non-negative.' });
    }

    const baseLockPayload = {
      user_id: req.user.id,
      portfolio_id: portfolioId,
      strategy_id: strategyId,
      strategy_name: strategyName,
      symbol: rawSymbol,
      action,
      quantity,
      price,
      execution_date: executionDate,
    };

    let executionRow: any = null;
    let tableExists = true;

    let { data: insertedLock, error: lockErr } = await req.supabase
      .from('strategy_executions')
      .insert([baseLockPayload])
      .select()
      .single();

    // Retry without strategy_id if referenced rule was deleted or local-only
    if (lockErr && lockErr.code === '23503' && strategyId !== null) {
      const retry = await req.supabase
        .from('strategy_executions')
        .insert([{ ...baseLockPayload, strategy_id: null }])
        .select()
        .single();
      insertedLock = retry.data;
      lockErr = retry.error;
    }

    if (lockErr) {
      if (lockErr.code === '23505') {
        return res.status(409).json({
          error: `Strategy action for ${rawSymbol} has already been executed on ${executionDate}.`,
        });
      }
      if (isMissingTableError(lockErr)) {
        tableExists = false;
      } else {
        return res.status(500).json({ error: lockErr.message });
      }
    } else {
      executionRow = insertedLock;
    }

    // Record the underlying buy or sell lot
    const tradeTable = action === 'BUY' ? 'stocks' : 'sold_stocks';
    const tradePayload =
      action === 'BUY'
        ? {
            portfolio_id: portfolioId,
            symbol: rawSymbol,
            quantity,
            entry_price: price,
            brokerage: 0,
            govt_tax: 0,
            entry_date: executionDate,
            user_id: req.user.id,
          }
        : {
            portfolio_id: portfolioId,
            symbol: rawSymbol,
            quantity,
            exit_price: price,
            brokerage: 0,
            govt_tax: 0,
            exit_date: executionDate,
            user_id: req.user.id,
          };

    const { data: tradeData, error: tradeErr } = await req.supabase
      .from(tradeTable)
      .insert([tradePayload])
      .select()
      .single();

    if (tradeErr) {
      if (executionRow?.id) {
        await req.supabase.from('strategy_executions').delete().eq('id', executionRow.id);
      }
      return res.status(500).json({ error: tradeErr.message || 'Failed to record trade.' });
    }

    // Best-effort log entry for "when the action happened and what action happened"
    try {
      await writeStrategyLog(req.supabase, {
        userId: req.user.id,
        portfolioId: String(portfolioId),
        strategyId,
        strategyName,
        symbol: rawSymbol,
        eventType: 'ACTION_EXECUTED',
        actionText: `Executed ${action} ${quantity} ${quantity === 1 ? 'share' : 'shares'}${strategyName ? ` (${strategyName})` : ''}`,
        signal: action,
        eventDate: executionDate,
        metadata: { action, quantity, price },
      });
    } catch (logErr) {
      console.warn('Non-fatal strategy_logs execution write error:', logErr);
    }

    if (!tableExists) {
      return res.status(201).json({
        persisted: false,
        warning: 'strategy_executions table does not exist yet in Supabase.',
        execution: {
          symbol: rawSymbol,
          action,
          quantity,
          price,
          executionDate,
          timestamp: Date.now(),
        },
        trade: tradeData,
      });
    }

    return res.status(201).json({
      persisted: true,
      execution: formatExecution(executionRow),
      trade: tradeData,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to execute strategy signal' });
  }
});

// GET /api/strategies/logs - Fetch chronological strategy execution logs (optionally scoped by portfolio_id and/or symbol)
router.get('/logs', authMiddleware, async (req: any, res: any) => {
  try {
    const portfolioId = typeof req.query?.portfolio_id === 'string' ? req.query.portfolio_id.trim() : '';
    const symbol = typeof req.query?.symbol === 'string' ? req.query.symbol.trim() : '';

    if (portfolioId && !UUID_REGEX.test(portfolioId)) {
      return res.status(400).json({ error: 'Invalid portfolio_id format.' });
    }

    let logsQuery = req.supabase
      .from('strategy_logs')
      .select('*')
      .order('logged_at', { ascending: true });
    if (portfolioId) {
      logsQuery = logsQuery.or(`portfolio_id.eq.${portfolioId},portfolio_id.is.null`);
    }
    if (symbol && symbol !== 'ALL') {
      logsQuery = logsQuery.in('symbol', [symbol, 'ALL']);
    }

    let strategiesQuery = req.supabase
      .from('portfolio_strategies')
      .select('id, portfolio_id, name, scope, target_symbol, enabled, created_at, updated_at')
      .order('created_at', { ascending: true });
    if (portfolioId) {
      strategiesQuery = strategiesQuery.or(`portfolio_id.eq.${portfolioId},portfolio_id.is.null`);
    }

    let executionsQuery = req.supabase
      .from('strategy_executions')
      .select('*')
      .order('executed_at', { ascending: true });
    if (portfolioId) {
      executionsQuery = executionsQuery.eq('portfolio_id', portfolioId);
    }
    if (symbol && symbol !== 'ALL') {
      executionsQuery = executionsQuery.eq('symbol', symbol);
    }

    const [logsRes, strategiesRes, executionsRes] = await Promise.all([
      logsQuery,
      strategiesQuery,
      executionsQuery,
    ]);

    let missingTable = false;
    const logs: any[] = [];

    if (logsRes.error) {
      if (isMissingTableError(logsRes.error)) {
        missingTable = true;
      } else {
        return res.status(500).json({ error: logsRes.error.message });
      }
    } else {
      for (const row of logsRes.data || []) {
        const formatted = formatStrategyLog(row);
        if (formatted) logs.push(formatted);
      }
    }

    const recordedStartedStrategyIds = new Set(
      logs
        .filter((l) => l.eventType === 'STRATEGY_STARTED' && l.strategyId)
        .map((l) => String(l.strategyId))
    );

    const recordedPausedStrategyIds = new Set(
      logs
        .filter((l) => l.eventType === 'STRATEGY_PAUSED' && l.strategyId)
        .map((l) => String(l.strategyId))
    );

    const recordedExecutionKeys = new Set(
      logs
        .filter((l) => l.eventType === 'ACTION_EXECUTED' && l.eventDate)
        .map((l) => `${l.portfolioId || ''}:${l.symbol || ''}:${l.eventDate}:${l.signal || ''}`)
    );

    if (!strategiesRes.error) {
      for (const strat of strategiesRes.data || []) {
        if (!strat || strat.id === 'rule-default') continue;
        const hasSpecificSymbol = Boolean(symbol && symbol !== 'ALL');
        const appliesToStock = !hasSpecificSymbol
          ? true
          : strat.scope === 'global' ||
            strat.target_symbol === 'ALL' ||
            strat.target_symbol === symbol;

        if (!appliesToStock) {
          continue;
        }

        const resolvedSymbol = hasSpecificSymbol ? symbol : (strat.target_symbol || 'ALL');
        const resolvedPortfolioId = strat.portfolio_id || portfolioId || null;

        if (!recordedStartedStrategyIds.has(String(strat.id))) {
          logs.push({
            id: `start-${strat.id}`,
            portfolioId: resolvedPortfolioId,
            strategyId: strat.id,
            strategyName: strat.name || 'Strategy',
            symbol: resolvedSymbol,
            eventType: 'STRATEGY_STARTED',
            actionText: `Strategy "${strat.name || 'Untitled Strategy'}" started`,
            signal: null,
            eventDate: strat.created_at ? String(strat.created_at).split('T')[0] : null,
            loggedAt: strat.created_at,
            metadata: {
              scope: strat.scope || 'global',
              enabled: strat.enabled !== false,
            },
            source: 'strategy',
          });
        }

        if (
          strat.enabled === false &&
          !recordedPausedStrategyIds.has(String(strat.id)) &&
          strat.updated_at
        ) {
          logs.push({
            id: `pause-${strat.id}`,
            portfolioId: resolvedPortfolioId,
            strategyId: strat.id,
            strategyName: strat.name || 'Strategy',
            symbol: strat.target_symbol || resolvedSymbol,
            eventType: 'STRATEGY_PAUSED',
            actionText: `Strategy "${strat.name || 'Untitled Strategy'}" paused`,
            signal: null,
            eventDate: String(strat.updated_at).split('T')[0],
            loggedAt: strat.updated_at,
            metadata: {
              scope: strat.scope || 'global',
              enabled: false,
            },
            source: 'strategy',
          });
        }
      }
    } else if (!isMissingTableError(strategiesRes.error)) {
      console.warn('Non-fatal strategy_logs portfolio_strategies lookup error:', strategiesRes.error);
    }

    if (!executionsRes.error) {
      for (const exec of executionsRes.data || []) {
        const execKey = `${exec.portfolio_id || ''}:${exec.symbol || ''}:${exec.execution_date}:${exec.action || ''}`;
        if (recordedExecutionKeys.has(execKey)) continue;

        const qty = Number(exec.quantity) || 0;
        const price = Number(exec.price) || 0;
        logs.push({
          id: `exec-${exec.id}`,
          portfolioId: exec.portfolio_id || portfolioId || null,
          strategyId: exec.strategy_id || null,
          strategyName: exec.strategy_name || null,
          symbol: exec.symbol || symbol || 'ALL',
          eventType: 'ACTION_EXECUTED',
          actionText: `Executed ${exec.action} ${qty} ${qty === 1 ? 'share' : 'shares'}${exec.strategy_name ? ` (${exec.strategy_name})` : ''}`,
          signal: exec.action || null,
          eventDate: exec.execution_date || null,
          loggedAt: exec.executed_at,
          metadata: { action: exec.action, quantity: qty, price },
          source: 'execution',
        });
      }
    } else if (!isMissingTableError(executionsRes.error)) {
      console.warn('Non-fatal strategy_logs strategy_executions lookup error:', executionsRes.error);
    }

    const eventRank: Record<string, number> = {
      STRATEGY_STARTED: 0,
      SIGNAL_TRIGGERED: 1,
      ACTION_EXECUTED: 2,
      STRATEGY_PAUSED: 3,
      STRATEGY_RESUMED: 4,
    };

    logs.sort((a, b) => {
      const timeA = a.loggedAt ? new Date(a.loggedAt).getTime() : 0;
      const timeB = b.loggedAt ? new Date(b.loggedAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (eventRank[a.eventType] ?? 9) - (eventRank[b.eventType] ?? 9);
    });

    return res.json({ logs, missingTable });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch strategy logs' });
  }
});

// POST /api/strategies/logs/signal - Record first signal occurrence per stock per day
router.post('/logs/signal', authMiddleware, async (req: any, res: any) => {
  try {
    const portfolioId = req.body?.portfolio_id || req.body?.portfolioId;
    const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim() : '';
    const signal = req.body?.signal;
    const rawStrategyId = req.body?.strategy_id || req.body?.strategyId;
    const strategyId =
      typeof rawStrategyId === 'string' && UUID_REGEX.test(rawStrategyId) ? rawStrategyId : null;
    const strategyName =
      typeof (req.body?.strategy_name || req.body?.strategyName) === 'string'
        ? String(req.body?.strategy_name || req.body?.strategyName).trim() || null
        : null;
    const rawPrice = req.body?.price;
    const price = rawPrice !== undefined && rawPrice !== null ? Number(rawPrice) : NaN;
    const rawDate = req.body?.event_date || req.body?.eventDate;
    const eventDate =
      typeof rawDate === 'string' && DATE_REGEX.test(rawDate) ? rawDate : getTodayUtcDate();

    if (!portfolioId || !UUID_REGEX.test(String(portfolioId))) {
      return res.status(400).json({ error: 'Valid portfolio_id is required.' });
    }
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required.' });
    }
    if (signal !== 'BUY' && signal !== 'SELL') {
      return res.status(400).json({ error: 'Signal must be BUY or SELL.' });
    }

    const metadata: Record<string, any> = { signal };
    if (Number.isFinite(price) && price > 0) {
      metadata.price = price;
    }

    const actionText = `${signal} signal came${strategyName ? ` (${strategyName})` : ''}`;

    const result = await writeStrategyLog(req.supabase, {
      userId: req.user.id,
      portfolioId: String(portfolioId),
      strategyId,
      strategyName,
      symbol,
      eventType: 'SIGNAL_TRIGGERED',
      actionText,
      signal,
      eventDate,
      metadata,
    });

    if (result.missingTable) {
      return res.status(200).json({
        persisted: false,
        missingTable: true,
        log: {
          id: `local-${symbol}-${signal}-${eventDate}`,
          portfolioId: String(portfolioId),
          strategyId,
          strategyName,
          symbol,
          eventType: 'SIGNAL_TRIGGERED',
          actionText,
          signal,
          eventDate,
          loggedAt: new Date().toISOString(),
          metadata,
          source: 'local',
        },
      });
    }

    if (result.alreadyRecorded) {
      return res.status(200).json({
        persisted: true,
        alreadyRecorded: true,
      });
    }

    return res.status(201).json({
      persisted: true,
      alreadyRecorded: false,
      log: formatStrategyLog(result.row),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to record strategy signal log' });
  }
});

// PUT /api/strategies/:id - Update strategy
router.put('/:id', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const {
      name,
      scope,
      targetSymbol,
      target_symbol,
      action,
      sizingType,
      sizing_type,
      sizingValue,
      sizing_value,
      conditions,
      enabled,
      frequency,
      portfolioId,
      portfolio_id
    } = req.body;

    const updatePayload: Record<string, any> = {};

    if (name !== undefined) updatePayload.name = name.trim();
    if (scope !== undefined) updatePayload.scope = scope;
    if (target_symbol !== undefined || targetSymbol !== undefined) {
      updatePayload.target_symbol = target_symbol || targetSymbol;
    }
    if (action !== undefined) updatePayload.action = action;
    if (sizing_type !== undefined || sizingType !== undefined) {
      updatePayload.sizing_type = sizing_type || sizingType;
    }
    if (sizing_value !== undefined || sizingValue !== undefined) {
      const val = sizing_value !== undefined ? sizing_value : sizingValue;
      updatePayload.sizing_value = val !== '' && val !== null ? Number(val) : null;
    }
    if (conditions !== undefined || req.body.entryConditions !== undefined || req.body.exitConditions !== undefined) {
      const resolvedEntry = Array.isArray(req.body.entryConditions || req.body.entry_conditions)
        ? (req.body.entryConditions || req.body.entry_conditions)
        : (Array.isArray(conditions) ? conditions : []);

      const resolvedExit = Array.isArray(req.body.exitConditions || req.body.exit_conditions)
        ? (req.body.exitConditions || req.body.exit_conditions)
        : [];

      updatePayload.conditions = {
        entry: resolvedEntry,
        exit: resolvedExit,
        entrySizingType: req.body.entrySizingType || req.body.entry_sizing_type || updatePayload.sizing_type || 'QTY',
        entrySizingValue: req.body.entrySizingValue !== undefined ? req.body.entrySizingValue : updatePayload.sizing_value,
        exitSizingType: req.body.exitSizingType || req.body.exit_sizing_type || 'DECREASE_PCT',
        exitSizingValue: req.body.exitSizingValue !== undefined ? req.body.exitSizingValue : 100,
        stopLossPct: req.body.stopLossPct ?? req.body.stop_loss_pct ?? '',
        takeProfitPct: req.body.takeProfitPct ?? req.body.take_profit_pct ?? '',
      };
    }
    if (enabled !== undefined) updatePayload.enabled = !!enabled;
    if (frequency !== undefined) updatePayload.frequency = frequency;
    if (portfolio_id !== undefined || portfolioId !== undefined) {
      updatePayload.portfolio_id = portfolio_id || portfolioId || null;
    }

    let previousEnabled: boolean | null = null;
    if (enabled !== undefined) {
      const { data: existingRow } = await req.supabase
        .from('portfolio_strategies')
        .select('enabled')
        .eq('id', id)
        .single();
      if (existingRow && existingRow.enabled !== undefined) {
        previousEnabled = Boolean(existingRow.enabled);
      }
    }

    const { data, error } = await req.supabase
      .from('portfolio_strategies')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    let toggleResult: { lifecycleLog: any; lifecycleLogPersisted: boolean } = {
      lifecycleLog: null,
      lifecycleLogPersisted: true,
    };
    if (
      enabled !== undefined &&
      previousEnabled !== null &&
      previousEnabled !== Boolean(data?.enabled)
    ) {
      const contextPortfolioId =
        req.body?.portfolio_id_context || req.body?.portfolio_id || req.body?.portfolioId || null;
      toggleResult = await recordStrategyToggleLog(
        req.supabase,
        req.user.id,
        data,
        previousEnabled,
        Boolean(data?.enabled),
        contextPortfolioId
      );
    }

    res.json({
      ...formatStrategy(data),
      ...(toggleResult.lifecycleLog ? toggleResult : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update strategy' });
  }
});

// DELETE /api/strategies/:id - Delete strategy
router.delete('/:id', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { error } = await req.supabase
      .from('portfolio_strategies')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, message: 'Strategy deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete strategy' });
  }
});

// PATCH /api/strategies/:id/toggle - Toggle strategy status
router.patch('/:id/toggle', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    // 1. Fetch current status
    const { data: current, error: fetchErr } = await req.supabase
      .from('portfolio_strategies')
      .select('enabled')
      .eq('id', id)
      .single();

    if (fetchErr || !current) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // 2. Toggle enabled
    const { data, error } = await req.supabase
      .from('portfolio_strategies')
      .update({ enabled: !current.enabled })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const contextPortfolioId =
      req.body?.portfolio_id_context || req.body?.portfolio_id || req.body?.portfolioId || null;
    const toggleResult = await recordStrategyToggleLog(
      req.supabase,
      req.user.id,
      data,
      Boolean(current.enabled),
      Boolean(data?.enabled),
      contextPortfolioId
    );

    res.json({
      ...formatStrategy(data),
      ...(toggleResult.lifecycleLog ? toggleResult : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to toggle strategy' });
  }
});

// Forward /api/strategies/backtest to backtest routes
import backtestRoutes from '../backtest/backtest.routes';
router.use('/backtest', backtestRoutes);

export default router;
