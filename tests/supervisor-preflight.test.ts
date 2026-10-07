import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error Repository scripts are plain ESM and intentionally have no TypeScript declaration file.
import { inspectCandidate, validatePrMetadata } from "../scripts/supervisor-preflight.mjs";

const roots: string[] = [];
const preflight = join(process.cwd(), "scripts", "supervisor-preflight.mjs");

function git(cwd: string, args: string[], allowFailure = false) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (!allowFailure) expect(result.status, result.stderr).toBe(0);
  return result;
}

function write(path: string, value: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function fixture(options: { branch?: string; baseFiles?: Record<string, string> } = {}) {
  const root = mkdtempSync(join(tmpdir(), "proffera-preflight-"));
  roots.push(root);
  const repo = join(root, "repo");
  mkdirSync(repo);
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.name", "Fixture"]);
  git(repo, ["config", "user.email", "fixture@example.invalid"]);
  git(repo, ["remote", "add", "origin", "https://github.com/ibboabdoli-ai/Proffera.git"]);

  const baseFiles = options.baseFiles ?? { "README.md": "# Fixture\n" };
  for (const [path, value] of Object.entries(baseFiles)) write(join(repo, path), value);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-qm", "base"]);
  const base = git(repo, ["rev-parse", "HEAD"]).stdout.trim();
  git(repo, ["checkout", "-qb", options.branch ?? "work/proffera-preflight-test"]);

  return { root, repo, base };
}

function body(base: string, extra = "") {
  return [
    "## Worker bootstrap",
    "",
    "Task/issue: user-request",
    `Bootstrap baseline: ${base}`,
    "Worker bootstrap: complete",
    "Supervisor handoff: #548",
    "",
    "## Documentation impact",
    "",
    "Documentation impact: none",
    extra,
  ].join("\n");
}

function writeBody(root: string, text: string) {
  const path = join(root, "pr-body.md");
  writeFileSync(path, text);
  return path;
}

function inspectFixture(args: { cwd: string; baseSha: string; prBody: string }) {
  return inspectCandidate({...args, liveMainResolver: () => args.baseSha});
}

function cli(repo: string, args: string[]) {
  const baseIndex = args.indexOf("--base");
  const base = baseIndex >= 0 ? args[baseIndex + 1] : "";
  const shimPath = join(dirname(repo), "preflight-gh-shim.cjs");
  writeFileSync(shimPath, [
    'const childProcess = require("node:child_process");',
    'const { syncBuiltinESMExports } = require("node:module");',
    'const originalSpawnSync = childProcess.spawnSync;',
    'childProcess.spawnSync = function(command, commandArgs, options) {',
    '  if (command === "gh" && Array.isArray(commandArgs) && commandArgs[0] === "api" && process.env.PREFLIGHT_TEST_MAIN_SHA) {',
    '    return { status: 0, signal: null, stdout: process.env.PREFLIGHT_TEST_MAIN_SHA + "\\n", stderr: "" };',
    '  }',
    '  return originalSpawnSync.call(this, command, commandArgs, options);',
    '};',
    'syncBuiltinESMExports();',
    '',
  ].join("\n"));
  const existingNodeOptions = process.env.NODE_OPTIONS?.trim();
  const requireShim = `--require=${shimPath.replaceAll("\\", "/")}`;
  return spawnSync(process.execPath, [preflight, ...args], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PREFLIGHT_TEST_MAIN_SHA: base,
      NODE_OPTIONS: existingNodeOptions ? `${existingNodeOptions} ${requireShim}` : requireShim,
    },
  });
}

function candidateIdentity(candidate: ReturnType<typeof inspectCandidate>) {
  return {
    repository: candidate.repository,
    branch: candidate.branch,
    base_sha: candidate.base_sha,
    head_sha: candidate.head_sha,
    tree_sha: candidate.tree_sha,
    pr_body_sha256: candidate.pr_body_sha256,
  };
}

