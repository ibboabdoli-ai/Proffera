import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyCiScope } from "./ci-scope-plan.mjs";

const DEFAULT_REPOSITORY = "ibboabdoli-ai/Proffera";
const SHA_RE = /^[a-f0-9]{40}$/;
const DIGEST_RE = /^[a-f0-9]{64}$/;
const BRANCH_RE = /^work\/proffera-[A-Za-z0-9._/-]+$/;
const ALLOWED_MODES = new Set(["000000", "100644", "100755"]);
const HOSTED_DEFERRABLE_CHECKS = new Set(["unit", "e2e"]);

function fail(code, message) {
  const error = new Error(`supervisor_preflight:${code}: ${message}`);
  error.code = code;
  throw error;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function runGit(cwd, args, { binary = false, allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: binary ? null : "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (!allowFailure && result.status !== 0) {
    const stderr = binary ? result.stderr?.toString("utf8") : result.stderr;
    fail("git", `${args.join(" ")} failed: ${String(stderr ?? "").trim()}`);
  }
  return result;
}

function gitText(cwd, args) {
  return String(runGit(cwd, args).stdout).trim();
}

function resolveLiveMainSha(repository) {
  const result = spawnSync("gh", [
    "api",
    "--hostname", "github.com",
    `repos/${repository}/git/ref/heads/main`,
    "--jq",
    ".object.sha",
  ], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    env: {...process.env, GH_HOST: "github.com"},
  });
  if (result.status !== 0 || result.error) {
    fail("base", `unable to resolve live main from GitHub: ${String(result.stderr ?? "").trim() || "gh api failed"}`);
  }
  return assertSha(String(result.stdout ?? "").trim(), "live_main_sha");
}

function nulList(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const text = buffer.toString("utf8");
  if (!Buffer.from(text).equals(buffer)) fail("path_encoding", "Git path output is not valid UTF-8");
  if (text && !text.endsWith("\0")) fail("path_encoding", "Git path output is not NUL terminated");
  return text ? text.slice(0, -1).split("\0") : [];
}

function assertSha(value, field) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!SHA_RE.test(normalized)) fail("identity", `${field} must be a 40-character SHA`);
  return normalized;
}

function assertDigest(value, field) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!DIGEST_RE.test(normalized)) fail("evidence", `${field} must be a SHA-256 digest`);
  return normalized;
}

function assertRepositoryPath(path) {
  if (typeof path !== "string" || !path || path.length > 240) fail("path", "invalid repository path");
  if (/[\u0000-\u001f\u007f\\]/u.test(path) || path.startsWith("/") || path.includes("//") || path.endsWith("/")) {
    fail("path", `unsafe repository path: ${JSON.stringify(path)}`);
  }
  if (path.split("/").some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) {
    fail("path", `unsafe repository path segments: ${JSON.stringify(path)}`);
  }
  return path;
}

function repositoryFromRemote(remote) {
  const value = String(remote ?? "").trim().replace(/\\/g, "/");
  const scp = value.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (scp) return `${scp[1]}/${scp[2]}`;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("repository", `unsupported origin URL: ${value}`);
  }
  if (!["https:", "ssh:"].includes(parsed.protocol)
    || parsed.hostname.toLowerCase() !== "github.com"
    || parsed.search
    || parsed.hash) {
    fail("repository", `unsupported origin URL: ${value}`);
  }
  if (parsed.protocol === "ssh:" && parsed.username !== "git") {
    fail("repository", `unsupported origin URL: ${value}`);
  }
  const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
  const match = path.match(/^([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) fail("repository", `unsupported origin URL: ${value}`);
  return `${match[1]}/${match[2]}`;
}

function collectDiffRecords(cwd, baseSha, headSha) {
  const raw = nulList(runGit(cwd, [
    "diff",
    "--raw",
    "--no-abbrev",
    "--no-renames",
    "--no-ext-diff",
    "--no-textconv",
    "-z",
    `${baseSha}...${headSha}`,
  ], { binary: true }).stdout);

  if (raw.length % 2 !== 0) fail("diff", "raw diff path evidence is incomplete");

  const records = [];
  for (let index = 0; index < raw.length; index += 2) {
    const header = raw[index];
    const path = assertRepositoryPath(raw[index + 1]);
    const match = header.match(/^:(\d{6}) (\d{6}) ([a-f0-9]{40}) ([a-f0-9]{40}) ([AMDT])$/);
    if (!match) fail("diff", `unsupported raw diff record for ${path}`);
    const [, oldMode, newMode, oldSha, newSha, status] = match;
    if (!ALLOWED_MODES.has(oldMode) || !ALLOWED_MODES.has(newMode)) {
      fail("file_mode", `unsupported file mode transition ${oldMode}->${newMode} for ${path}`);
    }
    records.push({
      path,
      status,
      old_mode: oldMode,
      new_mode: newMode,
      old_blob: oldSha,
      new_blob: newSha,
      mode_changed: oldMode !== newMode,
    });
  }
  return records;
}

function matchingLines(body, prefix) {
  const lower = prefix.toLowerCase();
  return body.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.toLowerCase().startsWith(lower));
}

