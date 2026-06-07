import { env } from './config/env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRouter from './routes/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

import { connectDB } from './config/db.js';

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

app.use('/api/auth',authRouter);

app.use(errorHandler);

const start = async()=>{
  await connectDB();
app.listen(env.PORT, () => {
  console.log(`✅ Server running on http://localhost:${env.PORT}`);
});
};

start();

