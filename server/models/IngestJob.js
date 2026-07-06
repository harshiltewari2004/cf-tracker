import mongoose from "mongoose";

const ingestJobSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["initial", "daily_refresh"], required: true },
    status: {
      type: String,
      enum: ["queued", "processing", "complete", "failed"],
      default: "queued",
    },
    lastIngestedSubmissionId: { type: Number },
    submissionsIngested: { type: Number, default: 0 },
    rateLimitHits: { type: Number, default: 0 },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

ingestJobSchema.index({ user: 1, status: 1 });
ingestJobSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("IngestJob", ingestJobSchema);
