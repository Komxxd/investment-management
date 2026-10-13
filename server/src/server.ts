import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

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

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
// app.use(limiter); // Temporarily removed rate limiting for dev

app.get("/", (req: any, res: any) => {
    res.send("Portfolio Management API is running. Access endpoints via /api");
});

app.get("/api/health", (req: any, res: any) => {
    res.json({ status: "OK", uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);

import calculationsRoutes from './modules/calculations/calculations.routes';

// Register routes
app.use('/api/portfolios', portfoliosRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/sold-stocks', soldStocksRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/exchange-rate', exchangeRateRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/calculations', calculationsRoutes);
app.use('/api/settings', settingsRoutes);

// The corporate-actions router internally defines `/`, `/bulk`, and `/cron/sync-corp-actions`
// but the client expects `/api/corporate-actions`, `/api/bulk-corporate-actions`, and `/api/cron/sync-corp-actions`.
// A simple way to solve this is to mount it multiple times or refactor it into separate routers.
// Let's just mount it at `/api` and adjust the paths inside the router. Wait, the paths inside the router are `/`, `/bulk`, `/cron/sync-corp-actions`.
// If I mount it at `/api`, then it becomes `/api/`, `/api/bulk`, `/api/cron/sync-corp-actions`.
// Let's create an `index.routes.ts` or just map them properly.

import { initCronJobs } from './cron';

// Let's mount corporateActionsRoutes at `/api` and I will fix the router.
app.use('/api', corporateActionsRoutes);

if (!process.env.VERCEL) {
    // Initialize background cron tasks only if not on Vercel
    initCronJobs();
}

const PORT = process.env.PORT || 5001;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on ${PORT}`);
    });
}

export default app;