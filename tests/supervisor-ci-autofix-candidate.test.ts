import {afterEach, describe, expect, it} from "vitest";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createRequire} from "node:module";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import {prepareCiAutofixCandidate} from "../scripts/supervisor-ci-autofix-candidate.mjs";

const workflow = createRequire(import.meta.url)("js-yaml").load(readFileSync(new URL("../.github/workflows/proffera-ci-autofix.yml", import.meta.url), "utf8"));
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true}); });
const run = (job: string, name: string) => workflow.jobs[job].steps.find((step: {name: string}) => step.name === name).run;
const git = (cwd: string, ...args: string[]) => {
  const result = spawnSync("git", args, {cwd, encoding: "utf8"});
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ci-autofix-isolation-")); roots.push(root);
  const trusted = join(root, "trusted"); mkdirSync(trusted);
  git(trusted, "init", "-q"); git(trusted, "config", "user.name", "Fixture"); git(trusted, "config", "user.email", "fixture@example.invalid");
  mkdirSync(join(trusted, "tests")); mkdirSync(join(trusted, ".github", "workflows"), {recursive: true});
  writeFileSync(join(trusted, "tests", "allowed.ts"), "base\n");
  writeFileSync(join(trusted, ".github", "workflows", "protected.yml"), "protected\n");
  writeFileSync(join(trusted, "unrelated.txt"), "unchanged\n");
  git(trusted, "add", "."); git(trusted, "commit", "-qm", "base");
  const base = git(trusted, "rev-parse", "HEAD");
  writeFileSync(join(trusted, "tests", "allowed.ts"), "expected\n"); git(trusted, "commit", "-qam", "expected");
  const head = git(trusted, "rev-parse", "HEAD");
  const clone = (name: string) => {const path = join(root, name); git(root, "clone", "-q", "--no-local", trusted, path); return path;};
  const model = clone("model"); const validation = clone("validation"); const publication = clone("publication");
  const capture = () => {
    const result = spawnSync("bash", ["-c", run("autofix", "Capture bounded repair candidate")], {cwd: model, encoding: "utf8", env: {
      ...process.env, RUNNER_TEMP: root, GITHUB_OUTPUT: join(root, "output"), REPOSITORY: "ibboabdoli-ai/Proffera", PR_NUMBER: "934",
      EXPECTED_HEAD: head, BASE_SHA: base, ADMITTED_RUN_ID: "50", ADMITTED_RUN_ATTEMPT: "1", SOURCE_RUN_ID: "40", SOURCE_RUN_ATTEMPT: "2",
    }});
    expect(result.status, result.stderr).toBe(0);
    const artifact_dir = join(root, "ci-autofix-candidate");
    return {...JSON.parse(readFileSync(join(artifact_dir, "manifest.json"), "utf8")), artifact_dir,
      blocked_patterns: workflow.env.BLOCKED_PATH_PATTERNS.trim().split("\n")};
  };
  return {root, trusted, model, validation, publication, base, head, capture};
}

