import mongoose from "mongoose";

const validationBaselineSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    snapshotDate: { type: Date, required: true },
    topicBucketRates: [
      {
        topic: { type: String, required: true },
        bucket: { type: String, required: true },
        solveRate: { type: Number, required: true },
        solvesCount: { type: Number, required: true },
        attemptsCount: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model("ValidationBaseline", validationBaselineSchema);
