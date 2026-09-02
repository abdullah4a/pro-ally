import Parser from "rss-parser";

import type { JobListing } from "@/lib/schemas/job";
import type { JsearchKeyStatus } from "@/lib/schemas/jsearchKeys";

const parser = new Parser();

/** Upwork RSS gives no stable location/salary, so those stay undefined. */
export async function fetchUpworkJobs(query: string): Promise<JobListing[]> {
  const feedUrl = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(query)}&sort=recency`;

  try {
    const feed = await parser.parseURL(feedUrl);

    return feed.items
      .filter((item) => Boolean(item.link))
      .map((item) => ({
        // guid is Upwork's stable id; link is a good fallback. Never random —
        // a non-deterministic id would defeat dedupe.
        externalId: item.guid || item.link!,
        title: item.title || "Untitled Job",
        company: "Upwork Client",
        description: item.contentSnippet || item.content || "",
        url: item.link!,
        postedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
        source: "upwork" as const,
      }));
  } catch (error) {
    console.error("Failed to fetch Upwork jobs via RSS", error);
    return [];
  }
}

// This account's JSearch subscription only exposes /search-v2 (cursor-paged,
// data.jobs not data[]) — confirmed by probing the live API, since the
// commonly-documented /search endpoint 404s ("Endpoint '/search' does not
// exist") for this key's plan. If jobs stop coming back after a RapidAPI plan
// change, re-verify this against a live call before assuming the code is wrong.
const JSEARCH_HOST = "jsearch.p.rapidapi.com";
const JSEARCH_PATH = "/search-v2";

/** Subset of the JSearch response we actually use — the real payload has ~40 fields. */
interface JSearchJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_description?: string;
  job_apply_link?: string | null;
  job_google_link?: string | null;
  /** The actual board this listing came from, e.g. "Indeed", "LinkedIn", "BeBee". */
  job_publisher?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_posted_at_datetime_utc?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
}

interface JSearchResponse {
  data?: { jobs?: JSearchJob[] };
}

export interface JsearchFetchResult {
  jobs: JobListing[];
  /** What the key itself looks like right now — for status tracking, not routing logic. */
  status: JsearchKeyStatus;
  statusMessage: string | null;
  requestsRemaining: number | null;
  requestsLimit: number | null;
  /**
   * Absolute time the plan's quota window resets, derived from RapidAPI's
   * x-ratelimit-requests-reset header (seconds-from-now) at the moment this
   * response arrived — converted to an absolute Date immediately, since a
   * relative "seconds from now" number goes stale the instant time passes.
   */
  quotaResetsAt: Date | null;
}

const NOT_ATTEMPTED: JsearchFetchResult = {
  jobs: [],
  status: "unknown",
  statusMessage: null,
  requestsRemaining: null,
  requestsLimit: null,
  quotaResetsAt: null,
};

/**
 * LinkedIn/Indeed/Google-Jobs aggregation via RapidAPI's JSearch product.
 * `apiKey` comes from the caller (DB-stored, with an env-var default as
 * fallback — see src/lib/repositories/jsearchKeys.ts) rather than being read
 * here directly, so an admin can update it from Settings without a restart.
 * Never throws — a failed key still returns a result the caller can log/store,
 * with `jobs: []`, so the worker keeps running on whatever sources *are* healthy.
 */
export async function fetchRapidApiJobs(
  query: string,
  location: string,
  apiKey: string | undefined,
): Promise<JsearchFetchResult> {
  if (!apiKey) {
    console.log("[JSearch] No API key configured — skipping this source.");
    return NOT_ATTEMPTED;
  }

  const searchQuery = location ? `${query} jobs in ${location}` : `${query} jobs`;
  const url = `https://${JSEARCH_HOST}${JSEARCH_PATH}?query=${encodeURIComponent(searchQuery)}&num_pages=1`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": JSEARCH_HOST,
      },
    });

    const requestsLimit = parseIntHeader(response.headers.get("x-ratelimit-requests-limit"));
    const requestsRemaining = parseIntHeader(
      response.headers.get("x-ratelimit-requests-remaining"),
    );
    const quotaResetsAt = parseResetHeader(
      response.headers.get("x-ratelimit-requests-reset"),
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return classifyFailure(response.status, bodyText, requestsRemaining, requestsLimit, quotaResetsAt);
    }

    const body = (await response.json()) as JSearchResponse;
    const rawJobs = body.data?.jobs ?? [];

    // Indeed-sourced listings often have a null job_apply_link and only a
    // Google-Jobs redirect link — fall back to that before dropping the job.
    const jobs = rawJobs
      .map((job) => ({ ...job, applyUrl: job.job_apply_link || job.job_google_link }))
      .filter((job): job is JSearchJob & { applyUrl: string } => Boolean(job.applyUrl))
      .map((job) => {
        const jobLocation =
          [job.job_city, job.job_state].filter(Boolean).join(", ") ||
          job.job_country ||
          undefined;

        return {
          externalId: job.job_id || job.applyUrl,
          source: "jsearch" as const,
          publisher: job.job_publisher || undefined,
          title: job.job_title || "Untitled Job",
          company: job.employer_name || "Unknown Company",
          description: job.job_description || "",
          url: job.applyUrl,
          location: jobLocation,
          salary:
            job.job_min_salary && job.job_max_salary
              ? `${job.job_salary_currency ?? "$"}${job.job_min_salary}-${job.job_max_salary}`
              : undefined,
          postedAt: job.job_posted_at_datetime_utc
            ? new Date(job.job_posted_at_datetime_utc)
            : new Date(),
        };
      });

    return {
      jobs,
      status: "ok",
      statusMessage: null,
      requestsRemaining,
      requestsLimit,
      quotaResetsAt,
    };
  } catch (error) {
    console.error("Failed to fetch jobs via JSearch", error);
    return {
      jobs: [],
      status: "error",
      statusMessage: error instanceof Error ? error.message : "Network request failed",
      requestsRemaining: null,
      requestsLimit: null,
      quotaResetsAt: null,
    };
  }
}

