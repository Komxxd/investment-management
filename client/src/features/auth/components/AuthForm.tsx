import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api/client';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { PasswordField, PasswordRequirements } from './PasswordField';
import { evaluatePassword } from '../../../utils/passwordPolicy';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

interface RecoveryState {
  isRecovery: boolean;
  accessToken: string;
  refreshToken: string;
  tokenHash: string;
  urlError: string | null;
}

/**
 * Extracts Supabase recovery tokens or recovery link errors from URL hash/query
 * synchronously during initial state initialization so React StrictMode preserves them.
 */
function parseRecoveryFromUrl(): RecoveryState {
  if (typeof window === 'undefined') {
    return {
      isRecovery: false,
      accessToken: '',
      refreshToken: '',
      tokenHash: '',
      urlError: null,
    };
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);

  const hashType = hashParams.get('type');
  const queryType = queryParams.get('type');
  const queryMode = queryParams.get('mode');
  const accessToken = hashParams.get('access_token') || '';
  const refreshToken = hashParams.get('refresh_token') || '';
  const tokenHash = queryParams.get('token_hash') || '';

  const rawError =
    hashParams.get('error_description') ||
    hashParams.get('error') ||
    queryParams.get('error_description') ||
    null;

  const isRecovery =
    hashType === 'recovery' ||
    queryType === 'recovery' ||
    queryMode === 'reset' ||
    (Boolean(accessToken) && hashType === 'recovery');

  return {
    isRecovery,
    accessToken,
    refreshToken,
    tokenHash,
    urlError: rawError ? decodeURIComponent(rawError.replace(/\+/g, ' ')) : null,
  };
}

function resolveInitialMode(searchParams: URLSearchParams, recovery: RecoveryState): AuthMode {
  if (recovery.isRecovery) return 'reset';
  const param = searchParams.get('mode');
  if (param === 'signup') return 'signup';
  if (param === 'forgot') return 'forgot';
  if (param === 'reset') return 'reset';
  return 'signin';
}

