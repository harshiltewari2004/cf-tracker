import { getReliability } from "../engines/ReliabilityEngine.js";

export const getReliabilityScore = async (req, res, next) => {
  try {
    const data = await getReliability(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
