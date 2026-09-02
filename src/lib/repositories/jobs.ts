import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/mongodb";
import type { JobStatus, MatchedJob } from "@/lib/schemas/job";

const COLLECTION = "jobs";

export type StoredJob = MatchedJob & { _id: ObjectId };

export async function listJobsByUserId(
  userId: string,
  limit = 200,
): Promise<StoredJob[]> {
  const db = await getDb();
  return db
    .collection<StoredJob>(COLLECTION)
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function insertMatchedJob(job: MatchedJob): Promise<ObjectId> {
  const db = await getDb();
  const result = await db.collection(COLLECTION).insertOne(job);
  return result.insertedId;
}

/** Dedupe key is (userId, url): two users may each hold the same listing. */
export async function jobExistsForUser(
  userId: ObjectId,
  url: string,
): Promise<boolean> {
  const db = await getDb();
  const existing = await db
    .collection(COLLECTION)
    .findOne({ userId, url }, { projection: { _id: 1 } });
  return existing !== null;
}

/**
 * Applies a status/notes change, scoped to the owner so one user can never
 * mutate another's rows. Returns false when nothing matched.
 */
export async function updateJobForUser(
  userId: string,
  jobId: ObjectId,
  changes: { status?: JobStatus; notes?: string },
): Promise<boolean> {
  const db = await getDb();

  const update: Record<string, unknown> = {};
  if (changes.status !== undefined) {
    update.status = changes.status;
    // "saved" is the only status the dashboard timestamps.
    update.savedAt = changes.status === "saved" ? new Date() : null;
  }
  if (changes.notes !== undefined) {
    update.notes = changes.notes;
  }

  const result = await db
    .collection(COLLECTION)
    .updateOne({ _id: jobId, userId: new ObjectId(userId) }, { $set: update });

  return result.matchedCount > 0;
}

export async function markJobAlerted(jobId: ObjectId): Promise<void> {
  const db = await getDb();
  await db
    .collection(COLLECTION)
    .updateOne({ _id: jobId }, { $set: { alertedAt: new Date() } });
}
