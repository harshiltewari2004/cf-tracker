// scripts/verify-worker-retry.js
// Dev-only: confirms the worker marks 'failed' on the FINAL attempt, not early
// or never. Enqueues one job with bogus ids so runInitialIngest throws
// AppError(404) every attempt — a non-degraded error that rides the retry path
// and exhausts attempts, exercising `job.attemptsMade >= maxAttempts`.
import mongoose from 'mongoose';
import { Queue } from 'bullmq';

import { connectDB } from '../config/db.js';
import { connection } from '../config/redis.js';
import { INGEST_QUEUE_NAME, INGEST_JOB_INITIAL, INGEST_JOB_ATTEMPTS } from '../config/constants.js';
import '../workers/ingestWorker.js'; // side-effect import starts the consumer

const run = async () => {
  await connectDB();

  const queue = new Queue(INGEST_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: INGEST_JOB_ATTEMPTS,
      backoff: { type: 'fixed', delay: 100 }, // tiny, so 5 attempts finish in ~1s
    },
  });

  await queue.add(INGEST_JOB_INITIAL, {
    userId: new mongoose.Types.ObjectId().toString(),
    ingestJobId: new mongoose.Types.ObjectId().toString(),
  });

  setTimeout(async () => {
    await queue.close();
    await mongoose.disconnect();
    process.exit(0);
  }, 60000);
};

run();