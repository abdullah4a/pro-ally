/**
 * How often it's safe to actually call JSearch, derived from the active
 * key's own quota — not a fixed guess. RapidAPI's free/basic JSearch tiers
 * commonly cap around 200 requests/month, nowhere near enough to poll every
 * 5 minutes (~8,600 requests/month). A fixed 20% safety margin leaves
 * headroom for the admin's manual "Test" button and for imprecise reset
 * timing, without needing to track exact billing-cycle boundaries by hand.
 */
const DEFAULT_INTERVAL_MINUTES = 180; // used only when nothing is known about the key yet
const DAYS_PER_MONTH = 30;
const SAFETY_FACTOR = 0.8;
const MIN_INTERVAL_MINUTES = 60;
const MAX_INTERVAL_MINUTES = 24 * 60;

export interface QuotaSnapshot {
  /** Requests left in the current window, from x-ratelimit-requests-remaining. */
  requestsRemaining: number | null;
  /** Absolute time the window resets — see JsearchFetchResult.quotaResetsAt. */
  quotaResetsAt: Date | null;
  /** The plan's total per-window limit, from x-ratelimit-requests-limit. */
  monthlyLimit: number | null;
}

/**
 * Prefers spreading the *actual remaining* requests evenly across the
 * *actual remaining* time until reset (from live rate-limit headers) — this
 * is what "properly utilizing the quota" means: the cadence tightens
 * automatically as the quota depletes or the reset window approaches,
 * instead of a static guess that could burn through everything in the first
 * few days of a cycle or leave requests unused at the end of it. Falls back
 * to a flat monthlyLimit/30-day estimate when remaining/reset aren't known
 * yet (e.g. right after a key is added, before its first real call), and to
 * a fixed default when nothing about the key is known at all.
 */
export function computeFetchIntervalMinutes(
  quota: QuotaSnapshot,
  now: Date = new Date(),
): number {
  if (quota.requestsRemaining !== null && quota.quotaResetsAt) {
    const secondsUntilReset = (quota.quotaResetsAt.getTime() - now.getTime()) / 1000;

    if (quota.requestsRemaining <= 0) {
      // Nothing left to spend — no point calling again before the window resets.
      return secondsUntilReset > 0
        ? clamp(Math.ceil(secondsUntilReset / 60))
        : MIN_INTERVAL_MINUTES;
    }

    if (secondsUntilReset > 0) {
      const budget = Math.max(1, Math.floor(quota.requestsRemaining * SAFETY_FACTOR));
      return clamp(Math.ceil(secondsUntilReset / budget / 60));
    }
  }

  if (quota.monthlyLimit) {
    const budgetPerDay = Math.max(1, Math.floor((quota.monthlyLimit * SAFETY_FACTOR) / DAYS_PER_MONTH));
    return clamp(Math.ceil((24 * 60) / budgetPerDay));
  }

  return DEFAULT_INTERVAL_MINUTES;
}

function clamp(minutes: number): number {
  return Math.min(Math.max(minutes, MIN_INTERVAL_MINUTES), MAX_INTERVAL_MINUTES);
}

export function isDueForFetch(
  lastFetchedAt: Date | null,
  fetchIntervalMinutes: number | null,
  now: Date = new Date(),
): boolean {
  if (!lastFetchedAt) return true;

  const intervalMinutes = fetchIntervalMinutes ?? DEFAULT_INTERVAL_MINUTES;
  const dueAt = lastFetchedAt.getTime() + intervalMinutes * 60_000;

  return now.getTime() >= dueAt;
}
