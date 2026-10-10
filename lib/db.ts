import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// Server only. Created on first use so builds and pages that never query don't need DATABASE_URL.
let instance: ReturnType<typeof drizzle> | undefined;

export function db() {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
    instance = drizzle(neon(url));
  }
  return instance;
}
