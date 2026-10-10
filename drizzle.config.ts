import { defineConfig } from "drizzle-kit";

// One schema file per feature: db/schema/<slug>.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/*.ts",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
