import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HEAD_TIME = "2026-08-31T20:00:00Z";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function classify(files: string[]) {
  const result = spawnSync(
    process.execPath,
    [resolve(process.cwd(), "scripts/ci/classify-pr-risk.mjs")],
    {
      encoding: "utf8",
      input: `${files.join("\n")}\n`,
    },
  );

  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as {
    reviewRisk: "low" | "medium" | "high";
    aiReviewRequired: boolean;
    humanMergeRequired: boolean;
    dbTestsRequired: boolean;
    productionImpact: boolean;
    reasons: string[];
  };
}

type ReviewFixture = {
  head?: string;
  headTime?: string;
  issueComments?: unknown[];
  reviews?: unknown[];
  inlineComments?: unknown[];
  prReactions?: unknown[];
  requestReactions?: Record<string, unknown[]>;
};

function runReviewGate(fixture: ReviewFixture) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-review-gate-"));
  const fixturePath = join(dir, "fixture.json");
  const ghPath = join(dir, "gh");

  writeFileSync(fixturePath, JSON.stringify({
    head: HEAD,
    headTime: HEAD_TIME,
    issueComments: [],
    reviews: [],
    inlineComments: [],
    prReactions: [],
    requestReactions: {},
    ...fixture,
  }));

  writeFileSync(
    ghPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const fixture = JSON.parse(fs.readFileSync(process.env.MOCK_GH_FIXTURE, "utf8"));
const args = process.argv.slice(2);
if (args[0] !== "api") process.exit(2);
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const jqIndex = args.indexOf("--jq");
const jq = jqIndex >= 0 ? args[jqIndex + 1] : "";
function emitItems(items) { for (const item of items || []) console.log(JSON.stringify(item)); }
if (/\\/pulls\\/1$/.test(endpoint) && jq === ".head.sha") console.log(fixture.head);
else if (/\\/commits\\//.test(endpoint)) console.log(fixture.headTime);
else if (/\\/issues\\/1\\/comments/.test(endpoint)) emitItems(fixture.issueComments);
else if (/\\/pulls\\/1\\/reviews/.test(endpoint)) emitItems(fixture.reviews);
else if (/\\/pulls\\/1\\/comments/.test(endpoint)) emitItems(fixture.inlineComments);
else if (/\\/issues\\/1\\/reactions/.test(endpoint)) emitItems(fixture.prReactions);
else {
  const match = endpoint.match(/\\/issues\\/comments\\/(\\d+)\\/reactions/);
  if (match) emitItems((fixture.requestReactions || {})[match[1]] || []);
  else process.exit(3);
}
`,
  );
  chmodSync(ghPath, 0o755);

  const result = spawnSync(
    "bash",
    [resolve(process.cwd(), "scripts/ci/review-gate.sh")],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ""}`,
        MOCK_GH_FIXTURE: fixturePath,
        REPOSITORY: "example/proffera",
        PR_NUMBER: "1",
        HEAD_SHA: HEAD,
        REVIEW_GATE_MODE: "check",
      },
    },
  );

  rmSync(dir, { recursive: true, force: true });
  return result;
}

