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

const cleanup = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("connected");

  // Scope to smoke data ONLY: find smoke users, delete everything by their _id.
  const smokeUsers = await User.find({ name: "smoke-contestant" })
    .select("_id")
    .lean();
  const userIds = smokeUsers.map((u) => u._id);
  console.log(`found ${userIds.length} smoke-contestant user(s)`);

  if (userIds.length > 0) {
    const filter = { user: { $in: userIds } };
    await CFProfile.deleteMany(filter);
    await IngestJob.deleteMany(filter);
    await Submission.deleteMany(filter);
    await ContestResult.deleteMany(filter);
    await ContestProblemResult.deleteMany(filter);
    await TopicBucketScore.deleteMany(filter);
    await ReliabilityScore.deleteMany(filter);
    await Upsolvequeue.deleteMany(filter);
    await User.deleteMany({ _id: { $in: userIds } });
    console.log("deleted all smoke-contestant data");
  } else {
    console.log("nothing to clean");
  }

  await mongoose.disconnect();
  console.log("done");
};

cleanup().catch(async (err) => {
  console.error("cleanup failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
