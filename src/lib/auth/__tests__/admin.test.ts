import { afterEach, describe, expect, it } from "vitest";

import { isAdminEmail } from "../admin";

const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;

afterEach(() => {
  process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
});

describe("isAdminEmail", () => {
  it("returns true when the email matches ADMIN_EMAIL", () => {
    process.env.ADMIN_EMAIL = "admin@proally.app";
    expect(isAdminEmail("admin@proally.app")).toBe(true);
  });

  it("returns false when the email does not match ADMIN_EMAIL", () => {
    process.env.ADMIN_EMAIL = "admin@proally.app";
    expect(isAdminEmail("someone-else@proally.app")).toBe(false);
  });

  it("is case-sensitive (does not normalize case)", () => {
    process.env.ADMIN_EMAIL = "admin@proally.app";
    expect(isAdminEmail("Admin@ProAlly.app")).toBe(false);
  });

  it("returns false when ADMIN_EMAIL is unset, regardless of input", () => {
    delete process.env.ADMIN_EMAIL;
    expect(isAdminEmail("admin@proally.app")).toBe(false);
  });

  it("returns false for null or undefined email", () => {
    process.env.ADMIN_EMAIL = "admin@proally.app";
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("returns false for an empty string email even if ADMIN_EMAIL is also empty", () => {
    process.env.ADMIN_EMAIL = "";
    expect(isAdminEmail("")).toBe(false);
  });
});
