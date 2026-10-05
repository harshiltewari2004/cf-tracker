import { describe, it, expect } from "vitest";

import { computeGap } from "../../../engines/GapEngine.js";
import { GAP_BETA } from "../../../config/constants.js";

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
});