import { ObjectId } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";

const findUserByEmail = vi.fn();
const createUser = vi.fn();

vi.mock("@/lib/repositories/users", () => ({
  findUserByEmail: (...args: unknown[]) => findUserByEmail(...args),
  createUser: (...args: unknown[]) => createUser(...args),
}));

// bcryptjs is used with real hashing here (fast enough for short test passwords)
// so we exercise the actual compare() implementation rather than mocking it.

import bcrypt from "bcryptjs";

import { authorizeCredentials } from "@/lib/auth/authorize";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = ORIGINAL_ENV.ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD = ORIGINAL_ENV.ADMIN_PASSWORD;
});

describe("authorizeCredentials", () => {
  it("returns null for undefined credentials", async () => {
    expect(await authorizeCredentials(undefined)).toBeNull();
  });

  it("returns null for malformed credentials (invalid email)", async () => {
    expect(
      await authorizeCredentials({ email: "not-an-email", password: "x" }),
    ).toBeNull();
  });

  it("returns null when password is missing", async () => {
    expect(
      await authorizeCredentials({ email: "a@b.com" }),
    ).toBeNull();
  });

  it("returns null when credentials is an empty object", async () => {
    expect(await authorizeCredentials({})).toBeNull();
  });

  describe("admin login via env vars", () => {
    it("creates a real DB user on first admin login and returns its id", async () => {
      process.env.ADMIN_EMAIL = "admin@proally.app";
      process.env.ADMIN_PASSWORD = "supersecret";
      findUserByEmail.mockResolvedValue(null);
      const createdId = new ObjectId();
      createUser.mockResolvedValue({
        _id: createdId,
        email: "admin@proally.app",
        passwordHash: "hashed",
        createdAt: new Date(),
      });

      const result = await authorizeCredentials({
        email: "admin@proally.app",
        password: "supersecret",
      });

      expect(result).toEqual({
        id: createdId.toString(),
        email: "admin@proally.app",
      });
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: "admin@proally.app" }),
      );
    });

    it("returns the existing DB user on subsequent admin logins without creating a duplicate", async () => {
      process.env.ADMIN_EMAIL = "admin@proally.app";
      process.env.ADMIN_PASSWORD = "supersecret";
      const existingId = new ObjectId();
      findUserByEmail.mockResolvedValue({
        _id: existingId,
        email: "admin@proally.app",
        passwordHash: "hashed",
        createdAt: new Date(),
      });

      const result = await authorizeCredentials({
        email: "admin@proally.app",
        password: "supersecret",
      });

      expect(result).toEqual({
        id: existingId.toString(),
        email: "admin@proally.app",
      });
      expect(createUser).not.toHaveBeenCalled();
    });

    it("falls through to DB lookup when password does not match admin password", async () => {
      process.env.ADMIN_EMAIL = "admin@proally.app";
      process.env.ADMIN_PASSWORD = "supersecret";
      findUserByEmail.mockResolvedValue(null);

      const result = await authorizeCredentials({
        email: "admin@proally.app",
        password: "wrong-password",
      });

      expect(result).toBeNull();
      expect(findUserByEmail).toHaveBeenCalledWith("admin@proally.app");
    });

    it("falls through to DB lookup when email does not match admin email", async () => {
      process.env.ADMIN_EMAIL = "admin@proally.app";
      process.env.ADMIN_PASSWORD = "supersecret";
      findUserByEmail.mockResolvedValue(null);

      const result = await authorizeCredentials({
        email: "someone-else@proally.app",
        password: "supersecret",
      });

      expect(result).toBeNull();
      expect(findUserByEmail).toHaveBeenCalledWith("someone-else@proally.app");
    });

    it("does not use admin path when ADMIN_EMAIL/ADMIN_PASSWORD are unset", async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_PASSWORD;
      findUserByEmail.mockResolvedValue(null);

      const result = await authorizeCredentials({
        email: "admin@proally.app",
        password: "supersecret",
      });

      expect(result).toBeNull();
      expect(findUserByEmail).toHaveBeenCalled();
    });
  });

  describe("database login", () => {
    it("returns null when no user is found for the email", async () => {
      findUserByEmail.mockResolvedValue(null);

      const result = await authorizeCredentials({
        email: "ghost@example.com",
        password: "whatever",
      });

      expect(result).toBeNull();
    });

    it("authorizes a user with the correct password", async () => {
      const passwordHash = await bcrypt.hash("correct-horse-battery", 12);
      const userId = new ObjectId();
      findUserByEmail.mockResolvedValue({
        _id: userId,
        email: "user@example.com",
        passwordHash,
        createdAt: new Date(),
      });

      const result = await authorizeCredentials({
        email: "user@example.com",
        password: "correct-horse-battery",
      });

      expect(result).toEqual({
        id: userId.toString(),
        email: "user@example.com",
      });
    });

    it("returns null when the password is incorrect", async () => {
      const passwordHash = await bcrypt.hash("correct-horse-battery", 12);
      findUserByEmail.mockResolvedValue({
        _id: new ObjectId(),
        email: "user@example.com",
        passwordHash,
        createdAt: new Date(),
      });

      const result = await authorizeCredentials({
        email: "user@example.com",
        password: "wrong-password",
      });

      expect(result).toBeNull();
    });

    it("returns null for an empty-string password against a real hash", async () => {
      const passwordHash = await bcrypt.hash("correct-horse-battery", 12);
      findUserByEmail.mockResolvedValue({
        _id: new ObjectId(),
        email: "user@example.com",
        passwordHash,
        createdAt: new Date(),
      });

      // loginSchema requires min(1) so an empty password is rejected before DB compare
      const result = await authorizeCredentials({
        email: "user@example.com",
        password: "",
      });

      expect(result).toBeNull();
      expect(findUserByEmail).not.toHaveBeenCalled();
    });

    it("propagates a rejected findUserByEmail promise", async () => {
      findUserByEmail.mockRejectedValue(new Error("Mongo down"));

      await expect(
        authorizeCredentials({ email: "user@example.com", password: "x" }),
      ).rejects.toThrow("Mongo down");
    });
  });
});
