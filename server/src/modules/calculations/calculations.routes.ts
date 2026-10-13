import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { calculatePortfolioStats } from './pnl.service';
import { fetchPrices } from '../prices/prices.service';
import { getExchangeRate } from '../prices/exchange-rate.service';
import type { Stock, SoldStock } from '../../shared/types';

const router = Router();

// GET /api/calculations/portfolio/:id/summary
router.get('/portfolio/:id/summary', authMiddleware, async (req: any, res: any) => {
  try {
    const portfolioId = req.params.id;
    
    // 1. Fetch stocks and sold stocks for this portfolio
    const [stocksResponse, soldStocksResponse] = await Promise.all([
      req.supabase.from('stocks').select('*').eq('portfolio_id', portfolioId),
      req.supabase.from('sold_stocks').select('*').eq('portfolio_id', portfolioId)
    ]);

    if (stocksResponse.error) throw stocksResponse.error;
    if (soldStocksResponse.error) throw soldStocksResponse.error;

    const stocks: Stock[] = stocksResponse.data || [];
    const soldStocks: SoldStock[] = soldStocksResponse.data || [];

    // 2. Fetch live prices for all unique symbols
    const uniqueSymbols = [...new Set([
      ...stocks.map(s => s.symbol),
      ...soldStocks.map(s => s.symbol)
    ])];
    
    const livePrices = uniqueSymbols.length > 0 ? await fetchPrices(uniqueSymbols) : {};

    const usdToInrRate = await getExchangeRate('USD', 'INR');

    // 3. Calculate stats
    const result = calculatePortfolioStats(stocks, soldStocks, livePrices, usdToInrRate);
    
    // Add weights
    if (result.summary.totalInvestment > 0) {
      result.symbolGroups.forEach(g => {
        (g as any).portfolioWeight = (g.netCostBasis / result.summary.totalInvestment) * 100;
      });
    }
    if (result.summary.totalCurrentValue > 0) {
      result.symbolGroups.forEach(g => {
        (g as any).currentValueWeight = (g.currentValue / result.summary.totalCurrentValue) * 100;
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Portfolio Summary Error:', error);
    res.status(500).json({ error: 'Failed to calculate portfolio summary' });
  }
});

// GET /api/calculations/dashboard/stats
router.get('/dashboard/stats', authMiddleware, async (req: any, res: any) => {
  try {
    // 1. Fetch ALL stocks and sold stocks for this user across all portfolios
    // But we only want active portfolios (not deleted)
    const { data: portfolios, error: portError } = await req.supabase
      .from('portfolios')
      .select('id')
      .is('deleted_at', null);
      
    if (portError) throw portError;
    
    if (!portfolios || portfolios.length === 0) {
      return res.json({ summary: null, symbolGroups: [] });
    }
    
    const activePortfolioIds = portfolios.map((p: any) => p.id);

    const [stocksResponse, soldStocksResponse] = await Promise.all([
      req.supabase.from('stocks').select('*').in('portfolio_id', activePortfolioIds),
      req.supabase.from('sold_stocks').select('*').in('portfolio_id', activePortfolioIds)
    ]);

    if (stocksResponse.error) throw stocksResponse.error;
    if (soldStocksResponse.error) throw soldStocksResponse.error;

    const stocks: Stock[] = stocksResponse.data || [];
    const soldStocks: SoldStock[] = soldStocksResponse.data || [];

    // 2. Fetch live prices
    const uniqueSymbols = [...new Set([
      ...stocks.map(s => s.symbol),
      ...soldStocks.map(s => s.symbol)
    ])];
    
    const livePrices = uniqueSymbols.length > 0 ? await fetchPrices(uniqueSymbols) : {};

    const usdToInrRate = await getExchangeRate('USD', 'INR');
    
    // 3. Calculate global stats (filtered by multi-select if provided)
    let targetPortfolioIds = activePortfolioIds;
    if (req.query.portfolioIds && req.query.portfolioIds !== 'ALL') {
      const pIdsString = Array.isArray(req.query.portfolioIds) 
        ? req.query.portfolioIds.join(',') 
        : String(req.query.portfolioIds);
      const requestedIds = pIdsString.split(',');
      targetPortfolioIds = activePortfolioIds.filter((id: string) => requestedIds.includes(id));
    }
    const filteredStocks = stocks.filter((s: any) => targetPortfolioIds.includes(s.portfolio_id));
    const filteredSoldStocks = soldStocks.filter((s: any) => targetPortfolioIds.includes(s.portfolio_id));
    const result = calculatePortfolioStats(filteredStocks, filteredSoldStocks, livePrices, usdToInrRate);
    
    // 4. Calculate per-portfolio stats
    const portfolioSummaries: Record<string, any> = {};
    for (const pid of activePortfolioIds) {
      const pStocks = stocks.filter((s: any) => s.portfolio_id === pid);
      const pSoldStocks = soldStocks.filter((s: any) => s.portfolio_id === pid);
      if (pStocks.length > 0 || pSoldStocks.length > 0) {
         const pResult = calculatePortfolioStats(pStocks, pSoldStocks, livePrices, usdToInrRate);
         portfolioSummaries[pid] = pResult.summary;
      }
    }
    
    res.json({ ...result, portfolioSummaries });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ error: 'Failed to calculate dashboard stats' });
  }
});

// GET /api/calculations/historical
router.get('/historical', authMiddleware, async (req: any, res: any) => {
  try {
    const timeframe = req.query.timeframe || '1Y'; // 1M, 3M, 6M, 1Y, ALL
    
    let query = req.supabase
      .from('portfolios')
      .select('id')
      .is('deleted_at', null);

    if (req.query.portfolioId && req.query.portfolioId !== 'ALL') {
      const pIdsString = Array.isArray(req.query.portfolioId) 
        ? req.query.portfolioId.join(',') 
        : String(req.query.portfolioId);
      const requestedIds = pIdsString.split(',');
      query = query.in('id', requestedIds);
    }

    const { data: portfolios, error: portError } = await query;
      
    if (portError) throw portError;
    
    if (!portfolios || portfolios.length === 0) {
      return res.json([]);
    }
    
    const activePortfolioIds = portfolios.map((p: any) => p.id);

    const [stocksResponse, soldStocksResponse] = await Promise.all([
      req.supabase.from('stocks').select('*').in('portfolio_id', activePortfolioIds),
      req.supabase.from('sold_stocks').select('*').in('portfolio_id', activePortfolioIds)
    ]);

    if (stocksResponse.error) throw stocksResponse.error;
    if (soldStocksResponse.error) throw soldStocksResponse.error;

    const stocks: Stock[] = stocksResponse.data || [];
    const soldStocks: SoldStock[] = soldStocksResponse.data || [];

    const endDate = new Date();
    let startDate = new Date();
    
    if (timeframe === '1M') startDate.setMonth(startDate.getMonth() - 1);
    else if (timeframe === '3M') startDate.setMonth(startDate.getMonth() - 3);
    else if (timeframe === '6M') startDate.setMonth(startDate.getMonth() - 6);
    else if (timeframe === '1Y') startDate.setFullYear(startDate.getFullYear() - 1);
    else if (timeframe === 'ALL') {
      // Find oldest transaction
      const oldestBuy = Math.min(...stocks.map(s => new Date(s.entry_date).getTime()));
      startDate = new Date(oldestBuy);
      if (isNaN(startDate.getTime())) startDate = new Date(); // fallback
    }

    const { calculateHistoricalPerformance } = await import('./historical.service');
    const result = await calculateHistoricalPerformance(stocks, soldStocks, startDate, endDate);
    
    res.json(result);
  } catch (error) {
    console.error('Historical Data Error:', error);
    res.status(500).json({ error: 'Failed to calculate historical data' });
  }
});

export default router;
