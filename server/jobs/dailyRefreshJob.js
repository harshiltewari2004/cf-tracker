import cron from "node-cron";

import logger from "../config/logger.js";
import { DAILY_REFRESH_CRON, CRON_TIMEZONE } from "../config/constants.js";
import CFProfile from "../models/CFProfile.js";
import { enqueueDailyRefresh } from "../queues/ingestQueue.js";

export const enqueueDailyRefreshJobs = async () => {
  try {
    // D-PC-2: refresh everyone whose first ingest finished — including cold-start users,
    // since new solves are exactly what lets them leave cold start
    const profiles = await CFProfile.find({ ingestStatus: "complete" })
      .select("user")
      .lean();

    logger.info({ count: profiles.length }, "daily refresh:enqueueing jobs");

    for (const profile of profiles) {
      try {
        await enqueueDailyRefresh({ userId: profile.user });
      } catch (err) {
        logger.error(
          { err, userId: profile.user.toString() },
          "daily refresh:enqueue failed for user",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "daily refresh:job failed");
  }
};

export const scheduleDailyRefresh = () => {
  cron.schedule(DAILY_REFRESH_CRON, enqueueDailyRefreshJobs, {
    timezone: CRON_TIMEZONE,
  });
};
