import { describe, expect, it } from "vitest";

import { loginSchema, objectIdSchema, registerSchema } from "../user";

describe("registerSchema", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords and attaches the error to confirmPassword", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      expect(flat.confirmPassword?.[0]).toMatch(/do not match/i);
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "short1",
      confirmPassword: "short1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password that is exactly 7 characters (boundary)", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "1234567",
      confirmPassword: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a password that is exactly 8 characters (boundary)", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    "not-an-email",
    "missing-domain@",
    "@missing-local.com",
    "spaces in@email.com",
    "",
    "double@@at.com",
  ])("rejects invalid email %p", (email) => {
    const result = registerSchema.safeParse({
      email,
      password: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when required fields are missing", () => {
    const result = registerSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects non-string password (type confusion)", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: 12345678,
      confirmPassword: 12345678,
    });
    expect(result.success).toBe(false);
  });

  it("rejects null and undefined payloads", () => {
    expect(registerSchema.safeParse(null).success).toBe(false);
    expect(registerSchema.safeParse(undefined).success).toBe(false);
  });

  it("is case-sensitive for password matching (whitespace differences)", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123 ",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid login payload", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });

  it("rejects a missing password field entirely", () => {
    expect(loginSchema.safeParse({ email: "a@b.com" }).success).toBe(false);
  });

  it("rejects an invalid email format", () => {
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: "x" })
        .success,
    ).toBe(false);
  });

  it("rejects array/object injected in place of a string field", () => {
    expect(
      loginSchema.safeParse({ email: ["a@b.com"], password: "x" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: { $ne: null } })
        .success,
    ).toBe(false);
  });
});

describe("objectIdSchema", () => {
  it("accepts a valid 24-char hex id and transforms it into an ObjectId", () => {
    const result = objectIdSchema.safeParse("507f1f77bcf86cd799439011");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toHexString()).toBe("507f1f77bcf86cd799439011");
    }
  });

  it("accepts uppercase hex characters", () => {
    expect(
      objectIdSchema.safeParse("507F1F77BCF86CD799439011").success,
    ).toBe(true);
  });

  it.each([
    "",
    "short",
    "507f1f77bcf86cd79943901",
    "507f1f77bcf86cd7994390111",
    "507f1f77bcf86cd79943901g",
    "not-an-object-id",
    "'; DROP TABLE users; --",
    "{$gt: ''}",
  ])("rejects malformed id %p", (value) => {
    expect(objectIdSchema.safeParse(value).success).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(objectIdSchema.safeParse(12345).success).toBe(false);
    expect(objectIdSchema.safeParse(null).success).toBe(false);
    expect(objectIdSchema.safeParse(undefined).success).toBe(false);
  });
});
