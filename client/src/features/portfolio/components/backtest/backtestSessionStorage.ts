import type { BacktestSessionState } from './backtestResultsUtils';

export const LATEST_BACKTEST_SESSION_KEY = 'latest_backtest_session';
export const BACKTEST_HISTORY_STORAGE_KEY = 'backtest_history_v1';
const MAX_BACKTEST_HISTORY = 12;

export type BacktestRunKind = 'PORTFOLIO_SIP' | 'PORTFOLIO_ONE_TIME' | 'STRATEGY';

export interface BacktestHistoryEntry {
  id: string;
  kind: BacktestRunKind;
  title: string;
  symbol: string;
  portfolioId: string | null;
  portfolioName?: string;
  startDate: string;
  endDate: string;
  netProfit: number;
  totalReturnPct: number;
  cagrPct: number;
  maxDrawdownPct: number;
  totalTrades: number;
  createdAt: number;
  session: BacktestSessionState;
}

function writeHistoryQuotaSafe(entries: BacktestHistoryEntry[]): void {
  const trimmed = entries.slice(0, MAX_BACKTEST_HISTORY);
  while (trimmed.length > 0) {
    try {
      localStorage.setItem(BACKTEST_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
      return;
    } catch {
      // Drop the oldest entry if localStorage quota is approached by large simulation curves
      trimmed.pop();
    }
  }
  try {
    localStorage.removeItem(BACKTEST_HISTORY_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

/**
 * Persists the latest simulation session and prepends a summary record into local backtest history.
 */
export function saveBacktestSession(session: BacktestSessionState): void {
  const timestamp = session.timestamp ?? Date.now();
  const normalizedSession: BacktestSessionState = { ...session, timestamp };

  try {
    localStorage.setItem(LATEST_BACKTEST_SESSION_KEY, JSON.stringify(normalizedSession));
  } catch {
    // Ignore storage quota errors on latest session write
  }

  const result = normalizedSession.result;
  if (!result) return;

  const mode = normalizedSession.portfolioConfig?.mode || normalizedSession.mode;
  const kind: BacktestRunKind =
    mode === 'SIP'
      ? 'PORTFOLIO_SIP'
      : mode === 'ONE_TIME'
        ? 'PORTFOLIO_ONE_TIME'
        : 'STRATEGY';

  const summary = result.summary;
  const entry: BacktestHistoryEntry = {
    id: `bt-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    title:
      normalizedSession.rule?.name ||
      normalizedSession.portfolioConfig?.portfolioName ||
      result.symbol ||
      'Backtest Simulation',
    symbol: result.symbol || normalizedSession.rule?.targetSymbol || 'PORTFOLIO',
    portfolioId: normalizedSession.portfolioId || null,
    portfolioName: normalizedSession.portfolioConfig?.portfolioName,
    startDate: (summary?.startDate || '').split(' ')[0].split('T')[0],
    endDate: (summary?.endDate || '').split(' ')[0].split('T')[0],
    netProfit: summary?.netProfit ?? 0,
    totalReturnPct: summary?.totalReturnPct ?? 0,
    cagrPct: summary?.cagrPct ?? summary?.totalReturnPct ?? 0,
    maxDrawdownPct: summary?.maxDrawdownPct ?? 0,
    totalTrades: summary?.totalTrades ?? result.trades?.length ?? 0,
    createdAt: timestamp,
    session: normalizedSession,
  };

  const existing = loadBacktestHistory();
  writeHistoryQuotaSafe([entry, ...existing]);
}

/**
 * Reads stored recent backtest simulation runs sorted newest first.
 */
export function loadBacktestHistory(): BacktestHistoryEntry[] {
  try {
    const raw = localStorage.getItem(BACKTEST_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is BacktestHistoryEntry =>
        Boolean(item && typeof item.id === 'string' && item.session?.result && item.session?.rule)
    );
  } catch {
    return [];
  }
}

/**
 * Sets a historical entry as the active session before navigating to BacktestResultsPage.
 */
export function activateBacktestHistorySession(entry: BacktestHistoryEntry): void {
  try {
    localStorage.setItem(LATEST_BACKTEST_SESSION_KEY, JSON.stringify(entry.session));
  } catch {
    // Ignore storage write errors; router state still delivers the session
  }
}

/**
 * Removes a single run from backtest history and returns the updated list.
 */
export function deleteBacktestHistoryEntry(id: string): BacktestHistoryEntry[] {
  const next = loadBacktestHistory().filter(item => item.id !== id);
  writeHistoryQuotaSafe(next);
  return next;
}

/**
 * Clears all stored recent simulation runs from local history.
 */
export function clearBacktestHistory(): void {
  try {
    localStorage.removeItem(BACKTEST_HISTORY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

