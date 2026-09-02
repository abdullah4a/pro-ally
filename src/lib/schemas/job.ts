import { ObjectId } from "mongodb";
import { z } from "zod";

import { objectIdSchema } from "@/lib/schemas/user";

/**
 * Every platform a job can come from. Lowercase is the canonical form and is
 * shared with `platformSchema` in ./filters and with the fetchers, so a filter
 * value can be compared to a job's `source` directly.
 */
export const jobSourceSchema = z.enum([
  "upwork",
  "linkedin",
  "indeed",
  "fiverr",
  "jsearch",
  "greenhouse",
  "lever",
  "ashby",
]);

/** Kanban columns on /jobs — this is the single source of truth for statuses. */
export const jobStatusSchema = z.enum([
  "new",
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
]);

/** A listing as returned by a fetcher, before any matching has happened. */
export const jobListingSchema = z.object({
  externalId: z.string().min(1),
  source: jobSourceSchema,
  /**
   * The actual originating job board, as reported by an aggregator (JSearch's
   * `job_publisher`, e.g. "Indeed", "LinkedIn", "BeBee"). `source` stays the
   * *fetch mechanism* ("jsearch" for every JSearch-origin job regardless of
   * board); `publisher` is what should be shown to the user and checked
   * against their platform filter, since one fetch mechanism can front many
   * different boards with very different apply experiences.
   */
  publisher: z.string().optional(),
  title: z.string().min(1),
  company: z.string().min(1),
  description: z.string(),
  url: z.url(),
  location: z.string().optional(),
  salary: z.string().optional(),
  postedAt: z.date(),
});

/**
 * What the user actually did with a job, recorded as it happens rather than
 * inferred later. `apply_clicked` fires the moment the external link opens —
 * it does NOT mean the user actually applied, only that they were sent
 * there; `applied_confirmed`/`not_applied_yet` come from the follow-up
 * prompt the UI shows after that click, which is what actually resolves
 * whether the click became a real application.
 */
export const jobActivityTypeSchema = z.enum([
  "apply_clicked",
  "applied_confirmed",
  "not_applied_yet",
  "status_changed",
]);

export const jobActivitySchema = z.object({
  type: jobActivityTypeSchema,
  at: z.date(),
  toStatus: jobStatusSchema.optional(),
});

/**
 * What actually lives in the `jobs` collection: one document per (user, job),
 * denormalized so the dashboard can read it without a join.
 */
export const matchedJobSchema = jobListingSchema.extend({
  userId: z.instanceof(ObjectId),
  matchScore: z.number().min(0).max(100),
  matchReason: z.string().default(""),
  matchingSkills: z.array(z.string()).default([]),
  status: jobStatusSchema.default("new"),
  notes: z.string().default(""),
  activity: z.array(jobActivitySchema).default([]),
  createdAt: z.date(),
  savedAt: z.date().nullable().default(null),
  alertedAt: z.date().nullable().default(null),
});

/** What the LLM must return when scoring a listing against a CV. */
export const jobMatchEvaluationSchema = z.object({
  match: z.boolean(),
  score: z.number().min(0).max(100),
  reason: z.string().max(500).default(""),
  matchingSkills: z.array(z.string()).max(20).default([]),
});

/** Body of PATCH /api/jobs. At least one mutable field must be present. */
export const jobUpdateSchema = z
  .object({
    jobId: objectIdSchema,
    status: jobStatusSchema.optional(),
    notes: z.string().max(5000).optional(),
    /** Logged to `activity[]`; "applied_confirmed" also implies status "applied" unless `status` overrides it. */
    action: jobActivityTypeSchema.optional(),
  })
  .refine(
    (body) => body.status !== undefined || body.notes !== undefined || body.action !== undefined,
    { message: "Provide a status, notes, or action to update" },
  );

export type JobSource = z.infer<typeof jobSourceSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;
export type JobActivityType = z.infer<typeof jobActivityTypeSchema>;
export type JobActivity = z.infer<typeof jobActivitySchema>;
export type JobListing = z.infer<typeof jobListingSchema>;
export type MatchedJob = z.infer<typeof matchedJobSchema>;
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;
export type JobMatchEvaluation = z.infer<typeof jobMatchEvaluationSchema>;
