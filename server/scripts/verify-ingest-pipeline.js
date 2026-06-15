/**
 * verify-ingest-pipeline.js
 *
 * End-to-end smoke test for the ingest pipeline THROUGH the real queue.
 * Seeds (or reuses) a user + CFProfile for a given CF handle, enqueues an
 * initial ingest, and polls the IngestJob until the live worker drives it
 * terminal.
 *
 * PREREQUISITE: dev server must be running (`npm run dev`) so ingestWorker is
 * up and consuming the `ingest` queue. This script does NOT boot its own
 * worker — a second worker would compete with the dev server's for the job.
 *
 * Usage:  node scripts/verify-ingest-pipeline.js <yourCodeforcesHandle>
 */

import '../config/env.js';

import mongoose from 'mongoose';

import logger from '../config/logger.js';
import { connectDB } from '../config/db.js';
import { connection } from '../config/redis.js';
import ingestQueue, { enqueueInitialIngest } from '../queues/ingestQueue.js';
import User from '../models/User.js';
import CFProfile from '../models/CFProfile.js';
import Submission from '../models/Submission.js';
import IngestJob from '../models/IngestJob.js';

const TEST_EMAIL = 'ingest-verify@cf-tracker.local';
const POLL_INTERVAL_MS = 3000; // matches onboarding poll cadence, 05 §3.7
const POLL_TIMEOUT_MS = 8 * 60 * 1000; // covers a 2–5 min active-account ingest with margin

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const handle = process.argv[2];
if (!handle) {
  logger.error('Usage: node scripts/verify-ingest-pipeline.js <codeforcesHandle>');
  process.exit(1);
}

const run = async () => {
  await connectDB();

  // The CF handle is the unique identity (03 §2, handle is unique-indexed).
  // If a profile already owns this handle, re-ingest THAT account instead of
  // inventing a second user with the same handle (which collides on handle_1).
  let profile = await CFProfile.findOne({ handle });
  let userId;

  if (profile) {
    userId = profile.user;
    await CFProfile.updateOne(
      { _id: profile._id },
      { $set: { ingestStatus: 'pending', lastIngestedSubmissionId: null } }
    );
  } else {
    const user = await User.create({
      name: 'Ingest Verify',
      email: TEST_EMAIL,
      passwordHash: 'not-a-real-hash', // never logs in; placeholder only
      coldStartComplete: false,
    });
    userId = user._id;
    await CFProfile.create({
      user: userId,
      handle,
      ingestStatus: 'pending',
      lastIngestedSubmissionId: null,
    });
  }

  // Clear prior submissions so the count assertion is meaningful on re-runs.
  await Submission.deleteMany({ user: userId });

  logger.info({ userId: userId.toString(), handle }, 'seed complete, enqueuing ingest');

  const ingestJob = await enqueueInitialIngest({ userId });
  const ingestJobId = ingestJob._id.toString();

  // Poll the IngestJob (more certain to flip than CFProfile) until terminal.
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let job;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    job = await IngestJob.findById(ingestJobId).lean();
    logger.info({ status: job?.status }, 'polling ingest job');
    if (job?.status === 'complete' || job?.status === 'failed') break;
  }

  profile = await CFProfile.findOne({ user: userId }).lean();
  const submissionCount = await Submission.countDocuments({ user: userId });

  const checks = [
    ['IngestJob.status === complete', job?.status === 'complete'],
    ['CFProfile.ingestStatus === complete', profile?.ingestStatus === 'complete'],
    ['Submission count > 0', submissionCount > 0],
    ['handle updated', profile?.handle === handle],
  ];

  let passed = true;
  for (const [label, ok] of checks) {
    logger.info({ ok }, label);
    if (!ok) passed = false;
  }

  logger.info(
    { passed, submissionCount, jobStatus: job?.status, ingestStatus: profile?.ingestStatus },
    passed ? 'PIPELINE VERIFY PASSED' : 'PIPELINE VERIFY FAILED'
  );

  return passed;
};

run()
  .then(async (passed) => {
    await ingestQueue.close();
    await connection.quit();
    await mongoose.disconnect();
    process.exit(passed ? 0 : 1);
  })
  .catch(async (err) => {
    logger.error({ err }, 'pipeline verify crashed');
    await ingestQueue.close();
    await connection.quit();
    await mongoose.disconnect();
    process.exit(1);
  });