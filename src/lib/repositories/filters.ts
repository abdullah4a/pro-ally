import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/mongodb";
import type { UserFiltersDocument } from "@/lib/schemas/filters";

const COLLECTION = "userFilters";

export async function findFiltersByUserId(
  userId: string,
): Promise<UserFiltersDocument | null> {
  const db = await getDb();
  return db.collection<UserFiltersDocument>(COLLECTION).findOne({
    userId: new ObjectId(userId),
  });
}

export async function upsertFilters(
  userId: string,
  filters: Omit<UserFiltersDocument, "userId" | "updatedAt">,
): Promise<UserFiltersDocument> {
  const db = await getDb();
  const userObjectId = new ObjectId(userId);
  const updatedAt = new Date();

  const doc: UserFiltersDocument = {
    userId: userObjectId,
    ...filters,
    updatedAt,
  };

  await db.collection(COLLECTION).updateOne(
    { userId: userObjectId },
    { $set: doc },
    { upsert: true },
  );

  return doc;
}

export async function getDefaultFilters(userId: string): Promise<UserFiltersDocument> {
  const existing = await findFiltersByUserId(userId);
  if (existing) {
    return existing;
  }

  return upsertFilters(userId, {
    keywords: [],
    excludeKeywords: [],
    platforms: ["linkedin", "indeed", "upwork"],
    minTrustScore: 60,
    minMatchScore: 70,
    pollIntervalMins: 15,
  });
}
