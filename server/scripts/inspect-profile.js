import mongoose from "mongoose";
import "dotenv/config";

import CFProfile from "../models/CFProfile.js";
import User from "../models/User.js";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const profiles = await CFProfile.find({ handle: "harshil20" }).lean();
  console.log(`found ${profiles.length} CFProfile(s) with handle harshil20:\n`);

  for (const p of profiles) {
    const owner = await User.findById(p.user).lean();
    console.log({
      profileId: p._id,
      userId: p.user,
      ownerName: owner?.name ?? "(no user found)",
      ownerEmail: owner?.email ?? "(none)",
      ingestStatus: p.ingestStatus,
      createdAt: p.createdAt,
    });
  }

  await mongoose.disconnect();
};

run().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
