import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Website review moderation audit contract", () => {
  it("keeps moderation workspace-scoped, locked and audited atomically", () => {
    const code = source("src/lib/website-reviews-db.ts");

    expect(code).toContain("canManageWorkspaceSettings(access)");
    expect(code).toContain("workspace_id = ${access.workspaceId}::uuid");
    expect(code).toContain("for update");
    expect(code).toContain("with previous as (");
    expect(code).toContain("updated as (");
    expect(code).toContain("audit as (");
    expect(code).toContain("insert into admin_audit_logs");
    expect(code).toContain("'website_review.status_updated'");
    expect(code).toContain("previous_value, new_value");
    expect(code).toContain("'status', previous.status");
    expect(code).toContain("'status', updated.status");
    expect(code).toContain("admin_user_id, workspace_id");
    expect(code).toContain("return Boolean(rows[0]?.id && rows[0]?.audit_id)");
  });

  it("does not audit no-op decisions or cross-workspace records", () => {
    const code = source("src/lib/website-reviews-db.ts");

    expect(code).toContain("and status <> ${status}");
    expect(code).toContain("where id = ${id}::uuid");
    expect(code).toContain("and workspace_id = ${access.workspaceId}::uuid");
  });
});
