import cron from 'node-cron';
import { syncCorporateActions } from '../modules/corporate-actions/sync.service';

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

  console.log('[Cron] Initialized cron jobs (Daily sync at 8:00 AM IST)');
}
