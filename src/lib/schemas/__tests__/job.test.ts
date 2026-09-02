import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
  jobActivitySchema,
  jobListingSchema,
  jobMatchEvaluationSchema,
  jobSourceSchema,
  jobStatusSchema,
  jobUpdateSchema,
  matchedJobSchema,
} from "../job";

describe("jobSourceSchema", () => {
  it.each(["upwork", "linkedin", "indeed", "fiverr", "jsearch", "greenhouse", "lever", "ashby"])(
    "accepts known source %p",
    (source) => {
      expect(jobSourceSchema.safeParse(source).success).toBe(true);
    },
  );

  it("rejects an unknown source", () => {
    expect(jobSourceSchema.safeParse("monster").success).toBe(false);
  });
});

describe("jobStatusSchema", () => {
  it.each(["new", "saved", "applied", "interviewing", "offer", "rejected"])(
    "accepts known status %p",
    (status) => {
      expect(jobStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it("rejects an unknown status", () => {
    expect(jobStatusSchema.safeParse("archived").success).toBe(false);
  });
});

describe("jobListingSchema", () => {
  const valid = {
    externalId: "abc-123",
    source: "greenhouse" as const,
    title: "Backend Engineer",
    company: "Acme Inc",
    description: "Build things.",
    url: "https://acme.example.com/jobs/abc-123",
    postedAt: new Date(),
  };

  it("accepts a minimal valid listing", () => {
    expect(jobListingSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional location and salary when present", () => {
    expect(
      jobListingSchema.safeParse({ ...valid, location: "Remote", salary: "$100k-$120k" })
        .success,
    ).toBe(true);
  });

  it("accepts an optional publisher, omitting it is also fine", () => {
    expect(jobListingSchema.safeParse({ ...valid, publisher: "Indeed" }).success).toBe(
      true,
    );
    expect(jobListingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid url", () => {
    expect(jobListingSchema.safeParse({ ...valid, url: "not-a-url" }).success).toBe(false);
  });

  it("rejects an empty externalId", () => {
    expect(jobListingSchema.safeParse({ ...valid, externalId: "" }).success).toBe(false);
  });

  it("rejects an unknown source", () => {
    expect(jobListingSchema.safeParse({ ...valid, source: "monster" }).success).toBe(false);
  });

  it("rejects postedAt as an ISO string rather than a Date instance", () => {
    expect(
      jobListingSchema.safeParse({ ...valid, postedAt: valid.postedAt.toISOString() }).success,
    ).toBe(false);
  });
});

describe("jobActivitySchema", () => {
  it("accepts a minimal activity entry", () => {
    expect(
      jobActivitySchema.safeParse({ type: "apply_clicked", at: new Date() }).success,
    ).toBe(true);
  });

  it("accepts an activity entry with a toStatus", () => {
    expect(
      jobActivitySchema.safeParse({
        type: "applied_confirmed",
        at: new Date(),
        toStatus: "applied",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown activity type", () => {
    expect(
      jobActivitySchema.safeParse({ type: "bogus", at: new Date() }).success,
    ).toBe(false);
  });

  it("rejects an invalid toStatus", () => {
    expect(
      jobActivitySchema.safeParse({
        type: "status_changed",
        at: new Date(),
        toStatus: "bogus",
      }).success,
    ).toBe(false);
  });
});

describe("matchedJobSchema", () => {
  const valid = {
    userId: new ObjectId(),
    externalId: "abc-123",
    source: "upwork" as const,
    title: "Backend Engineer",
    company: "Acme Inc",
    description: "Build things.",
    url: "https://acme.example.com/jobs/abc-123",
    postedAt: new Date(),
    matchScore: 85,
    createdAt: new Date(),
  };

  it("accepts a valid matched job and applies defaults", () => {
    const result = matchedJobSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("new");
      expect(result.data.matchReason).toBe("");
      expect(result.data.matchingSkills).toEqual([]);
      expect(result.data.notes).toBe("");
      expect(result.data.activity).toEqual([]);
      expect(result.data.savedAt).toBeNull();
      expect(result.data.alertedAt).toBeNull();
    }
  });

  it("accepts an explicit activity log", () => {
    const result = matchedJobSchema.safeParse({
      ...valid,
      activity: [{ type: "apply_clicked", at: new Date() }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activity).toHaveLength(1);
    }
  });

  it("accepts matchScore boundaries 0 and 100, rejects outside", () => {
    expect(matchedJobSchema.safeParse({ ...valid, matchScore: 0 }).success).toBe(true);
    expect(matchedJobSchema.safeParse({ ...valid, matchScore: 100 }).success).toBe(true);
    expect(matchedJobSchema.safeParse({ ...valid, matchScore: -1 }).success).toBe(false);
    expect(matchedJobSchema.safeParse({ ...valid, matchScore: 101 }).success).toBe(false);
  });

  it("rejects when userId is a hex string instead of an ObjectId instance", () => {
    expect(
      matchedJobSchema.safeParse({ ...valid, userId: valid.userId.toHexString() }).success,
    ).toBe(false);
  });

  it("rejects an invalid status override", () => {
    expect(matchedJobSchema.safeParse({ ...valid, status: "archived" }).success).toBe(false);
  });

  it("accepts explicit savedAt/alertedAt dates", () => {
    const now = new Date();
    expect(
      matchedJobSchema.safeParse({ ...valid, savedAt: now, alertedAt: now }).success,
    ).toBe(true);
  });
});

describe("jobUpdateSchema", () => {
  const jobId = new ObjectId().toHexString();

  it("accepts a status-only update", () => {
    expect(jobUpdateSchema.safeParse({ jobId, status: "applied" }).success).toBe(true);
  });

  it("accepts a notes-only update", () => {
    expect(jobUpdateSchema.safeParse({ jobId, notes: "Follow up Friday" }).success).toBe(true);
  });

  it("rejects when neither status, notes, nor action is provided", () => {
    expect(jobUpdateSchema.safeParse({ jobId }).success).toBe(false);
  });

  it("accepts an action-only update (e.g. logging an apply click with no status change)", () => {
    expect(jobUpdateSchema.safeParse({ jobId, action: "apply_clicked" }).success).toBe(true);
  });

  it("rejects an unknown action value", () => {
    expect(jobUpdateSchema.safeParse({ jobId, action: "bogus" }).success).toBe(false);
  });

  it("rejects an invalid jobId", () => {
    expect(
      jobUpdateSchema.safeParse({ jobId: "not-an-id", status: "applied" }).success,
    ).toBe(false);
  });

  it("transforms jobId into an ObjectId instance", () => {
    const result = jobUpdateSchema.safeParse({ jobId, status: "applied" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobId).toBeInstanceOf(ObjectId);
    }
  });
});

describe("jobMatchEvaluationSchema", () => {
  it("accepts a valid evaluation and applies defaults", () => {
    const result = jobMatchEvaluationSchema.safeParse({ match: true, score: 80 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe("");
      expect(result.data.matchingSkills).toEqual([]);
    }
  });

  it("rejects score outside 0-100", () => {
    expect(jobMatchEvaluationSchema.safeParse({ match: true, score: -1 }).success).toBe(false);
    expect(jobMatchEvaluationSchema.safeParse({ match: true, score: 101 }).success).toBe(false);
  });

  it("caps matchingSkills at 20 entries", () => {
    const skills = Array.from({ length: 21 }, (_, i) => `skill-${i}`);
    expect(
      jobMatchEvaluationSchema.safeParse({ match: true, score: 50, matchingSkills: skills })
        .success,
    ).toBe(false);
  });
});
