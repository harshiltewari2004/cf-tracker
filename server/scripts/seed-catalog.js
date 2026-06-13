// server/scripts/seed-catalog.js
// One-time catalog seed: Contest + Problem collections (07_timeline Phase 2).
// Idempotent — upserts everywhere, safe to re-run.
// Usage: node scripts/seed-catalog.js
import 'dotenv/config';
import mongoose from 'mongoose';

import { env } from '../config/env.js';
import Contest from '../models/Contest.js';
import Problem from '../models/Problem.js';
import * as cfApiClient from '../ingest/CFApiClient.js';
import { ratingToBucket } from '../utils/bucketUtils.js';

const BULK_CHUNK = 500;

const inferDivision = (name) => {
  if (name.includes('Educational')) return 'Educational';
  if (name.includes('Div. 3')) return 'Div3';
  if (name.includes('Div. 2')) return 'Div2';
  if (name.includes('Div. 1')) return 'Div1';
  return null; // Div4 / ICPC / special rounds — outside the model's division values, skipped
};

const chunkedBulkWrite = async (Model, ops, label) => {
  for (let i = 0; i < ops.length; i += BULK_CHUNK) {
    await Model.bulkWrite(ops.slice(i, i + BULK_CHUNK), { ordered: false });
    console.log(`${label}: ${Math.min(i + BULK_CHUNK, ops.length)} / ${ops.length}`);
  }
};

const main = async () => {
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000, // fail fast if Atlas unreachable
    socketTimeoutMS: 120000,         // kill any single op that stalls >2min
  });

  // --- 1. Contests (contest.list) ---
  const contests = await cfApiClient.getContestList();
  const divisionByContest = new Map();
  const contestOps = [];
  for (const c of contests) {
    if (c.phase !== 'FINISHED') continue;
    const division = inferDivision(c.name);
    if (!division) continue;
    divisionByContest.set(c.id, division);
    contestOps.push({
      updateOne: {
        filter: { cfContestId: c.id },
        update: {
          $set: {
            name: c.name,
            division,
            startTime: new Date(c.startTimeSeconds * 1000),
            durationMinutes: Math.round(c.durationSeconds / 60),
          },
        },
        upsert: true,
      },
    });
  }
  await chunkedBulkWrite(Contest, contestOps, 'contests');

  // --- 2. Problems (problemset.problems) ---
  const { problems } = await cfApiClient.getProblemsetProblems();
  const problemOps = problems.map((p) => {
    const division = divisionByContest.get(p.contestId) ?? null;
    const canonicalIndex = p.index === 'A2' ? 'A' : p.index; // A2 → A (02_features §3)
    return {
      updateOne: {
        filter: { cfContestId: p.contestId, cfIndex: p.index },
        update: {
          $set: {
            name: p.name,
            rating: p.rating ?? null, // CF omits rating for some problems
            ratingBucket: p.rating ? ratingToBucket(p.rating) : null,
            tags: p.tags,
            url: `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`,
            isDiv2A: division === 'Div2' && canonicalIndex === 'A',
            isDiv2B: division === 'Div2' && canonicalIndex === 'B',
          },
        },
        upsert: true,
      },
    };
  });
  await chunkedBulkWrite(Problem, problemOps, 'problems');

  // --- 3. Backfill Contest.problems arrays (batched) ---
  // One pass over all problems, grouped in memory, then chunked bulkWrite.
  // Replaces 3300 sequential round trips with a handful of batched writes.
  const allProblems = await Problem.find({}).select('_id cfIndex cfContestId').lean();

  const byContest = new Map();
  for (const p of allProblems) {
    if (!divisionByContest.has(p.cfContestId)) continue; // only catalog contests
    if (!byContest.has(p.cfContestId)) byContest.set(p.cfContestId, []);
    byContest.get(p.cfContestId).push({ problemIndex: p.cfIndex, problem: p._id });
  }

  const linkOps = [];
  for (const [cfContestId, problems] of byContest) {
    linkOps.push({
      updateOne: {
        filter: { cfContestId },
        update: { $set: { problems } },
      },
    });
  }
  await chunkedBulkWrite(Contest, linkOps, 'contests linked');

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error('SEED FAILED:', err);
  await mongoose.disconnect();
  process.exit(1);
});