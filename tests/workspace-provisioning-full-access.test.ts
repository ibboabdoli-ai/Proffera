import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Workspace provisioning feature access", () => {
  it("enables every active catalog feature for a new trial workspace", () => {
    const code = source("src/features/company/workspace-provisioning.ts");

    expect(code).toContain(
      "select gen_random_uuid(), ${workspaceId}::uuid, feature_key, true, now(), now()",
    );
    expect(code).toContain("from feature_catalog");
    expect(code).toContain("where is_active = true");
    expect(code).toContain("enabled = true");
  });

  it("does not keep plan-gated or hardcoded feature overrides in provisioning", () => {
    const code = source("src/features/company/workspace-provisioning.ts");

    expect(code).not.toContain("minimum_plan = 'starter'");
    expect(code).not.toContain("'crm_customers', false");
    expect(code).not.toContain("'ai_assistant', false");
    expect(code.match(/insert into workspace_feature_flags/g)).toHaveLength(1);
  });
});
