import mongoose from "mongoose";

const contestProblemResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contestResult: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContestResult",
      required: true,
    },
    cfContestId: { type: Number, required: true },
    problemIndex: { type: String, required: true },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    },
    status: {
      type: String,
      enum: ["solved", "failed", "unattempted"],
      required: true,
    },
    firstACTime: { type: Number },
    failCount: { type: Number, default: 0 },
    isDiv2A: { type: Boolean, default: false },
    isDiv2B: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

contestProblemResultSchema.index({ user: 1, isDiv2A: 1, status: 1 });
contestProblemResultSchema.index({ user: 1, isDiv2B: 1, status: 1 });
contestProblemResultSchema.index(
  { user: 1, cfContestId: 1, problemIndex: 1 },
  { unique: true },
);

export default mongoose.model(
  "ContestProblemResult",
  contestProblemResultSchema,
);
