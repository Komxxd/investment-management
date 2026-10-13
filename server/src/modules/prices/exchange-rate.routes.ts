import { Router } from 'express';


import { getExchangeRate } from './exchange-rate.service';

const router = Router();

/**
 * GET /api/exchange-rate?from=USD&to=INR
 * Returns the exchange rate between two currencies using Yahoo Finance.
 */
router.get('/', async (req: any, res: any) => {
  try {
    const from = (req.query.from || 'USD').toUpperCase();
    const to = (req.query.to || 'INR').toUpperCase();
    
    const rate = await getExchangeRate(from, to);
    res.json({ from, to, rate });
  } catch (error) {
    console.error('Exchange rate error:', error);
    res.status(500).json({ error: 'Failed to fetch exchange rate', details: (error as Error).message });
  }
});

export default router;
