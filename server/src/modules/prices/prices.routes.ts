import { Router } from 'express';
import { fetchPrices, searchStocks, priceEvents, watchSymbols, unwatchSymbols } from './prices.service';
import { fetchIndicators } from './indicators.service';

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

// GET /api/prices/indicators?symbols=RELIANCE.NS,TCS.NS&indicators=rsi,dma50,dma200&force=false
router.get('/indicators', async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'public, max-age=300'); // cache 5 minutes
  try {
    const symbolsParam = req.query.symbols;
    if (!symbolsParam) return res.json({});

    const symbols = symbolsParam.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (symbols.length === 0) return res.json({});

    const indicatorsParam = req.query.indicators;
    const requestedIndicators = indicatorsParam
      ? indicatorsParam.split(',').map((i: string) => i.trim()).filter(Boolean)
      : ['rsi', 'dma50', 'dma200', 'ema20', 'ema50', 'ema200', 'rsiDivergence', 'macd', 'macdSignal', 'macdHist', 'bbUpper', 'bbMiddle', 'bbLower', 'bbBandwidth', 'bbPercentB', 'vwap', 'avgVolume', 'obv', 'obvSignal'];
    const force = req.query.force === 'true';

    const options = {
      rsiPeriod: req.query.rsiPeriod ? parseInt(req.query.rsiPeriod, 10) : undefined,
      macdFastPeriod: req.query.macdFast ? parseInt(req.query.macdFast, 10) : (req.query.macdFastPeriod ? parseInt(req.query.macdFastPeriod, 10) : undefined),
      macdSlowPeriod: req.query.macdSlow ? parseInt(req.query.macdSlow, 10) : (req.query.macdSlowPeriod ? parseInt(req.query.macdSlowPeriod, 10) : undefined),
      macdSignalPeriod: req.query.macdSignal ? parseInt(req.query.macdSignal, 10) : (req.query.macdSignalPeriod ? parseInt(req.query.macdSignalPeriod, 10) : undefined),
      bbPeriod: req.query.bbPeriod ? parseInt(req.query.bbPeriod, 10) : undefined,
      bbStdDev: req.query.bbStdDev ? parseFloat(req.query.bbStdDev) : undefined,
    };

    const indicators = await fetchIndicators(symbols, requestedIndicators, force, options);
    res.json(indicators);
  } catch (error) {
    console.error('Indicators Error:', error);
    res.status(500).json({ error: 'Failed to fetch indicators', details: (error as Error).message });
  }
});

// POST /api/prices/indicators (for batch calculation)
router.post('/indicators', async (req: any, res: any) => {
  try {
    const { symbols, indicators: requestedIndicators, force, options } = req.body || {};
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.json({});
    }
    const indicators = await fetchIndicators(
      symbols,
      requestedIndicators || ['rsi', 'dma50', 'dma200', 'ema20', 'ema50', 'ema200', 'rsiDivergence', 'macd', 'macdSignal', 'macdHist', 'bbUpper', 'bbMiddle', 'bbLower', 'bbBandwidth', 'bbPercentB', 'vwap', 'avgVolume', 'obv', 'obvSignal'],
      force === true,
      options || {}
    );
    res.json(indicators);
  } catch (error) {
    console.error('Indicators Error:', error);
    res.status(500).json({ error: 'Failed to fetch indicators', details: (error as Error).message });
  }
});

// GET /api/prices/indicators/sync-stream?symbols=RELIANCE.NS,TCS.NS&force=false (SSE for real-time progress)
router.get('/indicators/sync-stream', async (req: any, res: any) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const symbolsParam = req.query.symbols;
  if (!symbolsParam) {
    res.write('data: {"type":"complete","indicators":{}}\n\n');
    return res.end();
  }

  const symbols = symbolsParam.split(',').map((s: string) => s.trim()).filter(Boolean);
  const force = req.query.force === 'true';

  const options = {
    rsiPeriod: req.query.rsiPeriod ? parseInt(req.query.rsiPeriod, 10) : undefined,
    macdFastPeriod: req.query.macdFast ? parseInt(req.query.macdFast, 10) : (req.query.macdFastPeriod ? parseInt(req.query.macdFastPeriod, 10) : undefined),
    macdSlowPeriod: req.query.macdSlow ? parseInt(req.query.macdSlow, 10) : (req.query.macdSlowPeriod ? parseInt(req.query.macdSlowPeriod, 10) : undefined),
    macdSignalPeriod: req.query.macdSignal ? parseInt(req.query.macdSignal, 10) : (req.query.macdSignalPeriod ? parseInt(req.query.macdSignalPeriod, 10) : undefined),
    bbPeriod: req.query.bbPeriod ? parseInt(req.query.bbPeriod, 10) : undefined,
    bbStdDev: req.query.bbStdDev ? parseFloat(req.query.bbStdDev) : undefined,
  };

  try {
    const { syncMultipleStocks } = await import('./data-storage.service');
    const results = await syncMultipleStocks(symbols, force, (info) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', ...info })}\n\n`);
    }, 'day', options);
    res.write(`data: ${JSON.stringify({ type: 'complete', indicators: results })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`);
    res.end();
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
