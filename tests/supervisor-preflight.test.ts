import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync } from "node:fs";
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

function cli(repo: string, args: string[], liveMain?: string) {
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
      PREFLIGHT_TEST_MAIN_SHA: liveMain ?? base,
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
  it("keeps Next build and dev generated outputs outside candidate Git identity", () => {
    const root = process.cwd();
    for (const generated of [".next/build/cache", "next-env.d.ts"]) {
      const ignored = spawnSync("git", ["check-ignore", "--quiet", generated], {cwd: root, encoding: "utf8"});
      expect(ignored.status, ignored.stderr).toBe(0);
    }
    const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "next-env.d.ts"], {cwd: root, encoding: "utf8"});
    expect(tracked.status).not.toBe(0);
    const config = JSON.parse(readFileSync(join(root, "tsconfig.json"), "utf8"));
    expect(config.include).toContain(".next/dev/types/**/*.ts");
  });

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

  it("accepts a symlinked path to the actual Git worktree root", () => {
    const { root, repo, base } = fixture();
    const alias = join(root, "repo-alias");
    try {
      symlinkSync(repo, alias, "dir");
    } catch (error) {
      // Windows without symlink privilege does not supply this facility.
      if (process.platform === "win32") return;
      throw error;
    }
    write(join(repo, "docs", "note.md"), "candidate\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate"]);
    expect(inspectFixture({ cwd: alias, baseSha: base, prBody: body(base) }).head_sha)
      .toBe(git(repo, ["rev-parse", "HEAD"]).stdout.trim());
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

  it("rejects embedded origin credentials without ever printing them in errors", () => {
    const { repo, base } = fixture();
    write(join(repo, "docs", "note.md"), "candidate\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "candidate"]);

    const fakeSecret = "FAKE_CREDENTIAL_MUST_NEVER_APPEAR_IN_ERRORS";
    for (const remote of [
      "https://x-access-token:" + fakeSecret + "@github.com/ibboabdoli-ai/Proffera.git",
      "https://x-access-token:" + fakeSecret + "@wrong.invalid/ibboabdoli-ai/Proffera.git",
      "https://x-access-token:" + fakeSecret + "@github.com/ibboabdoli-ai/Proffera/extra.git",
      "https://x-access-token:" + fakeSecret + "@github.com/ibboabdoli-ai/Proffera.git?token=" + fakeSecret,
      "https://x-access-token:" + fakeSecret + "@github.com/ibboabdoli-ai/Proffera.git#token",
      "ssh://git:" + fakeSecret + "@github.com/ibboabdoli-ai/Proffera.git",
      "https://x-access-token:" + fakeSecret + "@",
    ]) {
      git(repo, ["remote", "set-url", "origin", remote]);
      let message = "";
      try {
        inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) });
      } catch (error) {
        message = String(error);
      }
      expect(message).toMatch(/supervisor_preflight:repository/);
      expect(message).not.toContain(fakeSecret);
      expect(message).not.toContain("x-access-token");
    }
    git(repo, ["remote", "set-url", "origin", "https://github.com/ibboabdoli-ai/Proffera.git"]);
    expect(inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) }).repository)
      .toBe("ibboabdoli-ai/Proffera");
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
    write(join(repo, "node_modules", "next", "dist", "bin", "next"),
      'process.stdout.write("fixture-typegen-executed\\n");\n');
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

    write(join(repo, "node_modules", "next", "dist", "bin", "next"),
      'process.stdout.write("fixture-typegen-executed\\n");\n');
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

  it("keeps v1 Validation Evidence compatible while rejecting contradictory two-step typecheck",()=>{
    const f=fixture({baseFiles:{"AGENTS.md":"baseline\n"}});
    write(join(f.repo,"AGENTS.md"),"updated\n");
    git(f.repo,["add","."]);git(f.repo,["commit","-qm","candidate"]);
    const candidate=inspectFixture({cwd:f.repo,baseSha:f.base,prBody:body(f.base)});
    const bodyPath=writeBody(f.root,body(f.base));
    const {validationPath,reviewPath}=writeEvidence(f.root,candidate);
    const verify=()=>cli(f.repo,["verify","--base",f.base,"--pr-body",bodyPath,
      "--validation",validationPath,"--review",reviewPath]);
    const old=verify();
    expect(old.status).toBe(1);
    expect(JSON.parse(old.stdout).code).toBe("evidence_provenance_unverified");
    const evidence=JSON.parse(readFileSync(validationPath,"utf8"));
    const result=evidence.results.find((r:{id:string})=>r.id==="typecheck");
    expect(result).toBeDefined();
    result.exit_code=0;
    result.steps=[
      {id:"next-typegen",status:"passed",exit_code:0,error:null,command:"node next typegen"},
      {id:"typescript-noemit",status:"failed",exit_code:1,error:null,command:"node tsc --noEmit"},
    ];
    writeFileSync(validationPath,JSON.stringify(evidence));
    const rejected=verify();
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain("typecheck requires two successful ordered steps");
    result.steps[1].status="passed";
    result.steps[1].exit_code=0;
    writeFileSync(validationPath,JSON.stringify(evidence));
    const consistent=verify();
    expect(consistent.status).toBe(1);
    expect(JSON.parse(consistent.stdout).code).toBe("evidence_provenance_unverified");
  });

  it("fails closed if run-checks mutates the PR body during validation", () => {
    const { root, repo, base } = fixture({ baseFiles: { "AGENTS.md": "base\n" } });
    write(join(repo, "AGENTS.md"), "candidate\n");
    const bodyPath = writeBody(root, body(base));
    write(join(repo, "node_modules", "next", "dist", "bin", "next"),
      'process.stdout.write("fixture-typegen-executed\\n");\n');
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

  it("maps the PR941 Worker strategy-admission suite into required targeted validation", () => {
    const { repo, base } = fixture();
    write(join(repo, "tests", "pr941-worker-strategy-admission.test.ts"),
      'import { it } from "vitest"; it("registered", () => {});\n');
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "add PR941 strategy admission regression"]);
    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) });
    for (const id of ["targeted"]) {
      let executed = false;
      const result = executeLocalValidation(candidate, repo, [id], {
        runner: (_command: string, args: string[]) => {
          expect(args).toContain("tests/pr941-worker-strategy-admission.test.ts");
          expect(args).toContain("tests/supervisor-worker-handoff.test.ts");
          executed = true;
          return { status: 0, signal: null, stdout: "", stderr: "" };
        },
      });
      expect(executed).toBe(true);
      expect(result.ok).toBe(true);
    }
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

  it("runs both worker-handoff and CI Autofix candidate suites for mapped Supervisor changes", () => {
    const { repo, base } = fixture();
    write(join(repo, "scripts", "supervisor-worker-handoff.mjs"), "export const value = 1;\\n");
    write(join(repo, "scripts", "supervisor-ci-autofix-candidate.mjs"), "export const value = 2;\\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "change both mapped Supervisor helpers"]);
    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) });
    const observed = executeLocalValidation(candidate, repo, ["targeted"], {
      runner: (_command: string, args: string[]) => {
        expect(args).toContain("tests/supervisor-worker-handoff.test.ts");
        expect(args).toContain("tests/supervisor-ci-autofix-candidate.test.ts");
        return { status: 0, signal: null, stdout: "", stderr: "" };
      },
    });
    expect(observed.ok).toBe(true);
  });

  it("gives slow targeted Worker suites enough time while still failing closed on timeout", () => {
    const { repo, base } = fixture();
    write(join(repo, "scripts", "supervisor-worker-handoff.mjs"), "export const value = 1;\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "change Supervisor Worker helper"]);
    const candidate = inspectFixture({ cwd: repo, baseSha: base, prBody: body(base) });
    expect(candidate.required_validation_checks).toContain("targeted");

    const passed = executeLocalValidation(candidate, repo, ["targeted"], {
      runner: (_command: string, args: string[], options: { timeout: number }) => {
        expect(args).toContain("tests/supervisor-worker-handoff.test.ts");
        expect(options.timeout).toBeGreaterThanOrEqual(600000);
        return { status: 0, signal: null, stdout: "", stderr: "" };
      },
    });
    expect(passed.ok).toBe(true);

    const timedOut = executeLocalValidation(candidate, repo, ["targeted"], {
      runner: () => ({
        status: 143, signal: null, error: new Error("ETIMEDOUT"), stdout: "", stderr: "",
      }),
    });
    expect(timedOut.ok).toBe(false);
    expect(timedOut.results[0]?.status).toBe("failed");
    expect(timedOut.missing_checks).toContain("targeted");
  });

  it("maps all B4 pending, strategy, workflow, and evidence paths to executable suites", () => {
    const mapped: Record<string,string> = {
      "scripts/supervisor-owner-push-pending.mjs":"tests/supervisor-owner-push-pending.test.ts",
      "scripts/supervisor-ci-autofix-strategy-memory.mjs":"tests/supervisor-ci-autofix-strategy-history.test.ts",
      "scripts/supervisor-review-repair-strategy-memory.mjs":"tests/supervisor-review-repair-strategy-history.test.ts",
      "tests/supervisor-review-repair-strategy-history.test.ts":"tests/supervisor-review-repair-strategy-history.test.ts",
      ".github/workflows/ci.yml":"tests/github-workflow-yaml.test.ts",
      ".github/workflows/proffera-automerge.yml":"tests/proffera-standing-automerge.test.ts",
      ".github/workflows/proffera-final-gate-wakeup.yml":"tests/proffera-final-gate-wakeup.test.ts",
      "tests/ci-postgres-image-preload.test.ts":"tests/ci-postgres-image-preload.test.ts",
      "tests/proffera-final-gate-wakeup.test.ts":"tests/proffera-final-gate-wakeup.test.ts",
      "tests/proffera-standing-automerge.test.ts":"tests/proffera-standing-automerge.test.ts",
      "tests/tooling-safety-contract.test.ts":"tests/tooling-safety-contract.test.ts",
      ".github/workflows/supervisor-planner.yml":"tests/supervisor-control-plane-v2.test.ts",
      "tests/supervisor-owner-push-pending.test.ts":"tests/supervisor-owner-push-pending.test.ts",
      "tests/supervisor-model-launch-boundary.test.ts":"tests/supervisor-model-launch-boundary.test.ts",
      "scripts/supervisor-b4-exclusive-reservation.mjs":"tests/supervisor-b4-exclusive-reservation.test.ts",
      "tests/supervisor-b4-exclusive-reservation.test.ts":"tests/supervisor-b4-exclusive-reservation.test.ts",
      "tests/supervisor-owner-handoff.test.ts":"tests/supervisor-owner-handoff.test.ts",
      "tests/supervisor-ci-autofix-strategy-history.test.ts":"tests/supervisor-ci-autofix-strategy-history.test.ts",
      "tests/supervisor-control-plane-v2.test.ts":"tests/supervisor-control-plane-v2.test.ts",
      "tests/supervisor-worker-strategy-history.test.ts":"tests/supervisor-worker-strategy-history.test.ts",
    };
    const {repo,base}=fixture();
    for (const path of Object.keys(mapped)) {
      write(join(repo,...path.split("/")), "export const candidate = 1;\n");
    }
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "B4 mapped candidates"]);
    const candidate=inspectFixture({cwd:repo,baseSha:base,prBody:body(base)});
    for(const id of ["targeted","workflow-semantics"]){
      const result=executeLocalValidation(candidate,repo,[id],{
        runner: (_command:string,args:string[]) => {
          for(const suite of new Set([...Object.values(mapped), "tests/ci-postgres-image-preload.test.ts"])) {
            expect(args).toContain(suite);
          }
          return {status:0,signal:null,stdout:"",stderr:""};
        },
      });
      expect(result.ok).toBe(true);
    }
  });
  it.each([
    [".github/workflows/proffera-ci-autofix.yml", [
      "tests/supervisor-owner-handoff.test.ts",
      "tests/supervisor-owner-push-pending.test.ts",
      "tests/supervisor-ci-autofix-strategy-history.test.ts",
      "tests/supervisor-control-plane-v2.test.ts",
    ]],
    [".github/workflows/supervisor-review-repair.yml", [
      "tests/supervisor-review-repair-strategy-history.test.ts",
      "tests/supervisor-owner-handoff.test.ts",
      "tests/supervisor-owner-push-pending.test.ts",
      "tests/supervisor-control-plane-v2.test.ts",
    ]],
    [".github/workflows/supervisor-worker-handoff.yml", [
      "tests/supervisor-worker-strategy-history.test.ts",
      "tests/supervisor-owner-handoff.test.ts",
      "tests/supervisor-control-plane-v2.test.ts",
    ]],
    [".github/workflows/ci.yml", ["tests/tooling-safety-contract.test.ts"]],
    [".github/workflows/proffera-automerge.yml", ["tests/supervisor-control-plane-v2.test.ts"]],
    [".github/workflows/proffera-final-gate-wakeup.yml", ["tests/supervisor-control-plane-v2.test.ts"]],
  ] as [string, string[]][])("selects every linked workflow-contract suite for %s", (changedPath, suites) => {
    const {repo,base}=fixture();
    write(join(repo,...changedPath.split("/")), "name: isolated workflow\n");
    git(repo,["add","."]);
    git(repo,["commit","-qm","isolated workflow mapping"]);
    const candidate=inspectFixture({cwd:repo,baseSha:base,prBody:body(base)});
    for(const check of ["targeted","workflow-semantics"].filter(id=>candidate.required_validation_checks.includes(id))){
      const result=executeLocalValidation(candidate,repo,[check],{
        runner:(_command:string,args:string[])=>{
          for(const suite of suites)expect(args).toContain(suite);
          return {status:0,signal:null,stdout:"",stderr:""};
        },
      });
      expect(result.ok).toBe(true);
    }
  });

  it.each([
    "tests/supervisor-model-launch-boundary.test.ts",
    ".github/workflows/proffera-ci-autofix.yml",
    ".github/workflows/supervisor-review-repair.yml",
  ])("selects the model-launch boundary suite for %s", (changedPath) => {
    const {repo,base}=fixture();
    write(join(repo,...changedPath.split("/")), "export const candidate = 1;\n");
    git(repo,["add","."]);
    git(repo,["commit","-qm","model boundary candidate"]);
    const candidate=inspectFixture({cwd:repo,baseSha:base,prBody:body(base)});
    expect(candidate.required_validation_checks).toContain("targeted");
    const selected=["targeted","workflow-semantics"].filter(id=>candidate.required_validation_checks.includes(id));
    if(changedPath.startsWith(".github/workflows/"))expect(selected).toContain("workflow-semantics");
    for(const id of selected){
      const result=executeLocalValidation(candidate,repo,[id],{
        runner:(_command:string,args:string[])=>{
          expect(args).toContain("tests/supervisor-model-launch-boundary.test.ts");
          return {status:0,signal:null,stdout:"",stderr:""};
        },
      });
      expect(result.ok).toBe(true);
    }
  });

  it("maps package.json edits to actual executable tooling, scope and preflight suites",()=>{
    const f=fixture({baseFiles:{"package.json":"{\"scripts\":{}}\n"}});
    write(join(f.repo,"package.json"),'{"scripts":{"typecheck":"next typegen && tsc --noEmit"}}\n');
    git(f.repo,["add","."]);git(f.repo,["commit","-qm","package scripts update"]);
    const candidate=inspectFixture({cwd:f.repo,baseSha:f.base,prBody:body(f.base)});
    expect(candidate.required_validation_checks).toContain("targeted");
    const required=["tests/supervisor-preflight.test.ts","tests/ci-scope-plan.test.ts",
      "tests/tooling-safety-contract.test.ts"];
    const ids=["targeted","workflow-semantics"].filter(id=>candidate.required_validation_checks.includes(id));
    let calls=0;
    for(const id of ids){
      const result=executeLocalValidation(candidate,f.repo,[id],{runner:(_bin:string,args:string[])=>{
        calls++;
        for(const suite of required)expect(args).toContain(suite);
        return {status:0,signal:null,stderr:"",stdout:""};
      }});
      expect(result.ok).toBe(true);
    }
    expect(calls).toBe(ids.length);
    write(join(f.repo,"src","unmapped-feature.ts"),"export const broken=true;\n");
    git(f.repo,["add","."]);git(f.repo,["commit","-qm","unmapped path"]);
    const unmapped=inspectFixture({cwd:f.repo,baseSha:f.base,prBody:body(f.base)});
    expect(()=>executeLocalValidation(unmapped,f.repo,["targeted"],{runner:()=>{
      throw new Error("must not execute unmapped paths");
    }})).toThrow(/no mapped targeted tests/);
  });

  it("traces sequential typegen and tsc with fail-fast receipt under one typecheck ID",()=>{
    const f=fixture({baseFiles:{"AGENTS.md":"base\n"}});
    write(join(f.repo,"AGENTS.md"),"changed\n");
    git(f.repo,["add","."]);git(f.repo,["commit","-qm","typecheck"]);
    const candidate=inspectFixture({cwd:f.repo,baseSha:f.base,prBody:body(f.base)});
    for(const [statuses,expected] of [
      [[0,0],"passed"],[[7],"failed"],[[0,9],"failed"],[[null],"failed"],
    ] as const){
      const invoked:string[]=[];
      const receipt=executeLocalValidation(candidate,f.repo,["typecheck"],{
        runner:(_bin:string,args:string[])=>{
          invoked.push(args.join(" "));
          const code=statuses[invoked.length-1];
          return {status:code,signal:null,stderr:code===0?"":"error",stdout:"",
            error:code===null?new Error("ETIMEDOUT"):undefined};
        },
      });
      expect(receipt.results).toHaveLength(1);
      expect(receipt.results[0].status).toBe(expected);
      expect(receipt.results[0].steps.map((s:{id:string})=>s.id)).toEqual(statuses.length===1
        ?["next-typegen"]:["next-typegen","typescript-noemit"]);
      expect(invoked[0]).toContain("node_modules/next/dist/bin/next typegen");
      if(statuses.length===2)expect(invoked[1]).toContain("node_modules/typescript/bin/tsc --noEmit");
      expect(receipt.ok).toBe(expected==="passed");
    }
  });

  it("selects both Review Repair behavioral history and control-plane suites for the strategy source", () => {
    const {repo,base}=fixture();
    write(join(repo,"scripts","supervisor-review-repair-strategy-memory.mjs"),"export const candidate = 1;\n");
    git(repo,["add","."]);
    git(repo,["commit","-qm","review strategy candidate"]);
    const sourceCandidate=inspectFixture({cwd:repo,baseSha:base,prBody:body(base)});
    const runner=(_command:string,args:string[]) => {
      expect(args).toContain("tests/supervisor-review-repair-strategy-history.test.ts");
      expect(args).toContain("tests/supervisor-control-plane-v2.test.ts");
      return {status:0,signal:null,stdout:"",stderr:""};
    };
    expect(executeLocalValidation(sourceCandidate,repo,["targeted"],{runner}).ok).toBe(true);
    // The workflow itself additionally selects the workflow-semantics scope.
    write(join(repo,".github","workflows","supervisor-review-repair.yml"),"name: Review Repair\n");
    git(repo,["add","."]);
    git(repo,["commit","-qm","workflow-semantics candidate"]);
    const workflowCandidate=inspectFixture({cwd:repo,baseSha:base,prBody:body(base)});
    expect(executeLocalValidation(workflowCandidate,repo,["workflow-semantics"],{runner}).ok).toBe(true);
  });


  it("uses the hosted Linux python3 executable for discovery-worker without skipping failures",()=>{
    const f=fixture({baseFiles:{"AGENTS.md":"base\\n"}});
    write(join(f.repo,"AGENTS.md"),"changed\\n");
    git(f.repo,["add","."]);git(f.repo,["commit","-qm","change required supervisor control"]);
    const candidate=inspectFixture({cwd:f.repo,baseSha:f.base,prBody:body(f.base)});
    expect(candidate.required_validation_checks).toContain("discovery-worker");
    const result=executeLocalValidation(candidate,f.repo,["discovery-worker"],{
      runner:(command:string,args:string[])=>{
        expect(command).toBe("python3");
        expect(args).toEqual(["tests/test_company_directory_discovery_worker.py"]);
        return {status:0,signal:null,stdout:"",stderr:""};
      }
    });
    expect(result.ok).toBe(true);
    const failure=executeLocalValidation(candidate,f.repo,["discovery-worker"],{
      runner:()=>({status:null,signal:null,stdout:"",stderr:"",error:new Error("ENOENT")})
    });
    expect(failure.ok).toBe(false);
  });

  it("stages Worker and Review Repair only as owner-push artifacts, never automatic publication", () => {
    for (const filename of ["supervisor-worker-handoff.yml", "supervisor-review-repair.yml"]) {
      const workflow = readFileSync(join(process.cwd(), ".github", "workflows", filename), "utf8");
      const pub = workflow.slice(workflow.indexOf("\n  publish:\n"), workflow.indexOf("\n  record:\n") > 0
        ? workflow.indexOf("\n  record:\n") : workflow.length);
      expect(pub, filename).toContain("git bundle create");
      expect(pub, filename).toContain("git bundle verify");
      expect(pub, filename).toContain("upload-artifact@");
      expect(pub, filename).not.toMatch(/\bgit\s+push\b/);
      expect(pub, filename).not.toContain("PUSH_TOKEN:");
      expect(pub, filename).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
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
    // A legitimate unsubmitted draft has no submitted_at; it cannot veto an exact-head review.
    const withPending = evaluateGithubReviewSnapshot(candidate, pr,
      [[{ ...review(7, "PENDING"), submitted_at: null, user: {login: "other-reviewer"} }, review(8, "APPROVED")]], 941);
    expect(withPending).toMatchObject({
      coderabbit_approved_exact_head: true, publication_ready: false,
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

  it("stages CI Autofix without token-bearing publication or fabricated success", () => {
    const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "proffera-ci-autofix.yml"), "utf8");
    const pub = workflow.slice(workflow.indexOf("\n  publish:\n"), workflow.indexOf("\n  record:\n"));
    expect(pub).toContain("Stage CI Autofix commit for owner push");
    expect(pub).toContain("git bundle create");
    expect(pub).toContain("Upload CI Autofix owner handoff");
    expect(pub).toContain("published=no");
    expect(pub).not.toMatch(/\bgit\s+push\b/);
    expect(pub).not.toContain("PUSH_TOKEN:");
    expect(pub).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
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


describe("owner-authorized PR-push handoff", () => {
  it("reports a checked candidate without fabricating independent review, push or merge authority", () => {
    const f = fixture();
    write(join(f.repo, "docs", "change.md"), "local candidate\n");
    git(f.repo, ["add", "."]);
    git(f.repo, ["commit", "-qm", "candidate"]);
    const prBody = writeBody(f.root, body(f.base));
    const result = cli(f.repo, ["owner-handoff", "--base", f.base, "--pr-body", prBody]);
    expect(result.status, result.stderr).toBe(0);
    const receipt = JSON.parse(result.stdout);
    expect(receipt.phase).toBe("pre_push_local_candidate");
    expect(receipt.local_identity_checked).toBe(true);
    expect(receipt.candidate.head_sha).toBe(git(f.repo, ["rev-parse", "HEAD"]).stdout.trim());
    expect(receipt).toMatchObject({
      validation_execution_verified: false, independent_review_verified: false,
      owner_push_authorized: false, publication_ready: false, merge_authorized: false,
    });
    expect(receipt.required_validation_checks.length).toBeGreaterThan(0);
  });

  it("refuses a dirty or stale local handoff instead of authorizing a push", () => {
    const f = fixture();
    write(join(f.repo, "docs", "change.md"), "local candidate\n");
    git(f.repo, ["add", "."]);
    git(f.repo, ["commit", "-qm", "candidate"]);
    const prBody = writeBody(f.root, body(f.base));
    write(join(f.repo, "docs", "change.md"), "unsaved edits\n");
    const dirty = cli(f.repo, ["owner-handoff", "--base", f.base, "--pr-body", prBody]);
    expect(dirty.status).toBe(1);
    expect(dirty.stderr).toContain("candidate must be fully committed");
    git(f.repo, ["checkout", "--", "docs/change.md"]);
    const stale = cli(f.repo, ["owner-handoff", "--base", f.base, "--pr-body", prBody], "f".repeat(40));
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("supervisor_preflight:base");
    expect(stale.stderr).toContain("is stale or not current main");
  });
});