describe("CI Autofix isolated candidate reconstruction", () => {
  it("rejects a staged blocked file hidden from the old guard alongside an allowed unstaged edit", () => {
    const f = fixture();
    writeFileSync(join(f.model, ".github/workflows/protected.yml"), "blocked modification\n"); git(f.model, "add", ".github");
    writeFileSync(join(f.model, "tests/allowed.ts"), "allowed modification\n");
    expect(git(f.model, "ls-files", "--modified", "--deleted", "--others", "--exclude-standard")).toBe("tests/allowed.ts");
    const input = f.capture();
    expect(() => prepareCiAutofixCandidate(input, {cwd: f.validation, worktree: true})).toThrow("blocked_path");
    expect(() => prepareCiAutofixCandidate(input, {cwd: f.publication})).toThrow("blocked_path");
  });

  it.each(["delete", "rename"])("rejects a staged blocked-path %s using the complete candidate diff", (operation) => {
    const f = fixture();
    if (operation === "delete") git(f.model, "rm", ".github/workflows/protected.yml");
    else git(f.model, "mv", ".github/workflows/protected.yml", "tests/moved.ts");
    expect(() => prepareCiAutofixCandidate(f.capture(), {cwd: f.publication})).toThrow("blocked_path");
  });

  it("captures staged-only additions and reconstructs the identical tree without executing candidate code in publication", () => {
    const f = fixture();
    writeFileSync(join(f.model, "tests/new.ts"), "new test\n"); git(f.model, "add", "tests/new.ts");
    const input = f.capture();
    const validated = prepareCiAutofixCandidate(input, {cwd: f.validation, worktree: true});
    const published = prepareCiAutofixCandidate(input, {cwd: f.publication});
    expect(published).toEqual(validated);
    expect(published.changed_paths).toEqual(["tests/new.ts"]);
    expect(existsSync(join(f.validation, "tests/new.ts"))).toBe(true);
    expect(existsSync(join(f.publication, "tests/new.ts"))).toBe(false);
    const result = spawnSync("bash", ["-c", run("publish", "Create validated repair commit without candidate execution")], {
      cwd: f.publication, encoding: "utf8", env: {...process.env, EXPECTED_HEAD: f.head, VALIDATED_TREE: published.tree, PR_NUMBER: "934", GITHUB_OUTPUT: join(f.root, "commit-output")},
    });
    expect(result.status, result.stderr).toBe(0);
    const commit = readFileSync(join(f.root, "commit-output"), "utf8").trim().split("=")[1];
    expect(git(f.publication, "show", "-s", "--format=%P", commit)).toBe(f.head);
    expect(git(f.publication, "rev-parse", commit + "^{tree}")).toBe(validated.tree);
  });

  it("never transfers model-controlled config, hooks, filters, refs or Git objects to publication", () => {
    const f = fixture();
    writeFileSync(join(f.model, "tests/allowed.ts"), "candidate\n"); const input = f.capture();
    const destination = "https://x-access-token:FIXTURE_TOKEN@github.com/ibboabdoli-ai/Proffera.git";
    git(f.model, "config", "url.https://untrusted.invalid/.insteadOf", "https://");
    git(f.model, "config", "credential.helper", "!exit 91");
    git(f.model, "config", "core.fsmonitor", "false");
    git(f.model, "config", "filter.poison.clean", "false");
    git(f.model, "config", "filter.poison.smudge", "false");
    writeFileSync(join(f.model, ".git/info/attributes"), "* filter=poison\n");
    writeFileSync(join(f.model, ".git/hooks/pre-push"), "#!/bin/sh\nexit 92\n", {mode: 0o755});
    git(f.model, "replace", f.head, f.base);
    expect(git(f.model, "ls-remote", "--get-url", destination)).toContain("untrusted.invalid/x-access-token:FIXTURE_TOKEN");
    const result = prepareCiAutofixCandidate(input, {cwd: f.publication});
    expect(git(f.publication, "ls-remote", "--get-url", destination)).toBe(destination);
    expect(git(f.publication, "replace", "-l")).toBe("");
    expect(git(f.publication, "show", result.tree + ":tests/allowed.ts")).toBe("candidate");
    expect(git(f.publication, "config", "--local", "--list")).not.toMatch(/untrusted|poison|fsmonitor|credential/);
  });

  it("rejects validation-side mutations and publishes only the original immutable candidate", () => {
    const f = fixture(); writeFileSync(join(f.model, "tests/allowed.ts"), "candidate\n"); const input = f.capture();
    const validated = prepareCiAutofixCandidate(input, {cwd: f.validation, worktree: true});
    writeFileSync(join(f.validation, ".github/workflows/protected.yml"), "introduced during tests\n");
    const result = spawnSync("bash", ["-c", run("validate", "Reject changes introduced during candidate validation")], {
      cwd: f.validation, encoding: "utf8", env: {...process.env, VALIDATED_TREE: validated.tree},
    });
    expect(result.status).not.toBe(0);
    const published = prepareCiAutofixCandidate(input, {cwd: f.publication});
    expect(published.tree).toBe(validated.tree);
    expect(git(f.publication, "show", published.tree + ":.github/workflows/protected.yml")).toBe("protected");
  });

  it.each(["pr_number", "run_id", "run_attempt", "source_run_id", "source_run_attempt"])("rejects a candidate from another %s", (field) => {
    const f = fixture(); writeFileSync(join(f.model, "tests/allowed.ts"), "candidate\n"); const input = f.capture();
    expect(() => prepareCiAutofixCandidate({...input, [field]: input[field] + 1}, {cwd: f.publication})).toThrow("artifact_identity");
    expect(git(f.publication, "write-tree")).toBe(git(f.publication, "rev-parse", f.head + "^{tree}"));
  });

  it("rejects substituted patch bytes and a stale checkout", () => {
    const f = fixture(); writeFileSync(join(f.model, "tests/allowed.ts"), "candidate\n"); const input = f.capture();
    git(f.publication, "checkout", "-q", f.base);
    expect(() => prepareCiAutofixCandidate(input, {cwd: f.publication})).toThrow("checkout_binding");
    git(f.publication, "checkout", "-q", f.head);
    writeFileSync(join(input.artifact_dir, "repair.patch"), "substituted");
    expect(() => prepareCiAutofixCandidate(input, {cwd: f.publication})).toThrow("patch_digest");
  });

  it.each(["symlink", "executable", "control-character", "out-of-scope"])("rejects a %s candidate", (kind) => {
    const f = fixture();
    if (kind === "symlink") symlinkSync("../.git/config", join(f.model, "tests/link"));
    if (kind === "executable") chmodSync(join(f.model, "tests/allowed.ts"), 0o755);
    if (kind === "control-character") writeFileSync(join(f.model, "tests/new\nfile.ts"), "candidate\n");
    if (kind === "out-of-scope") writeFileSync(join(f.model, "unrelated.txt"), "candidate\n");
    expect(() => prepareCiAutofixCandidate(f.capture(), {cwd: f.publication})).toThrow(/file_mode|:path$|scope_expansion/);
  });

  it("rejects a submodule patch and traversal paths", () => {
    const f = fixture(); writeFileSync(join(f.model, "tests/allowed.ts"), "candidate\n"); const input = f.capture();
    for (const patch of [
      `diff --git a/tests/sub b/tests/sub\nnew file mode 160000\nindex 0000000..${f.head}\n--- /dev/null\n+++ b/tests/sub\n@@ -0,0 +1 @@\n+Subproject commit ${f.head}\n`,
      'diff --git a/../escape b/../escape\nnew file mode 100644\n--- /dev/null\n+++ b/../escape\n@@ -0,0 +1 @@\n+escape\n',
    ]) {
      git(f.publication, "reset", "--hard", f.head);
      input.patch_sha256 = createHash("sha256").update(patch).digest("hex");
      const manifest = JSON.parse(readFileSync(join(input.artifact_dir, "manifest.json"), "utf8")); manifest.patch_sha256 = input.patch_sha256;
      writeFileSync(join(input.artifact_dir, "manifest.json"), JSON.stringify(manifest)); writeFileSync(join(input.artifact_dir, "repair.patch"), patch);
      expect(() => prepareCiAutofixCandidate(input, {cwd: f.publication})).toThrow();
    }
    expect(existsSync(join(f.root, "escape"))).toBe(false);
  });
});

