import { Router } from 'express';
import {
  createStatelessAnonClient,
  getSupabaseConfig,
} from '../../config/supabase';
import { resolveSafeClientOrigin } from '../../config/cors';
import { validateStrongPassword } from './passwordPolicy';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ('none' as const) : ('lax' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

router.post('/signup', async (req, res) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!rawEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (!EMAIL_REGEX.test(rawEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const strength = validateStrongPassword(password);
  if (!strength.valid) {
    return res.status(400).json({ error: strength.error });
  }

  try {
    const supabase = createStatelessAnonClient();
    const redirectTo = `${resolveSafeClientOrigin(req.headers.origin)}/login`;
    const { data, error } = await supabase.auth.signUp({
      email: rawEmail,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;

    // Set cookie if session is returned (sometimes signUp requires email confirmation)
    if (data.session) {
      res.cookie('token', data.session.access_token, cookieOptions);
    }

    res.json({ user: data.user, session: data.session });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Sign up failed.' });
  }
});

router.post('/login', async (req, res) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!rawEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const supabase = createStatelessAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: rawEmail, password });
    if (error) throw error;

    res.cookie('token', data.session.access_token, cookieOptions);
    res.json({ user: data.user, session: data.session });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Authentication failed.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const supabase = createStatelessAnonClient();
    const redirectTo = `${resolveSafeClientOrigin(req.headers.origin)}/login?mode=reset`;
    const { error } = await supabase.auth.resetPasswordForEmail(rawEmail, { redirectTo });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (error.status === 429 || msg.includes('rate limit') || msg.includes('security purposes')) {
        return res.status(429).json({
          error: 'Too many reset requests. Please wait a moment and try again.',
        });
      }
      throw error;
    }

    return res.json({
      success: true,
      message: 'If an account exists for that email, a password reset link has been sent.',
    });
  } catch (error: any) {
    console.error('[auth/forgot-password] Reset email request error:', error?.message || error);
    // Avoid exposing whether an email is registered on non-rate-limit errors
    return res.json({
      success: true,
      message: 'If an account exists for that email, a password reset link has been sent.',
    });
  }
});

router.post('/reset-password', async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const accessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
  const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
  const tokenHash = typeof req.body?.tokenHash === 'string' ? req.body.tokenHash.trim() : '';

  const strength = validateStrongPassword(password);
  if (!strength.valid) {
    return res.status(400).json({ error: strength.error });
  }

  if (!accessToken && !tokenHash) {
    return res.status(400).json({
      error: 'Your password reset link is missing or has expired. Please request a new one.',
    });
  }

  try {
    const supabase = createStatelessAnonClient();

    if (tokenHash && !accessToken) {
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });
      if (verifyError || !verifyData.session) {
        return res.status(401).json({
          error: 'This password reset link is invalid or has expired. Please request a new one.',
        });
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        return res.status(400).json({ error: updateErr.message || 'Could not update password.' });
      }
      res.clearCookie('token');
      return res.json({ success: true });
    }

    // Verify recovery access token belongs to a valid user first
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return res.status(401).json({
        error: 'This password reset link is invalid or has expired. Please request a new one.',
      });
    }

    if (refreshToken) {
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionErr) {
        return res.status(401).json({
          error: 'This password reset link is invalid or has expired. Please request a new one.',
        });
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        return res.status(400).json({ error: updateErr.message || 'Could not update password.' });
      }
    } else {
      // Fallback when only recovery access_token is available (no refresh_token in redirect)
      const { url, anonKey } = getSupabaseConfig();
      const response = await fetch(`${url}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json({
          error: body?.msg || body?.message || body?.error_description || 'Could not update password.',
        });
      }
    }

    res.clearCookie('token');
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Could not update password.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/me', async (req, res) => {
  let token = req.cookies.token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const supabase = createStatelessAnonClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error) throw error;

    res.json({ user: data.user });
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
