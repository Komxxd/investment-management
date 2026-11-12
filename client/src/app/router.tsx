import { Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { lazyNamed } from '../utils/lazyNamed';

const LandingPage = lazyNamed(() => import('../features/landing/pages/LandingPage'), 'LandingPage');
const AuthForm = lazyNamed(() => import('../features/auth/components/AuthForm'), 'AuthForm');
const HomeDashboard = lazyNamed(() => import('../features/portfolio/pages/HomeDashboard'), 'HomeDashboard');
const PortfolioDashboard = lazyNamed(() => import('../features/portfolio/pages/PortfolioDashboard'), 'PortfolioDashboard');
const StockDetails = lazyNamed(() => import('../features/stocks/pages/StockDetails'), 'StockDetails');
const StrategyPage = lazyNamed(() => import('../features/portfolio/pages/StrategyPage'), 'StrategyPage');
const BacktestPage = lazyNamed(() => import('../features/portfolio/pages/BacktestPage'), 'BacktestPage');
const BacktestResultsPage = lazyNamed(() => import('../features/portfolio/pages/BacktestResultsPage'), 'BacktestResultsPage');

function withFullScreenSuspense(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="w-8 h-8 border-2 border-divider border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin" />
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: withFullScreenSuspense(<LandingPage />)
  },
  {
    path: '/login',
    element: withFullScreenSuspense(<AuthForm />)
  },
  {
    element: <AppLayout />,
    children: [
      {
        path: '/portfolios',
        element: <HomeDashboard />,
      },
      {
        path: '/portfolio/:portfolioId',
        element: <PortfolioDashboard />,
      },
      {
        path: '/stocks/:symbol',
        element: <StockDetails />,
      },
      {
        path: '/strategy',
        element: <StrategyPage />,
      },
      {
        path: '/portfolio/:portfolioId/strategy',
        element: <StrategyPage />,
      },
      {
        path: '/backtest',
        element: <BacktestPage />,
      },
      {
        path: '/portfolio/:portfolioId/backtest',
        element: <BacktestPage />,
      },
      {
        path: '/backtest/results',
        element: <BacktestResultsPage />,
      },
      {
        path: '/portfolio/:portfolioId/backtest/results',
        element: <BacktestResultsPage />,
      }
    ]
  }
]);
