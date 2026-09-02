import { MongoClient } from "mongodb";

import { env } from "@/lib/env";

const globalForMongo = globalThis as unknown as {
  mongoClientPromise?: Promise<MongoClient>;
};

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(env.MONGODB_URI);
  return client.connect();
}

export const mongoClientPromise =
  globalForMongo.mongoClientPromise ?? createClientPromise();

if (process.env.NODE_ENV !== "production") {
  globalForMongo.mongoClientPromise = mongoClientPromise;
}

export async function getDb() {
  const client = await mongoClientPromise;
  return client.db();
}
