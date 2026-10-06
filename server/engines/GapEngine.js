import { GAP_BETA, KEY_SEP } from "../config/constants.js";
import { clamp } from "../utils/mathUtils.js";
import Submission from "../models/Submission.js";
import { getTopicBucketRows } from "../utils/bucketUtils.js";
import ContestProblemResult from "../models/ContestProblemResult.js";
import BenchmarkTargetCount from "../models/BenchmarkTargetCount.js";
import TopicBucketScore from "../models/TopicBucketScore.js";
import BenchmarkCohort from "../models/BenchmarkCohort.js";
export const computeGap = ({
  solves,
  targetCount,
  contestFails,
  contestOpportunities,
}) => {
  const penalty =
    contestOpportunities <= 0
      ? 0
      : GAP_BETA * (contestFails / contestOpportunities);
  const baseGap = targetCount <= 0 ? 0 : clamp(1 - solves / targetCount, 0, 1);
  const finalGap = clamp(baseGap + penalty, 0, 1);

  return { baseGap, penalty, finalGap };
};

const aggregateSolves = async (userId) => {
  const submissions = await Submission.find({ user: userId, verdict: "OK" })
    .populate("problem", "rating tags")
    .lean();

  const distinctProblems = new Map();
  for (const submission of submissions) {
    if (!submission.problem) continue;
    const key = String(submission.problem._id);
    if (!distinctProblems.has(key)) {
      distinctProblems.set(key, submission.problem);
    }
  }

  const solvesByKey = new Map();

  for (const problem of distinctProblems.values()) {
    for (const { topic, bucket } of getTopicBucketRows(problem)) {
      const key = `${topic}|${bucket}`;
      solvesByKey.set(key, (solvesByKey.get(key) ?? 0) + 1);
    }
  }
  return solvesByKey;
};

// 01 §Definitions: opportunities = CONTESTS where (topic, bucket) appeared as A/B.
// If A and B share a tag in one contest, that contest counts once, not twice.
// Fails use the same unit ("failed it in that contest"), so fails/opportunities
// stays in [0, 1] and the penalty never exceeds beta (D-PC-5).
export const tallyContestSignal = (rows) => {
  const oppContests = new Map();
  const failContests = new Map();

  const addContest = (map, key, contestId) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(contestId);
  };

  for (const row of rows) {
    if (!row.isDiv2A && !row.isDiv2B) continue;
    if (!row.problem) continue;

    for (const { topic, bucket } of getTopicBucketRows(row.problem)) {
      const key = `${topic}${KEY_SEP}${bucket}`;
      addContest(oppContests, key, row.cfContestId);
      if (row.status === "failed") addContest(failContests, key, row.cfContestId);
    }
  }

  const toCounts = (map) => new Map([...map].map(([key, ids]) => [key, ids.size]));
  return {
    failsByKey: toCounts(failContests),
    opportunitiesByKey: toCounts(oppContests),
  };
};

const aggregrateContestSignal = async (userId) => {
  const rows = await ContestProblemResult.find({ user: userId })
    .select("cfContestId isDiv2A isDiv2B status problem")
    .populate("problem", "rating tags")
    .lean();

  return tallyContestSignal(rows);
};

const aggregrateTargetCounts = async () => {
  // 04 §11 shadow swap: BenchmarkCohort is written LAST, so its existence is the publish.
  // Half-written target rows from a crashed refresh are never read.
  const latest = await BenchmarkCohort.findOne()
    .sort({ version: -1 })
    .select("version")
    .lean();

  if (!latest) return new Map();

  const rows = await BenchmarkTargetCount.find({
    cohortVersion: latest.version,
  })
    .select("topic bucket p50")
    .lean();

  const targetByKey = new Map();
  for (const row of rows) {
    const key = `${row.topic}|${row.bucket}`;
    targetByKey.set(key, row.p50);
  }
  return targetByKey;
};

export const recalculate = async (userId) => {
  const solvesByKey = await aggregateSolves(userId);
  const { failsByKey, opportunitiesByKey } =
    await aggregrateContestSignal(userId);
  const targetByKey = await aggregrateTargetCounts();

  const allKeys = new Set([
    ...solvesByKey.keys(),
    ...failsByKey.keys(),
    ...opportunitiesByKey.keys(),
    ...targetByKey.keys(),
  ]);

  const now = new Date();

  for (const key of allKeys) {
    const [topic, bucket] = key.split(KEY_SEP);

    const solves = solvesByKey.get(key) ?? 0;
    const targetCount = targetByKey.get(key) ?? 0;
    const contestFails = failsByKey.get(key) ?? 0;
    const contestOpportunities = opportunitiesByKey.get(key) ?? 0;

    const { baseGap, penalty, finalGap } = computeGap({
      solves,
      targetCount,
      contestFails,
      contestOpportunities,
    });

    await TopicBucketScore.findOneAndUpdate(
      { user: userId, topic, bucket },
      {
        $set: {
          solves,
          targetCount,
          baseGap,
          contestFails,
          contestOpportunities,
          penalty,
          finalGap,
          lastCalculated: now,
        },
      },
      { upsert: true },
    );
  }
};
export const getWeakness = async (userId) => {
  return TopicBucketScore.find({ user: userId }).sort({ finalGap: -1 }).lean();
};
