import { afterEach, describe, expect, it, vi } from "vitest";

const REQUIRED_VALID = {
  AUTH_SECRET: "a".repeat(32),
  MONGODB_URI: "mongodb://localhost:27017/jobbot",
  LLM_BASE_URL: "http://127.0.0.1:8080/v1",
  LLM_MODEL: "qwen3.5-0.8b",
};

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

async function loadEnvWith(overrides: Record<string, string | undefined>) {
  const merged: NodeJS.ProcessEnv = { ...ORIGINAL_ENV, ...REQUIRED_VALID };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  process.env = merged;
  vi.resetModules();
  return import("../env");
}

describe("env", () => {
  it("loads successfully with all required vars valid", async () => {
    const { env } = await loadEnvWith({});
    expect(env.AUTH_SECRET).toBe(REQUIRED_VALID.AUTH_SECRET);
    expect(env.MONGODB_URI).toBe(REQUIRED_VALID.MONGODB_URI);
  });

  it("throws when AUTH_SECRET is missing", async () => {
    await expect(loadEnvWith({ AUTH_SECRET: undefined })).rejects.toThrow(
      /Invalid environment variables/,
    );
  });

  it("throws when AUTH_SECRET is shorter than 32 characters (boundary: 31)", async () => {
    await expect(
      loadEnvWith({ AUTH_SECRET: "a".repeat(31) }),
    ).rejects.toThrow();
  });

  it("accepts AUTH_SECRET of exactly 32 characters (boundary)", async () => {
    const { env } = await loadEnvWith({ AUTH_SECRET: "a".repeat(32) });
    expect(env.AUTH_SECRET).toHaveLength(32);
  });

  it("throws when MONGODB_URI is an empty string", async () => {
    await expect(loadEnvWith({ MONGODB_URI: "" })).rejects.toThrow();
  });

  it("throws when LLM_BASE_URL is not a valid URL", async () => {
    await expect(
      loadEnvWith({ LLM_BASE_URL: "not-a-url" }),
    ).rejects.toThrow();
  });

  it("throws when LLM_MODEL is an empty string", async () => {
    await expect(loadEnvWith({ LLM_MODEL: "" })).rejects.toThrow();
  });

  it("treats AUTH_URL as optional and loads fine without it", async () => {
    const { env } = await loadEnvWith({ AUTH_URL: undefined });
    expect(env.AUTH_URL).toBeUndefined();
  });

  it("throws when AUTH_URL is present but not a valid URL", async () => {
    await expect(
      loadEnvWith({ AUTH_URL: "definitely not a url" }),
    ).rejects.toThrow();
  });

  it("accumulates and reports multiple validation errors at once", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      AUTH_SECRET: "short",
      MONGODB_URI: "",
      LLM_BASE_URL: "bad-url",
      LLM_MODEL: "",
    };
    vi.resetModules();

    try {
      await import("../env");
      expect.unreachable("expected env import to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("AUTH_SECRET");
      expect(message).toContain("MONGODB_URI");
      expect(message).toContain("LLM_BASE_URL");
      expect(message).toContain("LLM_MODEL");
    }
  });

  it("leaves optional integration vars (JSEARCH_API_KEY etc.) undefined when unset", async () => {
    const { env } = await loadEnvWith({
      JSEARCH_API_KEY: undefined,
      WHATSAPP_PHONE_NUMBER_ID: undefined,
      REDIS_URL: undefined,
    });
    expect(env.JSEARCH_API_KEY).toBeUndefined();
    expect(env.WHATSAPP_PHONE_NUMBER_ID).toBeUndefined();
    expect(env.REDIS_URL).toBeUndefined();
  });
});
