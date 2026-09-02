import cron from "node-cron";
import { ObjectId } from "mongodb";

import { getDb } from "../db/mongodb";
import { sendJobEmailAlert } from "../email";
import { env } from "../env";
import { isDueForFetch } from "../jobs/fetchCadence";
import { fetchRapidApiJobs, fetchUpworkJobs } from "../jobs/fetchers";
import { isObviousSeniorityMismatch } from "../jobs/seniority";
import { evaluateJobMatch } from "../llm/client";
import { getActiveJsearchKey, recordJsearchFetchResult } from "../repositories/jsearchKeys";
import {
  insertMatchedJob,
  jobExistsForUser,
  markJobAlerted,
} from "../repositories/jobs";
import { getDefaultFilters } from "../repositories/filters";
import { findProfileByUserId } from "../repositories/profiles";
import { matchedJobSchema, type JobListing } from "../schemas/job";
import type { Platform, UserFiltersDocument } from "../schemas/filters";
import type { ParsedCV } from "../schemas/cv";

let isRunning = false;

const PROFILES_COLLECTION = "userProfiles";
const MIN_WINDOW_MINS = 15;
/**
 * JSearch aggregates existing listings from Indeed/LinkedIn/Google Jobs — its
 * postedAt reflects when the role was originally posted, often days or weeks
 * before this poll, not when it entered the feed (unlike Upwork's RSS, which
 * is sorted by recency and re-fetched fresh each tick). Applying the tight
 * per-poll `windowMins` cutoff to JSearch results was silently discarding
 * nearly every one of them regardless of match quality. Re-surfacing the same
 * listing across polls is already prevented by jobExistsForUser's URL dedupe,
 * so JSearch just needs a much looser "don't show stale postings" bound.
 */
const JSEARCH_MAX_AGE_DAYS = 30;

/**
 * JSearch aggregates from many boards at once (Indeed, LinkedIn, Glassdoor,
 * ZipRecruiter, BeBee, regional job sites, etc.) — a single query can return
 * listings from a board the user never selected, or one that charges to
 * apply (BeBee is a known case). Only the boards below have a genuinely free
 * public apply flow AND a corresponding entry in the platform filter, so a
 * JSearch result only survives if its `job_publisher` maps to one of these
 * *and* the user actually has that platform selected in their filters.
 * Anything else (BeBee, regional aggregators, etc.) is dropped outright,
 * regardless of filter selection — there is no "opt in to paid boards" case.
 */
const JSEARCH_PUBLISHER_TO_PLATFORM: Record<string, Platform> = {
  indeed: "indeed",
  linkedin: "linkedin",
};

function buildSearchQuery(filters: UserFiltersDocument, parsed?: ParsedCV): string {
  if (filters.keywords.length > 0) {
    return filters.keywords.join(" ");
  }

  const skills = parsed?.skills?.slice(0, 6).join(" ");
  if (skills) {
    return skills;
  }

  return parsed?.jobTitles?.[0] ?? "software engineer";
}

function isExcluded(job: JobListing, excludeKeywords: string[]): boolean {
  if (excludeKeywords.length === 0) return false;
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  return excludeKeywords.some((word) => {
    const needle = word.trim().toLowerCase();
    return needle.length > 0 && haystack.includes(needle);
  });
}

/**
 * Shared, mutable per-tick state for the one JSearch key in play. `dueForFetch`
 * is the quota-derived throttle (see fetchCadence.ts) — false means the key's
 * own monthly limit says it's too soon to call again, computed once per tick
 * before any user is processed, not re-checked per user. `exhausted` stops
 * further RapidAPI calls the moment the key is found to be over quota or
 * invalid mid-tick — every additional call would just fail the same way and
 * waste quota. `statusRecorded` limits the DB write-back to once per tick
 * (the key's health doesn't need re-recording per user, just per run).
 */
