import "dotenv/config";
import mongoose from "mongoose";

import logger from "../config/logger.js";
import User from "../models/User.js";
import "../models/Problem.js";
import { recalculate } from "../engines/GapEngine.js";

const email = process.argv[2];

const run = async () => {
  if (!email) {
    logger.error("Usage: node scripts/runRecalculate.js <email>");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  logger.info("MongoDB connected");

  const user = await User.findOne({ email }).select("_id").lean();
  if (!user) {
    logger.error({ email }, "No user found for that email");
    await mongoose.disconnect();
    process.exit(1);
  }

  logger.info({ userId: user._id }, "Running recalculate");
  await recalculate(user._id);
  logger.info("recalculate complete");

  await mongoose.disconnect();
  process.exit(0);
};

run();
