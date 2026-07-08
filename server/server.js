import { env } from "./config/env.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth.js";
import userRouter from "./routes/user.js";
import { errorHandler } from "./middleware/errorHandler.js";
import {
  authLimiter,
  apiLimiter,
  pollLimiter,
} from "./middleware/rateLimiter.js";
import onboardingRouter from "./routes/onboarding.js";
import reliabilityRouter from "./routes/reliability.js";
import weaknessRouter from "./routes/weakness.js";
import contestsRouter from "./routes/contests.js";
import planRouter from "./routes/plan.js";
import dashboardRouter from "./routes/dashboard.js";
import benchmarkRouter from "./routes/benchmark.js";
import "./workers/ingestWorker.js";
import { connectDB } from "./config/db.js";
import ingestRouter from "./routes/ingest.js";
import { scheduleDailyRefresh } from "./jobs/dailyRefreshJob.js";
import { scheduleBenchmarkRefresh } from "./jobs/benchmarkRefreshJob.js";

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ success: true, data: { status: "ok", env: env.NODE_ENV } });
});

app.use("/api/auth", apiLimiter, authRouter);
app.use("/api/user", apiLimiter, userRouter);

app.use("/api/onboarding", apiLimiter, onboardingRouter);

app.use("/api/contests", apiLimiter, contestsRouter);

app.use("/api/ingest", pollLimiter, ingestRouter);

app.use("/api/reliability", apiLimiter, reliabilityRouter);

app.use("/api/weakness", apiLimiter, weaknessRouter);

app.use("/api/plan", apiLimiter, planRouter);

app.use("/api/dashboard", apiLimiter, dashboardRouter);

app.use('/api/benchmark', apiLimiter,benchmarkRouter);

app.use(errorHandler);

const start = async () => {
  await connectDB();
  scheduleDailyRefresh();
  scheduleBenchmarkRefresh();
  app.listen(env.PORT, () => {
    console.log(`✅ Server running on http://localhost:${env.PORT}`);
  });
};

start();
