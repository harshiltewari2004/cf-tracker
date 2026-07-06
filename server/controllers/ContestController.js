import { success } from "zod";
import { getContests, getContestDetail } from "../services/contestService.js";

export const getContestList = async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const data = await getContests(req.userId, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getContestById = async (req, res, next) => {
  try {
    const data = await getContestDetail(req.userId, req.params.cfContestId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
