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

    const { data, error } = await req.supabase
      .from('portfolio_strategies')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(formatStrategy(data));
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

    res.json(formatStrategy(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to toggle strategy' });
  }
});

// Forward /api/strategies/backtest to backtest routes
import backtestRoutes from '../backtest/backtest.routes';
router.use('/backtest', backtestRoutes);

export default router;
