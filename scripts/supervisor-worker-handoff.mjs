#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const TASK_PACKET_MARKER = "<!-- proffera-worker-task-packet:v1 -->";
export const TASK_STATE_MARKER_PREFIX = "<!-- proffera-worker-task-state:";
export const EXPECTED_REPOSITORY = "ibboabdoli-ai/Proffera";
export const SUPERVISOR_ISSUE = 548;
export const TRUSTED_SUPERVISOR_ACTOR = "ibboabdoli-ai";
export const DISPATCH_ENABLE_LABEL = "worker-dispatch-enabled";
export const REQUIRED_CHECKS = Object.freeze([
  "validate",
  "codeql",
  "targeted-ci-shadow",
  "production-base-health",
  "ai-review",
  "final-gate",
]);

export const HARD_BLOCKED_SCOPES = Object.freeze([
  ".github/",
  ".github/workflows/",
  ".github/proffera-standing-merge-authorization.json",
  "AGENTS.md",
  "WORKER_BOOTSTRAP.md",
  "scripts/supervisor-worker-handoff.mjs",
  ".env",
  ".env.",
  "vercel.json",
  "db/migrations/",
  "migrations/",
  "supabase/",
  "prisma/",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

const ACTIVE_TASK_STATES = new Set([
  "TASK_CREATED",
  "TASK_DISPATCHED",
  "WORKER_PR_OPENED",
  "CHECKS_PENDING",
  "REVIEW_PENDING",
  "READY_FOR_SUPERVISOR",
  "WORKER_BLOCKED",
  "CLOSED_UNMERGED",
  "MERGED",
]);

const TERMINAL_TASK_STATES = new Set(["MERGED", "CLOSED_UNMERGED"]);
const LIFECYCLE_RANK = Object.freeze({
  WORKER_PR_OPENED: 10,
  CHECKS_PENDING: 20,
  REVIEW_PENDING: 30,
  READY_FOR_SUPERVISOR: 40,
});

const SHA_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const TASK_ID_RE = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,7}$/;
const BRANCH_RE = /^work\/proffera-[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const GRAPH_RE = /^[a-z0-9][a-z0-9._/-]{0,159}$/;
const PATH_RE = /^[A-Za-z0-9._/-]+$/;
const STATE_RE = /^[A-Z][A-Z0-9_]{2,39}$/;
const MAX_PUBLICATION_BYTES = 10 * 1024 * 1024;

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let start = 0;
  while (true) {
    const index = text.indexOf(needle, start);
    if (index === -1) return count;
    count += 1;
    start = index + needle.length;
  }
}

function assertPlainString(value, field, maxLength) {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  if (trimmed.length > maxLength) throw new Error(`${field} is too long`);
  if (/[\u0000-\u001F\u007F]/u.test(trimmed)) throw new Error(`${field} contains control characters`);
  return trimmed;
}

function assertSafeGraphPath(value) {
  const graphPath = assertPlainString(value, "graph_path", 160).toLowerCase();
  if (!GRAPH_RE.test(graphPath)) throw new Error("graph_path is malformed");
  if (graphPath.startsWith("/") || graphPath.endsWith("/") || graphPath.includes("//")) {
    throw new Error("graph_path is malformed");
  }
  if (graphPath.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("graph_path cannot traverse directories");
  }
  return graphPath;
}

function assertSafeScope(value, field) {
  const scope = assertPlainString(value, field, 240);
  if (!PATH_RE.test(scope)) throw new Error(`${field} contains unsupported path syntax`);
  if (scope.startsWith("/") || scope.includes("//")) throw new Error(`${field} is not repository-relative`);
  const pathWithoutTrailingSlash = scope.endsWith("/") ? scope.slice(0, -1) : scope;
  if (!pathWithoutTrailingSlash) throw new Error(`${field} is empty`);
  if (pathWithoutTrailingSlash.split("/").some((part) => part === "." || part === ".." || part === "")) {
    throw new Error(`${field} contains path traversal or an empty segment`);
  }
  return scope;
}

function isHardBlockedPath(path) {
  return HARD_BLOCKED_SCOPES.some((scope) => {
    if (scope.endsWith("/")) return path === scope.slice(0, -1) || path.startsWith(scope);
    if (scope.endsWith(".")) return path.startsWith(scope);
    return path === scope;
  });
}

function scopeCovers(scope, path) {
  if (scope.endsWith("/")) return path.startsWith(scope);
  return scope === path;
}

function scopesIntersect(left, right) {
  if (left.endsWith("/") && right.endsWith("/")) {
    return left.startsWith(right) || right.startsWith(left);
  }
  if (left.endsWith("/")) return right.startsWith(left);
  if (right.endsWith("/")) return left.startsWith(right);
  return left === right;
}

function graphPathsIntersect(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function normalizeChecks(value) {
  if (!Array.isArray(value)) throw new Error("required_checks must be an array");
  const normalized = value.map((item) => assertPlainString(item, "required_checks[]", 80).toLowerCase());
  if (new Set(normalized).size !== normalized.length) throw new Error("required_checks contains duplicates");
  const expected = new Set(REQUIRED_CHECKS);
  if (normalized.length !== expected.size || normalized.some((item) => !expected.has(item))) {
    throw new Error(`required_checks must equal ${REQUIRED_CHECKS.join(", ")}`);
  }
  return [...REQUIRED_CHECKS];
}

function normalizeScopeArray(value, field, { nonEmpty = true } = {}) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  if (nonEmpty && value.length === 0) throw new Error(`${field} must not be empty`);
  if (value.length > 50) throw new Error(`${field} has too many entries`);
  const normalized = value.map((item) => assertSafeScope(item, `${field}[]`));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${field} contains duplicates`);
  return normalized;
}

export function normalizeTaskPacket(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Task Packet must be a JSON object");
  const knownKeys = new Set([
    "task_id",
    "supervisor_issue",
    "repository",
    "task_title",
    "task_goal",
    "graph_path",
    "base_sha",
    "branch",
    "allowed_paths",
    "forbidden_paths",
    "required_checks",
    "risk_class",
    "production_mutation_allowed",
    "merge_allowed",
    "auto_merge_allowed",
  ]);
  const unknown = Object.keys(raw).filter((key) => !knownKeys.has(key));
  if (unknown.length > 0) throw new Error(`Task Packet has unsupported fields: ${unknown.join(", ")}`);

  const taskId = assertPlainString(raw.task_id, "task_id", 64).toUpperCase();
  if (!TASK_ID_RE.test(taskId)) throw new Error("task_id is malformed");
  if (raw.supervisor_issue !== SUPERVISOR_ISSUE) throw new Error(`supervisor_issue must be ${SUPERVISOR_ISSUE}`);
  if (raw.repository !== EXPECTED_REPOSITORY) throw new Error(`repository must be ${EXPECTED_REPOSITORY}`);

  const baseSha = assertPlainString(raw.base_sha, "base_sha", 40).toLowerCase();
  if (!SHA_RE.test(baseSha)) throw new Error("base_sha must be a 40-character commit SHA");
  const branch = assertPlainString(raw.branch, "branch", 100).toLowerCase();
  if (!BRANCH_RE.test(branch)) throw new Error("branch must match work/proffera-* using safe lowercase characters");

  const allowedPaths = normalizeScopeArray(raw.allowed_paths, "allowed_paths");
  const forbiddenPaths = normalizeScopeArray(raw.forbidden_paths, "forbidden_paths");

  for (const allowed of allowedPaths) {
    if (isHardBlockedPath(allowed) || HARD_BLOCKED_SCOPES.some((blocked) => scopesIntersect(allowed, blocked))) {
      throw new Error(`allowed_paths cannot include hard-blocked scope '${allowed}'`);
    }
    if (forbiddenPaths.some((forbidden) => scopesIntersect(allowed, forbidden))) {
      throw new Error(`allowed_paths overlaps forbidden_paths at '${allowed}'`);
    }
  }

  const riskClass = raw.risk_class;
  if (!Number.isInteger(riskClass) || riskClass < 1 || riskClass > 4) throw new Error("risk_class must be an integer from 1 to 4");
  for (const field of ["production_mutation_allowed", "merge_allowed", "auto_merge_allowed"]) {
    if (raw[field] !== false) throw new Error(`${field} must be false`);
  }

  return {
    task_id: taskId,
    supervisor_issue: SUPERVISOR_ISSUE,
    repository: EXPECTED_REPOSITORY,
    task_title: assertPlainString(raw.task_title, "task_title", 120),
    task_goal: assertPlainString(raw.task_goal, "task_goal", 4000),
    graph_path: assertSafeGraphPath(raw.graph_path),
    base_sha: baseSha,
    branch,
    allowed_paths: allowedPaths,
    forbidden_paths: forbiddenPaths,
    required_checks: normalizeChecks(raw.required_checks),
    risk_class: riskClass,
    production_mutation_allowed: false,
    merge_allowed: false,
    auto_merge_allowed: false,
  };
}

export function parseTaskPacketComment(body) {
  if (typeof body !== "string") throw new Error("comment body must be a string");
  if (countOccurrences(body, TASK_PACKET_MARKER) !== 1) throw new Error("comment must contain exactly one Task Packet marker");
  const markerIndex = body.indexOf(TASK_PACKET_MARKER);
  const afterMarker = body.slice(markerIndex + TASK_PACKET_MARKER.length);
  const matches = [...afterMarker.matchAll(/```json[ \t]*\r?\n([\s\S]*?)\r?\n```/gi)];
  if (matches.length !== 1) throw new Error("Task Packet marker must be followed by exactly one fenced JSON block");
  let parsed;
  try {
    parsed = JSON.parse(matches[0][1]);
  } catch {
    throw new Error("Task Packet JSON is malformed");
  }
  return normalizeTaskPacket(parsed);
}

export function packetDigest(packet) {
  const normalized = normalizeTaskPacket(packet);
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function parseTaskMetadata(body = "") {
  const taskId = body.match(/^Task ID:\s*([A-Z][A-Z0-9-]{1,63})\s*$/mi)?.[1]?.toUpperCase() ?? "";
  const graphPath = body.match(/^Graph path:\s*([^\s]+)\s*$/mi)?.[1]?.toLowerCase() ?? "";
  const allowedLine = body.match(/^Allowed paths:\s*(\[[^\r\n]*\])\s*$/mi)?.[1] ?? "";
  let allowedPaths = null;
  if (allowedLine) {
    try {
      const value = JSON.parse(allowedLine);
      allowedPaths = Array.isArray(value) ? value : null;
    } catch {
      allowedPaths = null;
    }
  }
  return { taskId, graphPath, allowedPaths };
}

function parseTrustedTaskState(comments, taskId) {
  if (!Array.isArray(comments)) return null;
  const marker = `${TASK_STATE_MARKER_PREFIX}${taskId} -->`;
  const candidates = comments
    .filter((comment) => comment?.user?.login === "github-actions[bot]" && typeof comment.body === "string" && comment.body.includes(marker))
    .map((comment) => {
      const state = comment.body.match(/^- State:\s*`([A-Z][A-Z0-9_]{2,39})`\s*$/mi)?.[1] ?? "";
      const runId = comment.body.match(/^- Run ID:\s*`([0-9]+)`\s*$/mi)?.[1] ?? "";
      const prNumber = Number(comment.body.match(/^- PR:\s*#([1-9][0-9]*)\s*$/mi)?.[1] ?? 0) || null;
      return { id: Number(comment.id) || 0, created_at: String(comment.created_at ?? ""), state, run_id: runId, pr_number: prNumber };
    })
    .filter((entry) => STATE_RE.test(entry.state))
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "") || a.id - b.id);
  return candidates.at(-1) ?? null;
}

function normalizePr(pr) {
  return {
    number: Number(pr?.number) || 0,
    head_ref: String(pr?.head_ref ?? ""),
    head_sha: String(pr?.head_sha ?? "").toLowerCase(),
    base_ref: String(pr?.base_ref ?? ""),
    head_repo: String(pr?.head_repo ?? ""),
    author: String(pr?.author ?? ""),
    body: String(pr?.body ?? ""),
    files: Array.isArray(pr?.files) ? pr.files.map(String) : null,
  };
}

function blocked(reason, packet = null, code = "blocked") {
  return { ok: false, status: "TASK_BLOCKED", code, reason, packet };
}

export function evaluateDispatchContext(context) {
  const event = context?.event ?? {};
  if (event.repository !== EXPECTED_REPOSITORY) return blocked("repository event is not trusted", null, "wrong_repository");
  if (Number(event.issue_number) !== SUPERVISOR_ISSUE) return blocked("Task Packet did not originate from Supervisor issue #548", null, "wrong_supervisor_issue");
  if (event.actor !== TRUSTED_SUPERVISOR_ACTOR) return blocked("Task Packet actor is not the trusted repository owner", null, "unauthorized_actor");
  if (event.is_fork === true) return blocked("fork or cross-repository dispatch sources are not trusted", null, "fork_source");

  let packet;
  try {
    packet = parseTaskPacketComment(String(event.comment_body ?? ""));
  } catch (error) {
    return blocked(error instanceof Error ? error.message : "Task Packet is malformed", null, "malformed_packet");
  }

  if (!Array.isArray(context.supervisor_labels) || !context.supervisor_labels.includes(DISPATCH_ENABLE_LABEL)) {
    return blocked(`dispatch kill switch is OFF; #548 must carry '${DISPATCH_ENABLE_LABEL}'`, packet, "kill_switch_off");
  }

  if (context?.secrets?.openai !== true || context?.secrets?.push !== true) {
    return blocked("existing authenticated Codex/push dispatch capability is unavailable", packet, "dispatch_auth_unavailable");
  }

  const liveMainSha = String(context.live_main_sha ?? "").toLowerCase();
  if (!SHA_RE.test(liveMainSha)) return blocked("live main SHA evidence is missing or malformed", packet, "live_main_unknown");
  if (packet.base_sha !== liveMainSha) return blocked(`Task Packet base ${packet.base_sha} is stale; live main is ${liveMainSha}`, packet, "stale_base");

  const currentRunId = String(context.run_id ?? "");
  const taskState = parseTrustedTaskState(context.comments, packet.task_id);
  if (taskState && taskState.state !== "TASK_BLOCKED") {
    const sameRunTaskCreated = taskState.state === "TASK_CREATED" && currentRunId && taskState.run_id === currentRunId;
    if (!sameRunTaskCreated && ACTIVE_TASK_STATES.has(taskState.state)) {
      return {
        ok: false,
        status: "ALREADY_DISPATCHED",
        code: "existing_task_state",
        reason: `task ${packet.task_id} already has trusted state ${taskState.state}`,
        packet,
        existing_state: taskState,
      };
    }
  }

  const prs = Array.isArray(context.open_prs) ? context.open_prs.map(normalizePr) : null;
  if (!prs) return blocked("open pull-request evidence is missing", packet, "pr_evidence_missing");

  const matchingTaskPrs = [];
  for (const pr of prs) {
    if (!Number.isInteger(pr.number) || pr.number <= 0 || pr.base_ref !== "main") continue;
    const metadata = parseTaskMetadata(pr.body);
    if (metadata.taskId === packet.task_id) matchingTaskPrs.push({ pr, metadata });
  }
  if (matchingTaskPrs.length > 0) {
    const exact = matchingTaskPrs.find(({ pr }) => pr.head_ref === packet.branch && pr.head_repo === EXPECTED_REPOSITORY);
    if (exact) {
      return {
        ok: false,
        status: "ALREADY_DISPATCHED",
        code: "existing_task_pr",
        reason: `task ${packet.task_id} already has PR #${exact.pr.number}`,
        packet,
        existing_pr: exact.pr.number,
      };
    }
    return blocked(`task ID ${packet.task_id} is already bound to a different PR`, packet, "task_id_collision");
  }

  if (context?.branch?.exists === true) {
    return blocked(`branch ${packet.branch} already exists without a trusted matching task PR`, packet, "branch_exists");
  }

  let activeWorkerCount = 0;
  for (const rawPr of prs) {
    const pr = normalizePr(rawPr);
    if (!Number.isInteger(pr.number) || pr.number <= 0 || pr.base_ref !== "main") continue;
    if (!Array.isArray(pr.files)) return blocked(`changed-file evidence is missing for open PR #${pr.number}`, packet, "pr_files_missing");
    for (const file of pr.files) {
      try {
        assertSafeScope(file, `PR #${pr.number} file`);
      } catch {
        return blocked(`changed-file evidence for PR #${pr.number} is malformed`, packet, "pr_files_malformed");
      }
    }

    const isWorkerPr = pr.head_ref.startsWith("work/proffera-");
    const isDependabot = pr.author === "dependabot[bot]" || pr.head_ref.startsWith("dependabot/");

    if (isWorkerPr) {
      activeWorkerCount += 1;
      if (pr.head_repo !== EXPECTED_REPOSITORY || pr.author !== TRUSTED_SUPERVISOR_ACTOR) {
        return blocked(`open Worker PR #${pr.number} is not a trusted same-repository owner branch`, packet, "untrusted_worker_pr");
      }
      const metadata = parseTaskMetadata(pr.body);
      if (!metadata.graphPath || !GRAPH_RE.test(metadata.graphPath) || metadata.graphPath.split("/").some((part) => part === "." || part === "..")) {
        return blocked(`graph-path ownership is ambiguous for open Worker PR #${pr.number}`, packet, "ambiguous_graph_owner");
      }
      if (graphPathsIntersect(metadata.graphPath, packet.graph_path)) {
        return blocked(`graph path ${packet.graph_path} is already owned by PR #${pr.number}`, packet, "graph_collision");
      }
      if (!Array.isArray(metadata.allowedPaths)) {
        return blocked(`scope ownership is ambiguous for open Worker PR #${pr.number}`, packet, "ambiguous_scope_owner");
      }
      let normalizedOtherScopes;
      try {
        normalizedOtherScopes = normalizeScopeArray(metadata.allowedPaths, `PR #${pr.number} Allowed paths`);
      } catch {
        return blocked(`scope ownership is malformed for open Worker PR #${pr.number}`, packet, "ambiguous_scope_owner");
      }
      if (packet.allowed_paths.some((left) => normalizedOtherScopes.some((right) => scopesIntersect(left, right)))) {
        return blocked(`declared scope overlaps open Worker PR #${pr.number}`, packet, "declared_scope_overlap");
      }
    }

    if (isWorkerPr || isDependabot) {
      const overlap = pr.files.find((file) => packet.allowed_paths.some((scope) => scopeCovers(scope, file)));
      if (overlap) {
        return blocked(`file scope '${overlap}' overlaps open PR #${pr.number}`, packet, isDependabot ? "dependabot_overlap" : "file_overlap");
      }
    }
  }

  if (activeWorkerCount >= 2) {
    return blocked("global writable Worker limit is already two; refusing a third Worker", packet, "writable_worker_limit");
  }

  return {
    ok: true,
    status: "TASK_CREATED",
    code: "accepted",
    reason: "Task Packet is trusted, fresh, bounded, independent, and dispatchable",
    packet,
    packet_digest: packetDigest(packet),
  };
}

