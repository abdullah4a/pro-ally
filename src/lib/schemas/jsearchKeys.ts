import { z } from "zod";

/**
 * Reflects what actually happened the last time this key was used to call
 * JSearch — "unknown" until the first call. "quota_exceeded" and "invalid"
 * are distinguished (RapidAPI returns 429 vs 401/403) so the UI and worker
 * logs can say something specific instead of a generic failure.
 */
export const jsearchKeyStatusSchema = z.enum([
  "unknown",
  "ok",
  "quota_exceeded",
  "invalid",
  "error",
]);

export const jsearchKeyDocumentSchema = z.object({
  apiKey: z.string().min(1),
  label: z.string().min(1).max(100),
  isActive: z.boolean().default(false),
  status: jsearchKeyStatusSchema.default("unknown"),
  statusMessage: z.string().nullable().default(null),
  lastCheckedAt: z.date().nullable().default(null),
  /** Learned from RapidAPI's x-ratelimit-requests-limit header on a real call. */
  monthlyLimit: z.number().int().positive().nullable().default(null),
  /** Learned from x-ratelimit-requests-remaining on the most recent real call. */
  requestsRemainingKnown: z.number().int().nonnegative().nullable().default(null),
  /** Learned from x-ratelimit-requests-reset (converted to an absolute time) on the most recent real call. */
  quotaResetsAt: z.date().nullable().default(null),
  /** Last time this key was actually used to call JSearch (fetch or manual test) — not just checked. */
  lastFetchedAt: z.date().nullable().default(null),
  /** Computed from monthlyLimit via computeFetchIntervalMinutes; null until a limit is known. */
  fetchIntervalMinutes: z.number().int().positive().nullable().default(null),
  createdAt: z.date(),
  createdBy: z.string(),
  updatedAt: z.date(),
});

export const addJsearchKeySchema = z.object({
  apiKey: z.string().min(10, "That doesn't look like a valid API key").max(500),
  label: z.string().max(100).optional(),
});

export type JsearchKeyStatus = z.infer<typeof jsearchKeyStatusSchema>;
export type JsearchKeyDocument = z.infer<typeof jsearchKeyDocumentSchema>;
export type AddJsearchKeyInput = z.infer<typeof addJsearchKeySchema>;
