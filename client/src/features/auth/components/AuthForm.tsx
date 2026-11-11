import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api/client';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function AuthForm() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session, refreshSession } = useAuth();

  useEffect(() => {
    setIsLogin(searchParams.get('mode') !== 'signup');
  }, [searchParams]);

  useEffect(() => {
    if (session) {
      navigate('/portfolios');
    }
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let response;
      if (isLogin) {
        response = await api.post('/api/auth/login', { email, password });
      } else {
        response = await api.post('/api/auth/signup', { email, password });
      }

      if (response && response.session && response.session.access_token) {
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
            <img src="/favicon.svg" alt="Prism" className="w-10 h-10 rounded-xl shadow-xs" />
            <div className="text-center space-y-0.5">
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-secondary">
                Prism
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-primary tracking-tight">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 p-1 bg-background border border-divider rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError(null);
              }}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${isLogin ? 'bg-primary text-background' : 'text-secondary hover:text-primary'
                }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError(null);
              }}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${!isLogin ? 'bg-primary text-background' : 'text-secondary hover:text-primary'
                }`}
            >
              Sign up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-background border border-divider rounded-xl px-3 py-2 text-xs sm:text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-background border border-divider rounded-xl px-3 py-2 text-xs sm:text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-background hover:opacity-90 font-semibold py-2.5 px-4 rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm cursor-pointer mt-2"
            >
              {loading ? 'Please wait...' : (isLogin ? 'Sign in' : 'Create account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
