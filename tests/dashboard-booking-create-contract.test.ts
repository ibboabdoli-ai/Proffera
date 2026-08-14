import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const code = readFileSync(resolve(process.cwd(), "src/lib/dashboard-db.ts"), "utf8");

describe("dashboard manual booking creation", () => {
  it("records the CRM event with a database-supported booking event type", () => {
    expect(code).toContain("'booking',");
    expect(code).toContain("'Bokning skapad manuellt',");
    expect(code).not.toContain("'booking_created',");
  });
});