export function AuthForm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [recovery] = useState<RecoveryState>(() => parseRecoveryFromUrl());
  const [mode, setMode] = useState<AuthMode>(() => resolveInitialMode(searchParams, recovery));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(recovery.urlError);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const navigate = useNavigate();
  const { session, refreshSession } = useAuth();

  // Scrub recovery tokens/errors from the URL bar once captured in state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasHashTokens =
      window.location.hash.includes('access_token') || window.location.hash.includes('error');
    const hasQueryTokens = searchParams.has('token_hash') || searchParams.has('type');

    if (hasHashTokens) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`
      );
    }
    if (hasQueryTokens) {
      setSearchParams({ mode: 'reset' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Sync mode when query parameter ?mode=... changes (e.g. clicking Sign Up CTA from landing)
  useEffect(() => {
    const param = searchParams.get('mode');
    if (param === 'signup' && mode !== 'signup') {
      setMode('signup');
      setError(null);
      setSuccessMessage(null);
    } else if (param === 'forgot' && mode !== 'forgot') {
      setMode('forgot');
      setError(null);
      setSuccessMessage(null);
    } else if (param === 'reset' && mode !== 'reset') {
      setMode('reset');
    } else if (!param && !recovery.isRecovery && mode === 'signup') {
      setMode('signin');
    }
  }, [searchParams, mode, recovery.isRecovery]);

  // Redirect authenticated users to workspace unless actively resetting password
  useEffect(() => {
    if (session && mode !== 'reset') {
      navigate('/portfolios');
    }
  }, [session, mode, navigate]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setSuccessMessage(null);
    setPassword('');
    setConfirmPassword('');

    if (nextMode === 'signin') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ mode: nextMode }, { replace: true });
    }
  };

  const hasValidRecoveryCredential = Boolean(recovery.accessToken || recovery.tokenHash);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (mode === 'forgot') {
      setLoading(true);
      try {
        const response = await api.post('/api/auth/forgot-password', { email: email.trim() });
        setSuccessMessage(
          response?.message ||
            'If an account exists for that email, a password reset link has been sent.'
        );
      } catch (err: any) {
        setError(err.message || 'Unable to send password reset link.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'reset') {
      if (!hasValidRecoveryCredential) {
        setError('Your password reset link is missing or has expired. Request a new link below.');
        return;
      }
      const evaluation = evaluatePassword(password);
      if (!evaluation.allMet) {
        setError(evaluation.firstError || 'Please satisfy all password requirements.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setLoading(true);
      try {
        await api.post('/api/auth/reset-password', {
          password,
          accessToken: recovery.accessToken,
          refreshToken: recovery.refreshToken,
          tokenHash: recovery.tokenHash,
        });
        localStorage.removeItem('auth_token');
        await refreshSession();
        setPassword('');
        setConfirmPassword('');
        setMode('signin');
        setSearchParams({}, { replace: true });
        setSuccessMessage('Password updated successfully. Sign in with your new password.');
      } catch (err: any) {
        setError(err.message || 'Could not update password.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'signup') {
      const evaluation = evaluatePassword(password);
      if (!evaluation.allMet) {
        setError(evaluation.firstError || 'Please satisfy all password requirements.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = mode === 'signin' ? '/api/auth/login' : '/api/auth/signup';
      const response = await api.post(endpoint, { email: email.trim(), password });

      if (mode === 'signup' && !response?.session) {
        setPassword('');
        setSuccessMessage(
          'Account created. Check your email inbox to confirm your address before signing in.'
        );
        return;
      }

      if (response?.session?.access_token) {
        localStorage.setItem('auth_token', response.session.access_token);
      }

      await refreshSession();
      navigate('/portfolios');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const titleByMode: Record<AuthMode, string> = {
    signin: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Set a new password',
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to home</span>
        </Link>

        <div className="w-full bg-surface border border-divider rounded-2xl shadow-lg px-5 py-7 sm:px-6 sm:py-8">
          <div className="flex flex-col items-center mb-6 space-y-3">
            <img src="/favicon.svg" alt="Prism" className="w-10 h-10 rounded-full shadow-xs" />
            <div className="text-center space-y-0.5">
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-secondary">
                Prism
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-primary tracking-tight">
                {titleByMode[mode]}
              </h2>
            </div>
          </div>

          {/* Primary Sign in / Sign up Segmented Toggle */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="grid grid-cols-2 p-1 bg-background border border-divider rounded-xl mb-6">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'signin' ? 'bg-primary text-background' : 'text-secondary hover:text-primary'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'signup' ? 'bg-primary text-background' : 'text-secondary hover:text-primary'
                }`}
              >
                Sign up
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs text-center leading-relaxed">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-success/10 border border-success/25 rounded-xl text-success text-xs text-center leading-relaxed flex items-start justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-secondary leading-relaxed">
                Enter the email address linked to your account and we&apos;ll send a link to reset
                your password.
              </p>

              <div>
                <label htmlFor="reset-email" className="block text-xs font-medium text-secondary mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full bg-background border border-divider rounded-xl pl-3 pr-9 py-2 text-xs sm:text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                    placeholder="you@example.com"
                  />
                  <Mail className="w-4 h-4 text-tertiary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-background hover:opacity-90 font-semibold py-2.5 px-4 rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm cursor-pointer"
              >
                {loading ? 'Sending link...' : 'Send reset link'}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-xs font-medium text-secondary hover:text-primary transition-colors cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {/* Complete Password Reset Form */}
          {mode === 'reset' && (
            <div className="space-y-4">
              {!hasValidRecoveryCredential ? (
                <div className="space-y-4 text-center">
                  <p className="text-xs text-secondary leading-relaxed">
                    Your password reset link is missing or has expired. Request a fresh link to
                    continue.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="w-full bg-primary text-background hover:opacity-90 font-semibold py-2.5 px-4 rounded-xl transition-opacity text-xs sm:text-sm cursor-pointer"
                  >
                    Request new reset link
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-xs font-medium text-secondary hover:text-primary transition-colors cursor-pointer"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <PasswordField
                    id="new-password"
                    label="New password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    minLength={8}
                  />

                  <PasswordRequirements password={password} />

                  <div className="space-y-1.5">
                    <PasswordField
                      id="confirm-new-password"
                      label="Confirm new password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      autoComplete="new-password"
                      minLength={8}
                    />
                    {passwordsMatch && (
                      <p className="text-[11px] text-success font-medium">Passwords match</p>
                    )}
                    {passwordsMismatch && (
                      <p className="text-[11px] text-danger font-medium">Passwords do not match</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-background hover:opacity-90 font-semibold py-2.5 px-4 rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm cursor-pointer"
                  >
                    {loading ? 'Updating password...' : 'Update password'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Standard Sign in / Sign up Form */}
          {(mode === 'signin' || mode === 'signup') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-secondary mb-1.5">
                  Email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-background border border-divider rounded-xl px-3 py-2 text-xs sm:text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-3">
                <PasswordField
                  id="auth-password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={mode === 'signup' ? 8 : undefined}
                  rightLabelAction={
                    mode === 'signin' ? (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-[11px] font-medium text-secondary hover:text-primary transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    ) : null
                  }
                />

                {mode === 'signup' && <PasswordRequirements password={password} />}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-background hover:opacity-90 font-semibold py-2.5 px-4 rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm cursor-pointer mt-2"
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
