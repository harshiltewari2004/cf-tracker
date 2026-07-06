import { getDashboard } from "../services/dashboardService.js";

export const getDashboardData = async (req, res, next) => {
  try {
    const dashboard = await getDashboard(req.userId);
    res.json({ success: true, data: dashboard });
  } catch (err) {
    next(err);
  }
};
