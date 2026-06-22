import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import mongoose from 'mongoose';

import logger from '../config/logger.js';
import { connectDB } from '../config/db.js';   // keep your existing harness import
import * as BenchmarkEngine from '../engines/BenchmarkEngine.js';
import BenchmarkTargetCount from '../models/BenchmarkTargetCount.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, '.cohort-cache.json');

const run = async () => {
  await connectDB();

  let injectedSelection = null;
  if (fs.existsSync(CACHE_PATH)) {
    injectedSelection = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    logger.info({ N: injectedSelection.cohort.N }, 'loaded cohort from cache — skipping the live scan');
  }

const result = await BenchmarkEngine.refresh({
  injectedSelection,
  onSelection: (selected) => {
    if (injectedSelection) return;
    fs.writeFileSync(CACHE_PATH, JSON.stringify(selected));
    logger.info({ N: selected.cohort.N }, 'cohort cached to disk — re-runs skip the scan');
  },
});

  if (!result) {
    logger.warn('benchmark held previous version (cohort below floor) — nothing written');
    return;
  }

  const rows = await BenchmarkTargetCount.find({ cohortVersion: result.version })
    .sort({ p50: -1 })
    .limit(15)
    .lean();

  logger.info({ version: result.version }, 'benchmark written — top 15 buckets by p50:');
  console.table(rows.map((r) => ({ topic: r.topic, bucket: r.bucket, p50: r.p50 })));
};

run()
  .catch((err) => logger.error({ err }, 'run-benchmark failed'))
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });