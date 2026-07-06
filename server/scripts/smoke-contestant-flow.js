import mongoose from "mongoose";
import "dotenv/config";

import { runInitialIngest } from "../ingest/IngestService.js";
import User from "../models/User.js";
import CFProfile from "../models/CFProfile.js";
import IngestJob from "../models/IngestJob.js";
import TopicBucketScore from "../models/TopicBucketScore.js";
import ReliabilityScore from "../models/ReliabilityScore.js";
import Upsolvequeue from "../models/UpsolveQueue.js";
import Submission from "../models/Submission.js";
import ContestResult from "../models/ContestResult.js";
import ContestProblemResult from "../models/ContestProblemResult.js";

const HANDLE = "harshil20";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("connected");

  const stale = await User.find({ name: "smoke-contestant" })
    .select("_id")
    .lean();
  const staleIds = stale.map((u) => u._id);
  if (staleIds.length > 0) {
    const f = { user: { $in: staleIds } };
    await CFProfile.deleteMany(f);
    await IngestJob.deleteMany(f);
    await Submission.deleteMany(f);
    await ContestResult.deleteMany(f);
    await ContestProblemResult.deleteMany(f);
    await TopicBucketScore.deleteMany(f);
    await ReliabilityScore.deleteMany(f);
    await Upsolvequeue.deleteMany(f);
    await User.deleteMany({ _id: { $in: staleIds } });
    console.log("cleared stale smoke data from prior run");
  }

  // --- Arrange: throwaway user + CFProfile + IngestJob for the real handle ---
  const user = await User.create({
    name: "smoke-contestant",
    email: `smoke-contestant-${Date.now()}@test.local`,
    passwordHash: "x",
  });

  const profile = await CFProfile.create({
    user: user._id,
    handle: HANDLE,
    ingestStatus: "pending",
  });

  const job = await IngestJob.create({
    user: user._id,
    type: "initial",
    status: "queued",
  });

  console.log(
    "running initial ingest (this hits CF API, may take a few min)...",
  );
  await runInitialIngest({ userId: user._id, ingestJobId: job._id });
  console.log("ingest complete\n");

  // ---------- TEST 1: TopicBucketScore has solves AND contest signal ----------
  const scores = await TopicBucketScore.find({ user: user._id }).lean();
  const withSolves = scores.filter((s) => s.solves > 0);
  const withContestSignal = scores.filter(
    (s) => s.contestFails > 0 || s.contestOpportunities > 0,
  );
  console.log("[TEST 1] TopicBucketScore:");
  console.log(`  total rows: ${scores.length}`);
  console.log(`  rows with solves > 0: ${withSolves.length}`);
  console.log(`  rows with contest signal > 0: ${withContestSignal.length}`);
  console.log("  sample contest-signal rows:");
  console.log(
    withContestSignal.slice(0, 5).map((s) => ({
      topic: s.topic,
      bucket: s.bucket,
      solves: s.solves,
      contestFails: s.contestFails,
      contestOpportunities: s.contestOpportunities,
      finalGap: s.finalGap,
    })),
  );
  console.log(
    "  expect: many solves rows; some contest-signal rows (recalculate ran)\n",
  );

  // ---------- TEST 2: ReliabilityScore exists ----------
  const reliability = await ReliabilityScore.findOne({ user: user._id }).lean();
  console.log("[TEST 2] ReliabilityScore:");
  console.log(
    reliability
      ? {
          aReliableCount: reliability.aReliableCount,
          bReliableCount: reliability.bReliableCount,
          totalReal: reliability.totalReal,
          reliabilityProgress: reliability.reliabilityProgress,
        }
      : "MISSING",
  );
  console.log("  expect: a document with counts (refresh ran)\n");

  // ---------- TEST 3 (teeth-check): UpsolveQueue empty (after-signup gate) ----------
  const upsolveCount = await Upsolvequeue.countDocuments({ user: user._id });
  console.log("[TEST 3] UpsolveQueue count:", upsolveCount);
  console.log("  expect: 0 — all of this handle's contests predate signup,");
  console.log("  so the after-signup gate makes seeding a no-op\n");

  // ---------- TEST 4: idempotency — re-run, nothing doubles ----------
  const solvesBefore = scores.reduce((a, s) => a + s.solves, 0);
  const failsBefore = scores.reduce((a, s) => a + s.contestFails, 0);

  // reset job to re-run
  job.status = "queued";
  job.lastIngestedSubmissionId = null;
  job.submissionsIngested = 0;
  await job.save();
  // reset cursor so it re-ingests
  profile.lastIngestedSubmissionId = null;
  profile.ingestStatus = "pending";
  await profile.save();

  console.log("re-running initial ingest for idempotency...");
  await runInitialIngest({ userId: user._id, ingestJobId: job._id });

  const scores2 = await TopicBucketScore.find({ user: user._id }).lean();
  const solvesAfter = scores2.reduce((a, s) => a + s.solves, 0);
  const failsAfter = scores2.reduce((a, s) => a + s.contestFails, 0);
  console.log("[TEST 4] idempotency:");
  console.log(`  total solves before: ${solvesBefore}, after: ${solvesAfter}`);
  console.log(
    `  total contestFails before: ${failsBefore}, after: ${failsAfter}`,
  );
  console.log("  expect: before === after ($set recompute, not $inc)\n");

  // --- Cleanup ---
  await TopicBucketScore.deleteMany({ user: user._id });
  await ReliabilityScore.deleteMany({ user: user._id });
  await Upsolvequeue.deleteMany({ user: user._id });
  // NOTE: Submission, ContestResult, ContestProblemResult also created — clean them too
  await Submission.deleteMany({ user: user._id });
  await ContestResult.deleteMany({ user: user._id });
  await ContestProblemResult.deleteMany({ user: user._id });
  await IngestJob.deleteMany({ user: user._id });
  await CFProfile.deleteOne({ _id: profile._id });
  await User.deleteOne({ _id: user._id });
  console.log("cleaned up");

  await mongoose.disconnect();
  console.log("done");
};

run().catch(async (err) => {
  console.error("smoke failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
