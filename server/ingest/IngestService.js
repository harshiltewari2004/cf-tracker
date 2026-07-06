import mongoose from "mongoose";
import { differenceInMinutes } from "date-fns";

import logger from "../config/logger.js";
import {
  INGEST_PAGE_SIZE,
  MONGO_DUPLICATE_KEY_CODE,
  INGEST_SKIP_GUARD_MIN_SUBMISSIONS,
  INGEST_SKIP_GUARD_MAX_MISS_RATIO,
} from "../config/constants.js";
import CFProfile from "../models/CFProfile.js";
import IngestJob from "../models/IngestJob.js";
import Problem from "../models/Problem.js";
import Submission from "../models/Submission.js";
import Contest from "../models/Contest.js";
import ContestResult from "../models/ContestResult.js";
import ContestProblemResult from "../models/ContestProblemResult.js";
import { AppError, DegradedIngestError } from "../utils/errors.js";
import * as cfApiClient from "./CFApiClient.js";
import { parseSubmission } from "./SubmissionParser.js";
import * as GapEngine from "../engines/GapEngine.js";
import * as ReliabilityEngine from "../engines/ReliabilityEngine.js";
import { seedUpsolveQueue } from "../engines/ContestFeedbackEngine.js";

const resolveProblemRefs = async (parseSubmissions) => {
  const pairs = new Map();
  for (const s of parseSubmissions) {
    pairs.set(`${s.problemContestId}:${s.cfIndex}`, {
      cfContestId: s.problemContestId,
      cfIndex: s.cfIndex,
    });
  }

  if (pairs.size == 0) return new Map();

  const problems = await Problem.find({ $or: [...pairs.values()] })
    .select("cfContestId cfIndex")
    .lean();

  return new Map(problems.map((p) => [`${p.cfContestId}:${p.cfIndex}`, p._id]));
};

const ingestSubmissionPages = async ({
  userId,
  handle,
  job,
  floorSubmissionId,
}) => {
  let from = 1;
  let newestSeenSubmissionId = null;
  let totalInserted = 0;
  let survivingTotal = 0;
  let catalogMissesTotal = 0;
  const missedProblemKeys = new Set();
  const contestantContestIds = new Set();

  const resumeCursor = job.lastIngestedSubmissionId ?? null;

  for (;;) {
    const page = await cfApiClient.getUserStatus(
      handle,
      from,
      INGEST_PAGE_SIZE,
    );
    if (page.length == 0) {
      break;
    }
    if (newestSeenSubmissionId == null) {
      newestSeenSubmissionId = page[0].id;
    }
    let hitFloor = false;
    const fresh = [];
    for (const raw of page) {
      if (floorSubmissionId != null && raw.id <= floorSubmissionId) {
        hitFloor = true;
        break;
      }
      const parsed = parseSubmission(raw);
      if (!parsed) continue;

      if (resumeCursor != null && parsed.cfSubmissionId >= resumeCursor)
        continue;

      fresh.push(parsed);
    }
    const refMap = await resolveProblemRefs(fresh);
    survivingTotal += fresh.length;
    const docs = [];

    for (const p of fresh) {
      const problemId = refMap.get(`${p.problemContestId}:${p.cfIndex}`);
      if (!problemId) {
        catalogMissesTotal += 1;
        missedProblemKeys.add(`${p.problemContestId}:${p.cfIndex}`);
        logger.warn(
          { userId, problemContestId: p.problemContestId, cfIndex: p.cfIndex },
          "problem not in catalog,skipping submission",
        );
        continue;
      }
      docs.push({
        user: userId,
        problem: problemId,
        cfSubmissionId: p.cfSubmissionId,
        verdict: p.verdict,
        participantType: p.participantType,
        cfContestId: p.cfContestId,
        timeConsumed: p.timeConsumed,
        language: p.language,
        submittedAt: p.submittedAt,
      });
      if (p.participantType === "CONTESTANT" && p.cfContestId) {
        contestantContestIds.add(p.cfContestId);
      }
    }
    let insertedCount = 0;
    if (docs.length > 0) {
      try {
        const inserted = await Submission.insertMany(docs, {
          ordered: false,
        });
        insertedCount = inserted.length;
      } catch (err) {
        if (err.code === MONGO_DUPLICATE_KEY_CODE) {
          insertedCount = err.insertedDocs?.length ?? 0;
          logger.warn(
            { userId, page: from },
            "duplicate submissions absorbed on re-ingest",
          );
        } else {
          throw err;
        }
      }
    }
    job.lastIngestedSubmissionId = page[page.length - 1].id;
    job.submissionsIngested += insertedCount;
    await job.save();

    totalInserted += insertedCount;

    if (hitFloor) break;
    if (page.length < INGEST_PAGE_SIZE) break;
    from += INGEST_PAGE_SIZE;
  }
  return {
    newestSeenSubmissionId,
    submissionsIngested: totalInserted,
    contestantContestIds,
    surviving: survivingTotal,
    catalogMisses: catalogMissesTotal,
    missedProblems: [...missedProblemKeys],
  };
};
const evaluateSkipGuard = ({
  userId,
  surviving,
  catalogMisses,
  missedProblems,
}) => {
  if (catalogMisses === 0) return;

  const ratio = catalogMisses / surviving;

  if (
    surviving >= INGEST_SKIP_GUARD_MIN_SUBMISSIONS &&
    ratio > INGEST_SKIP_GUARD_MAX_MISS_RATIO
  ) {
    throw new DegradedIngestError(
      "ingest skipped too many submissions on catalog miss;refusing to promote cursor",
      { surviving, catalogMisses, ratio, missedProblems },
    );
  }
  logger.warn(
    { userId, surviving, catalogMisses, ratio, missedProblems },
    "catalog misses below skip guard threshold;promoting cursor",
  );
};

