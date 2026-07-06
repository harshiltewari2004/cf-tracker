import mongoose from "mongoose";

const dailyPlanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    planType: {
      type: String,
      enum: ["cold_start", "gap_driven"],
      required: true,
    },
    problems: [
      {
        problem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Problem",
          required: true,
        },
        type: { type: String, enum: ["gap", "upsolve"], required: true },
        status: {
          type: String,
          enum: ["pending", "solved", "failed", "skipped"],
          default: "pending",
        },
        verdict: { type: String, enum: ["OK", "WA", "TLE", "RE", "MLE"] },
        solvedAt: { type: Date },
      },
    ],
    completed: { type: Boolean, default: false },
    replacedProblems: [
      {
        original: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Problem",
          required: true,
        },
        replacement: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Problem",
          required: true,
        },
        replacedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  },
);

dailyPlanSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model("DailyPlan", dailyPlanSchema);
