import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("company directory pilot database guard", () => {
  it("prevents publication outside Stockholm and Södertälje during the pilot", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "db/migrations/20260810_0041_company_profile_pilot_location_guard.sql"),
      "utf8",
    ).toLocaleLowerCase("sv-SE");

    expect(sql).toContain("company_directory_profiles_pilot_location_guard");
    expect(sql).toContain("publication_status <> 'published'");
    expect(sql).toContain("stockholm");
    expect(sql).toContain("södertälje");
  });
});
