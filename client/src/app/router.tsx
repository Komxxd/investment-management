import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { LandingPage } from '../features/landing/pages/LandingPage';
import { HomeDashboard } from '../features/portfolio/pages/HomeDashboard';
import { PortfolioDashboard } from '../features/portfolio/pages/PortfolioDashboard';
import { AuthForm } from '../features/auth/components/AuthForm';
import { StockDetails } from '../features/stocks/pages/StockDetails';
import { BacktestResultsPage } from '../features/portfolio/pages/BacktestResultsPage';
import { BacktestPage } from '../features/portfolio/pages/BacktestPage';
import { StrategyPage } from '../features/portfolio/pages/StrategyPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />
  },
  {
    path: '/login',
    element: <AuthForm />
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
