import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// GET /api/sold-stocks
router.get('/', authMiddleware, async (req: any, res: any) => {
  const { portfolio_id } = req.query;
  let query = req.supabase.from('sold_stocks').select('*');
  if (portfolio_id) query = query.eq('portfolio_id', portfolio_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/sold-stocks
router.post('/', authMiddleware, async (req: any, res: any) => {
  const { portfolio_id, symbol, quantity, exit_price, brokerage, govt_tax, exit_date } = req.body;
  const { data, error } = await req.supabase
    .from('sold_stocks')
    .insert([{
      portfolio_id, symbol, quantity, exit_price,
      brokerage: brokerage || 0, govt_tax: govt_tax || 0,
      exit_date, user_id: req.user.id
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/sold-stocks/bulk
router.post('/bulk', authMiddleware, async (req: any, res: any) => {
  const { inserts } = req.body;
  if (!Array.isArray(inserts) || inserts.length === 0) {
    return res.status(400).json({ error: 'Invalid inserts array' });
  }

  const sanitizedInserts = inserts.map((item: any) => ({ ...item, user_id: req.user.id }));

  const { error } = await req.supabase
    .from('sold_stocks')
    .insert(sanitizedInserts);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, count: sanitizedInserts.length });
});

// PUT /api/sold-stocks/:id
router.put('/:id', authMiddleware, async (req: any, res: any) => {
  const { id } = req.params;
  const { quantity, exit_price, brokerage, govt_tax, exit_date } = req.body;
  const { data, error } = await req.supabase
    .from('sold_stocks')
    .update({ quantity, exit_price, brokerage, govt_tax, exit_date })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/sold-stocks/:id
router.delete('/:id', authMiddleware, async (req: any, res: any) => {
  const { id } = req.params;
  const { error } = await req.supabase
    .from('sold_stocks')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
