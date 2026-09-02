import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/mongodb";
import { computeFetchIntervalMinutes } from "@/lib/jobs/fetchCadence";
import type { JsearchKeyDocument, JsearchKeyStatus } from "@/lib/schemas/jsearchKeys";

const COLLECTION = "jsearchApiKeys";

type JsearchKeyWithId = JsearchKeyDocument & { _id: ObjectId };

export async function listJsearchKeys(): Promise<JsearchKeyWithId[]> {
  const db = await getDb();
  return db
    .collection<JsearchKeyWithId>(COLLECTION)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
}

/**
 * The key doc actually used by the job worker — whichever one is active.
 * Returns null when no key is active (caller falls back to the env var in
 * that case, but there's then no document to write a status update back to).
 */
export async function getActiveJsearchKey(): Promise<JsearchKeyWithId | null> {
  const db = await getDb();
  return db.collection<JsearchKeyWithId>(COLLECTION).findOne({ isActive: true });
}

export async function findJsearchKeyById(id: string): Promise<JsearchKeyWithId | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  return db.collection<JsearchKeyWithId>(COLLECTION).findOne({ _id: new ObjectId(id) });
}

/**
 * Called after every *real* JSearch HTTP call — both the worker's automatic
 * fetch and the admin's manual "Test" button — since both consume the same
 * shared quota. Recomputes and persists the fetch cadence from whatever
 * quota info this call returned, layered on top of what was already known
 * (a call that omits a header doesn't wipe a previously-learned value —
 * e.g. a network-level failure returns no headers at all, but shouldn't
 * erase the cadence learned from the last successful call).
 */
export async function recordJsearchFetchResult(
  id: string,
  result: {
    status: JsearchKeyStatus;
    statusMessage: string | null;
    requestsRemaining: number | null;
    requestsLimit: number | null;
    quotaResetsAt: Date | null;
  },
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const existing = await findJsearchKeyById(id);

  const monthlyLimit = result.requestsLimit ?? existing?.monthlyLimit ?? null;
  const requestsRemainingKnown = result.requestsRemaining ?? existing?.requestsRemainingKnown ?? null;
  const quotaResetsAt = result.quotaResetsAt ?? existing?.quotaResetsAt ?? null;

  const update: Record<string, unknown> = {
    status: result.status,
    statusMessage: result.statusMessage,
    lastCheckedAt: now,
    lastFetchedAt: now,
    monthlyLimit,
    requestsRemainingKnown,
    quotaResetsAt,
    fetchIntervalMinutes: computeFetchIntervalMinutes({
      requestsRemaining: requestsRemainingKnown,
      quotaResetsAt,
      monthlyLimit,
    }),
    updatedAt: now,
  };

  await db.collection(COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: update });
}

/**
 * The first key ever added is activated automatically, so the worker has
 * something to use without an extra manual step. Every key after that is
 * added inactive — a newly added, possibly-untested key should never
 * silently replace one that's already working.
 */
export async function addJsearchKey(
  apiKey: string,
  label: string,
  userId: string,
): Promise<JsearchKeyWithId> {
  const db = await getDb();
  const now = new Date();

  const existingCount = await db.collection(COLLECTION).countDocuments({});
  const doc: JsearchKeyDocument = {
    apiKey,
    label,
    isActive: existingCount === 0,
    status: "unknown",
    statusMessage: null,
    lastCheckedAt: null,
    monthlyLimit: null,
    requestsRemainingKnown: null,
    quotaResetsAt: null,
    lastFetchedAt: null,
    fetchIntervalMinutes: null,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
  };

  const result = await db.collection(COLLECTION).insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

/** Deactivates every other key first — exactly one key is ever active. */
export async function activateJsearchKey(id: string): Promise<void> {
  const db = await getDb();
  const objectId = new ObjectId(id);
  const now = new Date();

  await db
    .collection(COLLECTION)
    .updateMany({ _id: { $ne: objectId } }, { $set: { isActive: false, updatedAt: now } });
  await db
    .collection(COLLECTION)
    .updateOne({ _id: objectId }, { $set: { isActive: true, updatedAt: now } });
}

export async function deactivateJsearchKey(id: string): Promise<void> {
  const db = await getDb();
  await db
    .collection(COLLECTION)
    .updateOne({ _id: new ObjectId(id) }, { $set: { isActive: false, updatedAt: new Date() } });
}

export async function deleteJsearchKey(id: string): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });
}
