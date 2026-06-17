// scripts/seed-contests.js
// Seeds the Contest catalog from contest.list — Div2 only (incl. combined→Div2).
// Idempotent: upserts on cfContestId, so re-running safely picks up new contests.
// PREREQ: the Problem catalog must already be seeded — problem refs resolve against it.
// Run:  node scripts/seed-contests.js

import mongoose from 'mongoose';

import logger from '../config/logger.js';
import { connectDB } from '../config/db.js';
import Contest from '../models/Contest.js';
import Problem from '../models/Problem.js';
import * as cfApiClient from '../ingest/CFApiClient.js';
import { classifyDivision, toStoredDivision } from '../utils/contestUtils.js';

const main = async () => {
  await connectDB();

  // (1) Contest metadata — one bulk CF call. Match your wrapper name.
  const contests = await cfApiClient.getContestList();

  // (2) Membership + refs from the already-seeded Problem catalog (NOT a 2nd CF call).
  //     Group every Problem by its contest into the embed shape Contest.problems wants.
  const problems = await Problem.find({}).select('cfContestId cfIndex').lean();
  const problemsByContest = new Map();
  for (const p of problems) {
    if (!problemsByContest.has(p.cfContestId)) problemsByContest.set(p.cfContestId, []);
    problemsByContest.get(p.cfContestId).push({ problemIndex: p.cfIndex, problem: p._id });
  }

  const counts = {};
  let stored = 0;
  let storedWithNoProblems = 0;

  for (const contest of contests) {
    if (contest.phase !== 'FINISHED') continue; // catalog = past contests only

    const label = classifyDivision(contest.name);
    counts[label] = (counts[label] ?? 0) + 1;

    const division = toStoredDivision(label);
    if (!division) continue; // classified but not stored (see decisions.md)

    const contestProblems = problemsByContest.get(contest.id) ?? [];
    if (contestProblems.length === 0) {
      // Stored Div2 but no problems in the catalog = a Problem-catalog gap. Surface it.
      logger.warn({ cfContestId: contest.id, name: contest.name }, 'seed: Div2 contest has no problems in catalog');
      storedWithNoProblems += 1;
    }

    // (3) Idempotent upsert on the unique cfContestId (03 §3). On insert, Mongo fills
    //     cfContestId from the filter; timestamps handle createdAt.
    await Contest.updateOne(
      { cfContestId: contest.id },
      {
        $set: {
          name: contest.name,
          division,
          startTime: new Date(contest.startTimeSeconds * 1000), // UTC
          durationMinutes: Math.round(contest.durationSeconds / 60),
          problems: contestProblems,
        },
      },
      { upsert: true }
    );
    stored += 1;
  }

  logger.info({ counts, stored, storedWithNoProblems }, 'seed: contest catalog complete');
  console.log('\n=== seed summary ===');
  console.table(counts);
  console.log(`stored: ${stored}  (with no problems: ${storedWithNoProblems})`);
};

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'seed: failed');
    await mongoose.disconnect();
    process.exit(1);
  });