interface JsearchTickState {
  apiKey: string | undefined;
  keyId: string | null;
  dueForFetch: boolean;
  exhausted: boolean;
  statusRecorded: boolean;
}

async function fetchForFilters(
  filters: UserFiltersDocument,
  query: string,
  location: string,
  jsearchState: JsearchTickState,
): Promise<JobListing[]> {
  const results: JobListing[] = [];

  if (filters.platforms.includes("upwork")) {
    results.push(...(await fetchUpworkJobs(query)));
  }

  const wantsJsearch =
    filters.platforms.includes("linkedin") || filters.platforms.includes("indeed");

  if (wantsJsearch && jsearchState.dueForFetch && !jsearchState.exhausted) {
    const result = await fetchRapidApiJobs(query, location, jsearchState.apiKey);
    const allowedJobs = result.jobs.filter((job) => {
      const platform = job.publisher ? JSEARCH_PUBLISHER_TO_PLATFORM[job.publisher.toLowerCase()] : undefined;
      return platform !== undefined && filters.platforms.includes(platform);
    });
    results.push(...allowedJobs);

    if (jsearchState.keyId && !jsearchState.statusRecorded && result.status !== "unknown") {
      jsearchState.statusRecorded = true;
      await recordJsearchFetchResult(jsearchState.keyId, result);

      if (result.status === "quota_exceeded") {
        console.warn(`[JSearch] Key is over its monthly quota — pausing JSearch fetches for this run.`);
      } else if (result.status === "invalid") {
        console.warn(`[JSearch] Key was rejected by RapidAPI — pausing JSearch fetches for this run.`);
      }
    }

    if (result.status === "quota_exceeded" || result.status === "invalid") {
      jsearchState.exhausted = true;
    }
  }

  return results;
}