export function validatePrMetadata(body, { baseSha, changedPaths }) {
  if (typeof body !== "string" || body.length === 0 || body.length > 200_000) {
    fail("metadata", "PR body is missing or unreasonably large");
  }

  const taskLines = matchingLines(body, "Task/issue:");
  if (taskLines.length !== 1) fail("metadata", "PR body must contain exactly one Task/issue declaration");
  const taskMatch = taskLines[0].match(/^Task\/issue:\s*(.+)$/);
  const task = taskMatch?.[1]?.trim() ?? "";
  if (!task || task.includes("<") || task.includes(">") || task.length > 200) {
    fail("metadata", "Task/issue must contain one concrete value");
  }

  const baselineLines = matchingLines(body, "Bootstrap baseline:");
  if (baselineLines.length !== 1) fail("metadata", "PR body must contain exactly one Bootstrap baseline declaration");
  const baselineMatch = baselineLines[0].match(/^Bootstrap baseline:\s*([a-fA-F0-9]{40})$/);
  if (!baselineMatch) fail("metadata", "Bootstrap baseline must contain one full SHA");
  const baseline = baselineMatch[1].toLowerCase();
  if (baseline !== baseSha) fail("metadata", `Bootstrap baseline ${baseline} does not match base ${baseSha}`);

  const bootstrapLines = body.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^Worker bootstrap:/i.test(line));
  if (bootstrapLines.length !== 1 || bootstrapLines[0] !== "Worker bootstrap: complete") {
    fail("metadata", "PR body must contain exactly one 'Worker bootstrap: complete' declaration");
  }

  const handoffLines = body.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^Supervisor handoff:/i.test(line));
  if (handoffLines.length !== 1 || handoffLines[0] !== "Supervisor handoff: #548") {
    fail("metadata", "PR body must contain exactly one 'Supervisor handoff: #548' declaration");
  }

  const docLines = matchingLines(body, "Documentation impact:");
  if (docLines.length !== 1) fail("metadata", "PR body must contain exactly one Documentation impact declaration");
  const docMatch = docLines[0].match(/^Documentation impact:\s*(updated|none)$/);
  if (!docMatch) fail("metadata", "Documentation impact must be exactly 'updated' or 'none'");
  const documentationImpact = docMatch[1];
  if (documentationImpact === "updated" && !changedPaths.includes("docs/CURRENT_STATUS.md")) {
    fail("metadata", "Documentation impact is updated but docs/CURRENT_STATUS.md is unchanged");
  }

  return { task, bootstrap_baseline: baseline, documentation_impact: documentationImpact };
}

function requiredValidationChecks(plan, paths) {
  const checks = new Set(["targeted"]);
  for (const [id, selected] of [
    ["lint", plan.execution.lint],
    ["typecheck", plan.execution.typecheck],
    ["unit", plan.execution.unit],
    ["build", plan.execution.build],
    ["e2e", plan.execution.e2e],
    ["discovery-worker", plan.execution.discoveryWorker],
  ]) {
    if (selected) checks.add(id);
  }
  if (paths.some((path) => /\.ya?ml$/i.test(path))) checks.add("yaml");
  if (paths.some((path) => path.startsWith(".github/workflows/"))) checks.add("workflow-semantics");
  return [...checks].sort();
}

