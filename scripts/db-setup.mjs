// drizzle-kit push doesn't create extensions; pgvector must exist before any vector column.
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  process.stderr.write("DATABASE_URL is not set (see .env.example)\n");
  process.exit(1);
}
await neon(process.env.DATABASE_URL)`create extension if not exists vector`;
process.stdout.write("pgvector ready\n");
