import mongoose from "mongoose";

const contestResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cfContestId: { type: Number, required: true },
    contestName: { type: String, required: true },
    isDiv2: { type: Boolean, required: true },
    rank: { type: Number },
    oldRating: { type: Number },
    newRating: { type: Number },
    ratingChange: { type: Number },
    participatedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
);

contestResultSchema.index({ user: 1, cfContestId: 1 }, { unique: true });
contestResultSchema.index({ user: 1, isDiv2: 1, participatedAt: 1 });

export default mongoose.model("ContestResult", contestResultSchema);
