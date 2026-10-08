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
    `repos/${repository}/git/ref/heads/main`,
    "--jq",
    ".object.sha",
  ], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
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
  const tree = assertSha(gitText(cwd, ["rev-parse", "HEAD^{tree}"]), "tree_sha");

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
  if (!["snapshot", "verify"].includes(args.mode)) fail("args", "mode must be snapshot or verify");
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
