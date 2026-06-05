import mongoose from 'mongoose';

const reliabilityScoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    last6Contests: [
      {
        contestId: { type: Number, required: true },
        solvedA: { type: Boolean, default: false },
        solvedB: { type: Boolean, default: false },
        timeA: { type: Number },
        timeB: { type: Number },
        aReliable: { type: Boolean, default: false },
        bReliable: { type: Boolean, default: false },
      },
    ],
    aReliableCount: { type: Number, default: 0 },
    bReliableCount: { type: Number, default: 0 },
    totalReal: { type: Number, default: 0 },
    reliabilityProgress: { type: Number, default: 0 },
    lastCalculated: { type: Date },
  },
  {
    timestamps: true,
  }
);


export default mongoose.model('ReliabilityScore', reliabilityScoreSchema);