const deriveContestResults = async ({
  userId,
  handle,
  contestIds,
  signupDate,
}) => {
  if (contestIds.size === 0) {
    return;
  }

  const ratingChanges = await cfApiClient.getUserRating(handle);
  const ratingByContest = new Map(
    ratingChanges.map((rc) => [rc.contestId, rc]),
  );

  for (const cfContestId of contestIds) {
    const contest = await Contest.findOne({ cfContestId }).lean();

    if (!contest) {
      logger.warn(
        { userId, cfContestId },
        "contest not in catalog,skipping result derivation",
      );
      continue;
    }

    const rc = ratingByContest.get(cfContestId);
    if (!rc) {
      logger.warn(
        { userId, cfContestId },
        "no rating change for contest,skipping",
      );
      continue;
    }
    const subs = await Submission.find({
      user: userId,
      cfContestId,
      participantType: "CONTESTANT",
    })
      .select("verdict submittedAt problem")
      .populate("problem", "cfIndex")
      .lean();

    const byIndex = new Map();
    for (const s of subs) {
      const idx = s.problem?.cfIndex;
      if (!idx) continue;
      if (!byIndex.has(idx)) byIndex.set(idx, []);
      byIndex.get(idx).push(s);
    }
    const isDiv2 = contest.division === "Div2";
    const cprDocs = contest.problems.map(({ problemIndex, problem }) => {
      const attempts = (byIndex.get(problemIndex) ?? []).sort(
        (a, b) => a.submittedAt - b.submittedAt,
      );
      const firstAC = attempts.find((a) => a.verdict === "OK");
      const failCount = firstAC
        ? attempts.filter(
            (a) => a.verdict !== "OK" && a.submittedAt < firstAC.submittedAt,
          ).length
        : attempts.filter((a) => a.verdict !== "OK").length;

      const cannonicalIndex = problemIndex === "A2" ? "A" : problemIndex;

      return {
        problemIndex,
        problem,
        status: firstAC
          ? "solved"
          : attempts.length > 0
            ? "failed"
            : "unattempted",
        firstACTime: firstAC
          ? differenceInMinutes(firstAC.submittedAt, contest.startTime)
          : null,
        failCount,
        isDiv2A: isDiv2 && cannonicalIndex === "A",
        isDiv2B: isDiv2 && cannonicalIndex === "B",
      };
    });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const contestResult = await ContestResult.findOneAndUpdate(
          { user: userId, cfContestId },
          {
            $set: {
              contestName: contest.name,
              isDiv2,
              rank: rc.rank,
              oldRating: rc.oldRating,
              newRating: rc.newRating,
              ratingChange: rc.newRating - rc.oldRating,
              participatedAt: contest.startTime,
            },
          },
          { upsert: true, returnDocument: "after", session },
        );
        for (const doc of cprDocs) {
          await ContestProblemResult.findOneAndUpdate(
            { user: userId, cfContestId, problemIndex: doc.problemIndex },
            { $set: { ...doc, contestResult: contestResult._id } },
            { upsert: true, session },
          );
        }
      });
    } finally {
      await session.endSession();
    }
    const failedProblems = cprDocs
      .filter((d) => (d.isDiv2A || d.isDiv2B) && d.status === "failed")
      .map((d) => ({ _id: d.problem }));

    await seedUpsolveQueue(
      userId,
      signupDate,
      cfContestId,
      contest.startTime,
      failedProblems,
    );
  }
};

