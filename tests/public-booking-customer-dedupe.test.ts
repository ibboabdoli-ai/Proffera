import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public booking customer reuse", () => {
  it("serializes same-workspace same-email customer resolution", () => {
    const verification = source("src/lib/public-booking-verification.ts");

    expect(verification).toContain("sql.transaction");
    expect(verification).toContain("pg_advisory_xact_lock");
    expect(verification).toContain("customerLockKey");
  });

  it("reuses an existing workspace customer before creating a new one", () => {
    const verification = source("src/lib/public-booking-verification.ts");

    expect(verification).toContain("with existing_customer as");
    expect(verification).toContain("lower(email) = lower");
    expect(verification).toContain("where not exists (select 1 from existing_customer)");
    expect(verification).toContain("select id from existing_customer");
    expect(verification).toContain("select id from inserted_customer");
  });
});
