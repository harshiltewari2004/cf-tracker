import { describe, it, expect } from "vitest";

import {
  ratingToBucket,
  getTopicBucketRows,
  isInStretchZone,
  getStretchZoneBuckets,
} from "../../../utils/bucketUtils.js";
import { STRETCH_ZONE_SPAN } from "../../../config/constants.js";

describe("bucketUtils", () => {
  describe("ratingToBucket", () => {
    it("includes the lower edge and excludes the upper edge", () => {
      expect(ratingToBucket(800)).toBe("800-1000");
      expect(ratingToBucket(999)).toBe("800-1000");
      expect(ratingToBucket(1000)).toBe("1000-1200");
    });

    it("returns null for an unrated problem", () => {
      expect(ratingToBucket(null)).toBe(null);
      expect(ratingToBucket(undefined)).toBe(null);
    });
  });

  describe("getTopicBucketRows", () => {
    it("credits every tag (all-tags attribution, 01)", () => {
      const rows = getTopicBucketRows({ rating: 1000, tags: ["dp", "greedy", "graphs"] });
      expect(rows).toEqual([
        { topic: "dp", bucket: "1000-1200" },
        { topic: "greedy", bucket: "1000-1200" },
        { topic: "graphs", bucket: "1000-1200" },
      ]);
    });

    it("returns no rows for an unrated problem", () => {
      expect(getTopicBucketRows({ tags: ["dp"] })).toEqual([]);
    });
  });

  describe("isInStretchZone", () => {
    it("includes both edges of [rating, rating + span]", () => {
      expect(isInStretchZone(737, 737)).toBe(true);
      expect(isInStretchZone(737 + STRETCH_ZONE_SPAN, 737)).toBe(true);
    });

    it("excludes just outside both edges", () => {
      expect(isInStretchZone(736, 737)).toBe(false);
      expect(isInStretchZone(737 + STRETCH_ZONE_SPAN + 1, 737)).toBe(false);
    });
  });

  describe("getStretchZoneBuckets", () => {
    it("returns one bucket when the zone sits inside it", () => {
      expect(getStretchZoneBuckets(737, 937)).toEqual(["800-1000"]);
    });

    it("returns every bucket the zone overlaps", () => {
      expect(getStretchZoneBuckets(1150, 1350)).toEqual(["1000-1200", "1200-1400"]);
    });
  });
});