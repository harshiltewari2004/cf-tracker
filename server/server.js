import { env } from './config/env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';


import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authLimiter,apiLimiter,pollLimiter } from './middleware/rateLimiter.js';
import onboardingRouter from './routes/onboarding.js';
import reliabilityRouter from './routes/reliability.js';

import './workers/ingestWorker.js';
import { connectDB } from './config/db.js';
import ingestRouter from './routes/ingest.js';
import { scheduleDailyRefresh } from './jobs/dailyRefreshJob.js';
import { scheduleBenchmarkRefresh } from './jobs/benchmarkRefreshJob.js';

const app = express();

app.use(cors({
  origin: env.FRONTEND_ORIGIN,
  credentials: true,
}));


app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', env: env.NODE_ENV } });
});

app.use('/api',authLimiter,authRouter);

app.use('/api/auth',authRouter,userRouter);

app.use('/api/onboarding',apiLimiter,onboardingRouter);

app.use('/api/ingest',pollLimiter,ingestRouter);

app.use('/api/reliability', apiLimiter, reliabilityRouter);

app.use(errorHandler);

const start = async()=>{
  await connectDB();
  scheduleDailyRefresh();
  scheduleBenchmarkRefresh();
app.listen(env.PORT, () => {
  console.log(`✅ Server running on http://localhost:${env.PORT}`);
});
};

start();

