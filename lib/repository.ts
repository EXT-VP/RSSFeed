import { ObjectId, type Collection, type WithId } from "mongodb";

import { getDb } from "./db";
import { parseLabels } from "./format";
import { renderBody } from "./markdown";

export type Status = "draft" | "published";
export type Priority = "low" | "normal" | "high";

export interface NewsItem {
  id: string;
  title: string;
  body_markdown: string;
  body_html: string;
  author: string;
  label: string;
  priority: Priority;
  status: Status;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

// Stored shape — same as NewsItem but keyed by Mongo's ObjectId `_id`.
type NewsDoc = Omit<NewsItem, "id">;
interface LabelColorDoc {
  _id: string; // the label text is its own natural key
  hue: number;
}

const now = () => new Date().toISOString();

async function newsCol(): Promise<Collection<NewsDoc>> {
  return (await getDb()).collection<NewsDoc>("news_item");
}
async function labelCol(): Promise<Collection<LabelColorDoc>> {
  return (await getDb()).collection<LabelColorDoc>("label_color");
}

function toNewsItem(doc: WithId<NewsDoc>): NewsItem {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

// Translate a route-supplied id string into an ObjectId, or null if malformed.
function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export async function createItem(
  title: string,
  body: string,
  author: string,
  label: string,
  priority: Priority,
  status: Status,
): Promise<string> {
  await ensureLabelColors(parseLabels(label));
  const ts = now();
  const doc: NewsDoc = {
    title,
    body_markdown: body,
    body_html: renderBody(body),
    author,
    label,
    priority,
    status,
    created_at: ts,
    updated_at: ts,
    published_at: status === "published" ? ts : null,
  };
  const result = await (await newsCol()).insertOne(doc as WithId<NewsDoc>);
  return result.insertedId.toString();
}

export async function updateItem(
  id: string,
  title: string,
  body: string,
  author: string,
  label: string,
  priority: Priority,
  status: Status,
): Promise<boolean> {
  const existing = await getItem(id);
  if (!existing) return false;
  await ensureLabelColors(parseLabels(label));
  const ts = now();
  let publishedAt = existing.published_at;
  if (status === "published" && !publishedAt) publishedAt = ts;
  await (await newsCol()).updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        title,
        body_markdown: body,
        body_html: renderBody(body),
        author,
        label,
        priority,
        status,
        updated_at: ts,
        published_at: publishedAt,
      },
    },
  );
  return true;
}

export async function setStatus(id: string, status: Status): Promise<boolean> {
  const existing = await getItem(id);
  if (!existing) return false;
  const ts = now();
  let publishedAt = existing.published_at;
  if (status === "published" && !publishedAt) publishedAt = ts;
  await (await newsCol()).updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, updated_at: ts, published_at: publishedAt } },
  );
  return true;
}

export async function deleteItem(id: string): Promise<void> {
  const oid = toObjectId(id);
  if (!oid) return;
  await (await newsCol()).deleteOne({ _id: oid });
}

export async function getItem(id: string): Promise<NewsItem | undefined> {
  const oid = toObjectId(id);
  if (!oid) return undefined;
  const doc = await (await newsCol()).findOne({ _id: oid });
  return doc ? toNewsItem(doc) : undefined;
}

export async function getPublishedItem(
  id: string,
): Promise<NewsItem | undefined> {
  const oid = toObjectId(id);
  if (!oid) return undefined;
  const doc = await (await newsCol()).findOne({
    _id: oid,
    status: "published",
  });
  return doc ? toNewsItem(doc) : undefined;
}

export async function listPublished(limit?: number): Promise<NewsItem[]> {
  let cursor = (await newsCol())
    .find({ status: "published" })
    .sort({ published_at: -1 });
  if (limit && limit > 0) cursor = cursor.limit(limit);
  const docs = await cursor.toArray();
  return docs.map(toNewsItem);
}

/**
 * A cheap fingerprint of the published feed. Changes whenever an item is
 * added, removed, unpublished, or edited — so clients can poll it to learn
 * that the feed they're viewing is now stale (e.g. a teammate published on
 * another machine) without re-fetching the whole list.
 */
export async function feedVersion(): Promise<string> {
  const col = await newsCol();
  const [count, latest] = await Promise.all([
    col.countDocuments({ status: "published" }),
    col.findOne(
      { status: "published" },
      { sort: { updated_at: -1 }, projection: { updated_at: 1 } },
    ),
  ]);
  return `${count}:${latest?.updated_at ?? "0"}`;
}

export async function listAll(): Promise<NewsItem[]> {
  const docs = await (await newsCol())
    .find()
    .sort({ created_at: -1, _id: -1 })
    .toArray();
  return docs.map(toNewsItem);
}

/**
 * Assign a remembered random color (hue) to any label seen for the first time.
 * Existing labels keep their color — $setOnInsert never overwrites.
 */
export async function ensureLabelColors(labels: string[]): Promise<void> {
  if (labels.length === 0) return;
  const col = await labelCol();
  await Promise.all(
    labels.map((l) =>
      col.updateOne(
        { _id: l },
        { $setOnInsert: { hue: Math.floor(Math.random() * 360) } },
        { upsert: true },
      ),
    ),
  );
}

/** Map of label -> hue for every label that has a remembered color. */
export async function getLabelColors(): Promise<Record<string, number>> {
  const docs = await (await labelCol()).find().toArray();
  const map: Record<string, number> = {};
  for (const d of docs) map[d._id] = d.hue;
  return map;
}

/** Distinct non-empty labels across published items, for the feed filter row. */
export async function listLabels(): Promise<string[]> {
  const docs = await (await newsCol())
    .find(
      { status: "published", label: { $ne: "" } },
      { projection: { label: 1 } },
    )
    .toArray();
  const set = new Set<string>();
  for (const doc of docs) for (const l of parseLabels(doc.label)) set.add(l);
  return [...set].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}
