import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  UUID_REGEX,
  DATE_REGEX,
  isMissingTableError,
  getTodayUtcDate,
} from './strategy-execution.service';
import {
  formatStrategyLog,
  writeRouteStrategyLog,
} from './strategy-route-helpers';

const router = Router();

const EVENT_RANK: Record<string, number> = {
  STRATEGY_STARTED: 0,
  SIGNAL_TRIGGERED: 1,
  ACTION_EXECUTED: 2,
  STRATEGY_PAUSED: 3,
  STRATEGY_RESUMED: 4,
};

// GET /api/strategies/logs - Fetch chronological strategy execution logs
router.get('/', authMiddleware, async (req: any, res: any) => {
  try {
    const portfolioId = typeof req.query?.portfolio_id === 'string' ? req.query.portfolio_id.trim() : '';
    const symbol = typeof req.query?.symbol === 'string' ? req.query.symbol.trim() : '';

    if (portfolioId && !UUID_REGEX.test(portfolioId)) {
      return res.status(400).json({ error: 'Invalid portfolio_id format.' });
    }

    let logsQuery = req.supabase
      .from('strategy_logs')
      .select('*')
      .order('logged_at', { ascending: true });
    if (portfolioId) {
      logsQuery = logsQuery.or(`portfolio_id.eq.${portfolioId},portfolio_id.is.null`);
    }
    if (symbol && symbol !== 'ALL') {
      logsQuery = logsQuery.in('symbol', [symbol, 'ALL']);
    }

    let strategiesQuery = req.supabase
      .from('portfolio_strategies')
      .select('id, portfolio_id, name, scope, target_symbol, enabled, created_at, updated_at')
      .order('created_at', { ascending: true });
    if (portfolioId) {
      strategiesQuery = strategiesQuery.or(`portfolio_id.eq.${portfolioId},portfolio_id.is.null`);
    }

    let executionsQuery = req.supabase
      .from('strategy_executions')
      .select('*')
      .order('executed_at', { ascending: true });
    if (portfolioId) {
      executionsQuery = executionsQuery.eq('portfolio_id', portfolioId);
    }
    if (symbol && symbol !== 'ALL') {
      executionsQuery = executionsQuery.eq('symbol', symbol);
    }

    const [logsRes, strategiesRes, executionsRes] = await Promise.all([
      logsQuery,
      strategiesQuery,
      executionsQuery,
    ]);

    let missingTable = false;
    const logs: any[] = [];

    if (logsRes.error) {
      if (isMissingTableError(logsRes.error)) {
        missingTable = true;
      } else {
        return res.status(500).json({ error: logsRes.error.message });
      }
    } else {
      for (const row of logsRes.data || []) {
        const formatted = formatStrategyLog(row);
        if (formatted) logs.push(formatted);
      }
    }

    const recordedStartedStrategyIds = new Set(
      logs
        .filter((l) => l.eventType === 'STRATEGY_STARTED' && l.strategyId)
        .map((l) => String(l.strategyId))
    );

    const recordedPausedStrategyIds = new Set(
      logs
        .filter((l) => l.eventType === 'STRATEGY_PAUSED' && l.strategyId)
        .map((l) => String(l.strategyId))
    );

    const recordedExecutionKeys = new Set(
      logs
        .filter((l) => l.eventType === 'ACTION_EXECUTED' && l.eventDate)
        .map((l) => `${l.portfolioId || ''}:${l.symbol || ''}:${l.eventDate}:${l.signal || ''}`)
    );

    if (!strategiesRes.error) {
      for (const strat of strategiesRes.data || []) {
        if (!strat || strat.id === 'rule-default') continue;
        const hasSpecificSymbol = Boolean(symbol && symbol !== 'ALL');
        const appliesToStock = !hasSpecificSymbol
          ? true
          : strat.scope === 'global' ||
            strat.target_symbol === 'ALL' ||
            strat.target_symbol === symbol;

        if (!appliesToStock) {
          continue;
        }

        const resolvedSymbol = hasSpecificSymbol ? symbol : (strat.target_symbol || 'ALL');
        const resolvedPortfolioId = strat.portfolio_id || portfolioId || null;

        if (!recordedStartedStrategyIds.has(String(strat.id))) {
          logs.push({
            id: `start-${strat.id}`,
            portfolioId: resolvedPortfolioId,
            strategyId: strat.id,
            strategyName: strat.name || 'Strategy',
            symbol: resolvedSymbol,
            eventType: 'STRATEGY_STARTED',
            actionText: `Strategy "${strat.name || 'Untitled Strategy'}" started`,
            signal: null,
            eventDate: strat.created_at ? String(strat.created_at).split('T')[0] : null,
            loggedAt: strat.created_at,
            metadata: {
              scope: strat.scope || 'global',
              enabled: strat.enabled !== false,
            },
            source: 'strategy',
          });
        }

        if (
          strat.enabled === false &&
          !recordedPausedStrategyIds.has(String(strat.id)) &&
          strat.updated_at
        ) {
          logs.push({
            id: `pause-${strat.id}`,
            portfolioId: resolvedPortfolioId,
            strategyId: strat.id,
            strategyName: strat.name || 'Strategy',
            symbol: strat.target_symbol || resolvedSymbol,
            eventType: 'STRATEGY_PAUSED',
            actionText: `Strategy "${strat.name || 'Untitled Strategy'}" paused`,
            signal: null,
            eventDate: String(strat.updated_at).split('T')[0],
            loggedAt: strat.updated_at,
            metadata: {
              scope: strat.scope || 'global',
              enabled: false,
            },
            source: 'strategy',
          });
        }
      }
    } else if (!isMissingTableError(strategiesRes.error)) {
      console.warn('Non-fatal strategy_logs portfolio_strategies lookup error:', strategiesRes.error);
    }

    if (!executionsRes.error) {
      for (const exec of executionsRes.data || []) {
        const execKey = `${exec.portfolio_id || ''}:${exec.symbol || ''}:${exec.execution_date}:${exec.action || ''}`;
        if (recordedExecutionKeys.has(execKey)) continue;

        const qty = Number(exec.quantity) || 0;
        const price = Number(exec.price) || 0;
        logs.push({
          id: `exec-${exec.id}`,
          portfolioId: exec.portfolio_id || portfolioId || null,
          strategyId: exec.strategy_id || null,
          strategyName: exec.strategy_name || null,
          symbol: exec.symbol || symbol || 'ALL',
          eventType: 'ACTION_EXECUTED',
          actionText: `Executed ${exec.action} ${qty} ${qty === 1 ? 'share' : 'shares'}${exec.strategy_name ? ` (${exec.strategy_name})` : ''}`,
          signal: exec.action || null,
          eventDate: exec.execution_date || null,
          loggedAt: exec.executed_at,
          metadata: { action: exec.action, quantity: qty, price },
          source: 'execution',
        });
      }
    } else if (!isMissingTableError(executionsRes.error)) {
      console.warn('Non-fatal strategy_logs strategy_executions lookup error:', executionsRes.error);
    }

    logs.sort((a, b) => {
      const timeA = a.loggedAt ? new Date(a.loggedAt).getTime() : 0;
      const timeB = b.loggedAt ? new Date(b.loggedAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (EVENT_RANK[a.eventType] ?? 9) - (EVENT_RANK[b.eventType] ?? 9);
    });

    return res.json({ logs, missingTable });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch strategy logs' });
  }
});

// POST /api/strategies/logs/signal - Record first signal occurrence per stock per day
router.post('/signal', authMiddleware, async (req: any, res: any) => {
  try {
    const portfolioId = req.body?.portfolio_id || req.body?.portfolioId;
    const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim() : '';
    const signal = req.body?.signal;
    const rawStrategyId = req.body?.strategy_id || req.body?.strategyId;
    const strategyId =
      typeof rawStrategyId === 'string' && UUID_REGEX.test(rawStrategyId) ? rawStrategyId : null;
    const strategyName =
      typeof (req.body?.strategy_name || req.body?.strategyName) === 'string'
        ? String(req.body?.strategy_name || req.body?.strategyName).trim() || null
        : null;
    const rawPrice = req.body?.price;
    const price = rawPrice !== undefined && rawPrice !== null ? Number(rawPrice) : NaN;
    const rawDate = req.body?.event_date || req.body?.eventDate;
    const eventDate =
      typeof rawDate === 'string' && DATE_REGEX.test(rawDate) ? rawDate : getTodayUtcDate();

    if (!portfolioId || !UUID_REGEX.test(String(portfolioId))) {
      return res.status(400).json({ error: 'Valid portfolio_id is required.' });
    }
    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required.' });
    }
    if (signal !== 'BUY' && signal !== 'SELL') {
      return res.status(400).json({ error: 'Signal must be BUY or SELL.' });
    }

    const metadata: Record<string, any> = { signal };
    if (Number.isFinite(price) && price > 0) {
      metadata.price = price;
    }

    const actionText = `${signal} signal came${strategyName ? ` (${strategyName})` : ''}`;

    const result = await writeRouteStrategyLog(req.supabase, {
      userId: req.user.id,
      portfolioId: String(portfolioId),
      strategyId,
      strategyName,
      symbol,
      eventType: 'SIGNAL_TRIGGERED',
      actionText,
      signal,
      eventDate,
      metadata,
    });

    if (result.missingTable) {
      return res.status(200).json({
        persisted: false,
        missingTable: true,
        log: {
          id: `local-${symbol}-${signal}-${eventDate}`,
          portfolioId: String(portfolioId),
          strategyId,
          strategyName,
          symbol,
          eventType: 'SIGNAL_TRIGGERED',
          actionText,
          signal,
          eventDate,
          loggedAt: new Date().toISOString(),
          metadata,
          source: 'local',
        },
      });
    }

    if (result.alreadyRecorded) {
      return res.status(200).json({
        persisted: true,
        alreadyRecorded: true,
      });
    }

    return res.status(201).json({
      persisted: true,
      alreadyRecorded: false,
      log: formatStrategyLog(result.row),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to record strategy signal log' });
  }
});

export default router;

