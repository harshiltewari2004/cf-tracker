import mongoose from "mongoose";
import "dotenv/config";

import User from "../models/User.js";
import CFProfile from "../models/CFProfile.js";
import IngestJob from "../models/IngestJob.js";
import Submission from "../models/Submission.js";
import ContestResult from "../models/ContestResult.js";
import ContestProblemResult from "../models/ContestProblemResult.js";
import TopicBucketScore from "../models/TopicBucketScore.js";
import ReliabilityScore from "../models/ReliabilityScore.js";
import Upsolvequeue from "../models/UpsolveQueue.js";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // Target the stale smoke-ingest user by its exact email — NOT by handle.
  const stale = await User.find({ email: "smoke-ingest@local.test" })
    .select("_id")
    .lean();
  const ids = stale.map((u) => u._id);
  console.log(`found ${ids.length} stale smoke-ingest user(s)`);

  if (ids.length > 0) {
    const f = { user: { $in: ids } };
    await CFProfile.deleteMany(f);
    await IngestJob.deleteMany(f);
    await Submission.deleteMany(f);
    await ContestResult.deleteMany(f);
    await ContestProblemResult.deleteMany(f);
    await TopicBucketScore.deleteMany(f);
    await ReliabilityScore.deleteMany(f);
    await Upsolvequeue.deleteMany(f);
    await User.deleteMany({ _id: { $in: ids } });
    console.log("deleted stale smoke-ingest data");
  }

  await mongoose.disconnect();
  console.log("done");
};

run().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
