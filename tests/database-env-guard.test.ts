import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");
const resolverPath = "src/lib/db/database-url.ts";
const directDatabaseEnvPattern = /process\.env(?:\.(?:DATABASE_URL|POSTGRES_URL|POSTGRES_PRISMA_URL|POSTGRES_URL_NON_POOLING|DATABASE_URL_UNPOOLED)|\[(?:"|')(?:DATABASE_URL|POSTGRES_URL|POSTGRES_PRISMA_URL|POSTGRES_URL_NON_POOLING|DATABASE_URL_UNPOOLED)(?:"|')\])/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("database environment isolation guard", () => {
  it("requires all runtime database URL access to go through the central resolver", () => {
    const offenders = sourceFiles(root)
      .map((path) => ({ path, relativePath: relative(process.cwd(), path).replaceAll("\\", "/") }))
      .filter(({ relativePath }) => relativePath !== resolverPath)
      .filter(({ path }) => directDatabaseEnvPattern.test(readFileSync(path, "utf8")))
      .map(({ relativePath }) => relativePath)
      .sort();

    expect(offenders, `Direct database environment access found in: ${offenders.join(", ")}`).toEqual([]);
  });
});
