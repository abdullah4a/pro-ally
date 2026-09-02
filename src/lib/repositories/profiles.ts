import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/mongodb";
import type { UserProfileDocument } from "@/lib/schemas/profile";

const COLLECTION = "userProfiles";

export async function findProfileByUserId(
  userId: string,
): Promise<UserProfileDocument | null> {
  const db = await getDb();
  return db.collection<UserProfileDocument>(COLLECTION).findOne({
    userId: new ObjectId(userId),
  });
}

export async function upsertProfile(
  userId: string,
  profile: Omit<UserProfileDocument, "userId" | "updatedAt">,
): Promise<UserProfileDocument> {
  const db = await getDb();
  const userObjectId = new ObjectId(userId);
  const updatedAt = new Date();

  const doc: UserProfileDocument = {
    userId: userObjectId,
    ...profile,
    updatedAt,
  };

  await db.collection(COLLECTION).updateOne(
    { userId: userObjectId },
    { $set: doc },
    { upsert: true },
  );

  return doc;
}
