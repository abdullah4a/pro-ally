import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/mongodb";
import type { ChatMessage, ChatSessionDocument } from "@/lib/schemas/chat";

const COLLECTION = "chatSessions";

type ChatSessionWithId = ChatSessionDocument & { _id: ObjectId };

export async function countSessionsByUserId(userId: string): Promise<number> {
  const db = await getDb();
  return db
    .collection(COLLECTION)
    .countDocuments({ userId: new ObjectId(userId) });
}

/** List view only — callers should not rely on `messages` here, only on the count below. */
export async function listSessionsByUserId(
  userId: string,
): Promise<ChatSessionWithId[]> {
  const db = await getDb();
  return db
    .collection<ChatSessionWithId>(COLLECTION)
    .find({ userId: new ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function findSessionById(
  userId: string,
  sessionId: string,
): Promise<ChatSessionWithId | null> {
  if (!ObjectId.isValid(sessionId)) return null;

  const db = await getDb();
  return db.collection<ChatSessionWithId>(COLLECTION).findOne({
    _id: new ObjectId(sessionId),
    userId: new ObjectId(userId),
  });
}

export async function createSession(
  userId: string,
  title: string,
): Promise<ChatSessionWithId> {
  const db = await getDb();
  const now = new Date();

  const doc: ChatSessionDocument = {
    userId: new ObjectId(userId),
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection(COLLECTION).insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

/**
 * Appends messages one at a time (not in bulk), and updates the title on the
 * first message, so the user's message is durable even if a later step (the
 * LLM call) fails — a session with only a user message and no reply is a
 * valid, recoverable state, not a lost one.
 */
export async function appendMessage(
  userId: string,
  sessionId: string,
  message: ChatMessage,
  titleIfUnset?: string,
): Promise<void> {
  const db = await getDb();
  const filter = { _id: new ObjectId(sessionId), userId: new ObjectId(userId) };

  const update: Record<string, unknown> = {
    $push: { messages: message },
    $set: { updatedAt: new Date() },
  };

  if (titleIfUnset) {
    await db.collection(COLLECTION).updateOne(
      { ...filter, title: "New chat" },
      { $set: { title: titleIfUnset } },
    );
  }

  await db.collection(COLLECTION).updateOne(filter, update);
}
