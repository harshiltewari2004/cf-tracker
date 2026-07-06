import mongoose from "mongoose";

const benchmarkTargetCountSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    bucket: { type: String, required: true },
    p50: { type: Number, required: true },
    cohortN: { type: Number, required: true },
    cohortVersion: { type: Number, required: true },
    lastCalculated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

benchmarkTargetCountSchema.index(
  { topic: 1, bucket: 1, cohortVersion: 1 },
  { unique: true },
);

export default mongoose.model(
  "BenchmarkTargetCount",
  benchmarkTargetCountSchema,
);
