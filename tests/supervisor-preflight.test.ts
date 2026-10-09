import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error Repository scripts are plain ESM and intentionally have no TypeScript declaration file.
import { inspectCandidate, executeLocalValidation, validatePrMetadata, evaluateGithubReviewSnapshot, assertStableHostedReviewReads } from "../scripts/supervisor-preflight.mjs";

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
    '    if (commandArgs[commandArgs.indexOf("--hostname") + 1] !== "github.com" || options.env?.GH_HOST !== "github.com") {',
    '      return { status: 1, signal: null, stdout: "", stderr: "GitHub authority was not pinned" };',
    '    }',
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
      GH_HOST: "attacker-mirror.invalid",
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
  findings?: Array<Record<string, unknown>>;
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

  it("rejects origins whose actual hostname is not github.com", () => {
    const { repo, base } = fixture();
    write(join(repo, "docs", "note.md"), "candidate\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate"]);

    for (const remote of [
      "https://example.invalid/github.com/ibboabdoli-ai/Proffera.git",
      "https://notgithub.com/ibboabdoli-ai/Proffera.git",
      "ssh://git@example.invalid/ibboabdoli-ai/Proffera.git",
    ]) {
      git(repo, ["remote", "set-url", "origin", remote]);
      expect(() => inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) }))
        .toThrow(/supervisor_preflight:repository/);
    }

    for (const remote of [
      "https://github.com/ibboabdoli-ai/Proffera.git",
      "git@github.com:ibboabdoli-ai/Proffera.git",
      "ssh://git@github.com/ibboabdoli-ai/Proffera.git",
    ]) {
      git(repo, ["remote", "set-url", "origin", remote]);
      expect(inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) }).repository)
        .toBe("ibboabdoli-ai/Proffera");
    }
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

  it("rejects fabricated execution and reviewer claims even when bound to the exact candidate", () => {
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
    expect(result.status, result.stderr).toBe(1);
    const receipt = JSON.parse(result.stdout);
    expect(receipt).toMatchObject({
      ok: false,
      code: "evidence_provenance_unverified",
      evidence_consistent: true,
      publication_ready: false,
      execution_verified: false,
      independent_review_verified: false,
      candidate: candidateIdentity(candidate),
      validation: { result_count: 1 },
      review: { reviewer: "codex-local-independent", finding_count: 0 },
    });
  });

  it("runs an allowlisted real local check and never confuses it with publication approval", () => {
    const { root, repo, base } = fixture({ baseFiles: { "AGENTS.md": "base\n" } });
    write(join(repo, "AGENTS.md"), "candidate\n");
    write(join(repo, "node_modules", "typescript", "bin", "tsc"),
      'process.stdout.write("fixture-check-executed\\n");\n');
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate with a local test runner"]);
    const prBody = body(base);
    const bodyPath = writeBody(root, prBody);
    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody });
    expect(candidate.required_validation_checks).toContain("typecheck");

    const passed = cli(repo, [
      "run-checks", "--base", base, "--pr-body", bodyPath, "--checks", "typecheck",
    ]);
    expect(passed.status, passed.stderr).toBe(0);
    const receipt = JSON.parse(passed.stdout);
    expect(receipt).toMatchObject({
      ok: true, code: "local_execution_observed_not_independent_review",
      execution_observed: true, independent_review_verified: false, publication_ready: false,
      executed_count: 1, results: [{ id: "typecheck", status: "passed", exit_code: 0 }],
    });
    expect(receipt.results[0].command).toContain("node_modules/typescript/bin/tsc");
    expect(receipt.missing_checks.length).toBeGreaterThan(0);

    // A caller cannot provide an arbitrary executable check or duplicate ID.
    const forged = cli(repo, [
      "run-checks", "--base", base, "--pr-body", bodyPath,
      "--checks", "typecheck,arbitrary-command",
    ]);
    expect(forged.status).toBe(1);
    expect(forged.stderr).toContain("was not selected");
    const duplicate = cli(repo, [
      "run-checks", "--base", base, "--pr-body", bodyPath,
      "--checks", "typecheck,typecheck",
    ]);
    expect(duplicate.status).toBe(1);
    expect(duplicate.stderr).toContain("unique check IDs");

    write(join(repo, "node_modules", "typescript", "bin", "tsc"),
      'process.stderr.write("deliberate failed check\\n");process.exit(7);\n');
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "failed validation fixture"]);
    const failed = cli(repo, [
      "run-checks", "--base", base, "--pr-body", bodyPath, "--checks", "typecheck",
    ]);
    expect(failed.status).toBe(1);
    expect(JSON.parse(failed.stdout)).toMatchObject({
      ok: false, publication_ready: false, executed_count: 1,
      results: [{ id: "typecheck", status: "failed", exit_code: 7 }],
    });
  });

  it("fails closed if run-checks mutates the PR body during validation", () => {
    const { root, repo, base } = fixture({ baseFiles: { "AGENTS.md": "base\n" } });
    write(join(repo, "AGENTS.md"), "candidate\n");
    const bodyPath = writeBody(root, body(base));
    write(join(repo, "node_modules", "typescript", "bin", "tsc"),
      'require("node:fs").appendFileSync(' + JSON.stringify(bodyPath)
      + ', ' + JSON.stringify("\nChanged during validation\n") + ');\n');
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate with changing PR metadata"]);
    const result = cli(repo, [
      "run-checks", "--base", base, "--pr-body", bodyPath, "--checks", "typecheck",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr, `stdout=${result.stdout}; stderr=${result.stderr}`).toContain("supervisor_preflight:stale_evidence");
  });

  it("fails closed when HEAD moves after capture but before its tree is resolved", () => {
    const { repo, base } = fixture();
    write(join(repo, "docs", "note.md"), "candidate one\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate one"]);
    const prBody = body(base);
    let advanced = false;
    expect(() => inspectCandidate({
      cwd: repo, baseSha: base, prBody, liveMainResolver: () => base,
      afterHeadCapture: () => {
        advanced = true;
        write(join(repo, "docs", "note.md"), "candidate two\n");
        git(repo, ["add", "."]);
        git(repo, ["commit", "-qm", "candidate two"]);
      },
    })).toThrow(/supervisor_preflight:stale_evidence/);
    expect(advanced).toBe(true);
  });

  it("fails closed if Git status or branch changes before candidate return", () => {
    const dirty = fixture();
    write(join(dirty.repo, "docs", "note.md"), "candidate\n");
    git(dirty.repo, ["add", "."]);
    git(dirty.repo, ["commit", "-qm", "candidate"]);
    expect(() => inspectCandidate({
      cwd: dirty.repo, baseSha: dirty.base, prBody: body(dirty.base),
      liveMainResolver: () => dirty.base,
      afterHeadCapture: () => write(join(dirty.repo, "untracked.txt"), "race\n"),
    })).toThrow(/supervisor_preflight:stale_evidence/);

    const switched = fixture();
    write(join(switched.repo, "docs", "note.md"), "candidate\n");
    git(switched.repo, ["add", "."]);
    git(switched.repo, ["commit", "-qm", "candidate"]);
    expect(() => inspectCandidate({
      cwd: switched.repo, baseSha: switched.base, prBody: body(switched.base),
      liveMainResolver: () => switched.base,
      afterHeadCapture: () => git(switched.repo, ["checkout", "-qb", "work/proffera-raced"]),
    })).toThrow(/supervisor_preflight:stale_evidence/);
  });

  it("rejects malformed changed YAML outside workflows and excludes deleted YAML", () => {
    const { repo, base } = fixture({
      baseFiles: {
        ".github/workflows/valid.yml": "name: valid\\n",
        ".github/dependabot.yml": "version: 2\\n",
      },
    });
    write(join(repo, ".github", "dependabot.yml"), "version: [\\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "malformed dependabot YAML"]);
    const prBody = body(base);
    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody });
    const realYamlRunner = (command: string, args: string[], options: Record<string, unknown>) =>
      spawnSync(command, args, {
        ...options, env: { ...process.env, NODE_PATH: join(process.cwd(), "node_modules") },
      });
    const invalid = executeLocalValidation(candidate, repo, ["yaml"], {
      runner: realYamlRunner,
      revalidate: () => inspectFixture({ cwd: repo, baseSha: base, prBody }),
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.results).toMatchObject([{ id: "yaml", status: "failed" }]);

    git(repo, ["rm", ".github/dependabot.yml"]);
    git(repo, ["commit", "-qm", "remove invalid YAML"]);
    const afterDeletion = inspectFixture({ cwd: repo, baseSha: base, prBody });
    const deleted = executeLocalValidation(afterDeletion, repo, ["yaml"], {
      runner: realYamlRunner,
      revalidate: () => inspectFixture({ cwd: repo, baseSha: base, prBody }),
    });
    expect(deleted.ok).toBe(true);
  });

  it("fails closed rather than reporting targeted coverage for an unmapped code path", () => {
    const { repo, base } = fixture();
    write(join(repo, "src", "features", "unmapped.ts"), "export const example = 1;\\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "unmapped feature"]);
    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) });
    expect(() => executeLocalValidation(candidate, repo, ["targeted"], {
      runner: () => ({ status: 0, signal: null, stderr: "", stdout: "" }),
    })).toThrow(/supervisor_preflight:validation: no mapped targeted tests/);
  });

  it("includes the booking-reminders behavioral suite for affected workflow candidates", () => {
    const { repo, base } = fixture({
      baseFiles: { ".github/workflows/booking-reminders.yml": "name: existing\\n" },
    });
    write(join(repo, ".github", "workflows", "booking-reminders.yml"), "name: revised\\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "booking reminder workflow"]);
    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) });
    for (const id of ["targeted", "workflow-semantics"]) {
      const result = executeLocalValidation(candidate, repo, [id], {
        runner: (_command: string, args: string[]) => {
          expect(args).toContain("tests/company-directory-revalidation-scheduling.test.ts");
          return { status: 0, signal: null, stdout: "", stderr: "" };
        },
      });
      expect(result.ok).toBe(true);
    }
  });

  it("does not mistake a past CodeRabbit review for independent local pre-push proof", () => {
    const { repo, base } = fixture();
    write(join(repo, "docs", "note.md"), "candidate\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate"]);
    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) });
    const pr = {
      number: 941, state: "open", merged: false, body: body(base),
      user: { login: "ibboabdoli-ai" },
      head: { sha: candidate.head_sha, ref: candidate.branch,
        repo: { full_name: "ibboabdoli-ai/Proffera" } },
      base: { ref: "main", sha: base },
    };
    const review = (id: number, state: string, sha = candidate.head_sha) => ({
      id, state, commit_id: sha, user: { login: "coderabbitai[bot]" },
      submitted_at: "2026-10-08T10:" + String(id).padStart(2, "0") + ":00Z",
    });
    const blocked = evaluateGithubReviewSnapshot(candidate, pr,
      [[review(1, "CHANGES_REQUESTED"), review(2, "COMMENTED")]], 941);
    expect(blocked).toMatchObject({
      ok: false, retrieval_ok: true,
      remote_head_matches_candidate: true,
      coderabbit_changes_requested_unresolved: true,
      coderabbit_approved_exact_head: false,
      local_independent_review_verified: false, publication_ready: false,
    });
    const allowedToObserve = evaluateGithubReviewSnapshot(candidate, pr,
      [[review(1, "CHANGES_REQUESTED"), review(2, "COMMENTED"), review(3, "APPROVED")]], 941);
    expect(allowedToObserve).toMatchObject({
      coderabbit_approved_exact_head: true,
      coderabbit_changes_requested_unresolved: false,
      local_independent_review_verified: false, publication_ready: false,
    });
    const stale = evaluateGithubReviewSnapshot(candidate,
      { ...pr, head: { ...pr.head, sha: "a".repeat(40) } },
      [[review(1, "APPROVED")]], 941);
    expect(stale).toMatchObject({
      code: "local_candidate_not_on_remote_pr",
      remote_head_matches_candidate: false,
      coderabbit_approved_exact_head: false, publication_ready: false,
    });
    // A dismissed later CodeRabbit review is ambiguous: never revive an old approval.
    const dismissed = evaluateGithubReviewSnapshot(candidate, pr,
      [[review(1, "APPROVED"), review(2, "DISMISSED")]], 941);
    expect(dismissed).toMatchObject({
      coderabbit_approved_exact_head: false,
      coderabbit_changes_requested_unresolved: true,
      coderabbit_dismissal_requires_fresh_approval: true,
      publication_ready: false,
    });
    const dismissedAfterChanges = evaluateGithubReviewSnapshot(candidate, pr,
      [[review(1, "APPROVED"), review(2, "CHANGES_REQUESTED"), review(3, "DISMISSED")]], 941);
    expect(dismissedAfterChanges.coderabbit_approved_exact_head).toBe(false);
    const renewedApproval = evaluateGithubReviewSnapshot(candidate, pr,
      [[review(1, "APPROVED"), review(2, "CHANGES_REQUESTED"),
        review(3, "DISMISSED"), review(4, "APPROVED")]], 941);
    expect(renewedApproval).toMatchObject({
      coderabbit_approved_exact_head: true,
      coderabbit_changes_requested_unresolved: false,
      publication_ready: false,
    });
    expect(() => evaluateGithubReviewSnapshot(candidate,
      { ...pr, base: { ref: "main", sha: "f".repeat(40) } },
      [[review(1, "APPROVED")]], 941)).toThrow(/PR identity/);
    assertStableHostedReviewReads(pr, { ...pr }, [[review(1, "COMMENTED")]],
      [[review(1, "COMMENTED")]]);
    expect(() => assertStableHostedReviewReads(pr, { ...pr },
      [[review(1, "APPROVED")]], [[review(1, "APPROVED"), review(2, "CHANGES_REQUESTED")]]
    )).toThrow(/inventory changed/);
    expect(() => assertStableHostedReviewReads(pr, {
      ...pr, base: { ref: "main", sha: "f".repeat(40) },
    }, [[]], [[]])).toThrow(/inventory changed/);
    const wrongAuthor = evaluateGithubReviewSnapshot(candidate, pr,
      [[{ ...review(1, "APPROVED"), user: { login: "random-reviewer" } }]], 941);
    expect(wrongAuthor.coderabbit_approved_exact_head).toBe(false);
    const noReviews = evaluateGithubReviewSnapshot(candidate, pr, [[]], 941);
    expect(noReviews.coderabbit_changes_requested_unresolved).toBe(false);
    expect(noReviews.coderabbit_approved_exact_head).toBe(false);
    expect(() => evaluateGithubReviewSnapshot(candidate, { ...pr,
      user: { login: "malicious" },
    }, [], 941)).toThrow(/PR identity/);
    expect(() => evaluateGithubReviewSnapshot(candidate, { ...pr,
      body: body(base) + " tampered",
    }, [], 941)).toThrow(/body digest/);
    expect(() => evaluateGithubReviewSnapshot(candidate, pr,
      [[{ ...review(1, "APPROVED"), commit_id: "bogus" }]], 941)).toThrow(/malformed/);
  });

  it("blocks CI Autofix publication without trusted pre-push provenance before credentials", () => {
    const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "proffera-ci-autofix.yml"), "utf8");
    const publishIndex = workflow.indexOf("\n  publish:\n");
    expect(publishIndex).toBeGreaterThan(0);
    const remaining = workflow.slice(publishIndex + 1);
    const nextJob = remaining.search(/\n  [a-z][a-z0-9_-]*:\s*\n/);
    const publication = nextJob >= 0
      ? workflow.slice(publishIndex, publishIndex + 1 + nextJob)
      : workflow.slice(publishIndex);
    // The publication boundary must fail while no authenticated external reviewer exists.
    const gateName = "Require authenticated Supervisor provenance before autofix publication";
    const pushName = "Publish validated repair";
    const gateIndex = publication.indexOf(gateName);
    const pushIndex = publication.indexOf(pushName);
    expect(gateIndex).toBeGreaterThan(0);
    expect(pushIndex).toBeGreaterThan(gateIndex);
    const between = publication.slice(gateIndex, pushIndex);
    expect(between).not.toContain("PUSH_TOKEN");
    const code = between.match(/run: \|\r?\n((?:          .*\r?\n)+)/);
    expect(code).not.toBeNull();
    const script = code![1].split(/\r?\n/).map((line) => line.replace(/^          /, "")).join("\n");
    const executed = spawnSync("bash", ["-c", script], { encoding: "utf8" });
    expect(executed.status, executed.stderr).toBe(1);
    expect(executed.stdout).toContain("CI Autofix publication blocked");
    expect(publication.slice(0, pushIndex)).not.toMatch(/\bgit\s+.*\bpush\b/);
    expect(publication.slice(pushIndex)).toContain("PUSH_TOKEN:");
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
    expect(accepted.status, accepted.stderr).toBe(1);
    expect(JSON.parse(accepted.stdout)).toMatchObject({
      ok: false, evidence_consistent: true, publication_ready: false,
    });
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

    for (const malformedFinding of [
      { id: "P1", verified: "true", resolved: false },
      { id: "P1", resolved: false },
      { id: "P1", verified: false },
    ]) {
      const malformed = writeEvidence(reviewFixture.root, candidate, {
        findings: [malformedFinding],
      });
      const rejected = cli(reviewFixture.repo, [
        "verify",
        "--base", reviewFixture.base,
        "--pr-body", bodyPath,
        "--validation", malformed.validationPath,
        "--review", malformed.reviewPath,
      ]);
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain("review finding verification state is malformed");
    }

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