export function validateChangedFiles(packetInput, changedFilesInput) {
  const packet = normalizeTaskPacket(packetInput);
  if (!Array.isArray(changedFilesInput)) return blocked("changed-file evidence is missing", packet, "changed_files_missing");
  const changedFiles = changedFilesInput.map(String).filter(Boolean);
  if (changedFiles.length === 0) return blocked("Worker produced no repository changes", packet, "no_changes");
  if (new Set(changedFiles).size !== changedFiles.length) return blocked("changed-file evidence contains duplicates", packet, "changed_files_duplicate");

  for (const file of changedFiles) {
    try {
      assertSafeScope(file, "changed file");
    } catch (error) {
      return blocked(error instanceof Error ? error.message : "changed file is malformed", packet, "changed_file_malformed");
    }
    if (isHardBlockedPath(file)) return blocked(`Worker touched hard-blocked path '${file}'`, packet, "hard_blocked_change");
    if (packet.forbidden_paths.some((scope) => scopeCovers(scope, file))) {
      return blocked(`Worker touched forbidden path '${file}'`, packet, "forbidden_change");
    }
    if (!packet.allowed_paths.some((scope) => scopeCovers(scope, file))) {
      return blocked(`Worker expanded outside allowed_paths with '${file}'`, packet, "out_of_scope_change");
    }
  }

  return { ok: true, status: "VALID", code: "changes_bounded", reason: "all changed files remain inside the Task Packet scope", packet, changed_files: changedFiles };
}

