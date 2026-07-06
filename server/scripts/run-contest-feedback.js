// scripts/run-contest-feedback.js
import mongoose from "mongoose";
import { env } from "../config/env.js";
import UpsolveQueue from "../models/UpsolveQueue.js";
import {
  extractContestFails,
  seedUpsolveQueue,
} from "../engines/ContestFeedbackEngine.js";

// ── Part 1: extractContestFails (pure, no DB) ────────────────────────
const problemA = { tags: ["implementation"], ratingBucket: "800-1000" };
const problemB = { tags: ["greedy", "math"], ratingBucket: "1000-1200" };

const deltas = extractContestFails([problemA, problemB], [problemA]);
console.log("--- extractContestFails ---");
console.log(Object.fromEntries(deltas));

// ── Part 2: seedUpsolveQueue (touches DB) ────────────────────────────
const run = async () => {
  await mongoose.connect(env.MONGODB_URI);

  // Throwaway IDs so we never touch real user data.
  const testUserId = new mongoose.Types.ObjectId();
  const failedProblem = { _id: new mongoose.Types.ObjectId() };

  const signupDate = new Date("2026-01-01T00:00:00Z");
  const afterSignup = new Date("2026-06-01T00:00:00Z"); // contest AFTER signup
  const beforeSignup = new Date("2025-06-01T00:00:00Z"); // contest BEFORE signup

  // Clean any leftovers from a prior run.
  await UpsolveQueue.deleteMany({ user: testUserId });

  // Gate check: a pre-signup contest seeds nothing.
  const gated = await seedUpsolveQueue(
    testUserId,
    signupDate,
    1899,
    beforeSignup,
    [failedProblem],
  );
  console.log("\n--- gate (pre-signup) ---");
  console.log("seeded (expect 0):", gated);

  // First real seed: should insert one pending row.
  await seedUpsolveQueue(testUserId, signupDate, 1900, afterSignup, [
    failedProblem,
  ]);
  let row = await UpsolveQueue.findOne({
    user: testUserId,
    problem: failedProblem._id,
  }).lean();
  console.log("\n--- first seed ---");
  console.log("status (expect pending):", row.status);
  console.log(
    "scheduledFor - addedAt (expect 86400000 ms):",
    row.scheduledFor.getTime() - row.addedAt.getTime(),
  );

  // User upsolves it: mark completed.
  await UpsolveQueue.updateOne(
    { user: testUserId, problem: failedProblem._id },
    { $set: { status: "completed" } },
  );

  // Second seed of the SAME problem (re-fail or retry).
  // $setOnInsert must NOT clobber the completed status back to pending.
  await seedUpsolveQueue(testUserId, signupDate, 1950, afterSignup, [
    failedProblem,
  ]);
  row = await UpsolveQueue.findOne({
    user: testUserId,
    problem: failedProblem._id,
  }).lean();
  console.log("\n--- second seed (the real test) ---");
  console.log("status (expect STILL completed):", row.status);

  // Cleanup.
  await UpsolveQueue.deleteMany({ user: testUserId });
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
