import cron from 'node-cron';
import { syncCorporateActions } from '../modules/corporate-actions/sync.service';
import { evaluateAndExecuteActiveStrategies } from '../modules/strategies/strategy-monitor.service';

/**
 * Initialize all scheduled background tasks for the server.
 */
export function initCronJobs() {
  // Run every day at 8:00 AM IST (Asia/Kolkata timezone)
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Starting daily corporate action sync at 8:00 AM IST...');
    try {
      const { totalAdded } = await syncCorporateActions();
      console.log(`[Cron] Sync completed successfully. Added ${totalAdded} new corporate actions.`);
    } catch (error) {
      console.error('[Cron] Failed to sync corporate actions:', error);
    }
  }, {
    timezone: "Asia/Kolkata"
  });

  // Evaluate active portfolio strategies every 1 minute during Indian & US market hours
  cron.schedule('* * * * *', async () => {
    try {
      await evaluateAndExecuteActiveStrategies();
    } catch (error) {
      console.error('[Cron] Failed to evaluate active strategies:', error);
    }
  });

  console.log('[Cron] Initialized cron jobs (Daily corporate sync at 8:00 AM IST; 1-min strategy auto-executor)');
}
