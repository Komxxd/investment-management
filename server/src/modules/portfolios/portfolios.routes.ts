import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// GET /api/portfolios
router.get('/', authMiddleware, async (req: any, res: any) => {
  const isDeleted = req.query.deleted === 'true';
  let query = req.supabase
    .from('portfolios')
    .select('*')
    .order('created_at', { ascending: false });

  if (isDeleted) {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/portfolios
router.post('/', authMiddleware, async (req: any, res: any) => {
  const { name } = req.body;
  const { data, error } = await req.supabase
    .from('portfolios')
    .insert([{ name, user_id: req.user.id }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/portfolios/:id
router.put('/:id', authMiddleware, async (req: any, res: any) => {
  const { id } = req.params;
  const { name, deleted_at, auto_sync_corporate_actions } = req.body;

  const updateData: Record<string, any> = {};
  if (name !== undefined) updateData.name = name;
  if (deleted_at !== undefined) updateData.deleted_at = deleted_at;
  if (auto_sync_corporate_actions !== undefined) updateData.auto_sync_corporate_actions = auto_sync_corporate_actions;

  const { data, error } = await req.supabase
    .from('portfolios')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/portfolios/:id
router.delete('/:id', authMiddleware, async (req: any, res: any) => {
  const { id } = req.params;
  const isPermanent = req.query.permanent === 'true';

  if (isPermanent) {
    const { error } = await req.supabase
      .from('portfolios')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
  } else {
    const { error } = await req.supabase
      .from('portfolios')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// POST /api/portfolios/:id/restore
router.post('/:id/restore', authMiddleware, async (req: any, res: any) => {
  const { id } = req.params;
  const { error } = await req.supabase
    .from('portfolios')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /api/portfolios/:id/duplicate
router.post('/:id/duplicate', authMiddleware, async (req: any, res: any) => {
  const { id } = req.params;
  const { name } = req.body;
  
  // 1. Get original portfolio
  const { data: original, error: origError } = await req.supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .single();
    
  if (origError || !original) return res.status(404).json({ error: 'Portfolio not found' });
  
  // 2. Create new portfolio
  const { data: newPortfolio, error: createError } = await req.supabase
    .from('portfolios')
    .insert([{ name: name || `${original.name} (Copy)`, user_id: req.user.id, auto_sync_corporate_actions: original.auto_sync_corporate_actions }])
    .select()
    .single();
    
  if (createError) return res.status(500).json({ error: createError.message });
  
  // 3. Get stocks from original portfolio
  const { data: stocks, error: stocksError } = await req.supabase
    .from('stocks')
    .select('*')
    .eq('portfolio_id', id);
    
  if (stocksError) return res.status(500).json({ error: stocksError.message });
  
  // 4. Insert stocks into new portfolio
  if (stocks && stocks.length > 0) {
    const newStocks = stocks.map((s: any) => ({
      portfolio_id: newPortfolio.id,
      user_id: req.user.id,
      symbol: s.symbol,
      quantity: s.quantity,
      entry_price: s.entry_price,
      brokerage: s.brokerage,
      govt_tax: s.govt_tax,
      entry_date: s.entry_date,
    }));
    
    const { error: insertError } = await req.supabase
      .from('stocks')
      .insert(newStocks);
      
    if (insertError) return res.status(500).json({ error: insertError.message });
  }
  
  res.json(newPortfolio);
});

export default router;
