import { Request, Response, NextFunction } from 'express';
import { createUserClient } from '../config/supabase';

/**
 * Auth middleware that verifies the JWT token from cookies (or Authorization header),
 * creates a user-scoped Supabase client, and attaches both to the request.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid authentication token' });
  }

  try {
    const supabase = createUserClient(token);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    (req as any).user = user;
    (req as any).supabase = supabase;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
