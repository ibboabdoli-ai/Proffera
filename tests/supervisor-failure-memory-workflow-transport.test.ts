import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { createMemory, readTrustedMemory, serializeMemory } from "../scripts/supervisor-failure-memory.mjs";

const repository = "ibboabdoli-ai/Proffera";
const pr = 937;
const scope = {kind: "pull_request" as const, pr_number: pr};

type Step = {name?: string; run?: string};
type Workflow = {jobs: Record<string, {steps?: Step[]}>};
const yamlLoad = createRequire(import.meta.url)("js-yaml").load as (text: string) => Workflow;

function workflowRun(path: string, job: string, name: string) {
  const workflow = yamlLoad(readFileSync(new URL(path, import.meta.url), "utf8").replaceAll("\r\n", "\n"));
  const step = workflow.jobs[job]?.steps?.find((candidate) => candidate.name === name);
  if (!step?.run) throw new Error(`Missing workflow run step: ${job}/${name}`);
  return step.run;
}

function canonicalBody() {
  return serializeMemory(createMemory(repository, scope));
}

function trustedComment(body: string) {
  return {
    id: 99,
    issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548",
    user: {login: "github-actions[bot]", type: "Bot"},
    body,
  };
}

function expectCanonicalDirectTransport(script: string, expectedLine: string) {
  const lines = script.split("\n").map((line) => line.trim());
  expect(lines).toContain(expectedLine);
  expect(script).not.toContain("--rawfile body");
  expect(script).not.toContain("memory-body.txt");
  const body = canonicalBody();
  const plan = {body};
  const transported = JSON.parse(JSON.stringify({body: plan.body})).body;
  expect(transported).toBe(body);
  expect(readTrustedMemory([trustedComment(transported)], {
    repository,
    scope,
    complete: true,
  }).memory).toEqual(createMemory(repository, scope));
  expect(() => readTrustedMemory([trustedComment(body + "\n")], {
    repository,
    scope,
    complete: true,
  })).toThrow(/malformed_body_or_version/);
}

describe("Failure Memory workflow payload transport", () => {
  it("preserves canonical CI Autofix terminal backfill bytes", () => {
    const script = workflowRun(
      "../.github/workflows/proffera-ci-autofix.yml",
      "admit",
      "Recover proven pre-model starts and admit exact-head CI evidence",
    );
    expectCanonicalDirectTransport(
      script,
      `jq '{body:.body}' <<< "$backfill_plan" > "$backfill_payload"`,
    );
  });

  it("preserves canonical CI Autofix outcome bytes", () => {
    const script = workflowRun(
      "../.github/workflows/proffera-ci-autofix.yml",
      "record",
      "Persist exact CI Autofix outcome in canonical Failure Memory",
    );
    expectCanonicalDirectTransport(script, `jq '{body:.body}' "$plan_b" > "$payload"`);
  });

  it("preserves canonical Review Repair outcome bytes", () => {
    const script = workflowRun(
      "../.github/workflows/supervisor-review-repair.yml",
      "record",
      "Persist exact attempt outcome in canonical Failure Memory",
    );
    expectCanonicalDirectTransport(script, `jq '{body:.body}' "$plan_b" > "$payload"`);
  });
});
