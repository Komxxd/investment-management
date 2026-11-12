import type { CorsOptions } from 'cors';

const DEV_LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
];

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '');
}

/**
 * Returns the list of allowed exact origins from CLIENT_URL (plus localhost origins in non-production).
 */
export function getAllowedOrigins(): string[] {
  const configured = (process.env.CLIENT_URL || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  if (!isProductionEnv()) {
    for (const localOrigin of DEV_LOCAL_ORIGINS) {
      if (!configured.includes(localOrigin)) {
        configured.push(localOrigin);
      }
    }
  }

  return configured;
}

function getAllowedOriginPatterns(): RegExp[] {
  const raw = process.env.ALLOWED_ORIGIN_PATTERNS;
  if (!raw) return [];

  const patterns: RegExp[] = [];
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    try {
      patterns.push(new RegExp(trimmed));
    } catch (err) {
      console.warn(`Invalid ALLOWED_ORIGIN_PATTERNS entry "${trimmed}":`, err);
    }
  }
  return patterns;
}

/**
 * Checks whether a request origin matches configured exact origins or explicit regex patterns.
 */
export function isOriginAllowed(origin: string): boolean {
  const cleanOrigin = normalizeOrigin(origin);
  if (!cleanOrigin) return false;

  if (getAllowedOrigins().includes(cleanOrigin)) {
    return true;
  }

  return getAllowedOriginPatterns().some((pattern) => pattern.test(cleanOrigin));
}

/**
 * Resolves a safe redirect origin for auth links using configured allowlist or default origin.
 */
export function resolveSafeClientOrigin(rawOrigin: string | string[] | undefined): string {
  const allowed = getAllowedOrigins();
  const fallback = allowed[0] || 'http://localhost:5173';
  const reqOrigin = typeof rawOrigin === 'string' ? normalizeOrigin(rawOrigin) : '';

  if (!reqOrigin) return fallback;
  return isOriginAllowed(reqOrigin) ? reqOrigin : fallback;
}

/**
 * Strict Express CORS configuration allowing configured origins, PATCH preflights, and credentials.
 */
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header (curl, health checks, server-to-server, cron jobs)
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
