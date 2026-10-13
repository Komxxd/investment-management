import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { HomeDashboard } from '../features/portfolio/pages/HomeDashboard';
import { PortfolioDashboard } from '../features/portfolio/pages/PortfolioDashboard';
import { AuthForm } from '../features/auth/components/AuthForm';
import { StockDetails } from '../features/stocks/pages/StockDetails';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/portfolios" replace />
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
      }
    ]
  }
]);
