import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api/client';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useNavigate } from 'react-router-dom';

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session, refreshSession } = useAuth();

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm bg-surface border border-divider rounded-md shadow-lg px-4 py-8 sm:px-6 sm:py-12">

        <h2 className="text-lg sm:text-xl font-semibold text-primary mb-6 sm:mb-8 text-center">
          {isLogin ? 'Welcome back' : 'Create an account'}
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded text-danger text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-secondary mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-background border border-divider rounded-md px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm text-primary focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-secondary mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-background border border-divider rounded-md px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm text-primary focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-background hover:opacity-90 font-medium py-1.5 px-3 sm:py-2 sm:px-4 rounded-md transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign in' : 'Sign up')}
          </button>
        </form>

        <div className="mt-8 text-center text-xs sm:text-sm text-secondary">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:text-secondary font-medium underline underline-offset-4"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
