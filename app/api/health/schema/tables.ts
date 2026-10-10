import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

// Table names from loaded db/schema/ modules, sorted. Non-table exports (relations, helpers) are skipped.
export function tableNames(modules: Record<string, unknown>[]): string[] {
  const names = new Set<string>();
  for (const m of modules) for (const v of Object.values(m)) if (is(v, PgTable)) names.add(getTableConfig(v).name);
  return [...names].sort();
}

export function missingTables(expected: string[], present: string[]): string[] {
  const have = new Set(present);
  return expected.filter((t) => !have.has(t));
}
