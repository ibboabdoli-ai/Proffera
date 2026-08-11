import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("company directory public claim guard", () => {
  it("accepts claims only for published privacy-safe eligible profiles", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/api/public-directory/claim/route.ts"),
      "utf8",
    );

    expect(source).toContain("publication_status = 'published'");
    expect(source).toContain("privacy_blocked = false");
    expect(source).toContain("auto_public_eligible = true");
    expect(source).not.toContain("publication_status in ('published', 'ready')");
  });
});
