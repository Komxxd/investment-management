import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './providers/ThemeProvider';
import { CurrencyProvider } from './providers/CurrencyProvider';
import { AuthProvider } from './providers/AuthProvider';
import { SettingsProvider } from './providers/SettingsProvider';
import { PortfolioProvider } from '../features/portfolio/hooks/PortfolioContext';
import { router } from './router';

// Redirect Supabase password recovery callbacks arriving on '/' cleanly to '/login?mode=reset'
if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  const isRecoveryCallback =
    hashParams.get('type') === 'recovery' ||
    queryParams.get('type') === 'recovery' ||
    hashParams.get('error_code') === 'otp_expired';

  if (isRecoveryCallback) {
    queryParams.set('mode', 'reset');
    window.history.replaceState(
      null,
      '',
      `/login?${queryParams.toString()}${window.location.hash}`
    );
  }
}

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
