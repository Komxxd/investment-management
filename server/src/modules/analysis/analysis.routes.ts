import { Router } from 'express';
import { getStockAnalysis, getStockChart } from './analysis.service';

const router = Router();

// GET /api/analysis/:symbol/chart
router.get('/:symbol/chart', async (req: any, res: any) => {
  try {
    const symbol = req.params.symbol;
    const range = req.query.range || '6M';
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });
    
    const chartData = await getStockChart(symbol, range as string);
    res.json(chartData);
  } catch (error) {
    console.error('Chart Error:', error);
    res.status(500).json({ error: 'Failed to fetch stock chart' });
  }
});

// GET /api/analysis/:symbol
router.get('/:symbol', async (req: any, res: any) => {
  try {
    const symbol = req.params.symbol;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const data = await getStockAnalysis(symbol);
    res.json(data);
  } catch (error) {
    console.error('Analysis Error:', error);
    res.status(500).json({ error: 'Failed to fetch stock analysis' });
  }
});

export default router;
