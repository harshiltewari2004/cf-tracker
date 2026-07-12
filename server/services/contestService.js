import ContestResult from "../models/ContestResult.js";
import ContestProblemResult from "../models/ContestProblemResult.js";
import { AppError } from "../utils/errors.js";
import { CONTESTS_DEFAULT_LIMIT } from "../config/constants.js";

export const getContests = async (userId, limit = CONTESTS_DEFAULT_LIMIT) => {
  return ContestResult.find({ user: userId, isDiv2: true })
    .sort({ participatedAt: -1 })
    .limit(limit)
    .lean();
};

export const getContestDetail = async (userId, cfContestId) => {
  const contest = await ContestResult.findOne({
    user: userId,
    cfContestId,
  })
  .select('cfContestId contestName isDiv2 rank oldRating newRating ratingChange participatedAt')
  .lean();

  if (!contest) {
    throw new AppError("Contest not found", 404);
  }
  const problems = await ContestProblemResult.find({
    user: userId,
    cfContestId,
  }).select('problemIndex problem status firstACTime failCount isDiv2A isDiv2B')
  .populate('problem','name rating url')
  .lean();

  return { ...contest, problems };
};
