// scripts/verify-classifier.js
// Throwaway verification harness — NOT app code. Runs the division classifier against
// the live contest.list and prints label counts + the full Unknown bucket, so you can
// eyeball the classifier before trusting it in the seed.  Run:  node scripts/verify-classifier.js

import * as cfApiClient from "../ingest/CFApiClient.js";
import { classifyDivision, toStoredDivision } from "../utils/contestUtils.js";

const main = async () => {
  // One bulk call. Match your actual wrapper name (getContestList / getContests / ...).
  const contests = await cfApiClient.getContestList();

  const counts = {};
  const unknowns = [];
  const div2Sample = [];

  for (const contest of contests) {
    const label = classifyDivision(contest.name);
    counts[label] = (counts[label] ?? 0) + 1;
    if (label === "Unknown") unknowns.push(contest.name);
    if (label === "Div2" && div2Sample.length < 15)
      div2Sample.push(contest.name);
  }

  console.log("\n=== counts per label ===");
  console.table(counts);

  // What the seed would actually persist: FINISHED + (Div2 or Combined).
  const stored = contests.filter(
    (c) => c.phase === "FINISHED" && toStoredDivision(classifyDivision(c.name)),
  ).length;
  console.log(`\nwould store (FINISHED, Div2 + Combined): ${stored}`);

  console.log(
    `\n=== Unknown bucket (${unknowns.length}) — scan for any real Div2 in here ===`,
  );
  unknowns.forEach((n) => console.log("  ", n));

  console.log("\n=== Div2 sample (confirm these really are Div2) ===");
  div2Sample.forEach((n) => console.log("  ", n));
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
