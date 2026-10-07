import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function git(cwd: string, args: string[]) {
  const result = spawnSync("git", args, {cwd, encoding: "utf8"});
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

function evaluatePaths(paths: string[]) {
  const result = spawnSync(process.execPath, [
    join(process.cwd(), "scripts", "supervisor-authorization-policy.mjs"),
    "evaluate-paths",
  ], {
    encoding: "utf8",
    input: JSON.stringify({paths}),
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

function evaluatePullFiles(files: Array<{filename: string; previous_filename?: string}>) {
  const result = spawnSync(process.execPath, [
    join(process.cwd(), "scripts", "supervisor-authorization-policy.mjs"),
    "evaluate-pull-files",
  ], {
    encoding: "utf8",
    input: JSON.stringify({files}),
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

function qualifyPullFiles(expectedChangedFiles: number | string, files: Array<{filename: string; previous_filename?: string}>) {
  const result = spawnSync(process.execPath, [
    join(process.cwd(), "scripts", "supervisor-authorization-policy.mjs"),
    "qualify-pull-files",
  ], {
    encoding: "utf8",
    input: JSON.stringify({expected_changed_files: expectedChangedFiles, files}),
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe("canonical Supervisor authorization ownership", () => {
  it.each([
    "src/lib/auth.ts",
    "src/lib/auth-secret.ts",
    "src/lib/workspace-access.ts",
    "src/lib/workspace-access-selection.ts",
    "src/lib/stripe-runtime-config.ts",
    "src/app/api/example/route.ts",
  ])("requires human authorization for %s", (path) => {
    const decision = evaluatePaths([path]);
    expect(decision).toMatchObject({ok: true, allowed: false, code: "repository_paths_require_human"});
    expect(decision.matches.some((match: {path: string}) => match.path === path)).toBe(true);
  });

  it("keeps ordinary application files outside the human-authorization boundary", () => {
    expect(evaluatePaths(["src/components/example.tsx"]))
      .toMatchObject({ok: true, allowed: true, matches: []});
  });

  it("treats both rename endpoints as authorization evidence", () => {
    const protectedRename = evaluatePullFiles([{
      filename: "src/lib/renamed-auth.ts",
      previous_filename: "src/lib/auth.ts",
    }]);
    expect(protectedRename).toMatchObject({
      ok: true,
      allowed: false,
      code: "repository_paths_require_human",
      paths: ["src/lib/renamed-auth.ts", "src/lib/auth.ts"],
    });
    expect(protectedRename.matches.some((match: {path: string}) => match.path === "src/lib/auth.ts")).toBe(true);

    const ordinaryRename = evaluatePullFiles([{
      filename: "src/components/renamed.tsx",
      previous_filename: "src/components/example.tsx",
    }]);
    expect(ordinaryRename).toMatchObject({
      ok: true,
      allowed: true,
      matches: [],
      paths: ["src/components/renamed.tsx", "src/components/example.tsx"],
    });
  });

  it("fails closed on malformed or empty pull-request file evidence", () => {
    const empty = spawnSync(process.execPath, [
      join(process.cwd(), "scripts", "supervisor-authorization-policy.mjs"),
      "evaluate-pull-files",
    ], {
      encoding: "utf8",
      input: JSON.stringify({files: []}),
    });
    expect(empty.status).toBe(1);
    expect(JSON.parse(empty.stdout)).toMatchObject({
      ok: false,
      allowed: false,
      code: "repository_path_policy_invalid",
      paths: [],
    });
  });

  it("rejects a CI Autofix candidate touching auth even when auth was already changed by the PR", () => {
    const dir = mkdtempSync(join(tmpdir(), "proffera-auth-policy-"));
    const repo = join(dir, "repo");
    const artifactDir = join(dir, "artifact");
    mkdirSync(repo);
    mkdirSync(artifactDir);
    try {
      git(repo, ["init", "-q"]);
      git(repo, ["config", "user.name", "Fixture"]);
      git(repo, ["config", "user.email", "fixture@example.invalid"]);
      mkdirSync(join(repo, "src", "lib"), {recursive: true});
      const target = join(repo, "src", "lib", "auth.ts");
      writeFileSync(target, "export const value = 1;\n");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-qm", "base"]);
      const base = git(repo, ["rev-parse", "HEAD"]);
      writeFileSync(target, "export const value = 2;\n");
      git(repo, ["commit", "-qam", "pr head"]);
      const head = git(repo, ["rev-parse", "HEAD"]);

      writeFileSync(target, "export const value = 3;\n");
      const patch = spawnSync("git", ["diff", "--binary", "HEAD"], {cwd: repo, encoding: "utf8"});
      expect(patch.status, patch.stderr).toBe(0);
      expect(patch.stdout).toContain("src/lib/auth.ts");
      git(repo, ["checkout", "--", "src/lib/auth.ts"]);

      const patchPath = join(artifactDir, "repair.patch");
      writeFileSync(patchPath, patch.stdout);
      const patchSha = createHash("sha256").update(patch.stdout).digest("hex");
      const manifest = {
        version: 1,
        repository: "ibboabdoli-ai/Proffera",
        pr_number: 940,
        head,
        base_sha: base,
        run_id: 50,
        run_attempt: 1,
        source_run_id: 40,
        source_run_attempt: 1,
        patch_sha256: patchSha,
      };
      writeFileSync(join(artifactDir, "manifest.json"), JSON.stringify(manifest));

      const candidate = spawnSync(process.execPath, [
        join(process.cwd(), "scripts", "supervisor-ci-autofix-candidate.mjs"),
        "prepare",
      ], {
        cwd: repo,
        encoding: "utf8",
        env: {
          ...process.env,
          REPOSITORY: manifest.repository,
          PR_NUMBER: String(manifest.pr_number),
          EXPECTED_HEAD: manifest.head,
          BASE_SHA: manifest.base_sha,
          ADMITTED_RUN_ID: String(manifest.run_id),
          ADMITTED_RUN_ATTEMPT: String(manifest.run_attempt),
          SOURCE_RUN_ID: String(manifest.source_run_id),
          SOURCE_RUN_ATTEMPT: String(manifest.source_run_attempt),
          EXPECTED_PATCH_SHA256: manifest.patch_sha256,
          CANDIDATE_DIR: artifactDir,
          BLOCKED_PATH_PATTERNS: ".github/*",
        },
      });
      expect(candidate.status).toBe(1);
      expect(candidate.stderr).toContain("human_authorization_path");
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });


  it("rejects a Supervisor control helper through the lane-specific control-plane boundary", () => {
    const dir = mkdtempSync(join(tmpdir(), "proffera-control-policy-"));
    const repo = join(dir, "repo");
    const artifactDir = join(dir, "artifact");
    mkdirSync(repo);
    mkdirSync(artifactDir);
    try {
      git(repo, ["init", "-q"]);
      git(repo, ["config", "user.name", "Fixture"]);
      git(repo, ["config", "user.email", "fixture@example.invalid"]);
      mkdirSync(join(repo, "scripts"), {recursive: true});
      const target = join(repo, "scripts", "supervisor-failure-memory.mjs");
      writeFileSync(target, "export const value = 1;\n");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-qm", "base"]);
      const base = git(repo, ["rev-parse", "HEAD"]);
      writeFileSync(target, "export const value = 2;\n");
      git(repo, ["commit", "-qam", "pr head"]);
      const head = git(repo, ["rev-parse", "HEAD"]);

      writeFileSync(target, "export const value = 3;\n");
      const patch = spawnSync("git", ["diff", "--binary", "HEAD"], {cwd: repo, encoding: "utf8"});
      expect(patch.status, patch.stderr).toBe(0);
      git(repo, ["checkout", "--", "scripts/supervisor-failure-memory.mjs"]);

      const patchPath = join(artifactDir, "repair.patch");
      writeFileSync(patchPath, patch.stdout);
      const patchSha = createHash("sha256").update(patch.stdout).digest("hex");
      const manifest = {
        version: 1,
        repository: "ibboabdoli-ai/Proffera",
        pr_number: 940,
        head,
        base_sha: base,
        run_id: 50,
        run_attempt: 1,
        source_run_id: 40,
        source_run_attempt: 1,
        patch_sha256: patchSha,
      };
      writeFileSync(join(artifactDir, "manifest.json"), JSON.stringify(manifest));

      const candidate = spawnSync(process.execPath, [
        join(process.cwd(), "scripts", "supervisor-ci-autofix-candidate.mjs"),
        "prepare",
      ], {
        cwd: repo,
        encoding: "utf8",
        env: {
          ...process.env,
          REPOSITORY: manifest.repository,
          PR_NUMBER: String(manifest.pr_number),
          EXPECTED_HEAD: manifest.head,
          BASE_SHA: manifest.base_sha,
          ADMITTED_RUN_ID: String(manifest.run_id),
          ADMITTED_RUN_ATTEMPT: String(manifest.run_attempt),
          SOURCE_RUN_ID: String(manifest.source_run_id),
          SOURCE_RUN_ATTEMPT: String(manifest.source_run_attempt),
          EXPECTED_PATCH_SHA256: manifest.patch_sha256,
          CANDIDATE_DIR: artifactDir,
          BLOCKED_PATH_PATTERNS: "scripts/supervisor-*.mjs",
        },
      });
      expect(candidate.status).toBe(1);
      expect(candidate.stderr).toContain("blocked_path");
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  it("executes the real qualification decision for protected, ordinary, empty, and incomplete pull-request evidence", () => {
    const protectedDecision = qualifyPullFiles(1, [{filename: "src/lib/auth.ts"}]);
    expect(protectedDecision).toMatchObject({
      ok: true,
      eligible: false,
      allowed: false,
      code: "repository_paths_require_human",
      paths: ["src/lib/auth.ts"],
    });

    const protectedRename = qualifyPullFiles(1, [{
      filename: "src/lib/renamed-auth.ts",
      previous_filename: "src/lib/auth.ts",
    }]);
    expect(protectedRename).toMatchObject({
      ok: true,
      eligible: false,
      allowed: false,
      code: "repository_paths_require_human",
      paths: ["src/lib/renamed-auth.ts", "src/lib/auth.ts"],
    });

    const ordinaryDecision = qualifyPullFiles("1", [{filename: "src/components/example.tsx"}]);
    expect(ordinaryDecision).toMatchObject({
      ok: true,
      eligible: true,
      allowed: true,
      code: "repository_paths_authorized",
      paths: ["src/components/example.tsx"],
    });

    expect(qualifyPullFiles(0, [])).toMatchObject({
      ok: true,
      eligible: false,
      code: "pull_request_has_no_changed_files",
      paths: [],
    });
    expect(qualifyPullFiles(2, [{filename: "src/components/example.tsx"}])).toMatchObject({
      ok: true,
      eligible: false,
      code: "pull_request_file_evidence_incomplete",
      paths: [],
    });

    const workflow = readFileSync(new URL("../.github/workflows/proffera-ci-autofix.yml", import.meta.url), "utf8");
    expect(workflow).toContain("    scripts/supervisor-*.mjs");
    expect(workflow).toContain("for policy_file in supervisor-authorization-policy.mjs supervisor-worker-handoff.mjs; do");
    expect(workflow).toContain('repos/$REPOSITORY/pulls/$pr_number/files?per_page=100');
    expect(workflow).toContain('node "$trusted_policy_dir/supervisor-authorization-policy.mjs" qualify-pull-files');
    expect(workflow).toContain('.ok == true and .eligible == true');
    expect(workflow).toContain('expected_changed_files="$(jq -r \'.changed_files // empty\' <<< "$pr_json")"');
    expect(workflow).toContain('changed_files="$(jq -r \'.paths[]\' <<< "$qualification")"');
    expect(workflow.match(/contents\/scripts\/supervisor-authorization-policy\.mjs\?ref=\$GITHUB_WORKFLOW_SHA/g))
      .toHaveLength(2);
    const candidate = readFileSync(new URL("../scripts/supervisor-ci-autofix-candidate.mjs", import.meta.url), "utf8");
    expect(candidate).toContain('fileURLToPath(new URL("./supervisor-authorization-policy.mjs", import.meta.url))');
    expect(candidate).toContain('[helper, "evaluate-paths"]');
    expect(candidate).toContain("enforceHumanAuthorization(paths)");
    const worker = readFileSync(new URL("../scripts/supervisor-worker-handoff.mjs", import.meta.url), "utf8");
    expect(worker).toContain("PLANNER_HUMAN_AUTH_OWNERSHIP");
    expect(workflow.match(/contents\/scripts\/supervisor-worker-handoff\.mjs\?ref=\$GITHUB_WORKFLOW_SHA/g))
      .toHaveLength(2);
  });
});
