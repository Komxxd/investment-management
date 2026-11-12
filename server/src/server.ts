import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { corsOptions } from './config/cors';
import portfoliosRoutes from './modules/portfolios/portfolios.routes';
import stocksRoutes from './modules/stocks/stocks.routes';
import soldStocksRoutes from './modules/sold-stocks/sold-stocks.routes';
import pricesRoutes from './modules/prices/prices.routes';
import exchangeRateRoutes from './modules/prices/exchange-rate.routes';
import searchRoutes from './modules/search/search.routes';
import analysisRoutes from './modules/analysis/analysis.routes';
import corporateActionsRoutes from './modules/corporate-actions/corporate-actions.routes';
import authRoutes from './modules/auth/auth.routes';
import settingsRoutes from './modules/settings/settings.routes';
import strategiesRoutes from './modules/strategies/strategies.routes';
import backtestRoutes from './modules/backtest/backtest.routes';
import calculationsRoutes from './modules/calculations/calculations.routes';
import { initCronJobs } from './cron';

const app = express();

// Trust single reverse proxy hop (e.g., Vercel) so rate limiting resolves real client IPs
app.set('trust proxy', 1);

// Tiered rate limiters sized for live ticker/strategy polling while protecting sensitive endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) =>
    req.path === '/health' ||
    req.path.startsWith('/cron/') ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/backtest') ||
    req.path.startsWith('/strategies/evaluate') ||
    req.path.startsWith('/strategies/backtest'),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
  skip: (req) => req.method === 'GET' && req.path === '/me',
});

const simulationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many simulation requests, please try again shortly.' },
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/backtest', simulationLimiter);
app.use('/api/strategies/evaluate', simulationLimiter);
app.use('/api/strategies/backtest', simulationLimiter);

app.get('/', (req: any, res: any) => {
  res.send('Portfolio Management API is running. Access endpoints via /api');
});

app.get('/api/health', (req: any, res: any) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);
app.use('/api/portfolios', portfoliosRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/sold-stocks', soldStocksRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/exchange-rate', exchangeRateRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/calculations', calculationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/strategies', strategiesRoutes);
app.use('/api/backtest', backtestRoutes);

// Mount corporate actions routes under /api (/corporate-actions, /bulk-corporate-actions, /cron/sync-corp-actions)
app.use('/api', corporateActionsRoutes);

if (!process.env.VERCEL) {
  // Initialize background cron tasks only if not running serverless on Vercel
  initCronJobs();
}

const PORT = process.env.PORT || 5001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
  });
}

export default app;
