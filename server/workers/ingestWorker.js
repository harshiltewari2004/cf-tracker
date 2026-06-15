import { UnrecoverableError, Worker } from "bullmq";
import logger from "../config/logger.js";
import { connection } from "../config/redis.js";
import {
  INGEST_QUEUE_NAME,
  INGEST_JOB_INITIAL,
  INGEST_JOB_DAILY_REFRESH,
  INGEST_JOB_ATTEMPTS,
  INGEST_WORKER_CONCURRENCY,
} from "../config/constants.js";

import CFProfile from "../models/CFProfile.js";
import IngestJob from "../models/IngestJob.js";
import { DegradedIngestError } from "../utils/errors.js";
import { runDailyRefresh, runInitialIngest } from "../ingest/IngestService.js";

const processIngestJob = async (job) => {
  const { userId, ingestJobId } = job.data;

  if (job.name === INGEST_JOB_INITIAL) {
    await runInitialIngest({ userId, ingestJobId });
    return;
  }
  if (job.name === INGEST_JOB_DAILY_REFRESH) {
    await runDailyRefresh({ userId, ingestJobId });
    return;
  }
  throw new UnrecoverableError(`unknown ingest job name: ${job.name}`);
};

const ingestWorker = new Worker(
  INGEST_QUEUE_NAME,
  async (job) => {
    try {
      await processIngestJob(job);
    } catch (err) {
      if (err instanceof DegradedIngestError) {
        const fatal = new UnrecoverableError(err.message);
        fatal.details = err.details;
        throw fatal;
      }
      throw err;
    }
  },
  { connection, concurrency: INGEST_WORKER_CONCURRENCY },
);

ingestWorker.on("failed", async (job, err) => {
  if (!job) {
    return;
  }
  const maxAttempts = job.opts.attempts ?? INGEST_JOB_ATTEMPTS;
  const isTerminal =
    err instanceof UnrecoverableError || job.attemptsMade >= maxAttempts;

  if (!isTerminal) {
    logger.warn(
      {
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        maxAttempts,
        err: err.message,
      },
      "ingest attempt failed,retry",
    );
    return;
  }
  const { userId, ingestJobId } = job.data;
  logger.error(
    {
      jobId: job.id,
      userId,
      ingestJobId,
      err: err.message,
      details: err.details,
    },
    "ingest job failed terminally",
  );
  try {
    await IngestJob.findByIdAndUpdate(ingestJobId, {
      status: "failed",
      error: err.message,
      completedAt: new Date(),
    });
    await CFProfile.findOneAndUpdate(
      { user: userId },
      { ingestStatus: "failed" },
    );
  } catch (markErr) {
    logger.error(
      { jobId: job.id, markErr: markErr.message },
      "failed to mark Ingest failed",
    );
  }
});

ingestWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, name: job.name }, "ingest job completed");
});

export default ingestWorker;
