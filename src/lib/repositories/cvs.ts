import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/mongodb";
import type { CVDocument } from "@/lib/schemas/cv";

const COLLECTION = "cvs";

export async function deactivateUserCvs(userId: string): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).updateMany(
    { userId: new ObjectId(userId), isActive: true },
    { $set: { isActive: false } },
  );
}

export async function createCv(doc: CVDocument): Promise<CVDocument & { _id: ObjectId }> {
  const db = await getDb();
  const result = await db.collection(COLLECTION).insertOne(doc);

  return {
    _id: result.insertedId,
    ...doc,
  };
}

export async function findActiveCvByUserId(
  userId: string,
): Promise<(CVDocument & { _id: ObjectId }) | null> {
  const db = await getDb();
  return db.collection<CVDocument & { _id: ObjectId }>(COLLECTION).findOne({
    userId: new ObjectId(userId),
    isActive: true,
  });
}

export async function listCvsByUserId(
  userId: string,
): Promise<Array<CVDocument & { _id: ObjectId }>> {
  const db = await getDb();
  return db
    .collection<CVDocument & { _id: ObjectId }>(COLLECTION)
    .find({ userId: new ObjectId(userId) })
    .sort({ uploadedAt: -1 })
    .toArray();
}
