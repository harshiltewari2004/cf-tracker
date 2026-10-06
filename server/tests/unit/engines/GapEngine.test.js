import { describe, it, expect } from "vitest";

import { computeGap, tallyContestSignal } from "../../../engines/GapEngine.js";
import { GAP_BETA, KEY_SEP } from "../../../config/constants.js";

describe("GapEngine", () => {
  describe("computeGap", () => {
    it("pins beta at 0.4 as locked in 01", () => {
      expect(GAP_BETA).toBe(0.4);
    });

    it("returns 0 gap when solves equal targetCount and there is no contest signal", () => {
      const { baseGap, penalty, finalGap } = computeGap({
        solves: 20,
        targetCount: 20,
        contestFails: 0,
        contestOpportunities: 0,
      });

      expect(baseGap).toBe(0);
      expect(penalty).toBe(0);
      expect(finalGap).toBe(0);
    });

    it("returns baseGap 0 when targetCount is 0 (unbenchmarked)", () => {
      const { baseGap, finalGap } = computeGap({
        solves: 5,
        targetCount: 0,
        contestFails: 0,
        contestOpportunities: 0,
      });

      expect(baseGap).toBe(0);
      expect(finalGap).toBe(0);
    });

    it("floors baseGap at 0 when solves exceed targetCount", () => {
      const { baseGap, finalGap } = computeGap({
        solves: 30,
        targetCount: 20,
        contestFails: 0,
        contestOpportunities: 0,
      });

      expect(baseGap).toBe(0);
      expect(finalGap).toBe(0);
    });

    it("returns penalty 0 when contestOpportunities is 0, even with fails recorded", () => {
      const { baseGap, penalty, finalGap } = computeGap({
        solves: 10,
        targetCount: 20,
        contestFails: 3,
        contestOpportunities: 0,
      });

      expect(baseGap).toBe(0.5);
      expect(penalty).toBe(0);
      expect(finalGap).toBe(0.5);
    });

    it("keeps a non-zero gap when practice is complete but contest fails persist", () => {
      // 01 §Why additive: practice volume alone cannot close a gap
      const { baseGap, penalty, finalGap } = computeGap({
        solves: 20,
        targetCount: 20,
        contestFails: 2,
        contestOpportunities: 2,
      });

      expect(baseGap).toBe(0);
      expect(penalty).toBeCloseTo(GAP_BETA);
      expect(finalGap).toBeCloseTo(GAP_BETA);
    });

    it("clamps finalGap to 1 when baseGap plus penalty exceeds it", () => {
      // base 0.8 + penalty 0.4 = 1.2 — only passes if the clamp really runs
      const { baseGap, finalGap } = computeGap({
        solves: 2,
        targetCount: 10,
        contestFails: 2,
        contestOpportunities: 2,
      });

      expect(baseGap).toBeCloseTo(0.8);
      expect(finalGap).toBe(1);
    });

    it("adds baseGap and penalty for a mid-range gap", () => {
      const { baseGap, penalty, finalGap } = computeGap({
        solves: 10,
        targetCount: 20,
        contestFails: 1,
        contestOpportunities: 2,
      });

      expect(baseGap).toBe(0.5);
      expect(penalty).toBeCloseTo(GAP_BETA * 0.5);
      expect(finalGap).toBeCloseTo(0.5 + GAP_BETA * 0.5);
    });
  });

    describe("tallyContestSignal", () => {
    const row = (cfContestId, { a = false, b = false, status = "solved", tags = ["math"] } = {}) => ({
      cfContestId,
      isDiv2A: a,
      isDiv2B: b,
      status,
      problem: { rating: 800, tags },
    });
    const key = (topic) => `${topic}${KEY_SEP}800-1000`;

    it("counts a contest once when A and B share a tag", () => {
      const { opportunitiesByKey } = tallyContestSignal([
        row(1, { a: true }),
        row(1, { b: true }),
      ]);
      expect(opportunitiesByKey.get(key("math"))).toBe(1);
    });

    it("counts separate contests separately", () => {
      const { opportunitiesByKey } = tallyContestSignal([
        row(1, { a: true }),
        row(2, { a: true }),
      ]);
      expect(opportunitiesByKey.get(key("math"))).toBe(2);
    });

    it("never lets fails exceed opportunities when A and B both fail in one contest", () => {
      const { failsByKey, opportunitiesByKey } = tallyContestSignal([
        row(1, { a: true, status: "failed" }),
        row(1, { b: true, status: "failed" }),
      ]);
      expect(failsByKey.get(key("math"))).toBe(1);
      expect(opportunitiesByKey.get(key("math"))).toBe(1);
    });

    it("counts a contest as failed if either A or B was failed", () => {
      const { failsByKey, opportunitiesByKey } = tallyContestSignal([
        row(1, { a: true, status: "solved" }),
        row(1, { b: true, status: "failed" }),
      ]);
      expect(failsByKey.get(key("math"))).toBe(1);
      expect(opportunitiesByKey.get(key("math"))).toBe(1);
    });

    it("ignores problems that are not A or B", () => {
      const { opportunitiesByKey } = tallyContestSignal([row(1)]);
      expect(opportunitiesByKey.size).toBe(0);
    });

    it("credits every tag of a problem (all-tags attribution, 01)", () => {
      const { opportunitiesByKey } = tallyContestSignal([
        row(1, { a: true, tags: ["math", "greedy"] }),
      ]);
      expect(opportunitiesByKey.get(key("math"))).toBe(1);
      expect(opportunitiesByKey.get(key("greedy"))).toBe(1);
    });
  });
});