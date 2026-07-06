import logger from "../config/logger.js";
import { generatePlan } from "../engines/DailyPlanEngine.js";
import { getReliability } from "../engines/ReliabilityEngine.js";
import { getWeakness } from "../engines/GapEngine.js";
import { getContests } from "./contestService.js";

import {
  DASHBOARD_RECENT_CONTESTS_LIMIT,
  DASHBOARD_TOP_GAPS_LIMIT,
} from "../config/constants.js";

export const getDashboard = async (userId) => {
  const [plan, reliability, recentContests, topGaps] = await Promise.all([
    generatePlan(userId, new Date()).catch((err) => {
      logger.warn({ err, userId }, "dashboard:plan section failed");
      return null;
    }),
    getReliability(userId).catch((err) => {
      logger.warn({ err, userId }, "dashboard:reliability section failed");
      return null;
    }),
    getContests(userId, DASHBOARD_RECENT_CONTESTS_LIMIT).catch((err) => {
      logger.warn({ err, userId }, "dashboard:contests section failed");
      return null;
    }),
    getWeakness(userId).catch((err) => {
      logger.warn({ err, userId }, "dashboard:gaps section failed");
      return null;
    }),
  ]);

  return {
    plan,
    reliability,
    recentContests,
    topGaps: (topGaps ?? []).slice(0, DASHBOARD_TOP_GAPS_LIMIT),
  };
};