export async function runJobFetcher() {
  if (isRunning) return;
  isRunning = true;
  console.log("[Worker] Starting job fetcher...");

  try {
    const db = await getDb();

    // Profiles are written by POST /api/profile, which sets onboardingComplete.
    const profiles = await db
      .collection(PROFILES_COLLECTION)
      .find({ onboardingComplete: true })
      .toArray();

    if (profiles.length === 0) {
      console.log(
        "[Worker] No onboarded profiles yet — finish setup at /settings to start matching.",
      );
      return;
    }

    // Resolved once per tick, not per user — it's one shared key, and an
    // admin-updated DB value should take effect on the very next tick, not
    // require a server restart.
    const activeKey = await getActiveJsearchKey();
    // A key with no stored cadence yet (never fetched, or the env-var
    // fallback with no DB document at all) is always due — the throttle only
    // kicks in once we've actually learned the key's real limit.
    const dueForFetch = activeKey
      ? isDueForFetch(activeKey.lastFetchedAt, activeKey.fetchIntervalMinutes)
      : true;

    if (activeKey && !dueForFetch) {
      const nextDue = new Date(
        activeKey.lastFetchedAt!.getTime() + (activeKey.fetchIntervalMinutes ?? 180) * 60_000,
      );
      console.log(
        `[JSearch] Skipping this tick — next fetch not due until ${nextDue.toISOString()} (key's own quota-derived cadence).`,
      );
    }

    const jsearchState: JsearchTickState = {
      apiKey: activeKey?.apiKey ?? env.JSEARCH_API_KEY,
      keyId: activeKey?._id.toString() ?? null,
      dueForFetch,
      exhausted: false,
      statusRecorded: false,
    };

    for (const profile of profiles) {
      try {
        await runForProfile(profile.userId as ObjectId, jsearchState);
      } catch (error) {
        console.error(
          `[Worker] Failed for user ${String(profile.userId)}`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("[Worker] Error running fetcher", error);
  } finally {
    isRunning = false;
  }
}

async function runForProfile(
  userId: ObjectId,
  jsearchState: JsearchTickState,
): Promise<void> {
  const db = await getDb();

  const cv = await db
    .collection("cvs")
    .findOne({ userId, isActive: true });
  if (!cv) {
    console.log(`[Worker] User ${userId.toString()} has no active CV — skipping.`);
    return;
  }

  const filters = await getDefaultFilters(userId.toString());
  const profile = await findProfileByUserId(userId.toString());
  const parsed = cv.parsed as ParsedCV | undefined;
  const query = buildSearchQuery(filters, parsed);
  const skills = parsed?.skills?.join(", ") || query;
  const location = profile?.preferredCities?.[0] || profile?.preferredCountry || "";

  const windowMins = Math.max(filters.pollIntervalMins, MIN_WINDOW_MINS);
  const liveCutoff = new Date(Date.now() - windowMins * 60_000);
  const jsearchCutoff = new Date(Date.now() - JSEARCH_MAX_AGE_DAYS * 24 * 60 * 60_000);

  const listings = await fetchForFilters(filters, query, location, jsearchState);

  for (const job of listings) {
    const cutoff = job.source === "jsearch" ? jsearchCutoff : liveCutoff;
    if (job.postedAt < cutoff) continue;
    if (isExcluded(job, filters.excludeKeywords)) continue;
    if (await jobExistsForUser(userId, job.url)) continue;

    // Deterministic pre-filter — see seniority.ts for why this doesn't just
    // rely on the LLM prompt to self-police seniority fit.
    if (isObviousSeniorityMismatch(job.title, profile?.experienceLevel)) continue;

    let evaluation;
    try {
      evaluation = await evaluateJobMatch({
        skills,
        title: job.title,
        description: job.description,
        jobTitles: parsed?.jobTitles,
        experienceYears: parsed?.experienceYears,
        experienceLevel: profile?.experienceLevel,
      });
    } catch (error) {
      console.error(`[Worker] Evaluation failed for "${job.title}"`, error);
      continue;
    }

    if (!evaluation.match || evaluation.score < filters.minMatchScore) continue;

    const doc = matchedJobSchema.safeParse({
      ...job,
      userId,
      matchScore: evaluation.score,
      matchReason: evaluation.reason,
      matchingSkills: evaluation.matchingSkills,
      status: "new",
      notes: "",
      createdAt: new Date(),
      savedAt: null,
      alertedAt: null,
    });

    if (!doc.success) {
      console.error(
        `[Worker] Skipping malformed job "${job.title}":`,
        doc.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
      );
      continue;
    }

    const jobId = await insertMatchedJob(doc.data);
    console.log(
      `[Worker] Match (${evaluation.score}%) for ${userId.toString()}: ${job.title}`,
    );

    const user = await db.collection("users").findOne({ _id: userId });
    if (!user?.email) {
      console.warn(
        `[Worker] No email on user ${userId.toString()} — alert not sent.`,
      );
      continue;
    }

    const sent = await sendJobEmailAlert(user.email as string, {
      title: job.title,
      company: job.company,
      description: job.description,
      url: job.url,
      matchScore: evaluation.score,
      matchReason: evaluation.reason,
    });

    if (sent) {
      await markJobAlerted(jobId);
    }
  }
}

/**
 * Cron ticks every 5 minutes, but that's the cadence for cheap work only
 * (re-checking Mongo, evaluating against the local LLM) — the actual
 * rate-limited JSearch HTTP call only happens when `isDueForFetch` says the
 * active key's own quota-derived cadence allows it (see fetchCadence.ts),
 * which is typically hours, not minutes. Each user's own pollIntervalMins
 * governs how far back the recency window reaches for non-JSearch sources,
 * and (userId, url) dedupe stops repeats regardless of fetch cadence.
 */
export function startCronJobs() {
  cron.schedule("*/5 * * * *", () => {
    void runJobFetcher();
  });
  console.log("[ProAlly Worker] Cron jobs scheduled — checking every 5 minutes (JSearch itself is rate-limited separately).");
}
