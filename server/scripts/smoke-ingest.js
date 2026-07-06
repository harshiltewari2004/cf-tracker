// server/scripts/smoke-ingest.js
// Scratch harness for IngestService. NOT a Vitest test — run manually.
//
// Usage:
//   node scripts/smoke-ingest.js <cfHandle> --wipe     # clean slate + initial ingest
//   node scripts/smoke-ingest.js <cfHandle>            # re-run on existing data (idempotency)
//   node scripts/smoke-ingest.js <cfHandle> --refresh  # daily refresh path
import "dotenv/config";
import mongoose from "mongoose";

import { env } from "../config/env.js";
import User from "../models/User.js";
import CFProfile from "../models/CFProfile.js";
import IngestJob from "../models/IngestJob.js";
import Submission from "../models/Submission.js";
import ContestResult from "../models/ContestResult.js";
import ContestProblemResult from "../models/ContestProblemResult.js";
import { runInitialIngest, runDailyRefresh } from "../ingest/IngestService.js";

const SMOKE_EMAIL = "smoke-ingest@local.test";

const handle = process.argv[2];
const wipe = process.argv.includes("--wipe");
const refresh = process.argv.includes("--refresh");

if (!handle) {
  console.error(
    "Usage: node scripts/smoke-ingest.js <cfHandle> [--wipe] [--refresh]",
  );
  process.exit(1);
}

const wipeSmokeData = async (userId) => {
  await Promise.all([
    Submission.deleteMany({ user: userId }),
    ContestResult.deleteMany({ user: userId }),
    ContestProblemResult.deleteMany({ user: userId }),
    IngestJob.deleteMany({ user: userId }),
  ]);
  await CFProfile.updateOne(
    { user: userId },
    {
      $set: { ingestStatus: "pending" },
      $unset: { lastIngestedSubmissionId: 1 },
    },
  );
  console.log("-- wiped prior smoke data --");
};

const report = async (userId, job, elapsedSec) => {
  const profile = await CFProfile.findOne({ user: userId }).lean();
  const freshJob = await IngestJob.findById(job._id).lean();

  const subCount = await Submission.countDocuments({ user: userId });
  const dupes = await Submission.aggregate([
    { $match: { user: userId } },
    { $group: { _id: "$cfSubmissionId", n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  const [newest] = await Submission.find({ user: userId })
    .sort({ cfSubmissionId: -1 })
    .limit(1)
    .select("cfSubmissionId")
    .lean();

  const byType = await Submission.aggregate([
    { $match: { user: userId } },
    { $group: { _id: "$participantType", n: { $sum: 1 } } },
  ]);

  const contestantContestIds = await Submission.distinct("cfContestId", {
    user: userId,
    participantType: "CONTESTANT",
  });
  const crCount = await ContestResult.countDocuments({ user: userId });
  const cprCount = await ContestProblemResult.countDocuments({ user: userId });

  // Orphan check: every CPR must point at an existing CR (the transaction's whole job)
  const crIds = new Set(
    (await ContestResult.find({ user: userId }).select("_id").lean()).map((c) =>
      String(c._id),
    ),
  );
  const cprs = await ContestProblemResult.find({ user: userId })
    .select("contestResult")
    .lean();
  const orphans = cprs.filter(
    (c) => !crIds.has(String(c.contestResult)),
  ).length;

  const sampleDiv2 = await ContestProblemResult.findOne({
    user: userId,
    isDiv2A: true,
    status: "solved",
  })
    .select("cfContestId problemIndex firstACTime failCount")
    .lean();

  console.log("\n================ SMOKE REPORT ================");
  console.log(`elapsed:                       ${elapsedSec}s`);
  console.log(`job.status:                    ${freshJob.status}`);
  console.log(`job.submissionsIngested:       ${freshJob.submissionsIngested}`);
  console.log(
    `job.lastIngestedSubmissionId:  ${freshJob.lastIngestedSubmissionId} (resume cursor: SMALLEST seen)`,
  );
  console.log(`profile.ingestStatus:          ${profile.ingestStatus}`);
  console.log(
    `profile.lastIngestedSubmissionId: ${profile.lastIngestedSubmissionId} (committed: NEWEST seen)`,
  );
  console.log("----------------------------------------------");
  console.log(`Submission count:              ${subCount}`);
  console.log(`by participantType:            ${JSON.stringify(byType)}`);
  console.log(`duplicate cfSubmissionIds:     ${dupes.length}   <-- MUST be 0`);
  console.log(`newest stored cfSubmissionId:  ${newest?.cfSubmissionId}`);
  console.log(
    `cursor >= newest stored?      ${profile.lastIngestedSubmissionId === newest?.cfSubmissionId}   <-- MUST be true`,
  );
  console.log("----------------------------------------------");
  console.log(
    `distinct CONTESTANT contests:  ${contestantContestIds.filter(Boolean).length}`,
  );
  console.log(
    `ContestResult count:           ${crCount}  (gap vs distinct = skipped: no rating change / not in catalog — check warn logs)`,
  );
  console.log(`ContestProblemResult count:    ${cprCount}`);
  console.log(`CPR orphans (no parent CR):    ${orphans}   <-- MUST be 0`);
  console.log(`sample solved Div2 A:          ${JSON.stringify(sampleDiv2)}`);
  console.log("==============================================\n");
};

const main = async () => {
  await mongoose.connect(env.MONGODB_URI);

  let user = await User.findOne({ email: SMOKE_EMAIL });
  if (!user) {
    user = await User.create({
      name: "Smoke Test",
      email: SMOKE_EMAIL,
      passwordHash: "not-a-real-hash-smoke-only",
    });
  }

  let profile = await CFProfile.findOne({ user: user._id });
  if (!profile) {
    profile = await CFProfile.create({
      user: user._id,
      handle,
      ingestStatus: "pending",
    });
  } else if (profile.handle !== handle) {
    console.error(
      `Existing smoke profile has handle '${profile.handle}'. Use --wipe to switch.`,
    );
    process.exit(1);
  }

  if (wipe) await wipeSmokeData(user._id);

  const job = await IngestJob.create({
    user: user._id,
    type: refresh ? "daily_refresh" : "initial",
    status: "queued",
    submissionsIngested: 0,
  });

  console.log(
    `-- running ${refresh ? "runDailyRefresh" : "runInitialIngest"} for '${handle}' --`,
  );
  const t0 = Date.now();
  if (refresh) {
    await runDailyRefresh({ userId: user._id, ingestJobId: job._id });
  } else {
    await runInitialIngest({ userId: user._id, ingestJobId: job._id });
  }
  const elapsedSec = Math.round((Date.now() - t0) / 1000);

  await report(user._id, job, elapsedSec);
  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error("SMOKE RUN FAILED:", err);
  await mongoose.disconnect();
  process.exit(1);
});