it("isolates credentials and candidate execution into separate jobs with immutable artifact and original-attempt bindings", () => {
  for (const name of ["autofix", "validate"]) {
    const job = workflow.jobs[name];
    expect(Object.values(job.permissions)).not.toContain("write");
    expect(JSON.stringify(job)).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
  }
  const publication = workflow.jobs.publish;
  expect(publication.needs).toEqual(["prepare", "admit", "autofix", "validate"]);
  expect(publication.if).toContain("needs.validate.result == 'success'");
  for (const step of publication.steps) {
    expect(step.uses ?? "").not.toContain("codex-action");
    expect(step.run ?? "").not.toMatch(/\bnpm\b|\bpython\b|git add/);
    if (step.env?.PUSH_TOKEN) expect(step.name).toBe("Publish validated repair");
  }
  for (const job of [workflow.jobs.validate, publication]) {
    const checkout = job.steps.find((step: {uses?: string}) => step.uses?.startsWith("actions/checkout@"));
    expect(checkout.with["persist-credentials"]).toBe(false);
    expect(checkout.with.ref).toBe("${{ needs.admit.outputs.head_sha }}");
    const download = job.steps.find((step: {uses?: string}) => step.uses?.startsWith("actions/download-artifact@"));
    expect(download.with["artifact-ids"]).toBe("${{ needs.autofix.outputs.artifact_id }}");
    expect(job.steps[0].run).toContain('test "$GITHUB_RUN_ATTEMPT" = "$ADMITTED_RUN_ATTEMPT"');
    expect(job.steps.find((step: {name: string}) => step.name.startsWith("Materialize candidate helper")).run).toContain("ref=$GITHUB_WORKFLOW_SHA");
  }
  expect(workflow.jobs.record.needs).toContain("publish");
  expect(workflow.jobs.record.steps.find((step: {id: string}) => step.id === "classify").env.PUBLISHED).toBe("${{ needs.publish.outputs.published }}");
});
