import { MongoClient, type Db } from "mongodb";

import { config } from "./config";

// Cache the connection promise on globalThis so Next.js dev hot-reloads reuse a
// single client instead of opening a new connection on every reload.
const globalForDb = globalThis as unknown as {
  __wireDb?: Promise<Db>;
};

async function connect(): Promise<Db> {
  const client = new MongoClient(config.mongoUri);
  await client.connect();
  const db = client.db(config.mongoDbName);

  // Index that backs the published-feed query (status + newest-first).
  await db
    .collection("news_item")
    .createIndex({ status: 1, published_at: -1 });

  return db;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__wireDb) {
    globalForDb.__wireDb = connect().catch((err) => {
      // Don't cache a failed connection — drop it so the next request retries
      // (e.g. MongoDB wasn't up yet when the first request came in).
      globalForDb.__wireDb = undefined;
      throw err;
    });
  }
  return globalForDb.__wireDb;
}
