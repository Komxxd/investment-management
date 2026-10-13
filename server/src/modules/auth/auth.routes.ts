import { Router } from 'express';
import { getAnonClient } from '../../config/supabase';

const router = Router();

// Set cookie options
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' as const : 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    
    // Set cookie if session is returned (sometimes signUp requires email confirmation)
    if (data.session) {
      res.cookie('token', data.session.access_token, cookieOptions);
    }
    
    res.json({ user: data.user, session: data.session });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    res.cookie('token', data.session.access_token, cookieOptions);
    res.json({ user: data.user, session: data.session });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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
    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    
    res.json({ user: data.user });
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
