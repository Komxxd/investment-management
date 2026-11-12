import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import backtestRoutes from '../backtest/backtest.routes';
import { UUID_REGEX } from './strategy-execution.service';
import { evaluateAndExecuteActiveStrategies } from './strategy-monitor.service';
import {
  buildStructuredConditions,
  formatStrategyResponse,
  recordStrategyToggleLog,
  writeRouteStrategyLog,
} from './strategy-route-helpers';
import strategyExecutionsRoutes from './strategy-executions.routes';
import strategyLogsRoutes from './strategy-logs.routes';

const router = Router();

// Sub-routers for daily executions, chronological logs, and backtests (registered before /:id)
router.use('/executions', strategyExecutionsRoutes);
router.use('/logs', strategyLogsRoutes);
router.use('/backtest', backtestRoutes);

// GET /api/strategies - List strategies for authenticated user
router.get('/', authMiddleware, async (req: any, res: any) => {
  try {
    const { portfolio_id } = req.query;
    let query = req.supabase
      .from('portfolio_strategies')
      .select('*')
      .order('created_at', { ascending: false });

    if (portfolio_id) {
      query = query.or(`portfolio_id.eq.${portfolio_id},portfolio_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return res.status(200).json({
          warning: 'portfolio_strategies table does not exist yet. Please run the setup SQL on Supabase.',
          data: [],
        });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json((data || []).map(formatStrategyResponse));
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
      enabled,
      frequency,
      portfolioId,
      portfolio_id,
    } = req.body;

    const finalPortfolioId = portfolio_id || portfolioId || null;
    const finalTargetSymbol = target_symbol || targetSymbol || 'ALL';
    const finalSizingType = sizing_type || sizingType || 'QTY';
    const rawSizingValue = sizing_value !== undefined ? sizing_value : sizingValue;
    const finalSizingValue =
      rawSizingValue !== '' && rawSizingValue !== undefined && rawSizingValue !== null
        ? Number(rawSizingValue)
        : null;

    const structuredConditions = buildStructuredConditions(
      req.body,
      finalSizingType,
      finalSizingValue,
      action === 'SELL'
    );

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
      frequency: frequency || 'daily',
    };

    const { data, error } = await req.supabase
      .from('portfolio_strategies')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') {
        return res.status(400).json({
          error:
            'Table "portfolio_strategies" does not exist in Supabase yet. Please execute the provided SQL script in the Supabase SQL Editor.',
        });
      }
      return res.status(500).json({ error: error.message });
    }

    if (data?.id && insertPayload.enabled) {
      try {
        await writeRouteStrategyLog(req.supabase, {
          userId: req.user.id,
          portfolioId:
            finalPortfolioId && UUID_REGEX.test(String(finalPortfolioId))
              ? String(finalPortfolioId)
              : null,
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

    res.status(201).json(formatStrategyResponse(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save strategy' });
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
      portfolio_id,
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
    if (
      conditions !== undefined ||
      req.body.entryConditions !== undefined ||
      req.body.exitConditions !== undefined
    ) {
      updatePayload.conditions = buildStructuredConditions(
        req.body,
        updatePayload.sizing_type,
        updatePayload.sizing_value,
        false
      );
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
      ...formatStrategyResponse(data),
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

    const { data: current, error: fetchErr } = await req.supabase
      .from('portfolio_strategies')
      .select('enabled')
      .eq('id', id)
      .single();

    if (fetchErr || !current) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

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
      ...formatStrategyResponse(data),
      ...(toggleResult.lifecycleLog ? toggleResult : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to toggle strategy' });
  }
});

// POST /api/strategies/evaluate - Trigger server-side evaluation for the authenticated user's active strategies
router.post('/evaluate', authMiddleware, async (req: any, res: any) => {
  try {
    const summary = await evaluateAndExecuteActiveStrategies({
      userId: req.user.id,
    });
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to evaluate active strategies' });
  }
});

export default router;
