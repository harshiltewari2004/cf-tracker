import cron from "node-cron";

import logger from "../config/logger.js";
import { DAILY_REFRESH_CRON, CRON_TIMEZONE } from "../config/constants.js";
import User from "../models/User.js";
import { enqueueDailyRefresh } from "../queues/ingestQueue.js";

export const enqueueDailyRefreshJobs = async () => {
  try {
    const users = await User.find({ coldStartComplete: true })
      .select("_id")
      .lean();

    logger.info({ count: users.length }, "daily refresh:enqueueing jobs");

    for (const user of users) {
      try {
        await enqueueDailyRefresh({ userId: user._id });
      } catch (err) {
        logger.error(
          { err, userId: user._id.toString() },
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
