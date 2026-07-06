import mongoose from "mongoose";

const upSolveQueueSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    },
    sourceContestId: { type: Number, required: true },
    addedAt: { type: Date, default: Date.now },
    scheduledFor: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "completed", "skipped"],
      default: "pending",
    },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

upSolveQueueSchema.index({ user: 1, status: 1, scheduledFor: 1 });
upSolveQueueSchema.index({ user: 1, problem: 1 }, { unique: true });

export default mongoose.model("UpsolveQueue", upSolveQueueSchema);
