import { Router } from 'express';
import { searchStocks } from '../prices/prices.service';

const router = Router();

// GET /api/search?q=RELIANCE
router.get('/', async (req: any, res: any) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.json([]);
    }

    const results = await searchStocks(query);
    res.json(results);
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ error: 'Failed to search stocks' });
  }
});

export default router;
