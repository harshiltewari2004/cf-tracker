import { describe, it, expect } from "vitest";

import { computeGap } from "../../../engines/GapEngine.js";

describe("GapEngine", () => {
  describe("computeGap", () => {
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

    it("returns baseGap 0 when targetCount is 0 and solves is 0", () => {
      const { baseGap, finalGap } = computeGap({
        solves: 0,
        targetCount: 0,
        contestFails: 0,
        contestOpportunities: 0,
      });

      expect(baseGap).toBe(0);
      expect(finalGap).toBe(0);
    });

    it("returns baseGap 0 when targetCount is 0 and user is above the zero benchmark", () => {
      const { baseGap, finalGap } = computeGap({
        solves: 5,
        targetCount: 0,
        contestFails: 0,
        contestOpportunities: 0,
      });

      expect(baseGap).toBe(0);
      expect(finalGap).toBe(0);
    });

    it("returns baseGap unchanged with penalty 0 when contestOpportunities is 0", () => {
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

    it("clamps finalGap to 1 when baseGap plus penalty would exceed it", () => {
      const { finalGap } = computeGap({
        solves: 0,
        targetCount: 10,
        contestFails: 2,
        contestOpportunities: 2,
      });

      expect(finalGap).toBe(1);
    });

    it("combines baseGap and penalty for a mid-range gap", () => {
      const { baseGap, penalty, finalGap } = computeGap({
        solves: 10,
        targetCount: 20,
        contestFails: 1,
        contestOpportunities: 2,
      });

      expect(baseGap).toBe(0.5);
      expect(penalty).toBeCloseTo(0.2);
      expect(finalGap).toBeCloseTo(0.7);
    });
  });
});
