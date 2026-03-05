/**
 * Weekly Email Cron Job
 * Runs every Monday at 8:00 AM (configurable via CRON_SCHEDULE env var).
 * For each active listing with a FUB contact ID:
 *   1. Fetches latest listing data
 *   2. Generates PDF report card
 *   3. Posts event to FUB (triggers Action Plan email)
 *   4. Logs the send in email_log
 */

import * as nodeCron from "node-cron";
import { getActiveListingsForCron, getActiveMagicLinkForListing, getFullListingData, logEmail } from "./db";
import { sendWeeklyReportToFub } from "./fub";
import { syncAllListings, runListTracTestCall } from "./listtrac";

// Default: Monday at 8:00 AM. Override with CRON_SCHEDULE env var.
// Format: seconds minutes hours day-of-month month day-of-week
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? "0 0 8 * * 1";
// ListTrac nightly sync: 2 AM every day
const LISTTRAC_CRON_SCHEDULE = process.env.LISTTRAC_CRON_SCHEDULE ?? "0 0 2 * * *";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

let cronJob: nodeCron.ScheduledTask | null = null;
let listTracCronJob: nodeCron.ScheduledTask | null = null;

export async function runWeeklyEmailJob(): Promise<{ processed: number; errors: number }> {
  console.log("[Cron] Starting weekly email job...");
  let processed = 0;
  let errors = 0;

  try {
    const activeListings = await getActiveListingsForCron();
    console.log(`[Cron] Found ${activeListings.length} active listings`);

    for (const listing of activeListings) {
      try {
        // Skip listings without FUB contact ID
        if (!listing.fubContactId) {
          console.log(`[Cron] Skipping listing ${listing.id} — no FUB contact ID`);
          await logEmail({
            listingId: listing.id,
            status: "skipped",
            errorMessage: "No FUB contact ID configured",
          });
          continue;
        }

        // Get active magic link
        const magicLink = await getActiveMagicLinkForListing(listing.id);
        if (!magicLink) {
          console.log(`[Cron] Skipping listing ${listing.id} — no active magic link`);
          await logEmail({
            listingId: listing.id,
            status: "skipped",
            errorMessage: "No active magic link",
          });
          continue;
        }

        // Check magic link expiry
        if (new Date() > magicLink.expiresAt) {
          console.log(`[Cron] Skipping listing ${listing.id} — magic link expired`);
          await logEmail({
            listingId: listing.id,
            status: "skipped",
            errorMessage: "Magic link expired",
          });
          continue;
        }

        const magicLinkUrl = `${BASE_URL}/report/${magicLink.token}`;
        const fullData = await getFullListingData(listing.id);

        // Calculate totals from latest weekly stats
        const latestStats = fullData?.weeklyStats[0];
        const totalPortalViews = (latestStats?.zillowViews ?? 0) +
          (latestStats?.realtorViews ?? 0) +
          (latestStats?.redfinViews ?? 0) +
          (latestStats?.websiteViews ?? 0);

        // Post to FUB
        const { eventId } = await sendWeeklyReportToFub({
          fubContactId: listing.fubContactId,
          listingAddress: listing.address,
          magicLinkUrl,
          agentName: listing.agentName ?? undefined,
        });

        await logEmail({
          listingId: listing.id,
          status: eventId ? "sent" : "failed",
          fubEventId: eventId ?? undefined,
          errorMessage: eventId ? undefined : "FUB event post failed",
        });

        if (eventId) {
          processed++;
          console.log(`[Cron] ✓ Sent report for listing ${listing.id} (${listing.address})`);
        } else {
          errors++;
          console.error(`[Cron] ✗ Failed to send report for listing ${listing.id}`);
        }
      } catch (err: any) {
        errors++;
        console.error(`[Cron] Error processing listing ${listing.id}:`, err.message);
        await logEmail({
          listingId: listing.id,
          status: "failed",
          errorMessage: err.message,
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    console.error("[Cron] Fatal error in weekly email job:", err.message);
    errors++;
  }

  console.log(`[Cron] Weekly email job complete. Processed: ${processed}, Errors: ${errors}`);
  return { processed, errors };
}

export function startCronJob(): void {
  if (cronJob) {
    console.log("[Cron] Job already running");
    return;
  }

  if (!nodeCron.validate(CRON_SCHEDULE)) {
    console.error(`[Cron] Invalid cron schedule: ${CRON_SCHEDULE}`);
    return;
  }

  cronJob = nodeCron.schedule(CRON_SCHEDULE, async () => {
    await runWeeklyEmailJob();
  }, {
    timezone: process.env.CRON_TIMEZONE ?? "America/New_York",
  });

  console.log(`[Cron] Weekly email job scheduled: ${CRON_SCHEDULE} (${process.env.CRON_TIMEZONE ?? "America/New_York"})`);

  // Start ListTrac nightly sync cron (2 AM daily)
  if (!listTracCronJob && nodeCron.validate(LISTTRAC_CRON_SCHEDULE)) {
    listTracCronJob = nodeCron.schedule(LISTTRAC_CRON_SCHEDULE, async () => {
      console.log("[ListTrac Cron] Starting nightly sync...");
      await syncAllListings();
      console.log("[ListTrac Cron] Nightly sync complete");
    }, {
      timezone: process.env.CRON_TIMEZONE ?? "America/New_York",
    });
    console.log(`[ListTrac Cron] Nightly sync scheduled: ${LISTTRAC_CRON_SCHEDULE} (America/New_York)`);
  }

  // Run ListTrac test call 3 seconds after startup to confirm credentials
  setTimeout(() => {
    runListTracTestCall().catch(console.error);
  }, 3000);
}

export function stopCronJob(): void {
  cronJob?.stop();
  cronJob = null;
  listTracCronJob?.stop();
  listTracCronJob = null;
  console.log("[Cron] All jobs stopped");
}
