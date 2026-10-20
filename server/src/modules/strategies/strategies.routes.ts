import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// Helper to normalize DB row into client-friendly model
function formatStrategy(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    portfolio_id: row.portfolio_id,
    name: row.name || 'Untitled Strategy',
    scope: row.scope || 'global',
    targetSymbol: row.target_symbol || 'ALL',
    target_symbol: row.target_symbol || 'ALL',
    action: row.action || 'BUY',
    sizingType: row.sizing_type || 'QTY',
    sizing_type: row.sizing_type || 'QTY',
    sizingValue: row.sizing_value !== null && row.sizing_value !== undefined ? Number(row.sizing_value) : '',
    sizing_value: row.sizing_value !== null && row.sizing_value !== undefined ? Number(row.sizing_value) : '',
    conditions: Array.isArray(row.conditions) ? row.conditions : [],
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

    const insertPayload = {
      user_id: req.user.id,
      portfolio_id: finalPortfolioId,
      name: (name || '').trim() || 'Untitled Strategy',
      scope: scope || 'global',
      target_symbol: finalTargetSymbol,
      action: action || 'BUY',
      sizing_type: finalSizingType,
      sizing_value: finalSizingValue,
      conditions: Array.isArray(conditions) ? conditions : [],
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
    if (conditions !== undefined) updatePayload.conditions = Array.isArray(conditions) ? conditions : [];
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

export default router;
