import { AppError } from "../utils/errors.js";
import  logger  from "../config/logger.js";
import User from "../models/User.js";
import CFProfile from "../models/CFProfile.js";
import IngestJob from "../models/IngestJob.js";
import * as cfApiClient from "../ingest/CFApiClient.js";
import { enqueueInitialIngest } from "../queues/ingestQueue.js";

export const submitHandle = async (userId, handle) => {
  const cfUser = await cfApiClient.validateHandleExists(handle);

  const existing = await CFProfile.findOne({ user: userId }).lean();

  if (existing) {
    return resolveExistingProfile(userId, existing, handle);
  }

  await CFProfile.create({
    user: userId,
    handle,
    currentRating: cfUser.rating ?? null,
    maxRating: cfUser.maxRating ?? null,
    rank: cfUser.rank ?? null,
    ingestStatus: "pending",
  });

  await enqueueInitialIngest({userId});

  await User.findByIdAndUpdate(userId, {
    onboardingStep: 2,
    onboardingCompleted: true,
  });

  logger.info(
    { userId, handle },
    "onboarding handle accepted,initial ingest queued",
  );
  return { ingestStatus: "pending" };
};

export const getOnboardingStatus = async(userId)=>{
  const user = await User.findById(userId)
  .select('onboardin step,onboarding completed')
  .lean();

  if(!user)throw new AppError('User not found',404);

  return{
    onboardingStep:user.onboardingStep,
    onboardingCompleted:user.onboardingCompleted
  };
};

const resolveExistingProfile = async (userId, existing, handle) => {
  if (existing.handle !== handle) {
    throw new AppError(
      "A codeforces handle is already linked.Change it in settings.",
      409,
    );
  }

  const activeJob = await IngestJob.findOne({
    user: userId,
    status: { $in: ["queued", "processing"] },
  }).lean();

  if (activeJob) {
    return { ingestStatus: existing.ingestStatus };
  }

  await enqueueInitialIngest({userId});
  await User.findByIdAndUpdate(userId, {
    onboardingStep: 2,
    onboardingCompleted: true,
  });
  logger.warn(
    { userId, handle },
    "onboarding:recovered orphaned profile ,re-queued ingest",
  );
  return { ingestStatus: existing.ingestStatus };
};