function evaluateReviewAuthorization(paths) {
  const policyPath = fileURLToPath(new URL("./supervisor-authorization-policy.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [policyPath, "evaluate-paths"], {
    encoding: "utf8",
    input: JSON.stringify({ paths }),
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    fail("review", `authorization policy could not classify review sensitivity: ${String(result.stderr ?? "").trim() || "policy evaluation failed"}`);
  }
  let authorization;
  try {
    authorization = JSON.parse(String(result.stdout ?? ""));
  } catch {
    fail("review", "authorization policy returned malformed review-sensitivity evidence");
  }
  if (!authorization?.ok || typeof authorization.allowed !== "boolean") {
    fail("review", `authorization policy could not classify review sensitivity: ${String(authorization?.reason ?? "invalid decision")}`);
  }
  return authorization;
}

function requiredReviewFocuses(plan, paths) {
  const focuses = ["adversarial"];
  const authorization = evaluateReviewAuthorization(paths);
  if (plan.fullCiStillRequired || plan.classification === "restricted-full" || authorization.allowed === false) {
    focuses.push("security");
  }
  return focuses;
}

function candidateIdentity(candidate) {
  return {
    repository: candidate.repository,
    branch: candidate.branch,
    base_sha: candidate.base_sha,
    head_sha: candidate.head_sha,
    tree_sha: candidate.tree_sha,
    pr_body_sha256: candidate.pr_body_sha256,
  };
}

function sameCandidate(actual, expected, label) {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) fail("evidence", `${label} candidate is missing`);
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) fail("stale_evidence", `${label} does not match candidate field ${key}`);
  }
}

