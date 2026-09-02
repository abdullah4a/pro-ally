import { describe, expect, it } from "vitest";

import { canCreateSession } from "../limits";

describe("canCreateSession", () => {
  it("always allows admins regardless of count", () => {
    expect(canCreateSession(0, true, 5)).toBe(true);
    expect(canCreateSession(5, true, 5)).toBe(true);
    expect(canCreateSession(1000, true, 5)).toBe(true);
  });

  it("allows non-admins under the limit", () => {
    expect(canCreateSession(0, false, 5)).toBe(true);
    expect(canCreateSession(4, false, 5)).toBe(true);
  });

  it("blocks non-admins at or above the limit", () => {
    expect(canCreateSession(5, false, 5)).toBe(false);
    expect(canCreateSession(6, false, 5)).toBe(false);
  });

  it("blocks a non-admin entirely when the limit is 0", () => {
    expect(canCreateSession(0, false, 0)).toBe(false);
  });
});
