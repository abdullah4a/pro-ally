import { describe, expect, it } from "vitest";

import { addJsearchKeySchema, jsearchKeyDocumentSchema } from "../jsearchKeys";

describe("jsearchKeyDocumentSchema", () => {
  const valid = {
    apiKey: "rapidapi-key-123",
    label: "Primary key",
    createdAt: new Date(),
    createdBy: "6a96a8f02135c9f2c5c2ef59",
    updatedAt: new Date(),
  };

  it("accepts a valid key document and defaults isActive plus quota-tracking fields", () => {
    const result = jsearchKeyDocumentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
      expect(result.data.monthlyLimit).toBeNull();
      expect(result.data.requestsRemainingKnown).toBeNull();
      expect(result.data.quotaResetsAt).toBeNull();
      expect(result.data.lastFetchedAt).toBeNull();
      expect(result.data.fetchIntervalMinutes).toBeNull();
    }
  });

  it("accepts fully populated quota-tracking fields", () => {
    expect(
      jsearchKeyDocumentSchema.safeParse({
        ...valid,
        monthlyLimit: 200,
        requestsRemainingKnown: 150,
        quotaResetsAt: new Date(),
        lastFetchedAt: new Date(),
        fetchIntervalMinutes: 288,
      }).success,
    ).toBe(true);
  });

  it("rejects a negative fetchIntervalMinutes", () => {
    expect(
      jsearchKeyDocumentSchema.safeParse({ ...valid, fetchIntervalMinutes: -5 }).success,
    ).toBe(false);
  });

  it("accepts an explicit isActive value", () => {
    const result = jsearchKeyDocumentSchema.safeParse({ ...valid, isActive: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it("rejects an empty apiKey", () => {
    expect(jsearchKeyDocumentSchema.safeParse({ ...valid, apiKey: "" }).success).toBe(
      false,
    );
  });

  it("rejects an empty label", () => {
    expect(jsearchKeyDocumentSchema.safeParse({ ...valid, label: "" }).success).toBe(
      false,
    );
  });

  it("rejects a label over 100 characters", () => {
    expect(
      jsearchKeyDocumentSchema.safeParse({ ...valid, label: "a".repeat(101) }).success,
    ).toBe(false);
  });
});

describe("addJsearchKeySchema", () => {
  it("accepts a plausible API key with no label", () => {
    expect(
      addJsearchKeySchema.safeParse({ apiKey: "f35ceea0bamshcaab3df39174db6" }).success,
    ).toBe(true);
  });

  it("accepts a plausible API key with a label", () => {
    expect(
      addJsearchKeySchema.safeParse({
        apiKey: "f35ceea0bamshcaab3df39174db6",
        label: "Team account",
      }).success,
    ).toBe(true);
  });

  it("rejects a key that's too short to be real", () => {
    expect(addJsearchKeySchema.safeParse({ apiKey: "short" }).success).toBe(false);
  });

  it("rejects an empty apiKey", () => {
    expect(addJsearchKeySchema.safeParse({ apiKey: "" }).success).toBe(false);
  });

  it("rejects a missing apiKey field", () => {
    expect(addJsearchKeySchema.safeParse({}).success).toBe(false);
  });
});