export const runInitialIngest = async ({ userId, ingestJobId, signupDate }) => {
  const job = await IngestJob.findById(ingestJobId);
  const profile = await CFProfile.findOne({ user: userId });
  if (!job || !profile)
    throw new AppError("Ingest Job or CF profile not found", 404);

  job.status = "processing";
  job.startedAt = job.startedAt ?? new Date();
  await job.save();
  profile.ingestStatus = "processing";
  await profile.save();

  logger.info({ userId, ingestJobId }, "initial ingest started");

  const summary = await ingestSubmissionPages({
    userId,
    handle: profile.handle,
    job,
    floorSubmissionId: null,
  });

  evaluateSkipGuard({
    userId,
    surviving: summary.surviving,
    catalogMisses: summary.catalogMisses,
    missedProblems: summary.missedProblems,
  });

  await deriveContestResults({
    userId,
    handle: profile.handle,
    contestIds: summary.contestantContestIds,
    signupDate: profile.createdAt,
  });

  await GapEngine.recalculate(userId);
  await ReliabilityEngine.refresh(userId);

  if (summary.newestSeenSubmissionId != null) {
    profile.lastIngestedSubmissionId = summary.newestSeenSubmissionId;
  }

  profile.ingestStatus = "complete";
  profile.ingestCompletedAt = new Date();
  profile.lastSyncedAt = new Date();
  await profile.save();

  job.status = "complete";
  job.completedAt = new Date();
  await job.save();

  logger.info(
    { userId, ingestJobId, submissionsIngested: summary.submissionsIngested },
    "initial ingest complete",
  );
};

export const runDailyRefresh = async ({ userId, ingestJobId, signupDate }) => {
  const job = await IngestJob.findById(ingestJobId);
  const profile = await CFProfile.findOne({ user: userId });
  if (!job || !profile) {
    throw new AppError("Ingest job or CF profile not found", 404);
  }
  const floorSubmissionId = profile.lastIngestedSubmissionId ?? null;
  if (floorSubmissionId == null) {
    logger.warn(
      { userId },
      "daily refresh with no committed cursor;running full history",
    );
  }
  job.status = "processing";
  job.startedAt = job.startedAt ?? new Date();
  await job.save();

  const summary = await ingestSubmissionPages({
    userId,
    handle: profile.handle,
    job,
    floorSubmissionId,
  });

  evaluateSkipGuard({
    userId,
    surviving: summary.surviving,
    catalogMisses: summary.catalogMisses,
    missedProblems: summary.missedProblems,
  });

  await deriveContestResults({
    userId,
    handle: profile.handle,
    contestIds: summary.contestantContestIds,
    signupDate: profile.createdAt,
  });

  await GapEngine.recalculate(userId);
  await ReliabilityEngine.refresh(userId);

  if (summary.newestSeenSubmissionId !== null) {
    profile.lastIngestedSubmissionId = summary.newestSeenSubmissionId;
  }
  profile.lastSyncedAt = new Date();
  await profile.save();

  job.status = "complete";
  job.completedAt = new Date();
  await job.save();

  logger.info(
    { userId, ingestJobId, submissionsIngested: summary.submissionsIngested },
    "daily refersh compelte",
  );
};
