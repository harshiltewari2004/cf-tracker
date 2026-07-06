import CFProfile from "../models/CFProfile.js";
import Submission from "../models/Submission.js";
import TopicBucketScore from "../models/TopicBucketScore.js";
import ContestResult from "../models/ContestResult.js";
import ContestProblemResult from "../models/ContestProblemResult.js";
import ReliabilityScore from "../models/ReliabilityScore.js";
import UpsolveQueue from "../models/UpsolveQueue.js";
import ValidationBaseline from "../models/ValidationBaseline.js";
import VirtualContest from "../models/VirtualContest.js";
import { AppError } from "../utils/errors.js";
import { validateHandleExists } from "../ingest/CFApiClient.js";
import { enqueueInitialIngest } from "../queues/ingestQueue.js";
import User from "../models/User.js";
import mongoose from "mongoose";

export const updateHandle = async (userId, newHandle) => {
  const profile = await CFProfile.findOne({ user: userId });

  if (!profile) {
    throw new AppError("CF Profile not found", 404);
  }

  const normalizedNew = newHandle.trim().toLowerCase();
  if (normalizedNew == profile.handle.toLowerCase()) {
    return profile;
  }

  await validateHandleExists(newHandle);

  const existing = await CFProfile.findOne({ handle: newHandle });
  if (existing && existing.user.toString() !== userId.toString()) {
    throw new AppError("Handle already in use", 409);
  }

  await Submission.deleteMany({ user: userId });
  await TopicBucketScore.deleteMany({ user: userId });
  await ContestResult.deleteMany({ user: userId });
  await ContestProblemResult.deleteMany({ user: userId });
  await ReliabilityScore.deleteMany({ user: userId });
  await UpsolveQueue.deleteMany({ user: userId });
  await ValidationBaseline.deleteMany({ user: userId });
  await VirtualContest.deleteMany({ user: userId });

  profile.handle = newHandle;
  profile.lastIngestedSubmissionId = null;
  profile.ingestStatus = "pending";
  await profile.save();

  await User.findByIdAndUpdate(userId, { coldStartComplete: false });
  await enqueueInitialIngest({ userId });
  return profile;
};

export const deleteAccount = async (userId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Submission.deleteMany({ user: userId }, { session });
      await TopicBucketScore.deleteMany({ user: userId }, { session });
      await ContestResult.deleteMany({ user: userId }, { session });
      await ContestProblemResult.deleteMany({ user: userId }, { session });
      await ReliabilityScore.deleteMany({ user: userId }, { session });
      await UpsolveQueue.deleteMany({ user: userId }, { session });
      await ValidationBaseline.deleteMany({ user: userId }, { session });
      await VirtualContest.deleteMany({ user: userId }, { session });
      await CFProfile.deleteOne({ user: userId }, { session });
      await User.deleteOne({ _id: userId }, { session });
    });
  } finally {
    await session.endSession();
  }
};
