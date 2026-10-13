import { Router } from 'express';
import { fetchPrices, searchStocks, priceEvents, watchSymbols, unwatchSymbols } from './prices.service';

const router = Router();

// GET /api/prices?symbols=RELIANCE.NS,TCS.NS
router.get('/', async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const symbolsParam = req.query.symbols;
    if (!symbolsParam) {
      return res.json({});
    }

    const symbols = symbolsParam.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (symbols.length === 0) {
      return res.json({});
    }

    const prices = await fetchPrices(symbols);
    res.json(prices);
  } catch (error) {
    console.error('Prices Error:', error);
    res.status(500).json({ error: 'Failed to fetch prices', details: (error as Error).message });
  }
});

// GET /api/prices/search?q=reliance
router.get('/search', async (req: any, res: any) => {
  try {
    const q = req.query.q;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    const results = await searchStocks(q);
    res.json(results);
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ error: 'Failed to search stocks', details: (error as Error).message });
  }
});

// SSE endpoint for live prices
// GET /api/prices/stream?symbols=RELIANCE.NS,TCS.NS
router.get('/stream', (req: any, res: any) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const symbolsParam = req.query.symbols;
  if (!symbolsParam) {
    res.write('data: {}\n\n');
    return res.end();
  }

  const symbols = symbolsParam.split(',').map((s: string) => s.trim()).filter(Boolean);
  if (symbols.length === 0) {
    res.write('data: {}\n\n');
    return res.end();
  }

  // Send initial prices immediately
  fetchPrices(symbols).then(prices => {
    res.write(`data: ${JSON.stringify(prices)}\n\n`);
  });

  // Register for future updates
  watchSymbols(symbols);

  const onPricesUpdated = (allPrices: Record<string, any>) => {
    // Only send the prices this connection cares about
    const relevantPrices: Record<string, any> = {};
    let hasData = false;
    for (const sym of symbols) {
      if (allPrices[sym]) {
        relevantPrices[sym] = allPrices[sym];
        hasData = true;
      }
    }
    
    if (hasData) {
      res.write(`data: ${JSON.stringify(relevantPrices)}\n\n`);
    }
  };

  priceEvents.on('prices_updated', onPricesUpdated);

  req.on('close', () => {
    priceEvents.off('prices_updated', onPricesUpdated);
    unwatchSymbols(symbols);
  });
});

export default router;