function writeEvidence(root: string, candidate: ReturnType<typeof inspectCandidate>, options: {
  validationIds?: string[];
  outcome?: string;
  findings?: Array<{ id: string; verified: boolean; resolved: boolean }>;
  candidateOverride?: Record<string, unknown>;
} = {}) {
  const identity = { ...candidateIdentity(candidate), ...(options.candidateOverride ?? {}) };
  const validation = {
    kind: "supervisor-validation-evidence",
    version: 1,
    candidate: identity,
    results: (options.validationIds ?? candidate.required_validation_checks).map((id: string) => ({
      id,
      status: "passed",
      command: `fixture:${id}`,
    })),
  };
  const review = {
    kind: "supervisor-review-evidence",
    version: 1,
    candidate: identity,
    reviewer: "codex-local-independent",
    outcome: options.outcome ?? "pass",
    focuses: candidate.required_review_focuses,
    findings: options.findings ?? [],
    review_digest: "a".repeat(64),
  };
  const validationPath = join(root, "validation.json");
  const reviewPath = join(root, "review.json");
  writeFileSync(validationPath, JSON.stringify(validation, null, 2));
  writeFileSync(reviewPath, JSON.stringify(review, null, 2));
  return { validationPath, reviewPath };
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("canonical Supervisor pre-publication gate", () => {
  it("accepts a clean committed candidate and reports its immutable identity", () => {
    const { root, repo, base } = fixture();
    write(join(repo, "docs", "note.md"), "candidate\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate"]);
    const prBody = body(base);

    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody });
    expect(candidate).toMatchObject({
      repository: "ibboabdoli-ai/Proffera",
      branch: "work/proffera-preflight-test",
      base_sha: base,
      metadata: {
        task: "user-request",
        bootstrap_baseline: base,
        documentation_impact: "none",
      },
    });
    expect(candidate.head_sha).toMatch(/^[a-f0-9]{40}$/);
    expect(candidate.tree_sha).toMatch(/^[a-f0-9]{40}$/);
    expect(candidate.pr_body_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(candidate.diff.paths).toEqual(["docs/note.md"]);
    expect(candidate.required_validation_checks).toEqual(["targeted"]);
    expect(candidate.required_review_focuses).toEqual(["adversarial"]);

    const bodyPath = writeBody(root, prBody);
    const result = cli(repo, ["snapshot", "--base", base, "--pr-body", bodyPath]);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true });
  });

  it("rejects the wrong branch and any dirty staged, unstaged, or untracked candidate state", () => {
    const wrong = fixture({ branch: "feature/not-supervisor" });
    write(join(wrong.repo, "docs", "note.md"), "candidate\n");
    git(wrong.repo, ["add", "."]);
    git(wrong.repo, ["commit", "-qm", "candidate"]);
    expect(() => inspectFixture({ cwd: wrong.repo, baseSha: wrong.base, prBody: body(wrong.base) }))
      .toThrow(/supervisor_preflight:branch/);

    const dirty = fixture();
    write(join(dirty.repo, "docs", "note.md"), "candidate\n");
    git(dirty.repo, ["add", "."]);
    git(dirty.repo, ["commit", "-qm", "candidate"]);
    write(join(dirty.repo, "untracked.txt"), "dirty\n");
    expect(() => inspectFixture({ cwd: dirty.repo, baseSha: dirty.base, prBody: body(dirty.base) }))
      .toThrow(/supervisor_preflight:dirty/);
  });

  it("accounts for both rename endpoints by disabling rename detection", () => {
    const { repo, base } = fixture({
      baseFiles: {
        "README.md": "# Fixture\n",
        "src/lib/auth.ts": "export const auth = 1;\n",
      },
    });
    git(repo, ["mv", "src/lib/auth.ts", "src/lib/renamed-auth.ts"]);
    git(repo, ["commit", "-qm", "rename protected file"]);

    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) });
    expect(candidate.diff.paths).toEqual(["src/lib/auth.ts", "src/lib/renamed-auth.ts"]);
    expect(candidate.diff.files.map((entry: {status: string; path: string}) => [entry.status, entry.path])).toEqual([
      ["D", "src/lib/auth.ts"],
      ["A", "src/lib/renamed-auth.ts"],
    ]);
    expect(candidate.required_review_focuses).toEqual(["adversarial", "security"]);
  });

  it("accounts for additions and deletions and rejects unsupported file modes", () => {
    const { repo, base } = fixture({
      baseFiles: {
        "README.md": "# Fixture\n",
        "src/old.ts": "old\n",
      },
    });
    git(repo, ["rm", "src/old.ts"]);
    write(join(repo, "src", "new.ts"), "new\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "replace file"]);

    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) });
    expect(candidate.diff.files.map((entry: {status: string; path: string}) => [entry.status, entry.path])).toEqual([
      ["A", "src/new.ts"],
      ["D", "src/old.ts"],
    ]);
  });

  it("requires exact, unique machine-readable PR declarations", () => {
    const base = "b".repeat(40);
    expect(() => validatePrMetadata(
      body(base) + "\nWorker bootstrap: complete\n",
      { baseSha: base, changedPaths: ["docs/note.md"] },
    )).toThrow(/exactly one 'Worker bootstrap: complete'/);

    expect(() => validatePrMetadata(
      body(base).replace("Documentation impact: none", "Documentation impact: updated"),
      { baseSha: base, changedPaths: ["docs/note.md"] },
    )).toThrow(/docs\/CURRENT_STATUS\.md is unchanged/);

    expect(() => validatePrMetadata(
      body(base).replace(`Bootstrap baseline: ${base}`, `Bootstrap baseline: ${"c".repeat(40)}`),
      { baseSha: base, changedPaths: ["docs/note.md"] },
    )).toThrow(/does not match base/);
  });

  it("verifies validation and independent review evidence bound to the exact candidate", () => {
    const { root, repo, base } = fixture();
    write(join(repo, "docs", "note.md"), "candidate\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate"]);
    const prBody = body(base);
    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody });
    const bodyPath = writeBody(root, prBody);
    const { validationPath, reviewPath } = writeEvidence(root, candidate);

    const result = cli(repo, [
      "verify",
      "--base", base,
      "--pr-body", bodyPath,
      "--validation", validationPath,
      "--review", reviewPath,
    ]);
    expect(result.status, result.stderr).toBe(0);
    const receipt = JSON.parse(result.stdout);
    expect(receipt).toMatchObject({
      ok: true,
      candidate: candidateIdentity(candidate),
      validation: { result_count: 1 },
      review: { reviewer: "codex-local-independent", finding_count: 0 },
    });
  });

  it("invalidates prior validation and review evidence after the candidate changes", () => {
    const { root, repo, base } = fixture();
    write(join(repo, "docs", "note.md"), "candidate one\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate one"]);
    const prBody = body(base);
    const first = inspectFixture({ cwd: repo, baseSha: base, prBody });
    const evidence = writeEvidence(root, first);
    const bodyPath = writeBody(root, prBody);

    write(join(repo, "docs", "note.md"), "candidate two\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate two"]);

    const result = cli(repo, [
      "verify",
      "--base", base,
      "--pr-body", bodyPath,
      "--validation", evidence.validationPath,
      "--review", evidence.reviewPath,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("supervisor_preflight:stale_evidence");
  });

  it("permits only explicitly justified hosted-required unit and e2e evidence", () => {
    const { root, repo, base } = fixture({ baseFiles: { "AGENTS.md": "base\n" } });
    write(join(repo, "AGENTS.md"), "changed\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "control plane"]);
    const prBody = body(base);
    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody });
    const bodyPath = writeBody(root, prBody);
    const identity = candidateIdentity(candidate);
    const review = {
      kind: "supervisor-review-evidence",
      version: 1,
      candidate: identity,
      reviewer: "codex-local-independent",
      outcome: "pass",
      focuses: candidate.required_review_focuses,
      findings: [],
      review_digest: "b".repeat(64),
    };
    const reviewPath = join(root, "review-hosted.json");
    writeFileSync(reviewPath, JSON.stringify(review, null, 2));

    const results = candidate.required_validation_checks.map((id: string) => ({
      id,
      status: id === "unit" || id === "e2e" ? "hosted-required" : "passed",
      command: `fixture:${id}`,
      ...(id === "unit" || id === "e2e"
        ? {
            hosted_evidence_required: true,
            reason: "The selected hosted lane depends on Linux/container behavior unavailable in this fixture.",
          }
        : {}),
    }));
    const validationPath = join(root, "validation-hosted.json");
    writeFileSync(validationPath, JSON.stringify({
      kind: "supervisor-validation-evidence",
      version: 1,
      candidate: identity,
      results,
    }, null, 2));

    const accepted = cli(repo, [
      "verify",
      "--base", base,
      "--pr-body", bodyPath,
      "--validation", validationPath,
      "--review", reviewPath,
    ]);
    expect(accepted.status, accepted.stderr).toBe(0);
    expect(JSON.parse(accepted.stdout).validation.hosted_required).toEqual(["e2e", "unit"]);

    const typecheck = results.find((result: {id: string}) => result.id === "typecheck");
    expect(typecheck).toBeDefined();
    Object.assign(typecheck!, {
      status: "hosted-required",
      hosted_evidence_required: true,
      reason: "Not allowed to defer deterministic typecheck.",
    });
    writeFileSync(validationPath, JSON.stringify({
      kind: "supervisor-validation-evidence",
      version: 1,
      candidate: identity,
      results,
    }, null, 2));
    const rejected = cli(repo, [
      "verify",
      "--base", base,
      "--pr-body", bodyPath,
      "--validation", validationPath,
      "--review", reviewPath,
    ]);
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain("validation check typecheck cannot be deferred");
  });

  it("blocks unresolved verified findings and missing scope-selected validation", () => {
    const reviewFixture = fixture();
    write(join(reviewFixture.repo, "docs", "note.md"), "candidate\n");
    git(reviewFixture.repo, ["add", "."]);
    git(reviewFixture.repo, ["commit", "-qm", "candidate"]);
    const prBody = body(reviewFixture.base);
    const candidate = inspectFixture({ cwd: reviewFixture.repo, baseSha: reviewFixture.base, prBody });
    const bodyPath = writeBody(reviewFixture.root, prBody);
    const evidence = writeEvidence(reviewFixture.root, candidate, {
      findings: [{ id: "P1", verified: true, resolved: false }],
    });
    const blocked = cli(reviewFixture.repo, [
      "verify",
      "--base", reviewFixture.base,
      "--pr-body", bodyPath,
      "--validation", evidence.validationPath,
      "--review", evidence.reviewPath,
    ]);
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("verified finding remains unresolved");

    const validationFixture = fixture({ baseFiles: { "AGENTS.md": "base\n" } });
    write(join(validationFixture.repo, "AGENTS.md"), "changed\n");
    git(validationFixture.repo, ["add", "."]);
    git(validationFixture.repo, ["commit", "-qm", "control plane"]);
    const sensitiveBody = body(validationFixture.base);
    const sensitive = inspectFixture({
      cwd: validationFixture.repo,
      baseSha: validationFixture.base,
      prBody: sensitiveBody,
    });
    expect(sensitive.scope.classification).toBe("restricted-full");
    expect(sensitive.required_validation_checks).toEqual(expect.arrayContaining([
      "targeted", "lint", "typecheck", "unit", "build", "e2e", "discovery-worker",
    ]));
    expect(sensitive.required_review_focuses).toEqual(["adversarial", "security"]);

    const sensitiveBodyPath = writeBody(validationFixture.root, sensitiveBody);
    const incomplete = writeEvidence(validationFixture.root, sensitive, { validationIds: ["targeted"] });
    const missing = cli(validationFixture.repo, [
      "verify",
      "--base", validationFixture.base,
      "--pr-body", sensitiveBodyPath,
      "--validation", incomplete.validationPath,
      "--review", incomplete.reviewPath,
    ]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("required validation evidence is missing");
  });
});