function publicationInvalid(code, reason) {
  return { ok: false, status: "INVALID", code, reason };
}

function publicationFailure(code, reason) {
  const error = new Error(reason);
  error.code = code;
  throw error;
}

function normalizePublicationPaths(value, field) {
  const paths = normalizeScopeArray(value, field);
  for (const path of paths) {
    if (path.endsWith("/")) publicationFailure("path_set_mismatch", `${field} must contain file paths, not directory scopes`);
  }
  return paths;
}

function samePathSet(left, right) {
  if (left.length !== right.length) return false;
  const expected = [...left].sort();
  const actual = [...right].sort();
  return expected.every((path, index) => path === actual[index]);
}

function parseUnifiedDiffPaths(value) {
  if (typeof value !== "string" || !value.startsWith("diff --git ") || !value.endsWith("\n")) {
    publicationFailure("diff_incomplete", "unified_diff must be a complete newline-terminated git diff");
  }
  const text = value;
  if (text.includes("GIT binary patch") || text.includes("Binary files ")) {
    publicationFailure("diff_incomplete", "binary diffs are not valid full-replacement publication artifacts");
  }
  const lines = text.split("\n");
  lines.pop();
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith("diff --git ")) starts.push(index);
  }
  if (starts.length === 0 || starts[0] !== 0) publicationFailure("diff_incomplete", "unified_diff has no complete file section");

  const paths = [];
  for (let sectionIndex = 0; sectionIndex < starts.length; sectionIndex += 1) {
    const section = lines.slice(starts[sectionIndex], starts[sectionIndex + 1] ?? lines.length);
    const header = section[0].match(/^diff --git a\/(\S+) b\/(\S+)$/);
    if (!header || header[1] !== header[2]) publicationFailure("diff_incomplete", "each diff section must identify one unambiguous repository path");
    let path;
    try {
      path = assertSafeScope(header[1], "unified diff path");
    } catch (error) {
      publicationFailure("diff_incomplete", error instanceof Error ? error.message : "unified diff path is malformed");
    }
    if (path.endsWith("/") || paths.includes(path)) publicationFailure("diff_incomplete", `unified diff path '${path}' is duplicated or not a file`);

    const firstHunk = section.findIndex((line) => line.startsWith("@@ "));
    if (firstHunk < 0) publicationFailure("diff_incomplete", `unified diff section '${path}' has no complete text hunk`);
    const preamble = section.slice(1, firstHunk);
    const oldHeaders = preamble.filter((line) => line.startsWith("--- "));
    const newHeaders = preamble.filter((line) => line.startsWith("+++ "));
    if (oldHeaders.length !== 1 || newHeaders.length !== 1) {
      publicationFailure("diff_incomplete", `unified diff section '${path}' must contain its own old and new file headers`);
    }
    const oldHeader = oldHeaders[0];
    const newHeader = newHeaders[0];
    if (oldHeader !== `--- a/${path}` && oldHeader !== "--- /dev/null") {
      publicationFailure("diff_incomplete", `unified diff old-file header does not match '${path}'`);
    }
    if (newHeader !== `+++ b/${path}` && newHeader !== "+++ /dev/null") {
      publicationFailure("diff_incomplete", `unified diff new-file header does not match '${path}'`);
    }
    if (oldHeader === "--- /dev/null" && newHeader === "+++ /dev/null") {
      publicationFailure("diff_incomplete", `unified diff section '${path}' has no source or destination file`);
    }
    const indexHeaders = preamble.filter((line) => line.startsWith("index "));
    const indexHeader = indexHeaders.length === 1
      ? indexHeaders[0].match(/^index ([0-9a-f]{40})\.\.([0-9a-f]{40})(?: ([0-7]{6}))?$/)
      : null;
    if (!indexHeader) {
      publicationFailure("diff_incomplete", `unified diff section '${path}' must contain one full Git blob index`);
    }
    const added = oldHeader === "--- /dev/null";
    const deleted = newHeader === "+++ /dev/null";
    if (added !== /^0{40}$/.test(indexHeader[1]) || deleted !== /^0{40}$/.test(indexHeader[2])) {
      publicationFailure("diff_incomplete", `unified diff section '${path}' has inconsistent file and Git blob headers`);
    }
    const modeLines = preamble.filter((line) => /^(?:old mode|new mode|new file mode|deleted file mode) /.test(line));
    const expectedModeLine = added ? "new file mode 100644" : deleted ? "deleted file mode 100644" : null;
    const supportedMode = expectedModeLine
      ? modeLines.length === 1 && modeLines[0] === expectedModeLine && indexHeader[3] === undefined
      : modeLines.length === 0 && indexHeader[3] === "100644";
    if (!supportedMode) {
      publicationFailure("unsupported_mode", `deterministic fallback does not support Git mode semantics for '${path}'`);
    }

    let cursor = firstHunk;
    while (cursor < section.length) {
      const hunk = section[cursor].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/);
      if (!hunk) publicationFailure("diff_incomplete", `unified diff section '${path}' has malformed or trailing hunk data`);
      const expectedOld = hunk[2] === undefined ? 1 : Number(hunk[2]);
      const expectedNew = hunk[4] === undefined ? 1 : Number(hunk[4]);
      let oldLines = 0;
      let newLines = 0;
      cursor += 1;
      while (cursor < section.length && !section[cursor].startsWith("@@ ")) {
        const line = section[cursor];
        if (line === "\\ No newline at end of file") {
          cursor += 1;
          continue;
        }
        if (line.startsWith(" ")) {
          oldLines += 1;
          newLines += 1;
        } else if (line.startsWith("-")) {
          oldLines += 1;
        } else if (line.startsWith("+")) {
          newLines += 1;
        } else {
          publicationFailure("diff_incomplete", `unified diff section '${path}' contains truncated hunk data`);
        }
        cursor += 1;
      }
      if (oldLines !== expectedOld || newLines !== expectedNew) {
        publicationFailure("diff_incomplete", `unified diff section '${path}' hunk line counts do not match its header`);
      }
    }
    paths.push({ path, old_blob_sha: indexHeader[1], new_blob_sha: indexHeader[2], added, deleted, section });
  }
  return paths;
}

