import mongoose from "mongoose";

const topicBucketScoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    topic: { type: String, required: true },
    bucket: { type: String, required: true },
    solves: { type: Number, default: 0 },
    targetCount: { type: Number, default: 0 },
    baseGap: { type: Number, default: 0 },
    contestFails: { type: Number, default: 0 },
    contestOpportunities: { type: Number, default: 0 },
    penalty: { type: Number, default: 0 },
    finalGap: { type: Number, default: 0 },
    lastCalculated: { type: Date },
  },
  { timestamps: true },
);

topicBucketScoreSchema.index(
  { user: 1, topic: 1, bucket: 1 },
  { unique: true },
);
topicBucketScoreSchema.index({ user: 1, finalGap: -1 });

export default mongoose.model("TopicBucketScore", topicBucketScoreSchema);
