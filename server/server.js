import { env } from './config/env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';


import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authLimiter,apiLimiter } from './middleware/rateLimiter.js';

import './workers/ingestWorker.js';
import { connectDB } from './config/db.js';

const app = express();

app.use(cors({
  origin: env.FRONTEND_ORIGIN,
  credentials: true,
}));
app.use('/api',apiLimiter);

app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', env: env.NODE_ENV } });
});

app.use('/api',authLimiter,authRouter);

app.use('/api/auth',authRouter);

app.use('/api/user',userRouter);

app.use(errorHandler);

const start = async()=>{
  await connectDB();
app.listen(env.PORT, () => {
  console.log(`✅ Server running on http://localhost:${env.PORT}`);
});
};

start();