function gitOutput(args, options = {}) {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: MAX_PUBLICATION_BYTES, ...options });
  } catch {
    publicationFailure("source_unavailable", "exact publication source bytes are unavailable from Git");
  }
}

function gitObjectExists(spec) {
  try {
    execFileSync("git", ["cat-file", "-e", spec], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function applyUnifiedDiffSection(source, entry) {
  const sourceEndsNewline = source.endsWith("\n");
  const sourceLines = source.length ? source.split("\n") : [];
  if (sourceEndsNewline) sourceLines.pop();
  const firstHunk = entry.section.findIndex((line) => line.startsWith("@@ "));
  const result = [];
  let sourceIndex = 0;
  let targetEndsNewline = sourceEndsNewline;
  let previousPrefix = "";
  let cursor = firstHunk;
  while (cursor < entry.section.length) {
    const match = entry.section[cursor].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/);
    if (!match) publicationFailure("diff_incomplete", `unified diff section '${entry.path}' has malformed hunks`);
    const oldStart = Number(match[1]);
    const oldCount = match[2] === undefined ? 1 : Number(match[2]);
    const newStart = Number(match[3]);
    const newCount = match[4] === undefined ? 1 : Number(match[4]);
    const hunkStart = oldCount === 0 ? oldStart : Math.max(0, oldStart - 1);
    const targetHunkStart = newCount === 0 ? newStart : Math.max(0, newStart - 1);
    if (hunkStart < sourceIndex) publicationFailure("diff_source_mismatch", `unified diff hunks overlap for '${entry.path}'`);
    result.push(...sourceLines.slice(sourceIndex, hunkStart));
    if (result.length !== targetHunkStart) {
      publicationFailure("diff_source_mismatch", `unified diff target hunk coordinates do not match reconstructed target for '${entry.path}'`);
    }
    sourceIndex = hunkStart;
    cursor += 1;
    while (cursor < entry.section.length && !entry.section[cursor].startsWith("@@ ")) {
      const line = entry.section[cursor];
      if (line === "\\ No newline at end of file") {
        if (!previousPrefix) publicationFailure("diff_incomplete", `unified diff section '${entry.path}' has a misplaced final-newline marker`);
        if ((previousPrefix === "-" || previousPrefix === " ") && sourceEndsNewline) {
          publicationFailure("diff_source_mismatch", `unified diff final-newline marker does not match exact source bytes for '${entry.path}'`);
        }
        if (previousPrefix === "+" || previousPrefix === " ") targetEndsNewline = false;
        previousPrefix = "";
        cursor += 1;
        continue;
      }
      const value = line.slice(1);
      if (line.startsWith(" ") || line.startsWith("-")) {
        if (sourceLines[sourceIndex] !== value) publicationFailure("diff_source_mismatch", `unified diff does not match exact source bytes for '${entry.path}'`);
        sourceIndex += 1;
      }
      if (line.startsWith(" ") || line.startsWith("+")) {
        result.push(value);
        targetEndsNewline = true;
      }
      previousPrefix = line[0];
      cursor += 1;
    }
  }
  result.push(...sourceLines.slice(sourceIndex));
  if (entry.deleted) {
    if (result.length !== 0 || sourceIndex !== sourceLines.length) {
      publicationFailure("diff_source_mismatch", `deletion diff must consume the complete exact source and leave no target lines for '${entry.path}'`);
    }
    return "";
  }
  return `${result.join("\n")}${targetEndsNewline ? "\n" : ""}`;
}

function replacementContent(entry) {
  if (entry?.deleted === true) {
    if (Object.prototype.hasOwnProperty.call(entry, "content") || Object.prototype.hasOwnProperty.call(entry, "chunks")) {
      publicationFailure("replacement_incomplete", "deleted replacements must not fabricate target content");
    }
    return "";
  }
  const hasContent = Object.prototype.hasOwnProperty.call(entry, "content");
  const hasChunks = Object.prototype.hasOwnProperty.call(entry, "chunks");
  if (hasContent === hasChunks) publicationFailure("replacement_incomplete", "each replacement must provide exactly one of content or chunks");
  if (hasContent) {
    if (typeof entry.content !== "string") publicationFailure("replacement_incomplete", "replacement content must be a string");
    return entry.content;
  }
  if (!Array.isArray(entry.chunks) || entry.chunks.length === 0) publicationFailure("missing_chunk", "replacement chunks must not be empty");
  const total = entry.chunks[0]?.total;
  if (!Number.isInteger(total) || total <= 0 || total !== entry.chunks.length) {
    publicationFailure("missing_chunk", "replacement chunk total does not match the supplied chunk count");
  }
  return entry.chunks.map((chunk, index) => {
    if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) publicationFailure("missing_chunk", "replacement chunk is malformed");
    if (chunk.number !== index + 1 || chunk.total !== total) publicationFailure("missing_chunk", "replacement chunks must be numbered contiguously from one");
    if (typeof chunk.content !== "string") publicationFailure("missing_chunk", "replacement chunk content must be a string");
    return chunk.content;
  }).join("");
}

function replacementLineCount(content) {
  if (content.length === 0) return 0;
  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}

export function validatePublicationArtifact(input) {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) publicationFailure("artifact_malformed", "publication validation input must be an object");
    const currentSourceHead = assertPlainString(input.current_source_head, "current_source_head", 40).toLowerCase();
    if (!SHA_RE.test(currentSourceHead)) publicationFailure("artifact_malformed", "current_source_head must be a 40-character commit SHA");
    let packet;
    try { packet = normalizeTaskPacket(input.packet); } catch (error) { publicationFailure("packet_invalid", error instanceof Error ? error.message : "Task Packet is invalid"); }
    const artifact = input.artifact;
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) publicationFailure("artifact_malformed", "artifact must be an object");
    const sourceHead = assertPlainString(artifact.source_head, "artifact.source_head", 40).toLowerCase();
    if (!SHA_RE.test(sourceHead)) publicationFailure("artifact_malformed", "artifact.source_head must be a 40-character commit SHA");
    if (sourceHead !== currentSourceHead || packet.base_sha !== sourceHead) publicationFailure("stale_source_head", "publication source must equal the live head and Task Packet baseline");
    if (artifact.artifact_set_complete !== "YES") publicationFailure("artifact_incomplete", "ARTIFACT_SET_COMPLETE must be exactly YES");
    if (Buffer.byteLength(String(artifact.unified_diff ?? ""), "utf8") > MAX_PUBLICATION_BYTES) publicationFailure("artifact_oversized", "unified diff exceeds the publication limit");

    const paths = normalizePublicationPaths(artifact.paths, "artifact.paths");
    const scope = validateChangedFiles(packet, paths);
    if (!scope.ok) publicationFailure(scope.code, scope.reason);
    const diffEntries = parseUnifiedDiffPaths(artifact.unified_diff);
    if (!samePathSet(paths, diffEntries.map((entry) => entry.path))) publicationFailure("path_set_mismatch", "unified diff path set does not exactly match artifact.paths");
    if (!Array.isArray(artifact.replacements) || !Array.isArray(artifact.manifest)) publicationFailure("artifact_malformed", "artifact replacements and manifest must be arrays");
    const replacementPaths = artifact.replacements.map((entry) => String(entry?.path ?? ""));
    const manifestPaths = artifact.manifest.map((entry) => String(entry?.path ?? ""));
    if (!samePathSet(paths, replacementPaths) || !samePathSet(paths, manifestPaths) || new Set(replacementPaths).size !== replacementPaths.length || new Set(manifestPaths).size !== manifestPaths.length) publicationFailure("path_set_mismatch", "replacement and manifest path sets must exactly match artifact.paths without duplicates");

    const manifests = new Map(artifact.manifest.map((entry) => [entry.path, entry]));
    const diffs = new Map(diffEntries.map((entry) => [entry.path, entry]));
    let aggregateBytes = 0;
    for (const replacement of artifact.replacements) {
      const path = assertSafeScope(replacement.path, "replacement path");
      const content = replacementContent(replacement);
      const bytes = Buffer.from(content, "utf8");
      aggregateBytes += bytes.length;
      if (aggregateBytes > MAX_PUBLICATION_BYTES || bytes.toString("utf8") !== content) publicationFailure("replacement_incomplete", `replacement '${path}' is oversized or not lossless UTF-8 text`);
      const manifest = manifests.get(path);
      const diff = diffs.get(path);
      const deleted = replacement.deleted === true;
      if (deleted !== (diff.deleted === true) || (manifest?.deleted === true) !== deleted) publicationFailure("replacement_incomplete", `deletion state does not match for '${path}'`);
      if (!manifest || manifest.bytes !== bytes.length) publicationFailure("byte_count_mismatch", `replacement '${path}' byte count does not match its manifest`);
      if (manifest.lines !== replacementLineCount(content)) publicationFailure("line_count_mismatch", `replacement '${path}' line count does not match its manifest`);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
      const expectedBlob = deleted ? "0".repeat(40) : blob;
      if (manifest.sha256 !== sha256 || manifest.git_blob_sha !== expectedBlob || diff.new_blob_sha !== expectedBlob) publicationFailure("digest_mismatch", `replacement '${path}' digest does not match its manifest and unified diff`);
      const sourceIsAdded = /^0{40}$/.test(diff.old_blob_sha);
      let source = "";
      if (sourceIsAdded) {
        const existingSourceEntry = gitOutput(["ls-tree", sourceHead, "--", path]).trim();
        if (existingSourceEntry) {
          publicationFailure("diff_source_mismatch", `unified diff marks existing source path as added for '${path}'`);
        }
      } else {
        source = gitOutput(["show", `${sourceHead}:${path}`]);
      }
      const sourceBytes = Buffer.from(source, "utf8");
      const sourceBlob = createHash("sha1").update(`blob ${sourceBytes.length}\0`).update(sourceBytes).digest("hex");
      if (sourceBytes.length + aggregateBytes > MAX_PUBLICATION_BYTES || (!sourceIsAdded && sourceBlob !== diff.old_blob_sha)) publicationFailure("diff_source_mismatch", `unified diff old blob does not match exact source for '${path}'`);
      if (applyUnifiedDiffSection(source, diff) !== content) publicationFailure("diff_replacement_mismatch", `unified diff result diverges from replacement '${path}'`);
    }
    return { ok: true, status: "VALID", code: "publication_artifact_valid", reason: "publication artifact is Task Packet scoped and exact-source/diff/replacement verified", source_head: sourceHead, paths };
  } catch (error) {
    return publicationInvalid(error?.code ?? "artifact_malformed", error instanceof Error ? error.message : "publication artifact is malformed");
  }
}

