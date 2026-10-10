import { index, jsonb, pgTable, real, text, timestamp, vector } from "drizzle-orm/pg-core";

// Written by corpus/embed (Python); read by search, the project drawer and idea placement.
export type ProjectEvent = { name: string; url: string; dates: string | null; prizes: string[] };

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(), // sha1 of the canonical URL
    url: text("url").notNull(),
    title: text("title").notNull(),
    tagline: text("tagline"),
    description: text("description").notNull(),
    technologies: jsonb("technologies").$type<string[]>().notNull(),
    events: jsonb("events").$type<ProjectEvent[]>().notNull(),
    date: text("date"), // as the page shows it; null when unknown
    dateKind: text("date_kind").$type<"created" | "unknown">().notNull(),
    source: text("source").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(), // BAAI/bge-m3, normalized
    x: real("x").notNull(), // display only: never use for similarity
    y: real("y").notNull(),
    z: real("z").notNull(),
    corpusVersion: text("corpus_version").notNull(),
  },
  (t) => [index("projects_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);
