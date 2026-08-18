import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("booking reminder workspace join", () => {
  it("casts UUID workspace ids before joining legacy text booking workspace ids", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/booking-reminders.ts"), "utf8");

    expect(source).toContain("left join workspaces w on w.id::text=b.workspace_id");
    expect(source).not.toContain("left join workspaces w on w.id=b.workspace_id");
  });
});
