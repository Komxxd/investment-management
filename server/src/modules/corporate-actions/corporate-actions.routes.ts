import { Router } from 'express';
import { fetchCorporateActions, fetchBulkEvents } from './corporate-actions.service';
import { syncCorporateActions } from './sync.service';

const router = Router();

// GET /api/corporate-actions?symbol=RELIANCE.NS
router.get('/corporate-actions', async (req: any, res: any) => {
  try {
    const symbol = req.query.symbol;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const events = await fetchCorporateActions(symbol);
    res.json({ symbol, ...events });
  } catch (error) {
    console.error('Corporate Actions Error:', error);
    res.status(500).json({ error: 'Failed to fetch corporate actions' });
  }
});

// POST /api/bulk-corporate-actions
router.post('/bulk-corporate-actions', async (req: any, res: any) => {
  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: "Missing or invalid 'symbols' array in request body" });
    }

    const events = await fetchBulkEvents(symbols);
    res.json({ events });
  } catch (error) {
    console.error('Bulk Corporate Actions Error:', error);
    res.status(500).json({ error: 'Failed to fetch bulk corporate actions' });
  }
});

// ALL /api/cron/sync-corp-actions
router.all('/cron/sync-corp-actions', async (req: any, res: any) => {
  try {
    const result = await syncCorporateActions();
    res.json({ message: 'Sync completed', ...result });
  } catch (error) {
    console.error('Cron Sync Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