function parseIntHeader(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseResetHeader(value: string | null): Date | null {
  const seconds = parseIntHeader(value);
  if (seconds === null || seconds < 0) return null;
  return new Date(Date.now() + seconds * 1000);
}

/**
 * RapidAPI's own conventions, confirmed live against this project's key:
 * 429 = monthly/plan request quota exhausted; 401/403 = key invalid, revoked,
 * or not subscribed to this specific API (its 403 body literally says "You
 * are not subscribed to this API."). Anything else is bucketed as a generic
 * error rather than guessed at.
 */
function classifyFailure(
  status: number,
  bodyText: string,
  requestsRemaining: number | null,
  requestsLimit: number | null,
  quotaResetsAt: Date | null,
): JsearchFetchResult {
  console.error(`[JSearch] Request failed with status ${status}: ${bodyText.slice(0, 300)}`);

  if (status === 429) {
    return {
      jobs: [],
      status: "quota_exceeded",
      statusMessage:
        "This key has hit its monthly JSearch request limit. Add a new key or wait for the plan to reset.",
      requestsRemaining,
      requestsLimit,
      quotaResetsAt,
    };
  }

  if (status === 401 || status === 403) {
    return {
      jobs: [],
      status: "invalid",
      statusMessage:
        "This key was rejected by RapidAPI — it may be invalid, revoked, or not subscribed to JSearch.",
      requestsRemaining,
      requestsLimit,
      quotaResetsAt,
    };
  }

  return {
    jobs: [],
    status: "error",
    statusMessage: `JSearch returned an unexpected error (HTTP ${status}).`,
    requestsRemaining,
    requestsLimit,
    quotaResetsAt,
  };
}
