import { getWeakness } from "../engines/GapEngine.js";
import * as DailyPlanEngine from "../engines/DailyPlanEngine.js";
export const getWeaknessScores = async (req, res, next) => {
  try {
    const data = await getWeakness(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getLedger = async (req, res, next) => {
  try {
    const ledger = await DailyPlanEngine.getLedger(req.userId);
    res.json({ success: true, data: ledger });
  } catch (err) {
    next(err);
  }
};