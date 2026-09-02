import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/mongodb";
import type { UserDocument } from "@/lib/schemas/user";

const COLLECTION = "users";

export async function findUserByEmail(email: string): Promise<UserDocument | null> {
  const db = await getDb();
  return db.collection<UserDocument>(COLLECTION).findOne({
    email: email.toLowerCase(),
  });
}

export async function findUserById(id: string): Promise<UserDocument | null> {
  const db = await getDb();
  return db.collection<UserDocument>(COLLECTION).findOne({
    _id: new ObjectId(id),
  });
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
}): Promise<UserDocument> {
  const db = await getDb();
  const now = new Date();

  const doc: Omit<UserDocument, "_id"> = {
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    createdAt: now,
  };

  const result = await db.collection(COLLECTION).insertOne(doc);

  return {
    _id: result.insertedId,
    ...doc,
  };
}
