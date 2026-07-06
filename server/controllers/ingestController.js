import * as ingestService from "../services/ingestService.js";

export const getStatus = async (req, res, next) => {
  try {
    const data = await ingestService.getIngestStatus(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
