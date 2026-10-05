import { describe, it, expect } from "vitest";

import { scoreContest, computeReliabilityProgress } from "../../../engines/ReliabilityEngine.js";
import {
  RELIABLE_A_MINUTES,
  RELIABLE_B_MINUTES,
  RELIABILITY_TARGET,
} from "../../../config/constants.js";

const solved = (firstACTime) => ({ status: "solved", firstACTime });

describe("ReliabilityEngine", () => {
  describe("scoreContest", () => {
    it("pins the thresholds locked in 01 (A 15 min, B 40 min)", () => {
      expect(RELIABLE_A_MINUTES).toBe(15);
      expect(RELIABLE_B_MINUTES).toBe(40);
    });

    it("marks A reliable one minute under the threshold", () => {
      const result = scoreContest(solved(RELIABLE_A_MINUTES - 1), undefined);
      expect(result.aReliable).toBe(true);
    });

    it("does not mark A reliable at exactly the threshold (strict 'under')", () => {
      const result = scoreContest(solved(RELIABLE_A_MINUTES), undefined);
      expect(result.solvedA).toBe(true);
      expect(result.aReliable).toBe(false);
    });

    it("marks B reliable under, but not at, its threshold", () => {
      expect(scoreContest(undefined, solved(RELIABLE_B_MINUTES - 1)).bReliable).toBe(true);
      expect(scoreContest(undefined, solved(RELIABLE_B_MINUTES)).bReliable).toBe(false);
    });

    it("treats a failed problem as unsolved with no time", () => {
      const result = scoreContest({ status: "failed", firstACTime: null }, undefined);
      expect(result.solvedA).toBe(false);
      expect(result.timeA).toBe(null);
      expect(result.aReliable).toBe(false);
    });

    it("treats a missing row as unsolved, not as an error", () => {
      const result = scoreContest(undefined, undefined);
      expect(result).toEqual({
        solvedA: false,
        solvedB: false,
        timeA: null,
        timeB: null,
        aReliable: false,
        bReliable: false,
      });
    });
  });

  describe("computeReliabilityProgress", () => {
    it("pins the target at 4 of 6 as locked in 01", () => {
      expect(RELIABILITY_TARGET).toBe(4);
    });

    it("is limited by the weaker of A and B — strong A cannot carry weak B", () => {
      // 01: success needs BOTH counts >= 4. 6/6 on A with 3/6 on B is not success.
      expect(computeReliabilityProgress(6, 3)).toBeCloseTo(3 / RELIABILITY_TARGET);
      expect(computeReliabilityProgress(6, 3)).toBeLessThan(1);
    });

    it("reaches 1 when both counts hit the target", () => {
      expect(computeReliabilityProgress(4, 4)).toBe(1);
    });

    it("caps at 1 above the target", () => {
      expect(computeReliabilityProgress(6, 6)).toBe(1);
    });

    it("is 0 when either side has no reliable contests", () => {
      expect(computeReliabilityProgress(0, 6)).toBe(0);
    });
  });
});