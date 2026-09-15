import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type EvidenceKind =
  | "code_test"
  | "preview_runtime"
  | "read_only_production"
  | "production_runtime"
  | "human_approval";

type V1Criterion = {
  id: string;
  group: "customer_marketplace" | "provider" | "platform_quality";
  requirement: string;
  requiredEvidence: EvidenceKind[];
  restrictedAction?: string;
  inspectionTargets: string[];
};

type V1Contract = {
  schemaVersion: number;
  purpose: string;
  completionRule: string;
  liveStateAuthority: string;
  evidenceKinds: Record<EvidenceKind, string>;
  criteria: V1Criterion[];
};

const contractPath = resolve(process.cwd(), "docs/V1_LAUNCH_EVIDENCE_CONTRACT.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8")) as V1Contract;

const expectedCriterionIds = [
  "customer.discovery_request",
  "customer.matching_invitation_offer",
  "customer.offer_compare_selection",
  "customer.selection_service_job",
  "customer.completed_verified_review",
  "customer.marketplace_tenant_isolation",
  "provider.onboarding_claim_workspace",
  "provider.services_service_areas",
  "provider.receive_respond",
  "provider.sole_trader_privacy",
  "platform.login_session",
  "platform.password_reset",
  "platform.i18n_parity",
  "platform.mobile_pwa",
  "platform.billing_tenant_integrity",
  "platform.posthog_funnel",
  "platform.directory_scheduler_neon",
  "platform.release_exact_sha_gates",
].sort();

const evidenceKinds: EvidenceKind[] = [
  "code_test",
  "preview_runtime",
  "read_only_production",
  "production_runtime",
  "human_approval",
];

describe("V1 launch evidence contract", () => {
  it("locks the exact 18 Supervisor V1 exit criteria without a stale completion flag", () => {
    expect(contract.schemaVersion).toBe(1);
    expect(contract.criteria.map((criterion) => criterion.id).sort()).toEqual(expectedCriterionIds);
    expect(contract.criteria).toHaveLength(18);

    const raw = readFileSync(contractPath, "utf8");
    expect(raw).not.toMatch(/"(?:status|complete|completed|done)"\s*:/i);
    expect(contract.purpose).toContain("not a live completion report");
    expect(contract.completionRule).toContain("every criterion");
  });

  it("requires explicit, known evidence kinds and real repository inspection targets", () => {
    expect(Object.keys(contract.evidenceKinds).sort()).toEqual([...evidenceKinds].sort());

    for (const criterion of contract.criteria) {
      expect(criterion.requirement.trim().length).toBeGreaterThan(20);
      expect(criterion.requiredEvidence.length).toBeGreaterThan(0);
      expect(new Set(criterion.requiredEvidence).size).toBe(criterion.requiredEvidence.length);
      expect(criterion.inspectionTargets.length).toBeGreaterThan(0);

      for (const evidence of criterion.requiredEvidence) {
        expect(evidenceKinds).toContain(evidence);
      }
      for (const target of criterion.inspectionTargets) {
        expect(target.startsWith("/")).toBe(false);
        expect(existsSync(resolve(process.cwd(), target)), `missing inspection target: ${target}`).toBe(true);
      }
    }
  });

  it("keeps real Marketplace and provider proof behind the restricted-action boundary", () => {
    const pilotCriteria = contract.criteria.filter(
      (criterion) => criterion.group === "customer_marketplace" || criterion.group === "provider",
    );

    expect(pilotCriteria).toHaveLength(10);
    for (const criterion of pilotCriteria) {
      expect(criterion.requiredEvidence).toContain("code_test");
      expect(criterion.requiredEvidence).toContain("preview_runtime");
      expect(criterion.requiredEvidence).toContain("production_runtime");
      expect(criterion.restrictedAction?.trim()).toBeTruthy();
    }
  });

  it("keeps privacy, Production audits, password reset and exact-SHA release proof explicit", () => {
    const byId = new Map(contract.criteria.map((criterion) => [criterion.id, criterion]));

    expect(byId.get("provider.sole_trader_privacy")?.requiredEvidence).toContain("human_approval");
    expect(byId.get("platform.password_reset")?.requiredEvidence).toEqual([
      "code_test",
      "preview_runtime",
      "production_runtime",
    ]);
    expect(byId.get("platform.posthog_funnel")?.requiredEvidence).toContain("read_only_production");
    expect(byId.get("platform.directory_scheduler_neon")?.requiredEvidence).toContain("read_only_production");
    expect(byId.get("platform.release_exact_sha_gates")?.requiredEvidence).toContain("production_runtime");
  });
});
