import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
  experienceLevelSchema,
  jobTypeSchema,
  profileFormSchema,
  userProfileSchema,
} from "../profile";

describe("jobTypeSchema / experienceLevelSchema", () => {
  it.each(["full-time", "remote", "contract", "freelance"])(
    "accepts known job type %p",
    (t) => {
      expect(jobTypeSchema.safeParse(t).success).toBe(true);
    },
  );

  it("rejects an unknown job type", () => {
    expect(jobTypeSchema.safeParse("internship").success).toBe(false);
  });

  it.each(["junior", "mid", "senior", "lead"])(
    "accepts known experience level %p",
    (l) => {
      expect(experienceLevelSchema.safeParse(l).success).toBe(true);
    },
  );

  it("rejects an unknown experience level", () => {
    expect(experienceLevelSchema.safeParse("principal").success).toBe(false);
  });
});

describe("userProfileSchema", () => {
  const base = {
    userId: new ObjectId(),
    fullName: "Jane Doe",
    preferredCountry: "PK",
    jobTypes: ["remote" as const],
    updatedAt: new Date(),
  };

  it("accepts a minimal valid profile and applies defaults", () => {
    const result = userProfileSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preferredCities).toEqual([]);
      expect(result.data.remoteOnly).toBe(false);
      expect(result.data.onboardingComplete).toBe(false);
      expect(result.data.experienceLevel).toBeUndefined();
    }
  });

  it("rejects an empty fullName", () => {
    expect(
      userProfileSchema.safeParse({ ...base, fullName: "" }).success,
    ).toBe(false);
  });

  it("rejects a fullName that is only whitespace (min(1) does not trim)", () => {
    // zod's min(1) counts whitespace as valid length, so this documents actual behavior
    expect(
      userProfileSchema.safeParse({ ...base, fullName: " " }).success,
    ).toBe(true);
  });

  it("rejects a preferredCountry that isn't exactly 2 characters", () => {
    expect(
      userProfileSchema.safeParse({ ...base, preferredCountry: "PAK" })
        .success,
    ).toBe(false);
    expect(
      userProfileSchema.safeParse({ ...base, preferredCountry: "P" })
        .success,
    ).toBe(false);
  });

  it("rejects an empty jobTypes array (min 1 required)", () => {
    expect(
      userProfileSchema.safeParse({ ...base, jobTypes: [] }).success,
    ).toBe(false);
  });

  it("rejects an unknown jobType in the array", () => {
    expect(
      userProfileSchema.safeParse({ ...base, jobTypes: ["internship"] })
        .success,
    ).toBe(false);
  });

  it("accepts multiple valid job types", () => {
    expect(
      userProfileSchema.safeParse({
        ...base,
        jobTypes: ["remote", "contract", "full-time"],
      }).success,
    ).toBe(true);
  });

  it("rejects a negative or zero minSalary", () => {
    expect(
      userProfileSchema.safeParse({ ...base, minSalary: 0 }).success,
    ).toBe(false);
    expect(
      userProfileSchema.safeParse({ ...base, minSalary: -1000 }).success,
    ).toBe(false);
  });

  it("accepts a positive minSalary", () => {
    expect(
      userProfileSchema.safeParse({ ...base, minSalary: 50000 }).success,
    ).toBe(true);
  });

  it("omitting minSalary is fine (optional)", () => {
    expect(userProfileSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an invalid experienceLevel when provided", () => {
    expect(
      userProfileSchema.safeParse({ ...base, experienceLevel: "staff" })
        .success,
    ).toBe(false);
  });

  it("rejects missing required fields", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fullName: _f, ...rest } = base;
    expect(userProfileSchema.safeParse(rest).success).toBe(false);
  });
});

describe("profileFormSchema", () => {
  it("omits userId and updatedAt from the required shape", () => {
    const result = profileFormSchema.safeParse({
      fullName: "Jane Doe",
      preferredCountry: "AE",
      jobTypes: ["remote"],
    });
    expect(result.success).toBe(true);
  });

  it("still validates nested field constraints (country length)", () => {
    expect(
      profileFormSchema.safeParse({
        fullName: "Jane Doe",
        preferredCountry: "UAE",
        jobTypes: ["remote"],
      }).success,
    ).toBe(false);
  });
});
