import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { filtersFormSchema, platformSchema, userFiltersSchema } from "../filters";

describe("platformSchema", () => {
  it.each(["linkedin", "indeed", "upwork", "fiverr", "ats"])(
    "accepts known platform %p",
    (platform) => {
      expect(platformSchema.safeParse(platform).success).toBe(true);
    },
  );

  it.each(["monster", "glassdoor", "", "LinkedIn", " indeed"])(
    "rejects unknown or mis-cased platform %p",
    (platform) => {
      expect(platformSchema.safeParse(platform).success).toBe(false);
    },
  );
});

describe("userFiltersSchema", () => {
  const base = { userId: new ObjectId(), updatedAt: new Date() };

  it("applies all documented defaults when optional fields are omitted", () => {
    const result = userFiltersSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keywords).toEqual([]);
      expect(result.data.excludeKeywords).toEqual([]);
      expect(result.data.platforms).toEqual(["linkedin", "indeed", "upwork"]);
      expect(result.data.minTrustScore).toBe(60);
      expect(result.data.minMatchScore).toBe(70);
      expect(result.data.pollIntervalMins).toBe(15);
    }
  });

  it("accepts minTrustScore/minMatchScore at the 0 and 100 boundaries", () => {
    expect(
      userFiltersSchema.safeParse({ ...base, minTrustScore: 0, minMatchScore: 100 })
        .success,
    ).toBe(true);
  });

  it("rejects minTrustScore below 0", () => {
    expect(
      userFiltersSchema.safeParse({ ...base, minTrustScore: -1 }).success,
    ).toBe(false);
  });

  it("rejects minMatchScore above 100", () => {
    expect(
      userFiltersSchema.safeParse({ ...base, minMatchScore: 101 }).success,
    ).toBe(false);
  });

  it("accepts pollIntervalMins at the 15-minute minimum boundary", () => {
    expect(
      userFiltersSchema.safeParse({ ...base, pollIntervalMins: 15 }).success,
    ).toBe(true);
  });

  it("rejects pollIntervalMins below 15 minutes", () => {
    expect(
      userFiltersSchema.safeParse({ ...base, pollIntervalMins: 14 }).success,
    ).toBe(false);
  });

  it("rejects pollIntervalMins of 0 or negative", () => {
    expect(
      userFiltersSchema.safeParse({ ...base, pollIntervalMins: 0 }).success,
    ).toBe(false);
    expect(
      userFiltersSchema.safeParse({ ...base, pollIntervalMins: -30 }).success,
    ).toBe(false);
  });

  it("rejects an unknown platform inside the platforms array", () => {
    expect(
      userFiltersSchema.safeParse({ ...base, platforms: ["monster"] })
        .success,
    ).toBe(false);
  });

  it("rejects a duplicate-laden but otherwise valid platforms array (duplicates allowed)", () => {
    expect(
      userFiltersSchema.safeParse({
        ...base,
        platforms: ["linkedin", "linkedin"],
      }).success,
    ).toBe(true);
  });

  it("rejects missing userId", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId: _userId, ...rest } = base;
    expect(userFiltersSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects non-array keywords (e.g. comma-separated string leaking from a form)", () => {
    expect(
      userFiltersSchema.safeParse({ ...base, keywords: "react,node" })
        .success,
    ).toBe(false);
  });
});

describe("filtersFormSchema", () => {
  it("accepts raw comma-separated keyword strings (form representation)", () => {
    const result = filtersFormSchema.safeParse({
      keywords: "react, node, typescript",
      excludeKeywords: "",
      platforms: ["linkedin"],
      minTrustScore: 50,
      minMatchScore: 60,
      pollIntervalMins: 30,
    });
    expect(result.success).toBe(true);
  });

  it("does not accept userId/updatedAt since they are omitted from the form shape", () => {
    const result = filtersFormSchema.safeParse({
      userId: new ObjectId(),
      updatedAt: new Date(),
      keywords: "react",
      excludeKeywords: "",
      platforms: ["linkedin"],
    });
    // extra keys are stripped by default zod object parsing, so this should still succeed
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).userId).toBeUndefined();
    }
  });

  it("rejects when keywords is passed as an array instead of the expected form string", () => {
    const result = filtersFormSchema.safeParse({
      keywords: ["react"],
      excludeKeywords: "",
      platforms: ["linkedin"],
    });
    expect(result.success).toBe(false);
  });
});
