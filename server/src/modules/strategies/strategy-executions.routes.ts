import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  UUID_REGEX,
  DATE_REGEX,
  isMissingTableError,
  getTodayUtcDate,
  formatExecution,
} from './strategy-execution.service';
import { writeRouteStrategyLog } from './strategy-route-helpers';

const router = Router();

// GET /api/strategies/executions - Fetch daily strategy executions for a portfolio & date
router.get('/', authMiddleware, async (req: any, res: any) => {
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
router.post('/', authMiddleware, async (req: any, res: any) => {
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

    try {
      await writeRouteStrategyLog(req.supabase, {
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

export default router;