function readJsonFile(path, label) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail("evidence", `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("evidence", `${label} must be a JSON object`);
  return parsed;
}

function validateValidationEvidence(evidence, candidate, requiredChecks) {
  if (evidence.kind !== "supervisor-validation-evidence" || evidence.version !== 1) {
    fail("evidence", "validation evidence kind/version is unsupported");
  }
  sameCandidate(evidence.candidate, candidateIdentity(candidate), "validation evidence");
  if (!Array.isArray(evidence.results)) fail("evidence", "validation evidence results must be an array");

  const seen = new Set();
  const byId = new Map();
  for (const result of evidence.results) {
    if (!result || typeof result !== "object" || Array.isArray(result)) fail("evidence", "validation result is malformed");
    const id = String(result.id ?? "").trim();
    if (!id || seen.has(id)) fail("evidence", `validation result id is missing or duplicated: ${id}`);
    seen.add(id);
    if (typeof result.command !== "string" || !result.command.trim()) fail("evidence", `validation check ${id} lacks its executed command`);

    if (result.status === "hosted-required") {
      if (!HOSTED_DEFERRABLE_CHECKS.has(id)) {
        fail("validation", `validation check ${id} cannot be deferred to hosted evidence`);
      }
      if (result.hosted_evidence_required !== true) {
        fail("evidence", `hosted-required validation check ${id} must set hosted_evidence_required=true`);
      }
      const reason = String(result.reason ?? "").trim();
      if (!reason || reason.length > 1000) {
        fail("evidence", `hosted-required validation check ${id} needs a bounded reason`);
      }
      byId.set(id, result);
      continue;
    }

    if (result.status !== "passed") fail("validation", `validation check ${id} did not pass`);
    byId.set(id, result);
  }

  const missing = requiredChecks.filter((id) => !byId.has(id));
  if (missing.length) fail("validation", `required validation evidence is missing: ${missing.join(", ")}`);
  const hostedRequired = requiredChecks.filter((id) => byId.get(id)?.status === "hosted-required");
  return {
    result_count: evidence.results.length,
    hosted_required: hostedRequired,
    digest: sha256(JSON.stringify(evidence)),
  };
}

function validateReviewEvidence(evidence, candidate, requiredFocuses) {
  if (evidence.kind !== "supervisor-review-evidence" || evidence.version !== 1) {
    fail("evidence", "review evidence kind/version is unsupported");
  }
  sameCandidate(evidence.candidate, candidateIdentity(candidate), "review evidence");
  const reviewer = String(evidence.reviewer ?? "").trim();
  if (!reviewer || /^(self|builder)$/i.test(reviewer)) fail("review", "independent reviewer identity is missing");
  if (evidence.outcome !== "pass") fail("review", "independent review outcome is not pass");
  if (!Array.isArray(evidence.focuses)) fail("review", "review focuses must be an array");
  for (const focus of requiredFocuses) {
    if (!evidence.focuses.includes(focus)) fail("review", `independent review is missing required focus: ${focus}`);
  }
  if (!Array.isArray(evidence.findings)) fail("review", "review findings must be an array");
  for (const finding of evidence.findings) {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) fail("review", "review finding is malformed");
    if (typeof finding.verified !== "boolean" || typeof finding.resolved !== "boolean") {
      fail("review", `review finding verification state is malformed: ${String(finding.id ?? "unknown")}`);
    }
    if (finding.verified && !finding.resolved) {
      fail("review", `verified finding remains unresolved: ${String(finding.id ?? "unknown")}`);
    }
  }
  assertDigest(evidence.review_digest, "review_digest");
  return { reviewer, finding_count: evidence.findings.length, digest: sha256(JSON.stringify(evidence)) };
}

// Selected checks run in this process, not from caller-authored PASS claims.
// This is local execution observation, never independent-review authentication.
const WORKFLOW_YAML_CHECK = (
  'const fs=require("node:fs"); const path=require("node:path"); const yaml=require("js-yaml");'
  + 'const dir=".github/workflows";const workflows=fs.readdirSync(dir).filter(name=>/\\.ya?ml$/.test(name)).map(name=>path.join(dir,name));'
  + 'if(!workflows.length)throw new Error("No workflows found");'
  + 'const files=[...new Set([...workflows,...process.argv.slice(1)])].sort();'
  + 'for(const file of files)yaml.load(fs.readFileSync(file,"utf8"));'
  + 'process.stdout.write("Parsed "+files.length+" YAML files\\n");'
);

// Unknown behavior-changing paths cannot borrow unrelated fixed-suite PASS evidence.
function additionalTargetedSuites(candidate) {
  const bookingWorkflow = ".github/workflows/booking-reminders.yml";
  const bookingSuites = [
    "tests/company-directory-revalidation-scheduling.test.ts",
    "tests/operations-scheduler-route.test.ts",
    "tests/neon-cost-reset-scheduler-contract.test.ts",
  ];
  const mappedSuitePaths = new Set([
    ".github/workflows/proffera-ci-autofix.yml",
    ".github/workflows/supervisor-worker-handoff.yml",
    ".github/workflows/supervisor-review-repair.yml",
    // Verified Next generated-output contract is covered by supervisor-preflight tests.
    ".gitignore", "next-env.d.ts", "tsconfig.json",
    "AGENTS.md", "WORKER_BOOTSTRAP.md", "README.md",
    "scripts/ci-scope-plan.mjs", "tests/ci-scope-plan.test.ts",
    "tests/github-workflow-yaml.test.ts",
    "scripts/supervisor-authorization-policy.mjs",
    "scripts/supervisor-ci-autofix-candidate.mjs",
    "scripts/supervisor-preflight.mjs",
    "scripts/supervisor-worker-handoff.mjs",
    "tests/supervisor-authorization-policy.test.ts",
    "tests/supervisor-ci-autofix-candidate.test.ts",
    "tests/supervisor-preflight.test.ts",
    "tests/supervisor-worker-handoff.test.ts",
  ]);
  const unmapped = candidate.diff.paths.filter((path) =>
    path !== bookingWorkflow
    && !mappedSuitePaths.has(path)
    && !path.startsWith("docs/"));
  if (unmapped.length) {
    fail("validation", "no mapped targeted tests for candidate paths: " + unmapped.join(", "));
  }
  const suites = new Set(candidate.diff.paths.includes(bookingWorkflow) ? bookingSuites : []);
  const workerPaths = new Set([
    "scripts/supervisor-worker-handoff.mjs",
    "tests/supervisor-worker-handoff.test.ts",
  ]);
  const autofixPaths = new Set([
    ".github/workflows/proffera-ci-autofix.yml",
    "scripts/supervisor-ci-autofix-candidate.mjs",
    "tests/supervisor-ci-autofix-candidate.test.ts",
  ]);
  for (const path of candidate.diff.paths) {
    if (workerPaths.has(path) || path === ".github/workflows/supervisor-worker-handoff.yml") {
      suites.add("tests/supervisor-worker-handoff.test.ts");
    }
    if (path === ".github/workflows/supervisor-review-repair.yml") {
      suites.add("tests/supervisor-control-plane-v2.test.ts");
    }
    if (autofixPaths.has(path)) suites.add("tests/supervisor-ci-autofix-candidate.test.ts");
  }
  return [...suites].sort();
}

function commandForCheck(id, cwd, candidate) {
  const node = process.execPath;
  const vitest = ["node_modules/vitest/vitest.mjs", "run", "--maxWorkers=2", "--reporter=dot"];
  switch (id) {
    case "lint": return {command: node, args: ["node_modules/eslint/bin/eslint.js", "."], cwd, timeout: 240000};
    case "typecheck": return {command: node, args: ["node_modules/typescript/bin/tsc", "--noEmit"], cwd, timeout: 240000};
    case "build": return {command: node, args: ["node_modules/next/dist/bin/next", "build"], cwd, timeout: 600000};
    case "unit": return {command: node, args: [...vitest], cwd, timeout: 1200000};
    case "targeted": return {command: node, args: [...vitest,
      "tests/supervisor-preflight.test.ts", "tests/supervisor-authorization-policy.test.ts",
      "tests/ci-scope-plan.test.ts", "tests/github-workflow-yaml.test.ts",
      ...additionalTargetedSuites(candidate)], cwd, timeout: 300000};
    case "workflow-semantics": return {command: node, args: [...vitest,
      "tests/github-workflow-yaml.test.ts", "tests/supervisor-authorization-policy.test.ts",
      "tests/supervisor-ci-autofix-candidate.test.ts", "tests/supervisor-worker-handoff.test.ts",
      ...additionalTargetedSuites(candidate)],
      cwd, timeout: 600000};
    case "yaml": return {command: node, args: ["-e", WORKFLOW_YAML_CHECK,
      ...candidate.diff.files.filter((record) => record.new_mode !== "000000"
        && /\.ya?ml$/i.test(record.path)).map((record) => record.path)],
      cwd, timeout: 120000};
    case "discovery-worker": return {command: "python", args: ["tests/test_company_directory_discovery_worker.py"],
      cwd, timeout: 300000};
    case "e2e": return {command: node, args: ["node_modules/playwright/cli.js", "test", "--workers=1"],
      cwd: resolve(cwd, "e2e"), timeout: 1200000};
    default: fail("validation", "unsupported executable validation check: " + id);
  }
}

// A caller cannot submit commands, executable arguments or test success values.
// Execute each selected fixed command, stop after failure and recheck the frozen tree.
export function executeLocalValidation(candidate, cwd, ids, {runner = spawnSync, revalidate} = {}) {
  if (process.versions.node.split(".")[0] !== "22") fail("runtime", "Node 22.x is required");
  if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length) {
    fail("validation", "provide one or more unique check IDs");
  }
  for (const id of ids) {
    if (!candidate.required_validation_checks.includes(id)) {
      fail("validation", "check " + id + " was not selected by the authoritative CI scope planner");
    }
  }
  const results = [];
  for (const id of ids) {
    const spec = commandForCheck(id, cwd, candidate);
    const result = runner(spec.command, spec.args, {
      cwd: spec.cwd, encoding: "utf8", windowsHide: true, timeout: spec.timeout,
      maxBuffer: 4 * 1024 * 1024,
    });
    results.push({
      id, command: [spec.command, ...spec.args].join(" "), exit_code: result.status,
      signal: result.signal ?? null,
      status: result.status === 0 && !result.error ? "passed" : "failed",
      error: result.error ? String(result.error.message ?? result.error).slice(0, 1000) : null,
      stderr_sha256: sha256(String(result.stderr ?? "")),
      stderr_bytes: Buffer.byteLength(String(result.stderr ?? ""), "utf8"),
    });
    if (result.status !== 0 || result.error) break; // fail fast
  }
  if (revalidate) {
    const after = revalidate();
    if (JSON.stringify(candidateIdentity(after)) !== JSON.stringify(candidateIdentity(candidate))) {
      fail("stale_evidence", "candidate identity changed during validation");
    }
  }
  return {
    ok: results.length === ids.length && results.every((result) => result.status === "passed"),
    code: "local_execution_observed_not_independent_review",
    candidate: candidateIdentity(candidate),
    results,
    executed_count: results.length,
    required_checks: candidate.required_validation_checks,
    missing_checks: candidate.required_validation_checks.filter((id) =>
      !results.some((result) => result.id === id && result.status === "passed")),
    execution_observed: true,
    independent_review_verified: false,
    publication_ready: false,
  };
}

// Read-only authenticated GitHub diagnostic. Hosted reviews do not authenticate
// independent pre-push review of unpublished local commits.
export function evaluateGithubReviewSnapshot(candidate, pr, pages, requestedNumber) {
  if (!pr || typeof pr !== "object" || Array.isArray(pr)
    || pr.number !== requestedNumber
    || pr.head?.repo?.full_name !== candidate.repository
    || pr.head?.ref !== candidate.branch
    || pr.base?.ref !== "main"
    || pr.base?.sha !== candidate.base_sha
    || pr.user?.login !== candidate.repository.split("/")[0]) {
    fail("github_review", "live PR identity does not match repository, owner, branch or base");
  }
  if (pr.state !== "open" || pr.merged === true) {
    fail("github_review", "PR is closed or merged");
  }
  if (typeof pr.body !== "string" || sha256(pr.body) !== candidate.pr_body_sha256) {
    fail("github_review", "live PR body digest does not match the candidate");
  }
  if (!Array.isArray(pages) || pages.length > 30
    || pages.some((page) => !Array.isArray(page))) {
    fail("github_review", "incomplete or malformed review pagination");
  }
  const reviews = pages.flat();
  if (reviews.length > 3000 || reviews.some((review) => !review
    || !Number.isSafeInteger(review.id)
    || typeof review.commit_id !== "string" || !SHA_RE.test(review.commit_id)
    || typeof review.user?.login !== "string"
    || typeof review.state !== "string"
    || (review.state !== "PENDING" && !Number.isFinite(Date.parse(review.submitted_at ?? ""))))) {
    fail("github_review", "malformed or excessive review evidence");
  }
  const remoteHead = assertSha(pr.head?.sha, "remote_pr_head_sha");
  const matched = remoteHead === candidate.head_sha;
  const coderabbit = reviews.filter((review) =>
    review.user.login === "coderabbitai[bot]"
      && review.commit_id === candidate.head_sha
      && ["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED"].includes(review.state))
    .sort((a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at) || a.id - b.id);
  // A dismissed review loses its original decision in the current snapshot.
  // Never revive an earlier approval when a later review was dismissed.
  const blocked = coderabbit.findLastIndex((review) =>
    review.state === "CHANGES_REQUESTED" || review.state === "DISMISSED");
  const approved = coderabbit.findLastIndex((review) => review.state === "APPROVED");
  const eligible = matched && approved >= 0 && approved > blocked;
  return {
    // A status probe can succeed at retrieval without proving a publishable candidate.
    // Nonzero status is intentional: never let a caller treat this as a security gate.
    ok: false,
    retrieval_ok: true,
    code: matched ? "hosted_review_read_only" : "local_candidate_not_on_remote_pr",
    candidate: candidateIdentity(candidate),
    pr_number: requestedNumber,
    remote_pr_head_sha: remoteHead,
    remote_head_matches_candidate: matched,
    coderabbit_exact_head_reviews: coderabbit.map((review) => ({
      review_id: review.id, state: review.state, submitted_at: review.submitted_at,
    })),
    coderabbit_approved_exact_head: eligible,
    coderabbit_changes_requested_unresolved: matched && blocked >= 0 && approved <= blocked,
    coderabbit_dismissal_requires_fresh_approval: matched && coderabbit.some((review) =>
      review.state === "DISMISSED") && !eligible,
    hosted_review_usable_for_current_head: eligible,
    local_independent_review_verified: false,
    publication_ready: false,
    explanation: "Read-only hosted-review diagnostics cannot attest local independent review or authorize a push.",
  };
}

export function assertStableHostedReviewReads(beforePr, afterPr, firstPages, lastPages) {
  if (beforePr.head?.sha !== afterPr.head?.sha || beforePr.base?.sha !== afterPr.base?.sha
    || beforePr.head?.ref !== afterPr.head?.ref || beforePr.body !== afterPr.body
    || beforePr.state !== afterPr.state || beforePr.draft !== afterPr.draft
    || JSON.stringify(firstPages) !== JSON.stringify(lastPages)) {
    fail("github_review", "PR or CodeRabbit review inventory changed during authenticated reads");
  }
}

function githubReadJson(cwd, endpoint, paginated = false) {
  const flags = paginated ? ["--paginate", "--slurp"] : [];
  const result = spawnSync("gh", ["api", "--hostname", "github.com", ...flags, endpoint], {
    cwd, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 16 * 1024 * 1024,
    env: {...process.env, GH_HOST: "github.com"},
  });
  if (result.status !== 0 || result.error) {
    fail("github_review", "authenticated GitHub API read failed");
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    fail("github_review", "GitHub returned invalid JSON");
  }
}

function parseArgs(argv) {
  const args = { mode: argv[2] ?? "" };
  for (let index = 3; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) fail("args", `invalid argument near ${key ?? "<end>"}`);
    args[key.slice(2).replaceAll("-", "_")] = value;
  }
  return args;
}

export function inspectCandidate({
  cwd = process.cwd(),
  repository = DEFAULT_REPOSITORY,
  baseSha,
  prBody,
  liveMainResolver = resolveLiveMainSha,
  afterHeadCapture,
}) {
  if (process.versions.node.split(".")[0] !== "22") {
    fail("runtime", `Node 22.x is required; running ${process.version}`);
  }

  const root = resolve(gitText(cwd, ["rev-parse", "--show-toplevel"]));
  if (root.toLowerCase() !== resolve(cwd).toLowerCase()) fail("repository", "run preflight from the repository root");

  const originRepository = repositoryFromRemote(gitText(cwd, ["config", "--get", "remote.origin.url"]));
  if (originRepository.toLowerCase() !== repository.toLowerCase()) {
    fail("repository", `origin resolves to ${originRepository}, expected ${repository}`);
  }

  const branch = gitText(cwd, ["branch", "--show-current"]);
  if (!BRANCH_RE.test(branch)) fail("branch", `branch must match work/proffera-*; got ${branch || "<detached>"}`);

  const dirty = runGit(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { binary: true }).stdout;
  if (dirty.length !== 0) fail("dirty", "candidate must be fully committed and the worktree/index must be clean");

  const base = assertSha(baseSha, "base_sha");
  const liveMain = assertSha(liveMainResolver(repository), "live_main_sha");
  if (base !== liveMain) {
    fail("base", "base SHA " + base + " is stale or not current main " + liveMain);
  }
  const head = assertSha(gitText(cwd, ["rev-parse", "HEAD"]), "head_sha");
  afterHeadCapture?.();
  const tree = assertSha(gitText(cwd, ["rev-parse", `${head}^{tree}`]), "tree_sha");

  const baseObject = gitText(cwd, ["rev-parse", `${base}^{commit}`]).toLowerCase();
  if (baseObject !== base) fail("identity", "base SHA does not resolve to the expected commit");
  const ancestor = runGit(cwd, ["merge-base", "--is-ancestor", base, head], { allowFailure: true });
  if (ancestor.status !== 0) fail("base", "base SHA is not an ancestor of the candidate head");

  const records = collectDiffRecords(cwd, base, head);
  if (records.length === 0) fail("diff", "candidate has no changes relative to base");
  const paths = [...new Set(records.map((record) => record.path))].sort();

  const diffCheck = runGit(cwd, ["diff", "--check", `${base}...${head}`], { allowFailure: true });
  if (diffCheck.status !== 0) fail("whitespace", String(diffCheck.stderr ?? diffCheck.stdout ?? "").trim() || "git diff --check failed");

  const body = prBody;
  const metadata = validatePrMetadata(body, { baseSha: base, changedPaths: paths });
  const plan = classifyCiScope(paths);
  const requiredChecks = requiredValidationChecks(plan, paths);
  const requiredFocuses = requiredReviewFocuses(plan, paths);

  // Reject any concurrent ref, branch or worktree change before reporting this candidate.
  const currentBranch = gitText(cwd, ["branch", "--show-current"]);
  const currentHead = gitText(cwd, ["rev-parse", "HEAD"]);
  const currentStatus = runGit(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { binary: true }).stdout;
  if (currentBranch !== branch || currentHead !== head || currentStatus.length !== 0) {
    fail("stale_evidence", "branch, HEAD or Git status changed during candidate inspection");
  }

  return {
    repository,
    branch,
    base_sha: base,
    head_sha: head,
    tree_sha: tree,
    pr_body_sha256: sha256(Buffer.from(body, "utf8")),
    metadata,
    diff: {
      files: records,
      paths,
      file_count: records.length,
      mode_changes: records.filter((record) => record.mode_changed).map((record) => record.path),
    },
    scope: plan,
    required_validation_checks: requiredChecks,
    required_review_focuses: requiredFocuses,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (!["snapshot", "owner-handoff", "verify", "run-checks", "hosted-review-status"].includes(args.mode)) fail("args", "unsupported preflight mode");
  if (!args.base || !args.pr_body) fail("args", "--base and --pr-body are required");

  const cwd = resolve(args.cwd ?? process.cwd());
  const prBody = readFileSync(resolve(args.pr_body), "utf8");
  const candidate = inspectCandidate({
    cwd,
    repository: args.repository ?? DEFAULT_REPOSITORY,
    baseSha: args.base,
    prBody,
  });

  if (args.mode === "snapshot") {
    process.stdout.write(JSON.stringify({ ok: true, candidate }, null, 2) + "\n");
    return;
  }

  if (args.mode === "owner-handoff") {
    // Local identity/scope only; independent post-push evidence is not available.
    process.stdout.write(JSON.stringify({
      ok: true,
      phase: "pre_push_local_candidate",
      candidate: candidateIdentity(candidate),
      required_validation_checks: candidate.required_validation_checks,
      required_review_focuses: candidate.required_review_focuses,
      local_identity_checked: true,
      validation_execution_verified: false,
      independent_review_verified: false,
      owner_push_authorized: false,
      publication_ready: false,
      merge_authorized: false,
      next_boundary: "owner_exact_candidate_push_then_authenticated_hosted_ci_and_review",
    }, null, 2) + "\n");
    return;
  }

  if (args.mode === "hosted-review-status") {
    if (!/^[1-9][0-9]*$/.test(args.pr ?? "")) {
      fail("args", "hosted-review-status requires --pr <positive integer>");
    }
    const number = Number(args.pr);
    if (!Number.isSafeInteger(number)) fail("args", "PR number out of range");
    const endpoint = "repos/" + candidate.repository + "/pulls/" + number;
    const before = githubReadJson(cwd, endpoint);
    const firstReviews = githubReadJson(cwd, endpoint + "/reviews?per_page=100", true);
    const pr = githubReadJson(cwd, endpoint);
    const lastReviews = githubReadJson(cwd, endpoint + "/reviews?per_page=100", true);
    assertStableHostedReviewReads(before, pr, firstReviews, lastReviews);
    // Git and PR-body files can change during the remote reads.
    const current = inspectCandidate({
      cwd, repository: args.repository ?? DEFAULT_REPOSITORY,
      baseSha: args.base, prBody: readFileSync(resolve(args.pr_body), "utf8"),
    });
    if (JSON.stringify(candidateIdentity(candidate)) !== JSON.stringify(candidateIdentity(current))) {
      fail("stale_evidence", "candidate changed during hosted review reads");
    }
    const receipt = evaluateGithubReviewSnapshot(candidate, pr, lastReviews, number);
    process.stdout.write(JSON.stringify(receipt, null, 2) + "\n");
    process.exitCode = 1; // diagnostic can never pass the pre-push gate
    return;
  }

  if (args.mode === "run-checks") {
    if (typeof args.checks !== "string" || !args.checks.trim()) {
      fail("args", "run-checks requires --checks <comma-separated selected IDs>");
    }
    const ids = args.checks.split(",").map((id) => id.trim());
    const receipt = executeLocalValidation(candidate, cwd, ids, {
      revalidate: () => inspectCandidate({
        cwd, repository: args.repository ?? DEFAULT_REPOSITORY,
        baseSha: args.base, prBody: readFileSync(resolve(args.pr_body), "utf8"),
      }),
    });
    process.stdout.write(JSON.stringify(receipt, null, 2) + "\n");
    if (!receipt.ok) process.exitCode = 1;
    return;
  }

  if (!args.validation || !args.review) fail("args", "verify requires --validation and --review evidence files");
  const validation = validateValidationEvidence(
    readJsonFile(resolve(args.validation), "validation evidence"),
    candidate,
    candidate.required_validation_checks,
  );
  const review = validateReviewEvidence(
    readJsonFile(resolve(args.review), "review evidence"),
    candidate,
    candidate.required_review_focuses,
  );

  // These files are caller-supplied claims. Matching SHAs, command strings,
  // reviewer names and digests establish consistency, never execution or
  // independence. No authenticated local evidence adapter exists here yet.
  // Keep the publication boundary closed; the existing hosted CI/review gates
  // remain authoritative and must not be replaced by this receipt.
  process.stdout.write(JSON.stringify({
    ok: false,
    code: "evidence_provenance_unverified",
    evidence_consistent: true,
    publication_ready: false,
    execution_verified: false,
    independent_review_verified: false,
    candidate: candidateIdentity(candidate),
    metadata: candidate.metadata,
    diff: candidate.diff,
    scope: candidate.scope,
    validation,
    review,
  }, null, 2) + "\n");
  process.stderr.write("supervisor_preflight:evidence_provenance_unverified: caller-supplied JSON cannot prove validation execution or independent review; NOT SAFE TO PUSH\n");
  process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
    process.exitCode = 1;
  }
}
