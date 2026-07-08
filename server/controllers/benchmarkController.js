import * as BenchmarkEngine from '../engines/BenchmarkEngine.js';

export const getBenchmarkMeta = async (req, res, next) => {
  try {
    const meta = await BenchmarkEngine.getLatestCohortMeta();
    res.json({ success: true, data: meta });
  } catch (err) {
    next(err);
  }
};