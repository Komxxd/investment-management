import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './providers/ThemeProvider';
import { CurrencyProvider } from './providers/CurrencyProvider';
import { AuthProvider } from './providers/AuthProvider';
import { SettingsProvider } from './providers/SettingsProvider';
import { PortfolioProvider } from '../features/portfolio/hooks/PortfolioContext';
import { router } from './router';

export default function App() {
  return (
    <ThemeProvider>
      <CurrencyProvider>
        <AuthProvider>
          <SettingsProvider>
            <PortfolioProvider>
              <RouterProvider router={router} />
            </PortfolioProvider>
          </SettingsProvider>
        </AuthProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
}