export function buildPublicationArtifact({ packet: packetInput, source_head, target_head }) {
  const packet = normalizeTaskPacket(packetInput);
  const sourceHead = assertPlainString(source_head, "source_head", 40).toLowerCase();
  const targetHead = assertPlainString(target_head, "target_head", 40).toLowerCase();
  if (!SHA_RE.test(sourceHead) || !SHA_RE.test(targetHead) || packet.base_sha !== sourceHead) throw new Error("publication heads are malformed or do not match Task Packet baseline");
  const unifiedDiff = gitOutput(["diff", "--full-index", "--no-renames", "--no-ext-diff", `${sourceHead}..${targetHead}`]);
  const paths = gitOutput(["diff", "--name-only", "--no-renames", `${sourceHead}..${targetHead}`]).trim().split("\n").filter(Boolean);
  const bounded = validateChangedFiles(packet, paths);
  if (!bounded.ok) throw new Error(bounded.reason);
  const replacements = paths.map((path) => gitObjectExists(`${targetHead}:${path}`)
    ? { path, content: gitOutput(["show", `${targetHead}:${path}`]) }
    : { path, deleted: true });
  const manifest = replacements.map((replacement) => {
    const content = replacement.deleted ? "" : replacement.content;
    const bytes = Buffer.from(content);
    return { path: replacement.path, ...(replacement.deleted ? { deleted: true } : {}), bytes: bytes.length, lines: replacementLineCount(content), sha256: createHash("sha256").update(bytes).digest("hex"), git_blob_sha: replacement.deleted ? "0".repeat(40) : createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") };
  });
  const artifact = { source_head: sourceHead, artifact_set_complete: "YES", paths, unified_diff: unifiedDiff, replacements, manifest };
  const validation = validatePublicationArtifact({ packet, current_source_head: sourceHead, artifact });
  if (!validation.ok) throw new Error(validation.reason);
  return artifact;
}

export function parseTaskStateBody(body = "") {
  const text = String(body ?? "");
  const state = text.match(/^- State:\s*`([A-Z][A-Z0-9_]{2,39})`\s*$/mi)?.[1] ?? "";
  const headSha = text.match(/^- Head:\s*`([0-9a-f]{40})`\s*$/mi)?.[1]?.toLowerCase() ?? "";
  const prNumber = Number(text.match(/^- PR:\s*#([1-9][0-9]*)\s*$/mi)?.[1] ?? 0) || null;
  return { state: STATE_RE.test(state) ? state : "", head_sha: SHA_RE.test(headSha) ? headSha : "", pr_number: prNumber };
}

function transitionResult(ok, apply, code, reason, current, requestedState, requestedHead, liveHead) {
  return {
    ok,
    apply,
    code,
    reason,
    current_state: current.state || "",
    current_head: current.head_sha || "",
    requested_state: requestedState,
    requested_head: requestedHead,
    live_head: liveHead,
  };
}

export function evaluateTaskStateTransition(input) {
  const source = assertPlainString(String(input?.source ?? ""), "source", 20).toLowerCase();
  if (source !== "lifecycle" && source !== "checks") throw new Error("source must be lifecycle or checks");

  const requestedState = assertPlainString(String(input?.requested_state ?? ""), "requested_state", 40).toUpperCase();
  if (!STATE_RE.test(requestedState)) throw new Error("requested_state is malformed");

  const requestedHead = assertPlainString(String(input?.requested_head ?? ""), "requested_head", 40).toLowerCase();
  const liveHead = assertPlainString(String(input?.live_head ?? ""), "live_head", 40).toLowerCase();
  if (!SHA_RE.test(requestedHead) || !SHA_RE.test(liveHead)) throw new Error("requested/live head SHA is malformed");

  const livePrState = assertPlainString(String(input?.live_pr_state ?? ""), "live_pr_state", 10).toLowerCase();
  if (livePrState !== "open" && livePrState !== "closed") throw new Error("live_pr_state must be open or closed");
  const liveMerged = input?.live_merged === true;
  const current = parseTaskStateBody(input?.current_body ?? "");

  if (requestedHead !== liveHead) {
    return transitionResult(false, false, "stale_event_head", "event/check head no longer matches the live PR head", current, requestedState, requestedHead, liveHead);
  }

  if (TERMINAL_TASK_STATES.has(current.state)) {
    return transitionResult(true, false, "terminal_state_preserved", `terminal state ${current.state} cannot regress`, current, requestedState, requestedHead, liveHead);
  }

  if (livePrState === "closed") {
    const canonicalTerminal = liveMerged ? "MERGED" : "CLOSED_UNMERGED";
    if (requestedState !== canonicalTerminal) {
      return transitionResult(false, false, "live_pr_terminal", `live PR is closed; only ${canonicalTerminal} may be recorded`, current, requestedState, requestedHead, liveHead);
    }
  } else if (TERMINAL_TASK_STATES.has(requestedState)) {
    return transitionResult(false, false, "live_pr_open", "open live PR cannot be reconciled to a terminal task state", current, requestedState, requestedHead, liveHead);
  }

  if (livePrState === "open" && source === "lifecycle" && current.state === "READY_FOR_SUPERVISOR" && current.head_sha === liveHead && requestedState !== "READY_FOR_SUPERVISOR") {
    return transitionResult(false, false, "ready_same_head_regression", "delayed lifecycle event cannot regress READY_FOR_SUPERVISOR for the same live head", current, requestedState, requestedHead, liveHead);
  }

  if (livePrState === "open" && source === "lifecycle" && current.head_sha === liveHead) {
    const currentRank = LIFECYCLE_RANK[current.state] ?? 0;
    const requestedRank = LIFECYCLE_RANK[requestedState] ?? 0;
    if (currentRank > 0 && requestedRank > 0 && requestedRank < currentRank) {
      return transitionResult(false, false, "lifecycle_regression", `lifecycle transition ${current.state} -> ${requestedState} is stale/regressive for the same head`, current, requestedState, requestedHead, liveHead);
    }
  }

  if (current.state === requestedState && (!current.head_sha || current.head_sha === requestedHead)) {
    return transitionResult(true, false, "duplicate_event", "requested state is already recorded for this head", current, requestedState, requestedHead, liveHead);
  }

  return transitionResult(true, true, "transition_allowed", "transition is current-head bound and non-regressive", current, requestedState, requestedHead, liveHead);
}

function cleanReason(reason) {
  const text = String(reason ?? "").replace(/[\r\n]+/g, " ").replace(/`/g, "'").trim();
  return text.slice(0, 500) || "not specified";
}

export function taskStateBody({ packet: packetInput, state, reason, run_id = "", pr_number = null, head_sha = "" }) {
  const packet = normalizeTaskPacket(packetInput);
  const normalizedState = assertPlainString(state, "state", 40).toUpperCase();
  if (!STATE_RE.test(normalizedState)) throw new Error("state is malformed");
  const runId = String(run_id ?? "");
  if (runId && !/^[0-9]+$/.test(runId)) throw new Error("run_id is malformed");
  const headSha = String(head_sha ?? "").toLowerCase();
  if (headSha && !SHA_RE.test(headSha)) throw new Error("head_sha is malformed");
  if (pr_number !== null && (!Number.isInteger(Number(pr_number)) || Number(pr_number) <= 0)) throw new Error("pr_number is malformed");
  if (normalizedState === "READY_FOR_SUPERVISOR" && (!headSha || pr_number === null)) {
    throw new Error("READY_FOR_SUPERVISOR requires an exact head_sha and pr_number");
  }

  const lines = [
    `${TASK_STATE_MARKER_PREFIX}${packet.task_id} -->`,
    `### Supervisor task: ${packet.task_id}`,
    `- State: \`${normalizedState}\``,
    `- Graph path: \`${packet.graph_path}\``,
    `- Branch: \`${packet.branch}\``,
    `- Base: \`${packet.base_sha}\``,
    `- Packet SHA-256: \`${packetDigest(packet)}\``,
  ];
  if (runId) lines.push(`- Run ID: \`${runId}\``);
  if (pr_number !== null) lines.push(`- PR: #${Number(pr_number)}`);
  if (headSha) lines.push(`- Head: \`${headSha}\``);
  if (normalizedState === "READY_FOR_SUPERVISOR") lines.push(`- Ready checkpoint: \`${packet.task_id}@${headSha}\``);
  lines.push(`- Reason: ${cleanReason(reason)}`);
  lines.push("- Production mutation: `false`");
  lines.push("- Merge allowed: `false`");
  lines.push("- Auto-merge allowed: `false`");
  return `${lines.join("\n")}\n`;
}

export function taskRejectionBody({ comment_id, reason }) {
  const commentId = Number(comment_id);
  if (!Number.isInteger(commentId) || commentId <= 0) throw new Error("comment_id is malformed");
  return [
    `<!-- proffera-worker-task-rejection:${commentId} -->`,
    "### Supervisor task: TASK_BLOCKED",
    `- Source comment: ${commentId}`,
    "- State: `TASK_BLOCKED`",
    `- Reason: ${cleanReason(reason)}`,
    "- No Worker branch or PR was created.",
    "",
  ].join("\n");
}

export function taskPrBody(packetInput, changedFilesInput = []) {
  const packet = normalizeTaskPacket(packetInput);
  const changedFiles = Array.isArray(changedFilesInput) ? changedFilesInput.map(String) : [];
  const documentationImpact = changedFiles.includes("docs/CURRENT_STATUS.md") ? "updated" : "none";
  return [
    "Worker bootstrap: complete",
    "Supervisor handoff: #548",
    `Task/issue: ${packet.task_id}`,
    `Bootstrap baseline: ${packet.base_sha}`,
    `Documentation impact: ${documentationImpact}`,
    "",
    `Task ID: ${packet.task_id}`,
    `Graph path: ${packet.graph_path}`,
    `Allowed paths: ${JSON.stringify(packet.allowed_paths)}`,
    `Forbidden paths: ${JSON.stringify(packet.forbidden_paths)}`,
    `Required checks: ${JSON.stringify(packet.required_checks)}`,
    `Risk class: ${packet.risk_class}`,
    "Production mutation allowed: false",
    "Merge allowed: false",
    "Auto-merge allowed: false",
    "",
    TASK_PACKET_MARKER,
    "```json",
    JSON.stringify(packet, null, 2),
    "```",
    "",
    "## Goal",
    packet.task_goal,
    "",
    "## Phase-1 handoff boundary",
    "This PR was created from a Supervisor-selected bounded Task Packet. Human approval remains external and exact-head. The Worker did not merge or enable auto-merge.",
    "",
  ].join("\n");
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function main() {
  const mode = process.argv[2];
  if (!mode) throw new Error("mode is required");
  const input = await readStdin();
  if (mode === "parse") {
    process.stdout.write(`${JSON.stringify(parseTaskPacketComment(input))}\n`);
    return;
  }
  const parsed = input.trim() ? JSON.parse(input) : {};
  if (mode === "evaluate") {
    process.stdout.write(`${JSON.stringify(evaluateDispatchContext(parsed))}\n`);
    return;
  }
  if (mode === "validate-changes") {
    process.stdout.write(`${JSON.stringify(validateChangedFiles(parsed.packet, parsed.changed_files))}\n`);
    return;
  }
  if (mode === "build-publication") {
    process.stdout.write(`${JSON.stringify(buildPublicationArtifact(parsed))}\n`);
    return;
  }
  if (mode === "validate-publication") {
    process.stdout.write(`${JSON.stringify(validatePublicationArtifact(parsed))}\n`);
    return;
  }
  if (mode === "transition") {
    process.stdout.write(`${JSON.stringify(evaluateTaskStateTransition(parsed))}\n`);
    return;
  }
  if (mode === "state-body") {
    process.stdout.write(taskStateBody(parsed));
    return;
  }
  if (mode === "rejection-body") {
    process.stdout.write(taskRejectionBody(parsed));
    return;
  }
  if (mode === "pr-body") {
    process.stdout.write(taskPrBody(parsed.packet ?? parsed, parsed.changed_files ?? []));
    return;
  }
  throw new Error(`unknown mode '${mode}'`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
