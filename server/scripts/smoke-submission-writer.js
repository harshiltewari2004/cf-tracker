import mongoose from "mongoose";
import "dotenv/config";

import { writeSubmission } from "../ingest/SubmissionWriter.js";
import Submission from "../models/Submission.js";
import TopicBucketScore from "../models/TopicBucketScore.js";
import Problem from "../models/Problem.js";
import User from "../models/User.js";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("connected");

  // --- Arrange: a throwaway user + problem we fully control ---
  const user = await User.create({
    name: "smoke-writer",
    email: `smoke-writer-${Date.now()}@test.local`,
    passwordHash: "x",
  });

  const problem = await Problem.create({
    cfContestId: 999999,
    cfIndex: "A",
    name: "Smoke Problem",
    rating: 900,
    tags: ["greedy", "implementation"],
    ratingBucket: "800-1000",
    url: "https://example.test/p",
    isDiv2A: true,
    isDiv2B: false,
  });

  const context = { userId: user._id, problem };

  const baseSubmission = {
    user: user._id,
    problem: problem._id,
    participantType: "PRACTICE",
    cfContestId: null,
    timeConsumed: 100,
    language: "C++",
    submittedAt: new Date(),
  };

  // helper to read both tag rows
  const readScores = async () =>
    TopicBucketScore.find({ user: user._id }).lean();

  // ---------- TEST 1: AC submission increments solves on all tags ----------
  await writeSubmission(
    { ...baseSubmission, cfSubmissionId: 1001, verdict: "OK" },
    context,
  );
  let scores = await readScores();
  console.log("\n[TEST 1] after one AC submission:");
  console.log(scores.map((s) => ({ topic: s.topic, solves: s.solves })));
  console.log("expect: greedy solves=1, implementation solves=1");

  // ---------- TEST 4 (teeth-check): row fully initialized, no undefined ----------
  console.log("\n[TEST 4] full row shape (teeth-check for Option B):");
  console.log(
    scores.map((s) => ({
      topic: s.topic,
      targetCount: s.targetCount,
      baseGap: s.baseGap,
      penalty: s.penalty,
      finalGap: s.finalGap,
      contestFails: s.contestFails,
      contestOpportunities: s.contestOpportunities,
    })),
  );
  console.log("expect: every numeric field === 0 (number), none undefined/NaN");

  // ---------- TEST 3: idempotency — same submission again ----------
  await writeSubmission(
    { ...baseSubmission, cfSubmissionId: 1001, verdict: "OK" },
    context,
  );
  scores = await readScores();
  console.log("\n[TEST 3] after re-running the SAME AC submission:");
  console.log(scores.map((s) => ({ topic: s.topic, solves: s.solves })));
  console.log("expect: solves STILL 1, not 2 (duplicate-key short-circuit)");

  // ---------- TEST 2: non-AC submission touches no scores ----------
  await writeSubmission(
    { ...baseSubmission, cfSubmissionId: 1002, verdict: "WA" },
    context,
  );
  scores = await readScores();
  console.log("\n[TEST 2] after a non-AC (WA) submission:");
  console.log(scores.map((s) => ({ topic: s.topic, solves: s.solves })));
  const waInserted = await Submission.findOne({
    user: user._id,
    cfSubmissionId: 1002,
  }).lean();
  console.log("WA Submission row exists:", !!waInserted);
  console.log("expect: solves STILL 1 (AC gate), but WA Submission row exists");

  // --- Cleanup: drop the throwaway docs ---
  await Submission.deleteMany({ user: user._id });
  await TopicBucketScore.deleteMany({ user: user._id });
  await Problem.deleteOne({ _id: problem._id });
  await User.deleteOne({ _id: user._id });
  console.log("\ncleaned up");

  await mongoose.disconnect();
  console.log("done");
};

run().catch(async (err) => {
  console.error("smoke failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