describe("Review Control Plane v3", () => {
  it("classifies ordinary UI work as low risk without mandatory AI or human merge", () => {
    expect(classify(["src/components/marketing/Hero.tsx"])).toMatchObject({
      reviewRisk: "low",
      aiReviewRequired: false,
      humanMergeRequired: false,
      dbTestsRequired: false,
    });
  });

  it("classifies a public API image route as medium review risk but still requires controlled merge", () => {
    expect(
      classify([
        "src/app/api/public-directory/category-image/[category]/route.tsx",
        "tests/company-directory-category-image.test.ts",
      ]),
    ).toMatchObject({
      reviewRisk: "medium",
      aiReviewRequired: true,
      humanMergeRequired: true,
      productionImpact: true,
    });
  });

  it("keeps workflow, classifier, privacy, database, and every supported lockfile high risk", () => {
    for (const file of [
      ".github/workflows/ci.yml",
      "scripts/ci/classify-pr-risk.mjs",
      "scripts/ci/review-gate.sh",
      "src/app/privacy/page.tsx",
      "db/migrations/0060_example.sql",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
    ]) {
      const result = classify([file]);
      expect(result.reviewRisk, file).toBe("high");
      expect(result.aiReviewRequired, file).toBe(true);
      expect(result.humanMergeRequired, file).toBe(true);
    }
  });

  it("marks database and concurrency paths for PostgreSQL/race coverage without changing current test execution", () => {
    const result = classify([
      "src/lib/workspace-transaction.ts",
      "tests/company-directory-provider-activation-area-race.integration.test.ts",
    ]);
    expect(result.dbTestsRequired).toBe(true);
  });

  it("routes a large otherwise ordinary change to medium AI review", () => {
    const result = classify(
      Array.from({ length: 12 }, (_, index) => `src/components/example-${index}.tsx`),
    );
    expect(result.reviewRisk).toBe("medium");
    expect(result.aiReviewRequired).toBe(true);
    expect(result.humanMergeRequired).toBe(false);
  });

  it("accepts a fresh Codex clean reaction bound to the current head time", () => {
    const result = runReviewGate({
      prReactions: [{
        user: { login: "chatgpt-codex-connector[bot]" },
        content: "+1",
        created_at: "2026-08-31T20:01:00Z",
      }],
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Codex completed a clean exact-head review");
  });

  it("rejects a stale Codex reaction from before the current head", () => {
    const result = runReviewGate({
      prReactions: [{
        user: { login: "chatgpt-codex-connector[bot]" },
        content: "+1",
        created_at: "2026-08-31T19:59:59Z",
      }],
    });
    expect(result.status).toBe(1);
  });

  it("keeps current-head Codex inline findings blocking even when a clean reaction exists", () => {
    const result = runReviewGate({
      inlineComments: [{
        user: { login: "chatgpt-codex-connector[bot]" },
        commit_id: HEAD,
        created_at: "2026-08-31T20:01:00Z",
      }],
      prReactions: [{
        user: { login: "chatgpt-codex-connector[bot]" },
        content: "+1",
        created_at: "2026-08-31T20:02:00Z",
      }],
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Codex posted current-head review findings");
  });

  it("does not let an equal-timestamp CodeRabbit approval clear CHANGES_REQUESTED", () => {
    const timestamp = "2026-08-31T20:02:00Z";
    const result = runReviewGate({
      reviews: [
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: HEAD,
          state: "CHANGES_REQUESTED",
          submitted_at: timestamp,
        },
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: HEAD,
          state: "APPROVED",
          submitted_at: timestamp,
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("CodeRabbit has unresolved CHANGES_REQUESTED");
  });

  it("accepts only a strictly later current-head CodeRabbit approval after CHANGES_REQUESTED", () => {
    const result = runReviewGate({
      reviews: [
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: HEAD,
          state: "CHANGES_REQUESTED",
          submitted_at: "2026-08-31T20:02:00Z",
        },
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: HEAD,
          state: "APPROVED",
          submitted_at: "2026-08-31T20:02:01Z",
        },
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: OTHER_HEAD,
          state: "APPROVED",
          submitted_at: "2026-08-31T20:03:00Z",
        },
      ],
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("CodeRabbit approved the exact head after its latest change request");
  });

  it("uses one canonical classifier from CI and main-backed classifier/evaluator in automerge", () => {
    const ci = source(".github/workflows/ci.yml");
    const automerge = source(".github/workflows/proffera-automerge.yml");

    expect(ci).toContain("node scripts/ci/classify-pr-risk.mjs");
    expect(ci).toContain("REVIEW_GATE_MODE=route bash scripts/ci/review-gate.sh");
    expect(ci).toContain("REVIEW_GATE_MODE=wait bash scripts/ci/review-gate.sh");
    expect(automerge).toContain("contents/scripts/ci/classify-pr-risk.mjs?ref=main");
    expect(automerge).toContain("contents/scripts/ci/review-gate.sh?ref=main");
    expect(automerge).toContain("REVIEW_GATE_MODE=check");
  });

  it("keeps Codex primary, CodeRabbit availability fallback, and no unproven Gemini pass path", () => {
    const gate = source("scripts/ci/review-gate.sh");

    expect(gate).toContain("proffera-codex-final-review-request:${HEAD_SHA}");
    expect(gate).toContain("@codex review");
    expect(gate).toContain("proffera-coderabbit-fallback-review-request:${HEAD_SHA}");
    expect(gate).toContain("@coderabbitai review");
    expect(gate).toContain("Codex posted current-head review findings");
    expect(gate).toContain("CodeRabbit has unresolved CHANGES_REQUESTED");
    expect(gate).not.toContain("Gemini");
  });

  it("separates browser and AI visibility while preserving required check compatibility and exact-head CodeQL", () => {
    const ci = source(".github/workflows/ci.yml");

    expect(ci).toContain("name: E2E public smoke run");
    expect(ci).toContain("name: AI review gate");
    expect(ci).toContain("name: E2E public smoke");
    expect(ci).toContain('select(.name == "Analyze JavaScript/TypeScript")');
    expect(ci).toContain("Browser E2E, AI review, and exact-head CodeQL all succeeded.");
  });
});
