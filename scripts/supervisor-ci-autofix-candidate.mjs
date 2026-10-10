import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Run only from the immutable workflow revision in a fresh job. Candidate jobs
// transfer patch bytes, never their Git metadata, configuration or commit objects.
const MAX_PATCH_BYTES = 10 * 1024 * 1024;
const fail = (code) => { throw new Error("ci_autofix_candidate:" + code); };
const sha = (value, length = 40) => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;

function git(cwd, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args], {
    cwd, env: {...env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_NO_REPLACE_OBJECTS: "1", GIT_TERMINAL_PROMPT: "0"},
    maxBuffer: 16 * 1024 * 1024, timeout: 60000,
  });
}

function nulList(bytes) {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text).equals(bytes) || text && !text.endsWith("\0")) fail("path_encoding");
  return text ? text.slice(0, -1).split("\0") : [];
}

function fileBytes(path, maximum) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size === 0 || stat.size > maximum) fail("artifact_bound");
  return readFileSync(path);
}

function enforceHumanAuthorization(paths) {
  const helper = fileURLToPath(new URL("./supervisor-authorization-policy.mjs", import.meta.url));
  let decision;
  try {
    const output = execFileSync(process.execPath, [helper, "evaluate-paths"], {
      input: JSON.stringify({paths}),
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 60000,
    });
    decision = JSON.parse(output);
  } catch {
    fail("human_authorization_policy");
  }
  if (!decision?.ok || !decision?.allowed) fail("human_authorization_path");
}

export function prepareCiAutofixCandidate(input, {cwd = process.cwd(), worktree = false} = {}) {
  const expected = {
    version: 1, repository: input.repository, pr_number: input.pr_number,
    head: input.head, base_sha: input.base_sha,
    run_id: input.run_id, run_attempt: input.run_attempt,
    source_run_id: input.source_run_id, source_run_attempt: input.source_run_attempt,
    patch_sha256: input.patch_sha256,
  };
  if (expected.repository !== "ibboabdoli-ai/Proffera" || !sha(expected.head) || !sha(expected.base_sha)
    || !sha(expected.patch_sha256, 64)
    || [expected.pr_number, expected.run_id, expected.run_attempt, expected.source_run_id, expected.source_run_attempt].some((n) => !positive(n))) fail("identity");
  if (!Array.isArray(input.blocked_patterns) || input.blocked_patterns.length === 0
    || input.blocked_patterns.some((pattern) => typeof pattern !== "string" || !pattern || /[\r\n\0]/.test(pattern))) fail("blocked_patterns");
  if (readdirSync(input.artifact_dir).sort().join("|") !== "manifest.json|repair.patch") fail("artifact_files");
  const manifest = JSON.parse(fileBytes(join(input.artifact_dir, "manifest.json"), 8192).toString("utf8"));
  if (Object.keys(manifest).sort().join("|") !== Object.keys(expected).sort().join("|")
    || Object.entries(expected).some(([key, value]) => manifest[key] !== value)) fail("artifact_identity");
  const patchPath = join(input.artifact_dir, "repair.patch");
  const patch = fileBytes(patchPath, MAX_PATCH_BYTES);
  if (createHash("sha256").update(patch).digest("hex") !== expected.patch_sha256) fail("patch_digest");
  const text = (args) => git(cwd, args).toString("utf8").trim();
  if (text(["rev-parse", "HEAD"]) !== expected.head
    || text(["write-tree"]) !== text(["rev-parse", expected.head + "^{tree}"])) fail("checkout_binding");
  const allowed = new Set(nulList(git(cwd, ["diff", "--name-only", "--no-renames", "-z", expected.base_sha + "..." + expected.head])));

  // --cached avoids filters/worktree execution in publication. Validation alone
  // materializes the same patch, before running any candidate code or packages.
  const destination = worktree ? "--index" : "--cached";
  git(cwd, ["apply", destination, "--check", "--binary", "--whitespace=nowarn", patchPath]);
  git(cwd, ["apply", destination, "--binary", "--whitespace=nowarn", patchPath]);
  const raw = nulList(git(cwd, ["diff", "--cached", "--raw", "--no-abbrev", "--no-renames", "--no-ext-diff", "--no-textconv", "-z", expected.head]));
  if (raw.length === 0 || raw.length % 2 || raw.length > 1000) fail("changed_paths");
  const blocked = input.blocked_patterns.map((pattern) => new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*").replaceAll("?", ".") + "$"));
  const paths = [];
  for (let i = 0; i < raw.length; i += 2) {
    const mode = raw[i].match(/^:(\d{6}) (\d{6}) [a-f0-9]{40} [a-f0-9]{40} ([AMD])$/);
    const path = raw[i + 1];
    if (!mode || !["000000", "100644", "100755"].includes(mode[1])
      || !["000000", "100644", "100755"].includes(mode[2])
      || mode[1] !== "000000" && mode[2] !== "000000" && mode[1] !== mode[2]
      || mode[1] === "000000" && mode[2] !== "100644") fail("file_mode");
    if (!path || /[\x00-\x1f\x7f\\]/.test(path) || path.startsWith("/")
      || path.split("/").some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) fail("path");
    if (blocked.some((pattern) => pattern.test(path))) fail("blocked_path");
    if (!allowed.has(path) && !path.startsWith("tests/")) fail("scope_expansion");
    paths.push(path);
  }
  enforceHumanAuthorization(paths);
  git(cwd, ["diff", "--cached", "--check", expected.head]);
  return {tree: text(["write-tree"]), changed_paths: paths};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = process.argv[2];
    if (!["prepare", "prepare-worktree"].includes(mode)) fail("mode");
    const env = process.env;
    const result = prepareCiAutofixCandidate({
      repository: env.REPOSITORY, pr_number: Number(env.PR_NUMBER), head: env.EXPECTED_HEAD, base_sha: env.BASE_SHA,
      run_id: Number(env.ADMITTED_RUN_ID), run_attempt: Number(env.ADMITTED_RUN_ATTEMPT),
      source_run_id: Number(env.SOURCE_RUN_ID), source_run_attempt: Number(env.SOURCE_RUN_ATTEMPT),
      patch_sha256: env.EXPECTED_PATCH_SHA256, artifact_dir: env.CANDIDATE_DIR,
      blocked_patterns: (env.BLOCKED_PATH_PATTERNS ?? "").split("\n").filter(Boolean),
    }, {worktree: mode === "prepare-worktree"});
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
    process.exitCode = 1;
  }
}
