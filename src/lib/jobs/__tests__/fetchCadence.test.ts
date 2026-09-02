import { describe, expect, it } from "vitest";

import { computeFetchIntervalMinutes, isDueForFetch } from "../fetchCadence";

describe("computeFetchIntervalMinutes", () => {
  const now = new Date("2026-09-01T00:00:00.000Z");

  it("returns the default interval when nothing about the key is known", () => {
    expect(
      computeFetchIntervalMinutes({ requestsRemaining: null, quotaResetsAt: null, monthlyLimit: null }, now),
    ).toBe(180);
  });

  it("falls back to monthlyLimit/30-day math when remaining/reset aren't known yet", () => {
    // 200 * 0.8 / 30 = 5.33 -> floor 5/day -> ceil(1440/5) = 288 minutes
    expect(
      computeFetchIntervalMinutes({ requestsRemaining: null, quotaResetsAt: null, monthlyLimit: 200 }, now),
    ).toBe(288);
  });

  it("prefers the precise remaining/reset formula when both are known", () => {
    // 10 days left, 100 remaining -> budget = floor(100*0.8) = 80 -> interval = ceil(10*24*60 / 80 / 60)*... let's just check it's tighter than the flat estimate
    const resetsAt = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const minutes = computeFetchIntervalMinutes(
      { requestsRemaining: 100, quotaResetsAt: resetsAt, monthlyLimit: 200 },
      now,
    );
    // secondsUntilReset = 864000, budget = floor(100*0.8) = 80, interval = ceil(864000/80/60) = 180
    expect(minutes).toBe(180);
  });

  it("spreads the cadence out as remaining requests shrink relative to time left", () => {
    const resetsAt = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const withPlentyRemaining = computeFetchIntervalMinutes(
      { requestsRemaining: 100, quotaResetsAt: resetsAt, monthlyLimit: 200 },
      now,
    );
    const withFewRemaining = computeFetchIntervalMinutes(
      { requestsRemaining: 5, quotaResetsAt: resetsAt, monthlyLimit: 200 },
      now,
    );
    expect(withFewRemaining).toBeGreaterThan(withPlentyRemaining);
  });

  it("returns the minimum interval immediately when quota is fully exhausted and reset has already passed", () => {
    const resetsAt = new Date(now.getTime() - 1000);
    expect(
      computeFetchIntervalMinutes({ requestsRemaining: 0, quotaResetsAt: resetsAt, monthlyLimit: 200 }, now),
    ).toBe(60);
  });

  it("waits out the remaining reset window when quota is exhausted but reset is still in the future", () => {
    const resetsAt = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5 hours
    expect(
      computeFetchIntervalMinutes({ requestsRemaining: 0, quotaResetsAt: resetsAt, monthlyLimit: 200 }, now),
    ).toBe(300);
  });

  it("clamps the computed interval to a 1-hour minimum", () => {
    // A huge limit would compute a very short interval without clamping.
    expect(
      computeFetchIntervalMinutes({ requestsRemaining: null, quotaResetsAt: null, monthlyLimit: 100_000 }, now),
    ).toBe(60);
  });

  it("clamps the computed interval to a 24-hour maximum", () => {
    expect(
      computeFetchIntervalMinutes({ requestsRemaining: null, quotaResetsAt: null, monthlyLimit: 1 }, now),
    ).toBe(1440);
  });

  it("treats a zero or negative monthlyLimit the same as unknown", () => {
    expect(
      computeFetchIntervalMinutes({ requestsRemaining: null, quotaResetsAt: null, monthlyLimit: 0 }, now),
    ).toBe(180);
  });
});

describe("isDueForFetch", () => {
  const now = new Date("2026-09-01T12:00:00.000Z");

  it("is always due when there is no lastFetchedAt", () => {
    expect(isDueForFetch(null, 180, now)).toBe(true);
  });

  it("is not due before the interval has elapsed", () => {
    const lastFetchedAt = new Date(now.getTime() - 60 * 60_000); // 1 hour ago
    expect(isDueForFetch(lastFetchedAt, 180, now)).toBe(false);
  });

  it("is due once the interval has elapsed", () => {
    const lastFetchedAt = new Date(now.getTime() - 180 * 60_000); // exactly 180 min ago
    expect(isDueForFetch(lastFetchedAt, 180, now)).toBe(true);
  });

  it("is due once the interval has been exceeded", () => {
    const lastFetchedAt = new Date(now.getTime() - 200 * 60_000);
    expect(isDueForFetch(lastFetchedAt, 180, now)).toBe(true);
  });

  it("falls back to the default 180-minute interval when fetchIntervalMinutes is null", () => {
    const justUnder = new Date(now.getTime() - 179 * 60_000);
    const justOver = new Date(now.getTime() - 181 * 60_000);
    expect(isDueForFetch(justUnder, null, now)).toBe(false);
    expect(isDueForFetch(justOver, null, now)).toBe(true);
  });
});
