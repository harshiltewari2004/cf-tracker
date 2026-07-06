import * as cfApiClient from "../ingest/CFApiClient.js";
import logger from "../config/logger.js";
import { COHORT } from "../config/constants.js";
import { daysBetween } from "../utils/dateUtils.js";
import { getTopicBucketRows } from "../utils/bucketUtils.js";
import { median } from "../utils/mathUtils.js";

import BenchmarkCohort from "../models/BenchmarkCohort.js";
import BenchmarkTargetCount from "../models/BenchmarkTargetCount.js";

const dedupSolved = (submissions) => {
  const seen = new Map();
  for (const sub of submissions) {
    if (sub.verdict !== "OK") continue;

    const p = sub.problem;

    const key = `${p.contestId}-${p.index}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()];
};

export const fetchCohort = async (filters) => {
  const ratedList = await cfApiClient.getRatedList();
  const candidates = ratedList.filter(
    (u) =>
      (filters.country == null || u.country == filters.country) &&
      u.rating >= filters.minRating &&
      u.rating <= filters.maxRating,
  );

  const users = [];
  for (const candidate of candidates) {
    try {
      const ratingHistory = await cfApiClient.getUserRating(candidate.handle);
      const contestCount = ratingHistory.length;
      if (contestCount < COHORT.MIN_CONTESTS) continue;

      const lastEntry = ratingHistory[ratingHistory.length - 1];
      const lastContestDate = new Date(
        lastEntry.ratingUpdateTimeSeconds * 1000,
      );
      if (daysBetween(lastContestDate, new Date()) > COHORT.RECENCY_DAYS)
        continue;

      const submissions = await cfApiClient.getUserStatus(candidate.handle);
      const distinctSolved = dedupSolved(submissions);
      if (distinctSolved.length < COHORT.MIN_SOLVES) continue;

      const bucketCounts = {};
      for (const problem of distinctSolved) {
        for (const { topic, bucket } of getTopicBucketRows(problem)) {
          const key = `${topic}|${bucket}`;
          bucketCounts[key] = (bucketCounts[key] ?? 0) + 1;
        }
      }
      users.push({
        handle: candidate.handle,
        currentRating: candidate.rating,
        contestCount,
        lastContestDate,
        solveCount: distinctSolved.length,
        bucketCounts,
      });
    } catch (err) {
      logger.warn(
        { handle: candidate.handle, err: err.message },
        "skipping candidate — CF call failed",
      );
    }
  }
  logger.info({ filters, N: users.length }, "cohort tier fetched");
  return { filters, users, N: users.length };
};

export const computeTargetCounts = (cohort) => {
  const { users, N } = cohort;

  const keys = new Set();

  for (const user of users) {
    for (const key of Object.keys(user.bucketCounts)) keys.add(key);
  }
  const rows = [];
  for (const key of keys) {
    const counts = users.map((user) => user.bucketCounts[key] ?? 0);
    const [topic, bucket] = key.split("|");
    rows.push({ topic, bucket, p50: median(counts), cohortN: N });
  }
  return rows;
};

const selectCohort = async () => {
  let broadest = null;
  for (const tier of COHORT.FALLBACK_TIERS) {
    const cohort = await fetchCohort(tier);
    broadest = { cohort, tier };
    if (cohort.N >= COHORT.TARGET_N) return { cohort, tier };
  }
  if (broadest.cohort.N >= COHORT.FLOOR_N) return broadest;

  logger.warn(
    { broadestN: broadest.cohort.N },
    "cohort below floor-holding previous version",
  );
  return null;
};

export const refresh = async ({
  injectedSelection = null,
  onSelection = null,
} = {}) => {
  const selected = injectedSelection ?? (await selectCohort());
  if (!selected) return null;
  if (onSelection) onSelection(selected);

  const { cohort, tier } = selected;

  const latest = await BenchmarkCohort.findOne()
    .sort({ version: -1 })
    .select("version")
    .lean();
  const newVersion = (latest?.version ?? 0) + 1;

  const targetRows = computeTargetCounts(cohort);
  const now = new Date();

  await BenchmarkTargetCount.deleteMany({ cohortVersion: newVersion });

  await BenchmarkTargetCount.insertMany(
    targetRows.map((row) => ({
      ...row,
      cohortVersion: newVersion,
      lastCalculated: now,
    })),
  );

  await BenchmarkCohort.create({
    filters: {
      country: tier.country,
      minRating: tier.minRating,
      maxRating: tier.maxRating,
      minContests: COHORT.MIN_CONTESTS,
      minSolves: COHORT.MIN_SOLVES,
      lastContestWithinDays: COHORT.RECENCY_DAYS,
    },
    users: cohort.users.map((u) => ({
      handle: u.handle,
      currentRating: u.currentRating,
      contestCount: u.contestCount,
      solveCount: u.solveCount,
      lastContestDate: u.lastContestDate,
    })),
    N: cohort.N,
    fallbackUsed: tier.fallbackUsed,
    version: newVersion,
    lastRefreshed: now,
  });
  logger.info(
    { version: newVersion, N: cohort.N, fallbackUsed: tier.fallbackUsed },
    "benchmark refreshed",
  );
  return { version: newVersion, N: cohort.N, fallbackUsed: tier.fallbackUsed };
};
