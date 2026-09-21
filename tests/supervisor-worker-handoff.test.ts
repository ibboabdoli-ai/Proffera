import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const helper = resolve(process.cwd(), "scripts/supervisor-worker-handoff.mjs");
const ciScopeHelper = resolve(process.cwd(), "scripts/ci-scope-plan.mjs");
const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const taskMarker = "<!-- proffera-worker-task-packet:v1 -->";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replaceAll("\r\n", "\n");
}

function executableRunText(workflow: string) {
  const lines = workflow.split("\n");
  const executable: string[] = [];
  let runIndent: number | null = null;
  for (const line of lines) {
    const block = line.match(/^(\s*)run:\s*\|\s*$/);
    if (block) {
      runIndent = block[1].length;
      continue;
    }
    const inline = line.match(/^\s*run:\s*(.+)$/);
    if (inline) {
      executable.push(inline[1]);
      runIndent = null;
      continue;
    }
    if (runIndent !== null) {
      if (line.trim() === "") {
        executable.push(line);
        continue;
      }
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (indent > runIndent) {
        executable.push(line);
        continue;
      }
      runIndent = null;
    }
  }
  return executable.join("\n");
}

function workflowRunStep(workflow: string, stepName: string) {
  const lines = workflow.split("\n");
  const stepIndex = lines.findIndex((line) => line.trim() === `- name: ${stepName}`);
  expect(stepIndex).toBeGreaterThanOrEqual(0);
  let runIndex = -1;
  for (let index = stepIndex + 1; index < lines.length; index += 1) {
    if (index > stepIndex + 1 && lines[index].trim().startsWith("- name:")) break;
    if (lines[index].trim() === "run: |") {
      runIndex = index;
      break;
    }
  }
  expect(runIndex).toBeGreaterThan(stepIndex);
  const runIndent = lines[runIndex].match(/^\s*/)?.[0].length ?? 0;
  const script: string[] = [];
  for (let index = runIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") {
      script.push("");
      continue;
    }
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= runIndent) break;
    script.push(line.slice(Math.min(line.length, runIndent + 2)));
  }
  return script.join("\n");
}

function expectShellAndJqSyntax(script: string) {
  const shell = spawnSync("bash", ["-n"], { input: script, encoding: "utf8" });
  expect(shell.status, shell.stderr).toBe(0);
  const invocations = [...script.matchAll(/\bjq\b([^\n]*?)'([^']+)'/g)];
  expect(invocations.length).toBeGreaterThan(0);
  for (const invocation of invocations) {
    const options = invocation[1];
    const filter = invocation[2];
    const variables = [...new Set([...options.matchAll(/--arg(?:json)?\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]))];
    const args = ["-n", ...variables.flatMap((variable) => ["--argjson", variable, "null"]), `def __syntax_check: (${filter}); null`];
    const compiled = spawnSync("jq", args, { encoding: "utf8" });
    expect(compiled.status, `${compiled.stderr}\nFilter: ${filter}`).toBe(0);
  }
}

type ReservationEnforcementOptions = {
  body?: string;
  comments?: Array<Record<string, unknown>>;
  eventAction?: string;
  eventActor?: string;
  eventHead?: string;
  failPagedCommentReads?: number;
  liveHead?: string;
  liveAuthor?: string;
  liveHeadRepository?: string;
  liveMerged?: boolean;
  liveState?: string;
};

function exactReservationEvidence(head = sha, overrides: Record<string, unknown> = {}) {
  const body = packetComment();
  const parsed = spawnSync("node", [helper, "parse"], { input: body, encoding: "utf8" });
  expect(parsed.status, parsed.stderr).toBe(0);
  const normalizedPacket = parsed.stdout.replace(/\n+$/, "");
  const parsedPacket = JSON.parse(normalizedPacket);
  const payload = {
    version: 1,
    state: "RESERVED",
    task_id: parsedPacket.task_id,
    run_id: "9001",
    branch: parsedPacket.branch,
    head_sha: head,
    graph_path: parsedPacket.graph_path,
    allowed_paths: parsedPacket.allowed_paths,
    packet_digest: createHash("sha256").update(normalizedPacket).digest("hex"),
    changed_files: ["src/features/test/worker.ts"],
    snapshot_finalized: true,
    lease_expires_at: "2099-01-01T00:00:00Z",
    pr_number: null,
    recovery: null,
    ...overrides,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return {
    body,
    comments: [
      {
        id: 101,
        user: { login: "github-actions[bot]" },
        body: "<!-- proffera-worker-slot-reservation:" + payload.task_id + " -->\n"
          + "### Worker slot reservation: " + payload.task_id + "\n"
          + "- State: `" + payload.state + "`\n"
          + "- Reservation payload: `" + payloadBase64 + "`",
      },
      {
        id: 102,
        user: { login: "github-actions[bot]" },
        body: "<!-- proffera-worker-dispatch-start:" + payload.task_id + ":" + payload.run_id + " -->",
      },
    ],
  };
}

function expiredSameTaskEvidence(
  reservationState: "RESERVED" | "RECOVERABLE",
  overrides: Record<string, unknown> = {},
  normalizedPacket = packet(),
) {
  const runId = String(overrides.run_id ?? "9001");
  const payload = {
    version: 1,
    state: reservationState,
    task_id: normalizedPacket.task_id,
    run_id: runId,
    branch: normalizedPacket.branch,
    head_sha: sha,
    graph_path: normalizedPacket.graph_path,
    packet_digest: createHash("sha256").update(JSON.stringify(normalizedPacket)).digest("hex"),
    lease_expires_at: "2000-01-01T00:00:00Z",
    allowed_paths: normalizedPacket.allowed_paths,
    changed_files: [],
    snapshot_finalized: false,
    pr_number: null,
    recovery: reservationState === "RECOVERABLE"
      ? { kind: "branch", expires_at: "2000-01-01T00:00:00Z" }
      : null,
    ...overrides,
  };
  return {
    packet: normalizedPacket,
    payload,
    comments: [
      reservationComment(payload, 201),
      {
        id: 202,
        user: { login: "github-actions[bot]" },
        body: `<!-- proffera-worker-dispatch-start:${normalizedPacket.task_id}:${runId} -->`,
      },
      {
        id: 203,
        user: { login: "github-actions[bot]" },
        body: runText("state-body", {
          packet: normalizedPacket,
          state: "WORKER_BLOCKED",
          reason: "Prior exact Worker reservation remains blocked.",
          run_id: runId,
          head_sha: sha,
        }),
      },
    ],
  };
}

// Model only the GitHub transport shared by the executable workflow fixtures.
// Admission, ownership decisions, and state writes still run in the real helper.
function reservationControlApiStub() {
  return String.raw`
const controlField = (name) => args.find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1) ?? "";
const controlSave = () => writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
if (method === "POST" && endpoint.endsWith("/labels")) {
  if (state.mutex) process.exit(1);
  state.mutex = controlField("description");
  controlSave();
  process.stdout.write("{}\n");
  process.exit(0);
}
if (endpoint.includes("/labels/proffera-worker-slot-reservation-mutex-v1")) {
  if (!state.mutex) process.exit(1);
  if (method === "DELETE") {
    state.mutex = "";
    controlSave();
    process.stdout.write("{}\n");
  } else if (method === "GET") {
    process.stdout.write(JSON.stringify({ description: state.mutex }) + "\n");
  } else process.exit(2);
  process.exit(0);
}
if (method === "GET" && /\/pulls\?state=open&per_page=100&page=\d+$/.test(endpoint)) {
  const page = Number(endpoint.match(/&page=(\d+)$/)[1]);
  const pulls = (state.pulls ?? [state.pr]).filter((pr) => pr && pr.state === "open");
  process.stdout.write(JSON.stringify(pulls.slice((page - 1) * 100, page * 100)) + "\n");
  process.exit(0);
}
const controlFiles = endpoint.match(/\/pulls\/(\d+)\/files\?per_page=100&page=(\d+)$/);
if (method === "GET" && controlFiles) {
  const pr = (state.pulls ?? [state.pr]).find((item) => String(item?.number) === controlFiles[1]);
  if (!pr) process.exit(3);
  const page = Number(controlFiles[2]);
  process.stdout.write(JSON.stringify((pr.files ?? []).slice((page - 1) * 100, page * 100).map((filename) => ({ filename }))) + "\n");
  process.exit(0);
}
const controlComment = endpoint.match(/\/issues\/comments\/(\d+)$/);
if (method === "GET" && controlComment) {
  const comment = state.comments.find((item) => String(item.id) === controlComment[1]);
  if (!comment) process.exit(3);
  process.stdout.write((args.includes("--jq") ? comment.body : JSON.stringify(comment)) + "\n");
  process.exit(0);
}
`;
}

function runReservationEnforcement({
  body = packetComment(),
  comments = [],
  eventAction = "synchronize",
  eventActor = "ibboabdoli-ai",
  liveHead = sha,
  liveAuthor = "ibboabdoli-ai",
  liveHeadRepository = "ibboabdoli-ai/Proffera",
  eventHead = liveHead,
  failPagedCommentReads = 0,
  liveMerged = false,
  liveState = "open",
}: ReservationEnforcementOptions = {}) {
  const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
  const script = workflowRunStep(workflow, "Require exact durable reservation before accepting Worker PR");
  const root = mkdtempSync(join(tmpdir(), "proffera-reservation-enforcement-"));
  const bin = join(root, "bin");
  const log = join(root, "gh-calls.jsonl");
  const stateFile = join(root, "gh-state.json");
  mkdirSync(bin, { recursive: true });
  writeFileSync(log, "");
  const livePr = {
    number: 849,
    state: liveState,
    merged: liveMerged,
    base: { ref: "main", sha },
    head: {
      sha: liveHead,
      ref: "work/proffera-test-task",
      repo: { full_name: liveHeadRepository },
    },
    user: { login: liveAuthor },
    body,
    files: ["src/features/test/worker.ts"],
  };
  writeFileSync(stateFile, JSON.stringify({ comments, failPagedCommentReads, pagedCommentFailures: 0, pr: livePr }));
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.GH_STUB_LOG, JSON.stringify(args) + "\\n");
const methodIndex = args.indexOf("--method");
const method = methodIndex >= 0 ? args[methodIndex + 1] : "GET";
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const state = JSON.parse(readFileSync(process.env.GH_STUB_STATE_FILE, "utf8"));
${reservationControlApiStub()}
if (args[0] !== "api" || !endpoint) {
  process.stderr.write("unexpected gh call: " + JSON.stringify(args) + "\\n");
  process.exit(2);
}
if (method !== "GET") {
  const bodyArg = args.find((arg) => arg.startsWith("body="));
  const commentMatch = endpoint.match(/issues\\/comments\\/(\\d+)$/);
  if (method === "PATCH" && endpoint === "repos/ibboabdoli-ai/Proffera/pulls/849" && args.includes("state=closed")) {
    state.pr.state = "closed";
    writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  } else if (method === "PATCH" && bodyArg && commentMatch) {
    const comment = state.comments.find((entry) => String(entry.id) === commentMatch[1]);
    if (!comment) process.exit(3);
    comment.body = bodyArg.slice("body=".length);
    writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  } else if (method === "POST" && bodyArg && endpoint === "repos/ibboabdoli-ai/Proffera/issues/548/comments") {
    state.comments.push({ id: 999, user: { login: "github-actions[bot]" }, body: bodyArg.slice("body=".length) });
    writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  }
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/pulls/849") {
  process.stdout.write(JSON.stringify(state.pr) + "\\n");
  process.exit(0);
}
const pagedComments = endpoint.match(/repos\\/ibboabdoli-ai\\/Proffera\\/issues\\/548\\/comments\\?per_page=100&page=(\\d+)$/);
if (pagedComments) {
  if (state.pagedCommentFailures < state.failPagedCommentReads) {
    state.pagedCommentFailures += 1;
    writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
    process.exit(75);
  }
  const page = Number(pagedComments[1]);
  process.stdout.write(JSON.stringify(state.comments.slice((page - 1) * 100, page * 100)) + "\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/issues/548/comments?per_page=100") {
  for (const comment of state.comments) {
    process.stdout.write(JSON.stringify(comment) + "\\n");
  }
  process.exit(0);
}
const directComment = endpoint.match(/repos\\/ibboabdoli-ai\\/Proffera\\/issues\\/comments\\/(\\d+)$/);
if (directComment) {
  const comment = state.comments.find((entry) => String(entry.id) === directComment[1]);
  if (!comment) process.exit(3);
  if (args.includes("--jq")) process.stdout.write(String(comment.body ?? "") + "\\n");
  else process.stdout.write(JSON.stringify(comment) + "\\n");
  process.exit(0);
}
process.stderr.write("unhandled gh endpoint: " + endpoint + "\\n");
process.exit(2);
`,
    { encoding: "utf8", mode: 0o755 },
  );

  const result = spawnSync("bash", ["-c", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      GH_TOKEN: "test-token",
      GH_STUB_LOG: log,
      GH_STUB_STATE_FILE: stateFile,
      REPOSITORY: "ibboabdoli-ai/Proffera",
      PR_NUMBER: "849",
      EVENT_ACTION: eventAction,
      EVENT_ACTOR: eventActor,
      EVENT_HEAD_SHA: eventHead,
      EVENT_HEAD_REF: "work/proffera-test-task",
      EVENT_AUTHOR: "ibboabdoli-ai",
      EVENT_HEAD_REPOSITORY: "ibboabdoli-ai/Proffera",
      RUN_ID: "9002",
    },
  });
  const calls = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
  const finalState = JSON.parse(readFileSync(stateFile, "utf8")) as { comments: Array<Record<string, unknown>>; pr: Record<string, unknown> };
  return { ...result, calls, comments: finalState.comments, pr: finalState.pr };
}

function runReservationRecovery({
  artifactUploaded = false,
  branchAppearsOnSecondVerification = false,
  branchExists = true,
  discoveredPrState = "",
  livePrState = "open",
  prNumber = "",
  reservationState = "RESERVED",
  taskState = "WORKER_BLOCKED",
}: {
  artifactUploaded?: boolean;
  branchAppearsOnSecondVerification?: boolean;
  branchExists?: boolean;
  discoveredPrState?: "" | "open" | "closed";
  livePrState?: "open" | "closed";
  prNumber?: string;
  reservationState?: "RESERVED" | "RELEASED";
  taskState?: string;
} = {}) {
  const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
  const script = workflowRunStep(workflow, "Release or recover reservation on dispatch failure");
  const root = mkdtempSync(join(tmpdir(), "proffera-reservation-recovery-"));
  const bin = join(root, "bin");
  const runnerTemp = join(root, "runner");
  const trusted = join(runnerTemp, "proffera-trusted-publish");
  const log = join(root, "gh-calls.jsonl");
  const stateFile = join(root, "gh-state.json");
  mkdirSync(bin, { recursive: true });
  mkdirSync(trusted, { recursive: true });
  const trustedHelper = join(trusted, "supervisor-worker-handoff.mjs");
  const trustedManifest = join(trusted, "supervisor-worker-handoff.sha256");
  copyFileSync(helper, trustedHelper);
  const trustedDigest = createHash("sha256").update(readFileSync(trustedHelper)).digest("hex");
  writeFileSync(trustedManifest, `${trustedDigest}  ${trustedHelper}\n`);
  const parsed = spawnSync(process.execPath, [helper, "parse"], { input: packetComment(), encoding: "utf8" });
  expect(parsed.status, parsed.stderr).toBe(0);
  const normalizedPacket = parsed.stdout.replace(/\n+$/, "");
  const normalizedPacketJson = JSON.parse(normalizedPacket);
  const reservation = reservationComment({
    version: 1,
    state: reservationState,
    task_id: normalizedPacketJson.task_id,
    run_id: "9001",
    branch: normalizedPacketJson.branch,
    head_sha: sha,
    graph_path: normalizedPacketJson.graph_path,
    packet_digest: createHash("sha256").update(normalizedPacket).digest("hex"),
    lease_expires_at: "2099-01-01T00:00:00Z",
    allowed_paths: normalizedPacketJson.allowed_paths,
    changed_files: [],
    snapshot_finalized: false,
    pr_number: null,
    recovery: null,
  }, 101);
  const taskStateBody = runText("state-body", {
    packet: normalizedPacketJson,
    state: taskState,
    reason: "Dispatch stopped before successful PR handoff.",
    run_id: "9001",
  });
  writeFileSync(log, "");
  writeFileSync(stateFile, JSON.stringify({
    branchAppearsOnSecondVerification,
    branchExists,
    comments: [
      reservation,
      { id: 99, user: { login: "github-actions[bot]" }, body: taskStateBody },
    ],
    matchingRefReads: 0,
    mutex: "",
    pr: {
      number: Number(prNumber || 900),
      state: livePrState,
      head: { ref: normalizedPacketJson.branch, sha, repo: { full_name: "ibboabdoli-ai/Proffera" } },
      user: { login: "ibboabdoli-ai" },
    },
    pulls: discoveredPrState
      ? [{
          number: 900,
          state: discoveredPrState,
          head: { ref: normalizedPacketJson.branch, sha, repo: { full_name: "ibboabdoli-ai/Proffera" } },
          user: { login: "ibboabdoli-ai" },
          body: packetComment(normalizedPacketJson),
        }]
      : [],
  }));
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.GH_STUB_LOG, JSON.stringify(args) + "\\n");
const methodIndex = args.indexOf("--method");
const method = methodIndex >= 0 ? args[methodIndex + 1] : "GET";
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const state = JSON.parse(readFileSync(process.env.GH_STUB_STATE_FILE, "utf8"));
${reservationControlApiStub()}
const commentMatch = endpoint.match(/issues\\/comments\\/(\\d+)$/);
if (method === "PATCH" && commentMatch) {
  const bodyArg = args.find((arg) => arg.startsWith("body="));
  const comment = state.comments.find((entry) => String(entry.id) === commentMatch[1]);
  if (!bodyArg || !comment) process.exit(3);
  comment.body = bodyArg.slice("body=".length);
  writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (method !== "GET") process.exit(2);
if (commentMatch) {
  const comment = state.comments.find((entry) => String(entry.id) === commentMatch[1]);
  if (!comment) process.exit(3);
  process.stdout.write(args.includes("--jq") ? String(comment.body || "") + "\\n" : JSON.stringify(comment) + "\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/pulls?state=all&base=main&per_page=100") {
  for (const pull of state.pulls) process.stdout.write(JSON.stringify(pull) + "\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/pulls/900") {
  const discovered = (state.pulls || []).find((pull) => String(pull.number) === "900");
  process.stdout.write(JSON.stringify(discovered || state.pr) + "\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/git/ref/heads/work/proffera-test-task") {
  if (!state.branchExists) process.exit(1);
  process.stdout.write('{"ref":"refs/heads/work/proffera-test-task"}\\n');
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/git/matching-refs/heads/work/proffera-test-task") {
  state.matchingRefReads += 1;
  const exists = state.branchExists || (state.branchAppearsOnSecondVerification && state.matchingRefReads >= 2);
  writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  process.stdout.write(JSON.stringify(exists ? [{ ref: "refs/heads/work/proffera-test-task" }] : []) + "\\n");
  process.exit(0);
}
process.stderr.write("unhandled gh endpoint: " + endpoint + "\\n");
process.exit(2);
`,
    { encoding: "utf8", mode: 0o755 },
  );
  const result = spawnSync("bash", ["-c", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      GH_TOKEN: "test-token",
      GH_STUB_LOG: log,
      GH_STUB_STATE_FILE: stateFile,
      RUNNER_TEMP: runnerTemp,
      REPOSITORY: "ibboabdoli-ai/Proffera",
      RESERVATION_COMMENT_ID: "101",
      STATE_COMMENT_ID: "99",
      TASK_ID: "SUP-TEST-1",
      BRANCH: "work/proffera-test-task",
      RUN_ID: "9001",
      PACKET_B64: Buffer.from(normalizedPacket).toString("base64"),
      ARTIFACT_UPLOADED: artifactUploaded ? "true" : "false",
      PR_NUMBER: prNumber,
      RECOVERY_DIGEST: "",
      HEAD_SHA: sha,
    },
  });
  const calls = readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as string[]);
  const finalState = JSON.parse(readFileSync(stateFile, "utf8")) as { comments: Array<Record<string, unknown>> };
  return { ...result, calls, comments: finalState.comments };
}

type SlotReservationOptions = {
  reservation?: Record<string, unknown>;
  extraComments?: Array<Record<string, unknown>>;
  pulls?: Array<Record<string, unknown>>;
  branches?: string[];
  runStatus?: string;
  changedReservationBody?: boolean;
  mutation?: PreflightMutation;
};

function reservationComment(payload: Record<string, unknown>, id = 201) {
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return {
    id,
    user: { login: "github-actions[bot]" },
    body: `<!-- proffera-worker-slot-reservation:${payload.task_id} -->\n`
      + `### Worker slot reservation: ${payload.task_id}\n`
      + `- State: \`${payload.state}\`\n`
      + `- Reservation payload: \`${payloadBase64}\``,
  };
}

function globalExpiryEvidence(index: number, state: "RESERVED" | "RECOVERABLE" = "RESERVED") {
  const taskPacket = packet({ task_id: `SUP-ABANDONED-${index}`, branch: `work/proffera-abandoned-${index}`,
    graph_path: `feature/abandoned-${index}`, allowed_paths: [`src/abandoned-${index}/`] });
  const evidence = expiredSameTaskEvidence(state, { run_id: String(9000 + index) }, taskPacket);
  const comments = evidence.comments.map((comment, offset) => ({ ...comment, id: index * 10 + offset + 200 }));
  comments.push({ id: index * 10 + 203, user: { login: "ibboabdoli-ai" }, body: packetComment(taskPacket) });
  return { ...evidence, comments };
}

type PreflightMutation = {
  duplicateReservationOnCommentRead?: number;
  duplicateTaskOnCommentRead?: number;
  mutateReservationOnCommentRead?: number;
  mutateTaskOnCommentRead?: number;
  failVerificationReads?: number;
  failReservationRelease?: boolean;
  branchAfterTaskPatch?: string;
  dispatchOnCommentRead?: number;
  aliasReservationOnCommentRead?: number;
  loseMutexResponse?: boolean;
};

function createPreflightHarness({
  branches = [],
  comments = [],
  pulls = [],
  runStatus = "completed",
}: {
  branches?: string[];
  comments?: Array<Record<string, unknown>>;
  pulls?: Array<Record<string, unknown>>;
  runStatus?: string;
} = {}) {
  const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
  const script = workflowRunStep(workflow, "Validate trust, freshness, idempotency, graph ownership, and scope");
  const root = mkdtempSync(join(tmpdir(), "proffera-task-preflight-"));
  const bin = join(root, "bin");
  const log = join(root, "gh-calls.jsonl");
  const stateFile = join(root, "gh-state.json");
  const waitLog = join(root, "waits.jsonl");
  const waitPreload = join(root, "record-backoff.cjs");
  mkdirSync(bin, { recursive: true });
  writeFileSync(log, "");
  writeFileSync(waitPreload, `
const { appendFileSync } = require("node:fs");
const { resolve } = require("node:path");
if (resolve(process.argv[1] || "") === resolve(process.env.GH_STUB_HELPER)) {
  // Exercise the actual retry loop and record its policy without wall-clock sleep.
  Atomics.wait = (array, index, value, milliseconds) => {
    appendFileSync(process.env.GH_STUB_WAIT_LOG, JSON.stringify({ mode: process.argv[2], milliseconds }) + "\\n");
    if (!(array instanceof Int32Array) || !(array.buffer instanceof SharedArrayBuffer)
      || index !== 0 || value !== 0 || ![1000, 2000].includes(milliseconds)) {
      throw new Error("Unexpected preflight fixture wait");
    }
    return "timed-out";
  };
}
`);
  writeFileSync(stateFile, JSON.stringify({
    branches,
    commentReads: 0,
    comments,
    mutation: {},
    nextCommentId: 900,
    pulls,
    refReads: 0,
    runStatus,
  }));
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.GH_STUB_LOG, JSON.stringify(args) + "\\n");
const methodIndex = args.indexOf("--method");
const method = methodIndex >= 0 ? args[methodIndex + 1] : "GET";
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const state = JSON.parse(readFileSync(process.env.GH_STUB_STATE_FILE, "utf8"));
const save = () => writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
const field = (name) => args.find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1) ?? "";
const commentMatch = endpoint.match(/issues\\/comments\\/(\\d+)$/);
if (method === "POST" && endpoint.endsWith("/labels")) {
  if (state.mutex) process.exit(1);
  state.mutex = field("description");
  save();
  if (state.mutation?.loseMutexResponse) process.exit(5);
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (method === "DELETE" && endpoint.includes("/labels/")) {
  state.mutex = "";
  save();
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (endpoint.includes("/labels/proffera-worker-slot-reservation-mutex-v1")) {
  if (!state.mutex) process.exit(1);
  process.stdout.write(JSON.stringify({ description: state.mutex }) + "\\n");
  process.exit(0);
}
if (method === "PATCH" && commentMatch) {
  const comment = state.comments.find((entry) => String(entry.id) === commentMatch[1]);
  if (!comment || !args.some((arg) => arg.startsWith("body="))) process.exit(3);
  if (state.mutation?.failReservationRelease && field("body").includes('- State: \`RELEASED\`')) process.exit(4);
  comment.body = field("body");
  if (field("body").includes("proffera-worker-task-state:") && state.mutation?.branchAfterTaskPatch) state.branches.push(state.mutation.branchAfterTaskPatch);
  if (field("body").includes("TASK_CREATED")) state.failReadsRemaining = state.mutation?.failVerificationReads || 0;
  save();
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (method === "POST" && endpoint.endsWith("/issues/548/comments")) {
  const id = state.nextCommentId++;
  if (field("body").includes("TASK_CREATED")) state.failReadsRemaining = state.mutation?.failVerificationReads || 0;
  state.comments.push({ id, user: { login: "github-actions[bot]" }, body: field("body") });
  save();
  process.stdout.write(args.includes("--jq") ? String(id) + "\\n" : JSON.stringify({ id }) + "\\n");
  process.exit(0);
}
if (method !== "GET") {
  process.stderr.write("unexpected mutation: " + JSON.stringify(args) + "\\n");
  process.exit(2);
}
if (commentMatch && commentMatch[1] === process.env.GH_STUB_SOURCE_COMMENT_ID) {
  process.stdout.write(JSON.stringify({
    id: Number(process.env.GH_STUB_SOURCE_COMMENT_ID),
    user: { login: "ibboabdoli-ai" },
    body: process.env.GH_STUB_SOURCE_COMMENT_BODY,
    issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548",
  }) + "\\n");
  process.exit(0);
}
if (endpoint.endsWith("/issues/548")) {
  process.stdout.write('{"labels":[{"name":"worker-dispatch-enabled"}]}\\n');
  process.exit(0);
}
if (endpoint.endsWith("/git/ref/heads/main")) {
  process.stdout.write(process.env.GH_STUB_MAIN_SHA + "\\n");
  process.exit(0);
}
if (endpoint.includes("/issues/548/comments?per_page=100")) {
  if (state.failReadsRemaining > 0) {
    state.failReadsRemaining -= 1;
    save();
    process.stderr.write("transient comments read failure\\n");
    process.exit(5);
  }
  state.commentReads += 1;
  const mutation = state.mutation || {};
  const mutate = (needle) => {
    const found = state.comments.find((entry) => String(entry.body || "").includes(needle));
    if (found) found.body = String(found.body) + "\\nchanged";
  };
  const duplicate = (needle) => {
    const found = state.comments.find((entry) => String(entry.body || "").includes(needle));
    if (found) state.comments.push({ ...found, id: state.nextCommentId++ });
  };
  if (state.commentReads === mutation.mutateReservationOnCommentRead) mutate("proffera-worker-slot-reservation:");
  if (state.commentReads === mutation.mutateTaskOnCommentRead) mutate("proffera-worker-task-state:");
  if (state.commentReads === mutation.duplicateReservationOnCommentRead) duplicate("proffera-worker-slot-reservation:");
  if (state.commentReads === mutation.duplicateTaskOnCommentRead) duplicate("proffera-worker-task-state:");
  if (state.commentReads === mutation.dispatchOnCommentRead) {
    state.comments.push({ id: state.nextCommentId++, user: { login: "github-actions[bot]" }, body: "<!-- proffera-worker-dispatch-start:SUP-TEST-1:9001 -->" });
  }
  if (state.commentReads === mutation.aliasReservationOnCommentRead) {
    const task = state.comments.find((entry) => String(entry.body).includes("proffera-worker-task-state:"));
    const branch = String(task?.body).match(/^- Branch: \`([^\`]+)\`$/m)?.[1];
    const payload = Buffer.from(JSON.stringify({ task_id: "SUP-TEST-1", branch })).toString("base64");
    state.comments.push({ id: state.nextCommentId++, user: { login: "github-actions[bot]" }, body: "<!-- proffera-worker-slot-reservation:SUP-ALIAS-1 -->\\n- Reservation payload: \`" + payload + "\`" });
  }
  save();
  if (endpoint.includes("&page=")) process.stdout.write(JSON.stringify(state.comments) + "\\n");
  else for (const comment of state.comments) process.stdout.write(JSON.stringify(comment) + "\\n");
  process.exit(0);
}
if (endpoint.includes("/pulls?state=open&per_page=100&page=")) {
  process.stdout.write(JSON.stringify(state.pulls) + "\\n");
  process.exit(0);
}
if (endpoint.endsWith("/pulls?state=open&base=main&per_page=100")) {
  for (const pull of state.pulls) process.stdout.write(JSON.stringify(pull) + "\\n");
  process.exit(0);
}
const filesMatch = endpoint.match(/pulls\\/(\\d+)\\/files/);
if (filesMatch) {
  const pull = state.pulls.find((entry) => String(entry.number) === filesMatch[1]);
  for (const path of pull?.files || []) process.stdout.write(String(path) + "\\n");
  process.exit(0);
}
const refsPrefix = "repos/ibboabdoli-ai/Proffera/git/matching-refs/heads/";
if (endpoint.startsWith(refsPrefix)) {
  state.refReads += 1;
  save();
  const branch = endpoint.slice(refsPrefix.length);
  const refs = state.branches.filter((candidate) => candidate === branch).map((candidate) => ({ ref: "refs/heads/" + candidate }));
  process.stdout.write(JSON.stringify(refs) + "\\n");
  process.exit(0);
}
const runMatch = endpoint.match(/actions\\/runs\\/(\\d+)$/);
if (runMatch) {
  process.stdout.write(args.includes("--jq") ? String(state.runStatus) + "\\n" : JSON.stringify({ status: state.runStatus }) + "\\n");
  process.exit(0);
}
if (commentMatch) {
  const comment = state.comments.find((entry) => String(entry.id) === commentMatch[1]);
  if (!comment) process.exit(3);
  process.stdout.write(args.includes("--jq") ? String(comment.body || "") + "\\n" : JSON.stringify(comment) + "\\n");
  process.exit(0);
}
process.stderr.write("unhandled gh endpoint: " + endpoint + " " + JSON.stringify(args) + "\\n");
process.exit(2);
`,
    { encoding: "utf8", mode: 0o755 },
  );

  return {
    run({
      commentId = "501",
      mutation = {},
      runId = "1001",
      taskPacket = packet(),
      taskLane = `task-${String(taskPacket.task_id)}`,
    }: {
      commentId?: string;
      mutation?: PreflightMutation;
      runId?: string;
      taskPacket?: ReturnType<typeof packet>;
      taskLane?: string;
    } = {}) {
      const state = JSON.parse(readFileSync(stateFile, "utf8"));
      state.commentReads = 0;
      state.failReadsRemaining = 0;
      state.mutation = mutation;
      state.refReads = 0;
      writeFileSync(stateFile, JSON.stringify(state));
      writeFileSync(log, "");
      writeFileSync(waitLog, "");
      const output = join(root, `github-output-${runId}-${commentId}`);
      writeFileSync(output, "");
      const result = spawnSync("bash", ["-c", script], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require ${JSON.stringify(waitPreload.replaceAll("\\", "/"))}`].filter(Boolean).join(" "),
          PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
          INPUT_COMMENT_ID: commentId,
          PLANNER_PACKET_B64: "",
          PLANNER_PACKET_SHA256: "",
          PLANNER_RUN_ID: "",
          PLANNER_HEAD_SHA: "",
          PLANNER_WORKFLOW_REF: "",
          GH_STUB_SOURCE_COMMENT_ID: commentId,
          GH_STUB_SOURCE_COMMENT_BODY: packetComment(taskPacket),
          GH_STUB_LOG: log,
          GH_STUB_MAIN_SHA: String(taskPacket.base_sha),
          GH_STUB_STATE_FILE: stateFile,
          GH_STUB_HELPER: helper,
          GH_STUB_WAIT_LOG: waitLog,
          GH_TOKEN: "test-token",
          GITHUB_OUTPUT: output,
          OPENAI_AVAILABLE: "true",
          PUSH_AVAILABLE: "true",
          REPOSITORY: "ibboabdoli-ai/Proffera",
          RUN_ID: runId,
        },
      });
      const calls = readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as string[]);
      const waits = readFileSync(waitLog, "utf8").trim().split("\n").filter(Boolean)
        .map((line) => JSON.parse(line) as { mode: string; milliseconds: number });
      const outputs = Object.fromEntries(readFileSync(output, "utf8").trim().split("\n").filter(Boolean).map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }));
      const finalState = JSON.parse(readFileSync(stateFile, "utf8")) as {
        comments: Array<Record<string, unknown>>;
      };
      return { ...result, calls, comments: finalState.comments, outputs, waits };
    },
  };
}

function verificationReadCalls(calls: string[][]) {
  const created = calls.findIndex((args) => args.some((arg) => arg.startsWith("body=") && arg.includes("- State: `TASK_CREATED`")));
  expect(created).toBeGreaterThanOrEqual(0);
  return calls.slice(created + 1).filter((args) => args.some((arg) => arg.includes("/issues/548/comments?per_page=100")));
}

function runTaskLane(taskPacket: ReturnType<typeof packet>, commentId = "501") {
  const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
  const script = workflowRunStep(workflow, "Resolve same-task serialization key");
  const root = mkdtempSync(join(tmpdir(), "proffera-task-lane-"));
  const output = join(root, "github-output");
  writeFileSync(output, "");
  const result = spawnSync("bash", ["-c", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      EVENT_COMMENT_BODY: packetComment(taskPacket),
      EVENT_COMMENT_ID: commentId,
      GITHUB_OUTPUT: output,
    },
  });
  expect(result.status, result.stderr).toBe(0);
  return Object.fromEntries(readFileSync(output, "utf8").trim().split("\n").map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

function runSlotReservation({
  reservation,
  extraComments = [],
  pulls = [],
  branches = [],
  runStatus = "completed",
  changedReservationBody = false,
  mutation = {},
}: SlotReservationOptions = {}) {
  const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
  const script = workflowRunStep(workflow, "Atomically reserve writable Worker slot");
  const root = mkdtempSync(join(tmpdir(), "proffera-slot-reservation-"));
  const bin = join(root, "bin");
  const runnerTemp = join(root, "runner");
  const trusted = join(runnerTemp, "proffera-trusted-control");
  const trustedHelper = join(trusted, "supervisor-worker-handoff.mjs");
  const manifest = join(trusted, "supervisor-worker-handoff.sha256");
  const output = join(root, "github-output");
  const log = join(root, "gh-calls.jsonl");
  const stateFile = join(root, "gh-state.json");
  mkdirSync(bin, { recursive: true });
  mkdirSync(trusted, { recursive: true });
  copyFileSync(helper, trustedHelper);
  const helperDigest = createHash("sha256").update(readFileSync(trustedHelper)).digest("hex");
  writeFileSync(manifest, `${helperDigest}  ${trustedHelper}\n`);
  writeFileSync(output, "");
  writeFileSync(log, "");
  const localHeadResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" });
  expect(localHeadResult.status, localHeadResult.stderr).toBe(0);
  const localHead = localHeadResult.stdout.trim();
  const newPacket = packet({
    task_id: "SUP-NEW-SLOT-1",
    task_title: "Disjoint slot behavior test",
    graph_path: "feature/new-slot",
    base_sha: localHead,
    branch: "work/proffera-new-slot",
    allowed_paths: ["tests/new-slot/"],
  });
  const comments = [...(reservation ? [reservationComment(reservation)] : []), ...extraComments];
  writeFileSync(stateFile, JSON.stringify({ branches, changedReservationBody, comments, mutex: "", pulls, runStatus, mutation, commentReads: 0, nextCommentId: 1000 }));
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.GH_STUB_LOG, JSON.stringify(args) + "\\n");
const methodIndex = args.indexOf("--method");
const method = methodIndex >= 0 ? args[methodIndex + 1] : "GET";
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const state = JSON.parse(readFileSync(process.env.GH_STUB_STATE_FILE, "utf8"));
const save = () => writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
const field = (name) => args.find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1) ?? "";
const commentMatch = endpoint.match(/issues\\/comments\\/(\\d+)$/);
if (method === "POST" && endpoint.endsWith("/labels")) {
  if (state.mutex) process.exit(1);
  state.mutex = field("description");
  save();
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (method === "DELETE" && endpoint.includes("/labels/")) {
  state.mutex = "";
  save();
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (method === "PATCH" && commentMatch) {
  const comment = state.comments.find((entry) => String(entry.id) === commentMatch[1]);
  if (!comment) process.exit(3);
  if (state.mutation?.failReservationRelease && field("body").includes('- State: \`RELEASED\`')) process.exit(4);
  comment.body = field("body");
  if (field("body").includes("proffera-worker-task-state:") && state.mutation?.branchAfterTaskPatch) state.branches.push(state.mutation.branchAfterTaskPatch);
  save();
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (method === "POST" && endpoint.endsWith("/issues/548/comments")) {
  state.comments.push({ id: 999, user: { login: "github-actions[bot]" }, body: field("body") });
  save();
  process.stdout.write(args.includes("--jq") ? "999\\n" : JSON.stringify({ id: 999 }) + "\\n");
  process.exit(0);
}
if (method !== "GET") process.exit(2);
if (endpoint.includes("/labels/proffera-worker-slot-reservation-mutex-v1")) {
  if (!state.mutex) process.exit(1);
  process.stdout.write(args.includes("--jq") ? state.mutex + "\\n" : JSON.stringify({ description: state.mutex }) + "\\n");
  process.exit(0);
}
if (endpoint.endsWith("/git/ref/heads/main")) {
  process.stdout.write(process.env.GH_STUB_MAIN_SHA + "\\n");
  process.exit(0);
}
if (commentMatch && commentMatch[1] === process.env.GH_STUB_SOURCE_COMMENT_ID) {
  process.stdout.write(JSON.stringify({
    id: Number(process.env.GH_STUB_SOURCE_COMMENT_ID),
    user: { login: "ibboabdoli-ai" },
    body: process.env.GH_STUB_SOURCE_COMMENT_BODY,
    issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548",
  }) + "\\n");
  process.exit(0);
}
if (endpoint.endsWith("/issues/548")) {
  process.stdout.write('{"labels":[{"name":"worker-dispatch-enabled"}]}\\n');
  process.exit(0);
}
if (endpoint.includes("/issues/548/comments?per_page=100")) {
  state.commentReads += 1;
  const mutation = state.mutation || {};
  const mutate = (needle) => {
    const found = state.comments.find((entry) => String(entry.body || "").includes(needle));
    if (found) found.body = String(found.body) + "\\nchanged";
  };
  const duplicate = (needle) => {
    const found = state.comments.find((entry) => String(entry.body || "").includes(needle));
    if (found) state.comments.push({ ...found, id: state.nextCommentId++ });
  };
  if (state.commentReads === mutation.mutateReservationOnCommentRead) mutate("proffera-worker-slot-reservation:");
  if (state.commentReads === mutation.mutateTaskOnCommentRead) mutate("proffera-worker-task-state:");
  if (state.commentReads === mutation.duplicateReservationOnCommentRead) duplicate("proffera-worker-slot-reservation:");
  if (state.commentReads === mutation.duplicateTaskOnCommentRead) duplicate("proffera-worker-task-state:");
  save();

  if (endpoint.includes("&page=")) process.stdout.write(JSON.stringify(state.comments) + "\\n");
  else for (const comment of state.comments) process.stdout.write(JSON.stringify(comment) + "\\n");
  process.exit(0);
}
if (endpoint.includes("/pulls?state=open&per_page=100&page=")) {
  process.stdout.write(JSON.stringify(state.pulls) + "\\n");
  process.exit(0);
}
if (endpoint.endsWith("/pulls?state=open&base=main&per_page=100")) {
  for (const pull of state.pulls) process.stdout.write(JSON.stringify(pull) + "\\n");
  process.exit(0);
}
const pullMatch = endpoint.match(/pulls\\/(\\d+)$/);
if (pullMatch) {
  const pull = state.pulls.find((entry) => String(entry.number) === pullMatch[1]);
  if (!pull) process.exit(3);
  process.stdout.write(JSON.stringify({ ...pull, state: pull.state ?? "open" }) + "\\n");
  process.exit(0);
}
const filesMatch = endpoint.match(/pulls\\/(\\d+)\\/files/);
if (filesMatch) {
  const pull = state.pulls.find((entry) => String(entry.number) === filesMatch[1]);
  if (endpoint.includes("&page=")) process.stdout.write(JSON.stringify((pull?.files ?? []).map((filename) => ({ filename }))) + "\\n");
  else for (const path of pull?.files ?? []) process.stdout.write(path + "\\n");
  process.exit(0);
}
const runMatch = endpoint.match(/actions\\/runs\\/(\\d+)$/);
if (runMatch) {
  process.stdout.write(args.includes("--jq") ? state.runStatus + "\\n" : JSON.stringify({ status: state.runStatus }) + "\\n");
  process.exit(0);
}
const matchingPrefix = "repos/ibboabdoli-ai/Proffera/git/matching-refs/heads/";
if (endpoint.startsWith(matchingPrefix)) {
  const branch = endpoint.slice(matchingPrefix.length);
  process.stdout.write(JSON.stringify(state.branches.filter((entry) => entry === branch).map((entry) => ({ ref: "refs/heads/" + entry }))) + "\\n");
  process.exit(0);
}
const branchPrefix = "repos/ibboabdoli-ai/Proffera/git/ref/heads/";
if (endpoint.startsWith(branchPrefix)) {
  const branch = endpoint.slice(branchPrefix.length);
  if (!state.branches.includes(branch)) process.exit(1);
  process.stdout.write("refs/heads/" + branch + "\\n");
  process.exit(0);
}
if (commentMatch) {
  const comment = state.comments.find((entry) => String(entry.id) === commentMatch[1]);
  if (!comment) process.exit(3);
  const body = state.changedReservationBody ? String(comment.body) + "\\nchanged" : String(comment.body);
  process.stdout.write(body + "\\n");
  process.exit(0);
}
process.stderr.write("unhandled gh endpoint: " + endpoint + "\\n");
process.exit(2);
`,
    { encoding: "utf8", mode: 0o755 },
  );
  const result = spawnSync("bash", ["-c", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      GH_TOKEN: "test-token",
      GH_STUB_LOG: log,
      GH_STUB_MAIN_SHA: localHead,
      GH_STUB_STATE_FILE: stateFile,
      GITHUB_OUTPUT: output,
      RUNNER_TEMP: runnerTemp,
      REPOSITORY: "ibboabdoli-ai/Proffera",
      PACKET_B64: Buffer.from(JSON.stringify(newPacket)).toString("base64"),
      SOURCE_COMMENT_ID: "501",
      SOURCE_MODE: "comment",
      GH_STUB_SOURCE_COMMENT_ID: "501",
      GH_STUB_SOURCE_COMMENT_BODY: packetComment(newPacket),
      BASE_SHA: localHead,
      RUN_ID: "1001",
    },
  });
  const calls = readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as string[]);
  const finalState = JSON.parse(readFileSync(stateFile, "utf8")) as { comments: Array<Record<string, unknown>> };
  const outputs = Object.fromEntries(readFileSync(output, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }));
  return { ...result, calls, comments: finalState.comments, outputs };
}

function runReservationFinalization({ changedReservationBody = false } = {}) {
  const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
  const script = workflowRunStep(workflow, "Finalize reserved Worker snapshot before publication");
  const root = mkdtempSync(join(tmpdir(), "proffera-reservation-finalize-"));
  const repo = join(root, "repo");
  const bin = join(root, "bin");
  const trusted = join(root, "proffera-trusted-publish");
  const log = join(root, "gh-calls.jsonl");
  const stateFile = join(root, "gh-state.json");
  mkdirSync(join(repo, "src"), { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(trusted, { recursive: true });
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  };
  git("init");
  git("config", "user.name", "test");
  git("config", "user.email", "test@example.invalid");
  writeFileSync(join(repo, "src/change.txt"), "before\n", "utf8");
  git("add", "src/change.txt");
  git("commit", "-m", "source");
  const sourceHead = git("rev-parse", "HEAD");
  writeFileSync(join(repo, "src/change.txt"), "after\n", "utf8");
  git("commit", "-am", "target");
  const targetHead = git("rev-parse", "HEAD");
  const finalizationPacket = packet({ base_sha: sourceHead, allowed_paths: ["src/change.txt"] });
  const normalizedPacket = JSON.stringify(finalizationPacket);
  const reservation = {
    version: 1,
    state: "RESERVED",
    task_id: finalizationPacket.task_id,
    run_id: "9001",
    branch: finalizationPacket.branch,
    graph_path: finalizationPacket.graph_path,
    packet_digest: createHash("sha256").update(normalizedPacket).digest("hex"),
    head_sha: sourceHead,
    lease_expires_at: "2099-01-01T00:00:00Z",
    allowed_paths: finalizationPacket.allowed_paths,
    changed_files: [],
    snapshot_finalized: false,
    pr_number: null,
    recovery: null,
  };
  copyFileSync(helper, join(trusted, "supervisor-worker-handoff.mjs"));
  const helperDigest = createHash("sha256").update(readFileSync(join(trusted, "supervisor-worker-handoff.mjs"))).digest("hex");
  writeFileSync(join(trusted, "supervisor-worker-handoff.sha256"), `${helperDigest}  ${join(trusted, "supervisor-worker-handoff.mjs")}\n`);
  writeFileSync(join(root, "proffera-worker-changed-files.txt"), "src/change.txt\n");
  writeFileSync(log, "");
  writeFileSync(stateFile, JSON.stringify({ changedReservationBody, comments: [reservationComment(reservation, 101)] }));
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.GH_STUB_LOG, JSON.stringify(args) + "\\n");
const methodIndex = args.indexOf("--method");
const method = methodIndex >= 0 ? args[methodIndex + 1] : "GET";
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const state = JSON.parse(readFileSync(process.env.GH_STUB_STATE_FILE, "utf8"));
const field = (name) => args.find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1) ?? "";
if (method === "PATCH" && endpoint.endsWith("/issues/comments/101")) {
  state.comments[0].body = field("body");
  writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (method !== "GET") process.exit(2);
if (endpoint.endsWith("/git/ref/heads/main")) {
  process.stdout.write(process.env.GH_STUB_MAIN_SHA + "\\n");
  process.exit(0);
}
if (endpoint.endsWith("/issues/comments/101")) {
  const comment = state.comments[0];
  if (args.includes("--jq")) {
    const body = state.changedReservationBody ? String(comment.body) + "\\nchanged" : String(comment.body);
    process.stdout.write(body + "\\n");
  } else {
    process.stdout.write(JSON.stringify(comment) + "\\n");
  }
  process.exit(0);
}
process.stderr.write("unhandled gh endpoint: " + endpoint + "\\n");
process.exit(2);
`,
    { encoding: "utf8", mode: 0o755 },
  );
  const result = spawnSync("bash", ["-c", script], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      GH_TOKEN: "test-token",
      GH_STUB_LOG: log,
      GH_STUB_MAIN_SHA: sourceHead,
      GH_STUB_STATE_FILE: stateFile,
      RUNNER_TEMP: root,
      REPOSITORY: "ibboabdoli-ai/Proffera",
      RESERVATION_COMMENT_ID: "101",
      PACKET_B64: Buffer.from(normalizedPacket).toString("base64"),
      BASE_SHA: sourceHead,
      RUN_ID: "9001",
    },
  });
  const calls = readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as string[]);
  const finalState = JSON.parse(readFileSync(stateFile, "utf8")) as { comments: Array<Record<string, unknown>> };
  return { ...result, calls, comments: finalState.comments, sourceHead, targetHead };
}

function durableMutationCalls(calls: string[][]) {
  return calls.filter((args) => args.includes("--method") && !args.some((arg) =>
    arg === "name=proffera-worker-slot-reservation-mutex-v1"
      || arg.endsWith("/labels/proffera-worker-slot-reservation-mutex-v1")));
}

function prPatchCalls(calls: string[][]) {
  return calls.filter((args) => {
    const methodIndex = args.indexOf("--method");
    return methodIndex >= 0
      && args[methodIndex + 1] === "PATCH"
      && args.includes("repos/ibboabdoli-ai/Proffera/pulls/849");
  });
}

function commentPatchCalls(calls: string[][], commentId: number) {
  return calls.filter((args) => {
    const methodIndex = args.indexOf("--method");
    return methodIndex >= 0
      && args[methodIndex + 1] === "PATCH"
      && args.includes(`repos/ibboabdoli-ai/Proffera/issues/comments/${commentId}`);
  });
}

type SyncCheckOptions = {
  action?: string;
  body?: string;
  comments: Array<Record<string, unknown>>;
  eventHead?: string;
  liveAuthor?: string;
  liveHead?: string;
  liveHeadRepository?: string;
  liveMerged?: boolean;
  liveRef?: string;
  liveState?: string;
  failPagedCommentReads?: number;
  mutateHeadOnPrFetch?: number;
  mutateReservationOnCommentFetch?: number;
  mutateTaskOnCommentFetch?: number;
  stepName?: string;
};

function runSyncCheckReconciliation({
  action = "synchronize",
  body = packetComment(),
  comments,
  eventHead = sha,
  liveAuthor = "ibboabdoli-ai",
  liveHead = sha,
  liveHeadRepository = "ibboabdoli-ai/Proffera",
  liveMerged = false,
  liveRef = "work/proffera-test-task",
  liveState = "closed",
  failPagedCommentReads = 0,
  mutateHeadOnPrFetch = 0,
  mutateReservationOnCommentFetch = 0,
  mutateTaskOnCommentFetch = 0,
  stepName = "Reconcile required current-head workflow evidence",
}: SyncCheckOptions) {
  const workflow = source(".github/workflows/worker-supervisor-sync.yml");
  const script = workflowRunStep(workflow, stepName);
  const root = mkdtempSync(join(tmpdir(), "proffera-sync-check-reconciliation-"));
  const repo = join(root, "repo");
  const bin = join(root, "bin");
  const log = join(root, "gh-calls.jsonl");
  const stateFile = join(root, "gh-state.json");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(bin, { recursive: true });
  copyFileSync(helper, join(repo, "scripts", "supervisor-worker-handoff.mjs"));
  const pr = {
    number: 849,
    state: liveState,
    merged: liveMerged,
    base: { ref: "main", sha },
    user: { login: liveAuthor },
    head: { repo: { full_name: liveHeadRepository }, ref: liveRef, sha: liveHead },
    body,
    files: ["src/features/test/worker.ts"],
  };
  writeFileSync(stateFile, JSON.stringify({
    commentFetches: 0,
    comments,
    failPagedCommentReads,
    mutateHeadOnPrFetch,
    mutateReservationOnCommentFetch,
    mutateTaskOnCommentFetch,
    pagedCommentFailures: 0,
    prFetches: 0,
    pr,
  }));
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.GH_STUB_LOG, JSON.stringify(args) + "\\n");
const methodIndex = args.indexOf("--method");
const method = methodIndex >= 0 ? args[methodIndex + 1] : "GET";
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const state = JSON.parse(readFileSync(process.env.GH_STUB_STATE_FILE, "utf8"));
${reservationControlApiStub()}
if (args[0] !== "api" || !endpoint) process.exit(2);
if (method !== "GET") {
  const bodyArg = args.find((arg) => arg.startsWith("body="));
  const commentMatch = endpoint.match(/issues\\/comments\\/(\\d+)$/);
  if (method === "PATCH" && endpoint === "repos/ibboabdoli-ai/Proffera/pulls/849" && args.includes("state=closed")) {
    state.pr.state = "closed";
    writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  } else if (method === "PATCH" && bodyArg && commentMatch) {
    const comment = state.comments.find((entry) => String(entry.id) === commentMatch[1]);
    if (!comment) process.exit(3);
    comment.body = bodyArg.slice("body=".length);
    writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  } else if (method === "POST" && bodyArg && endpoint === "repos/ibboabdoli-ai/Proffera/issues/548/comments") {
    state.comments.push({ id: 999, user: { login: "github-actions[bot]" }, body: bodyArg.slice("body=".length) });
    writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  }
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/pulls/849") {
  state.prFetches += 1;
  const pr = state.pr;
  if (state.prFetches >= state.mutateHeadOnPrFetch && state.mutateHeadOnPrFetch > 0) pr.head.sha = "${otherSha}";
  writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  process.stdout.write(JSON.stringify(pr) + "\\n");
  process.exit(0);
}
const pagedComments = endpoint.match(/repos\\/ibboabdoli-ai\\/Proffera\\/issues\\/548\\/comments\\?per_page=100&page=(\\d+)$/);
if (pagedComments) {
  if (state.pagedCommentFailures < state.failPagedCommentReads) {
    state.pagedCommentFailures += 1;
    writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
    process.exit(75);
  }
  state.commentFetches += 1;
  if (state.commentFetches === state.mutateReservationOnCommentFetch) {
    const reservation = state.comments.find((entry) => String(entry.body ?? "").includes("proffera-worker-slot-reservation:"));
    if (reservation) reservation.body = String(reservation.body) + "\\nchanged";
  }
  if (state.commentFetches === state.mutateTaskOnCommentFetch) {
    const task = state.comments.find((entry) => String(entry.body ?? "").includes("proffera-worker-task-state:"));
    if (task) task.body = String(task.body) + "\\nchanged";
  }
  writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  const page = Number(pagedComments[1]);
  process.stdout.write(JSON.stringify(state.comments.slice((page - 1) * 100, page * 100)) + "\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/issues/548/comments?per_page=100") {
  state.commentFetches += 1;
  if (state.commentFetches === state.mutateReservationOnCommentFetch) {
    const reservation = state.comments.find((entry) => String(entry.body ?? "").includes("proffera-worker-slot-reservation:"));
    if (reservation) reservation.body = String(reservation.body) + "\\nchanged";
  }
  if (state.commentFetches === state.mutateTaskOnCommentFetch) {
    const task = state.comments.find((entry) => String(entry.body ?? "").includes("proffera-worker-task-state:"));
    if (task) task.body = String(task.body) + "\\nchanged";
  }
  writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  for (const comment of state.comments) process.stdout.write(JSON.stringify(comment) + "\\n");
  process.exit(0);
}
if (endpoint.startsWith("repos/ibboabdoli-ai/Proffera/actions/runs?")) {
  for (const name of ["CI", "CodeQL", "Targeted CI shadow", "Production base health"]) {
    process.stdout.write(JSON.stringify({ name, conclusion: "success", created_at: "2026-09-12T00:00:00Z", id: 1 }) + "\\n");
  }
  process.exit(0);
}
process.stderr.write("unhandled gh endpoint: " + endpoint + "\\n");
process.exit(2);
`,
    { encoding: "utf8", mode: 0o755 },
  );

  const result = spawnSync("bash", ["-c", script], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      GH_TOKEN: "test-token",
      GH_STUB_LOG: log,
      GH_STUB_STATE_FILE: stateFile,
      GH_STUB_PR_JSON: JSON.stringify(pr),
      REPOSITORY: "ibboabdoli-ai/Proffera",
      ACTION: action,
      ACTOR: "ibboabdoli-ai",
      PR_NUMBER: "849",
      EVENT_PR_NUMBER: "849",
      EVENT_HEAD_SHA: eventHead,
      RUN_ID: "9003",
    },
  });
  const calls = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
  const finalState = JSON.parse(readFileSync(stateFile, "utf8")) as { comments: Array<Record<string, unknown>> };
  return { ...result, calls, comments: finalState.comments };
}

function runLifecycleReconciliation(options: Omit<SyncCheckOptions, "stepName">) {
  return runSyncCheckReconciliation({
    ...options,
    stepName: "Record or update Worker lifecycle state in Supervisor issue",
  });
}

function runWorkerPrStateRecord(currentBody: string) {
  const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
  const script = workflowRunStep(workflow, "Record dispatched Worker PR in stable Supervisor task state");
  const root = mkdtempSync(join(tmpdir(), "proffera-worker-pr-state-"));
  const bin = join(root, "bin");
  const trusted = join(root, "proffera-trusted-publish");
  const trustedHelper = join(trusted, "supervisor-worker-handoff.mjs");
  const manifest = join(trusted, "supervisor-worker-handoff.sha256");
  const log = join(root, "gh-calls.jsonl");
  const stateFile = join(root, "gh-state.json");
  mkdirSync(bin, { recursive: true });
  mkdirSync(trusted, { recursive: true });
  copyFileSync(helper, trustedHelper);
  const helperDigest = createHash("sha256").update(readFileSync(trustedHelper)).digest("hex");
  writeFileSync(manifest, `${helperDigest}  ${trustedHelper}\n`);
  writeFileSync(log, "");
  const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 900 });
  writeFileSync(stateFile, JSON.stringify({
    comments: [...evidence.comments, { id: 99, user: { login: "github-actions[bot]" }, body: currentBody }],
    pr: {
      number: 900, state: "open", merged: false, base: { ref: "main", sha },
      head: { sha, ref: packet().branch, repo: { full_name: packet().repository } },
      user: { login: "ibboabdoli-ai" }, body: evidence.body, files: ["src/features/test/worker.ts"],
    },
  }));
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.GH_STUB_LOG, JSON.stringify(args) + "\\n");
const methodIndex = args.indexOf("--method");
const method = methodIndex >= 0 ? args[methodIndex + 1] : "GET";
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const state = JSON.parse(readFileSync(process.env.GH_STUB_STATE_FILE, "utf8"));
${reservationControlApiStub()}
if (args[0] !== "api" || !endpoint) process.exit(2);
const commentMatch = endpoint.match(/issues\\/comments\\/(\\d+)$/);
if (method === "PATCH" && commentMatch) {
  const comment = state.comments.find((entry) => String(entry.id) === commentMatch[1]);
  if (!comment) process.exit(3);
  comment.body = args.find((arg) => arg.startsWith("body="))?.slice(5);
  writeFileSync(process.env.GH_STUB_STATE_FILE, JSON.stringify(state));
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (method !== "GET") process.exit(2);
if (endpoint === "repos/ibboabdoli-ai/Proffera/pulls/900") {
  process.stdout.write(JSON.stringify(state.pr) + "\\n");
  process.exit(0);
}
if (endpoint.includes("/issues/548/comments?per_page=100&page=")) {
  process.stdout.write(JSON.stringify(state.comments) + "\\n");
  process.exit(0);
}
process.exit(2);
`,
    { encoding: "utf8", mode: 0o755 },
  );

  const result = spawnSync("bash", ["-c", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      RUNNER_TEMP: root,
      GH_TOKEN: "test-token",
      GH_STUB_LOG: log,
      GH_STUB_STATE_FILE: stateFile,
      REPOSITORY: "ibboabdoli-ai/Proffera",
      PACKET_B64: Buffer.from(JSON.stringify(packet())).toString("base64"),
      STATE_COMMENT_ID: "99",
      PR_NUMBER: "900",
      HEAD_SHA: sha,
      RUN_ID: "9001",
    },
  });
  const calls = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
  return { ...result, calls };
}

function taskStatePatchCalls(calls: string[][]) {
  return calls.filter((args) => {
    const methodIndex = args.indexOf("--method");
    return methodIndex >= 0
      && args[methodIndex + 1] === "PATCH"
      && args.includes("repos/ibboabdoli-ai/Proffera/issues/comments/99");
  });
}

function runDispatchFailureState({
  capacityBlocked = false,
  reservationCommentId = "",
}: {
  capacityBlocked?: boolean;
  reservationCommentId?: string;
} = {}) {
  const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
  const script = workflowRunStep(workflow, "Fail closed into WORKER_BLOCKED on dispatch failure");
  const root = mkdtempSync(join(tmpdir(), "proffera-dispatch-failure-state-"));
  const bin = join(root, "bin");
  const trusted = join(root, "proffera-trusted-publish");
  const output = join(root, "patched-body");
  mkdirSync(bin, { recursive: true });
  mkdirSync(trusted, { recursive: true });
  copyFileSync(helper, join(trusted, "supervisor-worker-handoff.mjs"));
  const helperDigest = createHash("sha256").update(readFileSync(helper)).digest("hex");
  writeFileSync(join(trusted, "supervisor-worker-handoff.sha256"), `${helperDigest}  ${join(trusted, "supervisor-worker-handoff.mjs")}\n`);
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
const methodIndex = args.indexOf("--method");
const body = args.find((arg) => arg.startsWith("body="));
if (args[0] !== "api"
  || methodIndex < 0
  || args[methodIndex + 1] !== "PATCH"
  || !args.includes("repos/ibboabdoli-ai/Proffera/issues/comments/99")
  || !body) process.exit(2);
writeFileSync(process.env.GH_STUB_OUTPUT, body.slice("body=".length));
process.stdout.write("{}\\n");
`,
    { encoding: "utf8", mode: 0o755 },
  );
  const result = spawnSync("bash", ["-c", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      RUNNER_TEMP: root,
      GH_TOKEN: "test-token",
      GH_STUB_OUTPUT: output,
      REPOSITORY: "ibboabdoli-ai/Proffera",
      PACKET_B64: Buffer.from(JSON.stringify(packet())).toString("base64"),
      STATE_COMMENT_ID: "99",
      RUN_ID: "9001",
      CAPACITY_BLOCKED: capacityBlocked ? "true" : "false",
      RESERVATION_COMMENT_ID: reservationCommentId,
    },
  });
  return { ...result, body: existsSync(output) ? readFileSync(output, "utf8") : "" };
}

function packet(overrides: Record<string, unknown> = {}) {
  return {
    task_id: "SUP-TEST-1",
    supervisor_issue: 548,
    repository: "ibboabdoli-ai/Proffera",
    task_title: "Bounded test task",
    task_goal: "Change only the declared test feature.",
    graph_path: "feature/test",
    base_sha: sha,
    branch: "work/proffera-test-task",
    allowed_paths: ["src/features/test/", "tests/test-task.test.ts"],
    forbidden_paths: ["src/features/other/"],
    required_checks: [
      "validate",
      "codeql",
      "targeted-ci-shadow",
      "production-base-health",
      "ai-review",
      "final-gate",
    ],
    risk_class: 2,
    production_mutation_allowed: false,
    merge_allowed: false,
    auto_merge_allowed: false,
    ...overrides,
  };
}

function packetComment(value = packet()) {
  return `${taskMarker}\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``;
}

function baseContext(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      repository: "ibboabdoli-ai/Proffera",
      issue_number: 548,
      actor: "ibboabdoli-ai",
      is_fork: false,
      comment_body: packetComment(),
    },
    supervisor_labels: ["worker-dispatch-enabled"],
    live_main_sha: sha,
    comments: [],
    open_prs: [],
    branch: { exists: false },
    secrets: { openai: true, push: true },
    run_id: "1001",
    ...overrides,
  };
}

function run(mode: string, input: unknown) {
  const result = spawnSync(process.execPath, [helper, mode], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function runText(mode: string, input: unknown) {
  const result = spawnSync(process.execPath, [helper, mode], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

function ciPlan(paths: string[]) {
  const result = spawnSync(process.execPath, [ciScopeHelper], {
    input: `${paths.join("\n")}\n`,
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function publicationInput(overrides: Record<string, unknown> = {}, currentSourceHead?: string) {
  const path = "docs/SUPERVISOR_WORKER_HANDOFF.md";
  const sourceHead = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const targetHead = "d".repeat(40);
  const runId = "9001";
  const sourceContent = spawnSync("git", ["show", `${sourceHead}:${path}`], { encoding: "utf8" }).stdout;
  const [oldLine, ...rest] = sourceContent.split("\n");
  const newLine = `${oldLine} (publication test)`;
  const content = [newLine, ...rest].join("\n");
  const oldBytes = Buffer.from(sourceContent, "utf8");
  const bytes = Buffer.from(content, "utf8");
  const oldBlobSha = createHash("sha1").update(`blob ${oldBytes.length}\0`).update(oldBytes).digest("hex");
  const gitBlobSha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  const taskPacket = packet({ base_sha: sourceHead, allowed_paths: [path], forbidden_paths: ["src/features/other/"] });
  return {
    packet: taskPacket,
    current_source_head: currentSourceHead ?? sourceHead,
    expected_target_head: targetHead,
    expected_run_id: runId,
    artifact: {
      task_id: taskPacket.task_id,
      run_id: runId,
      packet_sha256: createHash("sha256").update(JSON.stringify(taskPacket)).digest("hex"),
      source_head: sourceHead,
      target_head: targetHead,
      artifact_set_complete: "YES",
      paths: [path],
      unified_diff: [`diff --git a/${path} b/${path}`, `index ${oldBlobSha}..${gitBlobSha} 100644`, `--- a/${path}`, `+++ b/${path}`, "@@ -1 +1 @@", `-${oldLine}`, `+${newLine}`, ""].join("\n"),
      replacements: [{ path, content }],
      manifest: [{ path, bytes: bytes.length, lines: content.split("\n").length - 1, sha256: createHash("sha256").update(bytes).digest("hex"), git_blob_sha: gitBlobSha }],
      ...overrides,
    },
  };
}

function evaluate(context: Record<string, unknown>) {
  return run("evaluate", context);
}

function workerPr(overrides: Record<string, unknown> = {}) {
  return {
    number: 900,
    head_ref: "work/proffera-independent",
    head_sha: "c".repeat(40),
    base_ref: "main",
    head_repo: "ibboabdoli-ai/Proffera",
    author: "ibboabdoli-ai",
    body: [
      "Task ID: OTHER-1",
      "Graph path: feature/other",
      'Allowed paths: ["src/features/other/"]',
    ].join("\n"),
    files: ["src/features/other/a.ts"],
    ...overrides,
  };
}

function trustedState(state: string, runId = "1001", headSha = "") {
  return {
    id: 99,
    created_at: "2026-09-08T12:00:00Z",
    user: { login: "github-actions[bot]" },
    body: [
      "<!-- proffera-worker-task-state:SUP-TEST-1 -->",
      "### Supervisor task: SUP-TEST-1",
      `- State: \`${state}\``,
      `- Run ID: \`${runId}\``,
      ...(headSha ? [`- Head: \`${headSha}\``] : []),
    ].join("\n"),
  };
}

function stateBody(state: string, headSha = sha) {
  return [
    "<!-- proffera-worker-task-state:SUP-TEST-1 -->",
    "### Supervisor task: SUP-TEST-1",
    `- State: \`${state}\``,
    "- Graph path: `feature/test`",
    "- Branch: `work/proffera-test-task`",
    `- Base: \`${sha}\``,
    `- Packet SHA-256: \`${createHash("sha256").update(JSON.stringify(packet())).digest("hex")}\``,
    "- Run ID: `9001`",
    "- PR: #900",
    `- Head: \`${headSha}\``,
    "- Reason: Behavior-test state.",
    "- Production mutation: `false`",
    "- Merge allowed: `false`",
    "- Auto-merge allowed: `false`",
  ].join("\n");
}

function durableStateBody(state: string, headSha = sha) {
  return runText("state-body", {
    packet: packet(),
    state,
    reason: "Behavior-test durable state.",
    run_id: "9001",
    pr_number: 849,
    head_sha: headSha,
  });
}

function transition(overrides: Record<string, unknown> = {}) {
  return run("transition", {
    current_body: stateBody("CHECKS_PENDING"),
    source: "lifecycle",
    requested_state: "READY_FOR_SUPERVISOR",
    requested_head: sha,
    live_head: sha,
    live_pr_state: "open",
    live_merged: false,
    ...overrides,
  });
}

async function ownershipHarness() {
  const control = await import(/* @vite-ignore */ pathToFileURL(helper).href);
  const taskPacket = control.normalizeTaskPacket(packet());
  const payload = {
    version: 1, state: "RELEASED", task_id: taskPacket.task_id, run_id: "9001",
    branch: taskPacket.branch, head_sha: sha, graph_path: taskPacket.graph_path,
    packet_digest: control.packetDigest(taskPacket), allowed_paths: taskPacket.allowed_paths,
    changed_files: ["src/features/test/worker.ts"], snapshot_finalized: true,
    lease_expires_at: "2099-01-01T00:00:00Z", pr_number: 849,
    recovery: { kind: "closed_pr", merged: false },
  };
  const pr = { number: 849, state: "open", merged: false, base: { ref: "main", sha },
    head: { ref: taskPacket.branch, sha, repo: { full_name: "ibboabdoli-ai/Proffera" } },
    user: { login: "ibboabdoli-ai" }, body: control.taskPrBody(taskPacket, payload.changed_files), files: payload.changed_files };
  const state = {
    owner: "1001", failTaskPatch: false, hook: (_step: string) => { void _step; },
    comments: [reservationComment(payload, 101),
      { id: 102, user: { login: "github-actions[bot]" }, body: `<!-- proffera-worker-dispatch-start:${taskPacket.task_id}:9001 -->` },
      { id: 103, user: { login: "github-actions[bot]" }, body: control.taskStateBody({ packet: taskPacket,
        state: "CLOSED_UNMERGED", run_id: "9001", pr_number: 849, head_sha: sha, reason: "Previously closed without merge." }) }],
    prs: [pr], writes: [] as Array<{ id: number; body: string }>, closes: [] as number[], posts: 0,
  };
  const io = (owner = "1001") => ({
    assertOwner: () => { if (state.owner !== owner) throw new Error("reservation mutex ownership changed"); },
    comments: () => { state.hook("comments"); return structuredClone(state.comments); },
    openPrs: () => { state.hook("open-prs"); return structuredClone(state.prs.filter((entry) => entry.state === "open")); },
    pr: (number: number) => {
      state.hook("pr");
      const found = state.prs.find((entry) => entry.number === number);
      if (!found) throw new Error("missing PR");
      return structuredClone(found);
    },
    patch: (id: number, body: string) => {
      state.hook(`before-patch:${id}`);
      if (id === 103 && state.failTaskPatch) throw new Error("task persistence interrupted");
      const record = state.comments.find((entry) => entry.id === id);
      if (!record) throw new Error("missing comment");
      record.body = body;
      state.writes.push({ id, body });
      state.hook(`patch:${id}`);
    },
    post: (body: string) => {
      const id = 1000 + state.posts++;
      state.comments.push({ id, user: { login: "github-actions[bot]" }, body });
      state.writes.push({ id, body });
      state.hook(`post:${id}`);
      return id;
    },
    close: (number: number) => {
      const found = state.prs.find((entry) => entry.number === number);
      if (!found) throw new Error("missing PR");
      found.state = "closed";
      state.closes.push(number);
      state.hook("close");
    },
  });
  const other = (index: number, reservationState = "RESERVED", branch = `work/proffera-owner-${index}`) => {
    const otherPacket = control.normalizeTaskPacket(packet({ task_id: `SUP-OWNER-${index}`, branch,
      graph_path: `feature/owner-${index}`, allowed_paths: [`src/owner-${index}/`] }));
    return reservationComment({ ...payload, state: reservationState, task_id: otherPacket.task_id,
      branch, graph_path: otherPacket.graph_path, allowed_paths: otherPacket.allowed_paths,
      changed_files: [], packet_digest: control.packetDigest(otherPacket),
      pr_number: reservationState === "PUBLISHED" ? 800 + index : null,
      recovery: reservationState === "RECOVERABLE" ? { kind: "branch", expires_at: "2099-01-01T00:00:00Z" } : null,
    }, 200 + index);
  };
  const request = { repository: "ibboabdoli-ai/Proffera", run_id: "1001", pr_number: 849,
    event_head: sha, actor: "ibboabdoli-ai" };
  return { control, taskPacket, payload, pr, state, io, other, request,
    authority: control.createWorkerReservationAuthority(io()) };
}

describe("Canonical Worker reservation ownership", () => {
  const acquisition = (fixture: Awaited<ReturnType<typeof ownershipHarness>>) => ({
    packet: fixture.taskPacket, run_id: "1001", head_sha: sha, changed_files: [],
  });

  it("reacquires one released slot before reopening and makes duplicate delivery idempotent", async () => {
    const fixture = await ownershipHarness();
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true, reactivated: true, reservation_comment_id: 101 });
    expect(fixture.state.writes.map((write) => write.id)).toEqual([101, 103, 101]);
    expect(fixture.state.writes[0].body).toContain("- State: `PUBLISHED`");
    expect(fixture.state.writes[1].body).toContain("- State: `WORKER_PR_OPENED`");
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true, reactivated: false });
    expect(fixture.state.writes).toHaveLength(3);
    expect(fixture.state.posts).toBe(0);
    expect(fixture.state.comments.filter((record) => record.body.includes("proffera-worker-dispatch-start:"))).toHaveLength(1);
  });

  it("rejects reopening a third Worker and recovers once capacity frees without redispatch", async () => {
    const fixture = await ownershipHarness();
    fixture.state.comments.push(fixture.other(1), fixture.other(2));
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: false, code: "capacity_blocked", retryable: true, pr_closed: true });
    expect(fixture.state.writes).toEqual([]);
    expect(fixture.state.closes).toEqual([849]);
    expect(fixture.state.comments[0].body).toContain("- State: `RELEASED`");
    expect(fixture.state.comments[2].body).toContain("- State: `CLOSED_UNMERGED`");
    fixture.state.comments[3] = fixture.other(1, "RELEASED");
    fixture.pr.state = "open"; // Supported retry: owner reopens the same unchanged PR.
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true, reservation_comment_id: 101 });
    expect(fixture.state.writes.map((write) => write.id)).toEqual([101, 103, 101]);
    expect(fixture.state.posts).toBe(0);
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.state.writes).toHaveLength(3);
  });

  it.each(["RESERVED", "PUBLISHED", "RECOVERABLE"])("rejects another %s branch owner even without a live branch or PR", async (state) => {
    const fixture = await ownershipHarness();
    fixture.state.prs = [];
    fixture.state.comments = [fixture.other(1, state, fixture.taskPacket.branch)];
    expect(fixture.authority.acquire(acquisition(fixture))).toMatchObject({ ok: false, code: "invalid_ownership", reason: expect.stringContaining("branch") });
    expect(fixture.state.writes).toEqual([]);
    expect(fixture.state.posts).toBe(0);
  });

  it.each(["RELEASED", "RECOVERABLE"])("permits legitimate disjoint reuse beside %s evidence and remains idempotent", async (state) => {
    const fixture = await ownershipHarness();
    fixture.state.prs = [];
    fixture.state.comments = [fixture.other(1, state, state === "RELEASED" ? fixture.taskPacket.branch : undefined)];
    expect(fixture.authority.acquire(acquisition(fixture))).toMatchObject({ ok: true, reused: false });
    expect(fixture.authority.acquire(acquisition(fixture))).toMatchObject({ ok: true, reused: true });
    expect(fixture.state.posts).toBe(1);
    expect(fixture.state.writes).toHaveLength(1);
  });

  it.each(["duplicate-task", "duplicate-branch", "array-branch", "array-head", "array-digest", "whitespace-scope", "whitespace-touch", "malformed-payload", "duplicate-payload", "duplicate-state"])("fails closed on %s reservation evidence before any mutation", async (kind) => {
    const fixture = await ownershipHarness();
    const other = fixture.other(1, "RECOVERABLE");
    if (kind === "duplicate-task") fixture.state.comments.push({ ...fixture.state.comments[0], id: 999 });
    else if (kind === "duplicate-branch") fixture.state.comments.push(fixture.other(1, "RESERVED", fixture.taskPacket.branch));
    else if (kind === "duplicate-payload") fixture.state.comments[0].body += "\n- Reservation payload: `!`";
    else if (kind === "duplicate-state") fixture.state.comments[0].body += "\n- State: malformed";
    else {
      const payload = JSON.parse(Buffer.from(other.body.match(/Reservation payload: `([^`]+)`/)![1], "base64").toString());
      if (kind === "array-branch") payload.branch = [fixture.taskPacket.branch];
      if (kind === "array-head") payload.head_sha = [sha];
      if (kind === "array-digest") payload.packet_digest = [payload.packet_digest];
      if (kind === "whitespace-scope") payload.allowed_paths = [" src/owner-1/"];
      if (kind === "whitespace-touch") payload.changed_files = ["src/owner-1/file.ts "];
      fixture.state.comments.push(kind === "malformed-payload" ? { ...other, body: other.body.replace(/Reservation payload: `[^`]+`/, "Reservation payload: `!`") } : reservationComment(payload, other.id));
    }
    if (kind === "duplicate-branch") {
      // RELEASED historical owners do not alias; the new active owner still blocks reacquisition.
      expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: false, code: "invalid_ownership" });
    } else expect(() => fixture.authority.admitPr(fixture.request)).toThrow();
    expect(fixture.state.writes).toEqual([]);
  });

  it.each(["stale-event", "changed-packet", "wrong-pr", "wrong-task-head", "unreserved", "invalid-source"])("rejects %s reopening without activation", async (kind) => {
    const fixture = await ownershipHarness();
    if (kind === "stale-event") fixture.request.event_head = "b".repeat(40);
    if (kind === "changed-packet") fixture.pr.body = packetComment({ ...fixture.taskPacket, graph_path: "feature/changed" });
    if (kind === "wrong-pr") fixture.state.comments[0] = reservationComment({ ...fixture.payload, pr_number: 850 }, 101);
    if (kind === "wrong-task-head") fixture.state.comments[2].body = fixture.state.comments[2].body.replace(`- Head: \`${sha}\``, `- Head: \`${"b".repeat(40)}\``);
    if (kind === "unreserved") fixture.state.comments.shift();
    expect(() => fixture.authority.admitPr({ ...fixture.request, ...(kind === "invalid-source" ? { source: "dispatch" } : {}) })).toThrow();
    expect(fixture.state.writes).toEqual([]);
  });

  it.each(["graph", "scope", "touch"])("preserves %s exclusion during reacquisition", async (kind) => {
    const fixture = await ownershipHarness();
    const other = fixture.other(1);
    const payload = JSON.parse(Buffer.from(other.body.match(/Reservation payload: `([^`]+)`/)![1], "base64").toString());
    if (kind === "graph") payload.graph_path = fixture.taskPacket.graph_path;
    if (kind === "scope") payload.allowed_paths = fixture.taskPacket.allowed_paths;
    if (kind === "touch") payload.changed_files = fixture.payload.changed_files;
    fixture.state.comments.push(reservationComment(payload, other.id));
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: false, code: "invalid_ownership" });
    expect(fixture.state.writes).toEqual([]);
  });

  it.each(["lifecycle", "checks"])("allows a %s reconciliation to arrive first after reopening", async (source) => {
    const fixture = await ownershipHarness();
    expect(fixture.authority.admitPr({ ...fixture.request, source, requested_state: "CHECKS_PENDING" })).toMatchObject({ ok: true, reactivated: true });
    expect(fixture.state.comments[2].body).toContain("- State: `CHECKS_PENDING`");
    expect(fixture.state.writes.map((write) => write.id)).toEqual([101, 103, 101]);
  });

  it.each(["reopen", "rebind"])("resumes an interrupted %s task write with the same reservation and no redispatch", async (kind) => {
    const fixture = await ownershipHarness();
    if (kind === "rebind") {
      fixture.authority.admitPr(fixture.request);
      fixture.state.writes = [];
      fixture.pr.head.sha = "b".repeat(40);
      fixture.request.event_head = fixture.pr.head.sha;
    }
    fixture.state.failTaskPatch = true;
    expect(() => fixture.authority.admitPr(fixture.request)).toThrow("task persistence interrupted");
    expect(fixture.state.writes.map((write) => write.id)).toEqual([101]);
    fixture.state.failTaskPatch = false;
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true, reservation_comment_id: 101 });
    expect(fixture.state.writes.map((write) => write.id)).toEqual([101, 103, 101]);
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.state.writes).toHaveLength(3);
    expect(fixture.state.posts).toBe(0);
    expect(fixture.state.comments.filter((record) => record.body.includes("proffera-worker-dispatch-start:"))).toHaveLength(1);
  });

  it.each(["close-before", "close-after-reservation", "reservation-before", "reservation-after", "dispatch-after", "mutex-after"])("prevents partial task activation when %s races admission", async (kind) => {
    const fixture = await ownershipHarness();
    let reads = 0;
    fixture.state.hook = (step) => {
      if (step === "comments") reads += 1;
      const before = (kind === "close-before" || kind === "reservation-before") && step === "comments" && reads === 2;
      const after = kind.endsWith("after") || kind === "close-after-reservation";
      if (!before && !(after && step === "patch:101")) return;
      fixture.state.hook = () => {};
      if (kind.startsWith("close")) fixture.pr.state = "closed";
      if (kind.startsWith("reservation")) fixture.state.comments.push(fixture.other(1), fixture.other(2));
      if (kind === "dispatch-after") fixture.state.comments[1].body += "\nchanged";
      if (kind === "mutex-after") fixture.state.owner = "2002";
    };
    expect(() => fixture.authority.admitPr(fixture.request)).toThrow();
    expect(fixture.state.writes.some((write) => write.id === 103)).toBe(false);
    expect(fixture.state.comments[2].body).toContain("- State: `CLOSED_UNMERGED`");
  });

  it("serializes a competing reservation behind the same global mutex and counts the reopened owner", async () => {
    const fixture = await ownershipHarness();
    fixture.state.comments.push(fixture.other(1));
    const competingPacket = fixture.control.normalizeTaskPacket(packet({ task_id: "SUP-OWNER-2", branch: "work/proffera-owner-2", graph_path: "feature/owner-2", allowed_paths: ["src/owner-2/"] }));
    const competing = fixture.control.createWorkerReservationAuthority(fixture.io("2002"));
    const request = { ...acquisition(fixture), packet: competingPacket, run_id: "2002" };
    expect(() => competing.acquire(request)).toThrow("mutex ownership");
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    fixture.state.owner = "2002";
    expect(competing.acquire(request)).toMatchObject({ ok: false, code: "capacity_blocked" });
    expect(fixture.state.posts).toBe(0);
  });

  it("rejects duplicate active owners even on same-task idempotent acquisition", async () => {
    const fixture = await ownershipHarness();
    fixture.state.prs = [];
    fixture.state.comments = [];
    fixture.authority.acquire(acquisition(fixture));
    fixture.state.comments.push(fixture.other(1, "RECOVERABLE", fixture.taskPacket.branch));
    expect(fixture.authority.acquire(acquisition(fixture))).toMatchObject({ ok: false, code: "invalid_ownership" });
    expect(fixture.state.posts).toBe(1);
  });

  it("retains all changed-file evidence beyond fifty files", async () => {
    const fixture = await ownershipHarness();
    fixture.pr.files = Array.from({ length: 75 }, (_, index) => `src/features/test/file-${index}.ts`);
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    const stored = JSON.parse(Buffer.from(fixture.state.comments[0].body.match(/Reservation payload: `([^`]+)`/)![1], "base64").toString());
    expect(stored.changed_files).toEqual(fixture.pr.files);
  });

  it.each(["RESERVED", "RECOVERABLE"])("publishes an original %s owner and preserves later readiness for the same head", async (state) => {
    const fixture = await ownershipHarness();
    fixture.state.comments[0] = reservationComment({ ...fixture.payload, state, pr_number: null,
      recovery: state === "RECOVERABLE" ? { kind: "artifact", expires_at: "2099-01-01T00:00:00Z" } : null }, 101);
    fixture.state.comments[2].body = fixture.control.taskStateBody({ packet: fixture.taskPacket, state: "TASK_CREATED", run_id: "9001", head_sha: sha });
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.authority.admitPr({ ...fixture.request, source: "checks", requested_state: "READY_FOR_SUPERVISOR" })).toMatchObject({ ok: true });
    const writes = fixture.state.writes.length;
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.state.writes).toHaveLength(writes);
    expect(fixture.state.comments[2].body).toContain(`- Ready checkpoint: \`${fixture.taskPacket.task_id}@${sha}\``);
  });

  it("rejects an unrelated third task head during an interrupted published-head rebind", async () => {
    const fixture = await ownershipHarness();
    fixture.authority.admitPr(fixture.request);
    fixture.pr.head.sha = "b".repeat(40);
    fixture.request.event_head = fixture.pr.head.sha;
    fixture.state.failTaskPatch = true;
    expect(() => fixture.authority.admitPr(fixture.request)).toThrow("task persistence interrupted");
    fixture.state.failTaskPatch = false;
    fixture.state.comments[2].body = fixture.state.comments[2].body.replace(`- Head: \`${sha}\``, `- Head: \`${"c".repeat(40)}\``);
    const writes = fixture.state.writes.length;
    expect(() => fixture.authority.admitPr(fixture.request)).toThrow("prior reserved head");
    expect(fixture.state.writes).toHaveLength(writes);
  });

  it("fails acquisition verification if duplicate branch evidence appears during persistence", async () => {
    const fixture = await ownershipHarness();
    fixture.state.prs = [];
    fixture.state.comments = [];
    fixture.state.hook = (step) => {
      if (step.startsWith("post:")) fixture.state.comments.push(fixture.other(1, "RECOVERABLE", fixture.taskPacket.branch));
    };
    expect(() => fixture.authority.acquire(acquisition(fixture))).toThrow("duplicate active reservation branch");
    expect(fixture.state.posts).toBe(1);
    expect(fixture.state.writes.every((write) => write.body.includes("slot-reservation"))).toBe(true);
  });

  it("invalidates a pre-close Ready checkpoint when the terminal close task write was interrupted", async () => {
    const fixture = await ownershipHarness();
    fixture.state.comments[2].body = fixture.control.taskStateBody({ packet: fixture.taskPacket,
      state: "READY_FOR_SUPERVISOR", run_id: "9001", pr_number: 849, head_sha: sha });
    fixture.state.failTaskPatch = true;
    expect(() => fixture.authority.admitPr(fixture.request)).toThrow("task persistence interrupted");
    fixture.state.failTaskPatch = false;
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.state.writes.map((write) => write.id)).toEqual([101, 103, 101]);
    expect(fixture.state.comments[2].body).toContain("- State: `WORKER_PR_OPENED`");
    expect(fixture.state.comments[2].body).not.toContain("Ready checkpoint:");
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.state.writes).toHaveLength(3);
  });

  it.each(["READY_FOR_SUPERVISOR", "CLOSED_UNMERGED"])("recovers an interrupted close at a newer head with exact prior %s task proof", async (state) => {
    const fixture = await ownershipHarness();
    fixture.state.comments[2].body = fixture.control.taskStateBody({ packet: fixture.taskPacket,
      state, run_id: "9001", pr_number: 849, head_sha: sha });
    const prior = fixture.state.comments[2].body;
    fixture.pr.head.sha = "b".repeat(40);
    fixture.request.event_head = fixture.pr.head.sha;
    fixture.state.comments[0] = reservationComment({ ...fixture.payload, head_sha: fixture.pr.head.sha,
      activation_task_sha256: createHash("sha256").update(prior).digest("hex") }, 101);
    fixture.state.failTaskPatch = true;
    expect(() => fixture.authority.admitPr(fixture.request)).toThrow("task persistence interrupted");
    fixture.state.failTaskPatch = false;
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true, head_sha: fixture.pr.head.sha });
    expect(fixture.state.writes.map((write) => write.id)).toEqual([101, 103, 101]);
    expect(fixture.state.comments[2].body).toContain(`- Head: \`${fixture.pr.head.sha}\``);
    expect(fixture.state.comments[2].body).not.toContain("Ready checkpoint:");
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.state.writes).toHaveLength(3);
  });

  it("consumes activation proof so restored identical Ready evidence remains monotonic", async () => {
    const fixture = await ownershipHarness();
    const reason = "All required workflows currently pass for the exact head.";
    const ready = fixture.control.taskStateBody({ packet: fixture.taskPacket,
      state: "READY_FOR_SUPERVISOR", run_id: "9001", pr_number: 849, head_sha: sha, reason });
    fixture.state.comments[2].body = ready;
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.authority.admitPr({ ...fixture.request, source: "checks", requested_state: "READY_FOR_SUPERVISOR", reason })).toMatchObject({ ok: true });
    expect(fixture.state.comments[2].body).toBe(ready);
    const writes = fixture.state.writes.length;
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.state.writes).toHaveLength(writes);
    expect(fixture.state.comments[2].body).toBe(ready);
    const payload = JSON.parse(Buffer.from(fixture.state.comments[0].body.match(/Reservation payload: `([^`]+)`/)![1], "base64").toString());
    expect(payload.activation_task_sha256).toBeUndefined();
  });

  it.each(["before-patch:101", "patch:101"])("finishes proof cleanup after failure at %s without duplicate activation", async (step) => {
    const fixture = await ownershipHarness();
    let patches = 0;
    fixture.state.hook = (current) => {
      if (current === step && ++patches === 2) throw new Error("cleanup transport failure");
    };
    expect(() => fixture.authority.admitPr(fixture.request)).toThrow("cleanup transport failure");
    fixture.state.hook = () => {};
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.state.writes.map((write) => write.id)).toEqual([101, 103, 101]);
    expect(fixture.state.posts).toBe(0);
    expect(fixture.authority.admitPr(fixture.request)).toMatchObject({ ok: true });
    expect(fixture.state.writes).toHaveLength(3);
  });
});

describe("Supervisor ↔ Worker Phase-1 handoff", () => {
  it("keeps manual owner dispatch separate from typed internal Planner handoff", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const workflowCall = workflow.slice(workflow.indexOf("  workflow_call:"), workflow.indexOf("  workflow_dispatch:"));
    const manualDispatch = workflow.slice(workflow.indexOf("  workflow_dispatch:"), workflow.indexOf("  pull_request_target:"));
    expect(workflowCall).toContain("planner_packet_b64:");
    expect(workflowCall).toContain("planner_packet_sha256:");
    expect(workflowCall).toContain("planner_run_id:");
    expect(manualDispatch).toContain("comment_id:");
    expect(manualDispatch).not.toContain("planner_packet_b64:");
    expect(workflow).not.toContain("issue_comment:");
  });

  it("keeps the trusted handoff helper directly executable", () => {
    const result = spawnSync(helper, ["parse"], {
      input: packetComment(),
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ task_id: "SUP-TEST-1" });
  });

  it("accepts a valid bounded task", () => {
    expect(evaluate(baseContext()).status).toBe("TASK_CREATED");
  });

  it("rejects forged Planner authority without exact internal provenance and run binding", () => {
    const forged = baseContext({
      event: {
        repository: "ibboabdoli-ai/Proffera",
        issue_number: 548,
        actor: "github-actions[bot]",
        source: "planner",
        trusted_internal_dispatch: true,
        is_fork: false,
        comment_body: packetComment(),
      },
      supervisor_labels: ["worker-dispatch-enabled", "supervisor-autopilot-enabled"],
    });
    expect(evaluate(forged).code).toBe("unauthorized_actor");

    const wrongRun = baseContext({
      event: {
        repository: "ibboabdoli-ai/Proffera",
        issue_number: 548,
        actor: "github-actions[bot]",
        source: "planner",
        trusted_internal_dispatch: true,
        internal_provenance_verified: true,
        packet_digest_verified: true,
        planner_run_id: "9999",
        planner_head_sha: sha,
        planner_packet_sha256: createHash("sha256").update(JSON.stringify(packet())).digest("hex"),
        planner_workflow_ref: "ibboabdoli-ai/Proffera/.github/workflows/supervisor-planner.yml@refs/heads/main",
        is_fork: false,
        comment_body: packetComment(),
      },
      supervisor_labels: ["worker-dispatch-enabled", "supervisor-autopilot-enabled"],
    });
    expect(evaluate(wrongRun).code).toBe("planner_provenance_mismatch");

    const exact = baseContext({
      event: {
        repository: "ibboabdoli-ai/Proffera",
        issue_number: 548,
        actor: "github-actions[bot]",
        source: "planner",
        trusted_internal_dispatch: true,
        internal_provenance_verified: true,
        packet_digest_verified: true,
        planner_run_id: "1001",
        planner_head_sha: sha,
        planner_packet_sha256: createHash("sha256").update(JSON.stringify(packet())).digest("hex"),
        planner_workflow_ref: "ibboabdoli-ai/Proffera/.github/workflows/supervisor-planner.yml@refs/heads/main",
        is_fork: false,
        comment_body: packetComment(),
      },
      supervisor_labels: ["worker-dispatch-enabled", "supervisor-autopilot-enabled"],
    });
    expect(evaluate(exact).status).toBe("TASK_CREATED");

    for (const risk_class of [3, 4]) {
      const highRiskPacket = packet({ risk_class });
      const highRisk = structuredClone(exact) as Record<string, unknown>;
      const highRiskEvent = highRisk.event as Record<string, unknown>;
      highRiskEvent.comment_body = packetComment(highRiskPacket);
      highRiskEvent.planner_packet_sha256 = createHash("sha256").update(JSON.stringify(highRiskPacket)).digest("hex");
      expect(evaluate(highRisk).code).toBe("planner_risk_class_requires_human");
    }

    const badDigest = structuredClone(exact) as Record<string, unknown>;
    ((badDigest.event as Record<string, unknown>).planner_packet_sha256 as string) = "f".repeat(64);
    expect(evaluate(badDigest).code).toBe("planner_packet_digest_mismatch");

    const badHead = structuredClone(exact) as Record<string, unknown>;
    (badHead.event as Record<string, unknown>).planner_head_sha = otherSha;
    expect(evaluate(badHead).code).toBe("planner_head_mismatch");
  });

  it("rejects malformed task JSON", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).comment_body = `${taskMarker}\n\`\`\`json\n{broken}\n\`\`\``;
    expect(evaluate(context).code).toBe("malformed_packet");
  });

  it("idempotently refuses a duplicate task ID with active state", () => {
    expect(evaluate(baseContext({ comments: [trustedState("WORKER_PR_OPENED", "1000")] })).status).toBe("ALREADY_DISPATCHED");
  });

  it("allows the same serialized run to recheck its own TASK_CREATED state", () => {
    expect(evaluate(baseContext({ comments: [trustedState("TASK_CREATED")] })).status).toBe("TASK_CREATED");
  });

  it("serializes admission while durable reservations preserve canonical task ownership", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    expect(workflow).toContain("group: proffera-supervisor-worker-admission");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("reservation-mutex-acquire");
    expect(workflow).toContain("reservation-acquire");
    expect(workflow).toContain("planner_packet_b64");
    expect(workflow).toContain("internal_provenance_verified");
    expect(workflow).not.toContain("needs: resolve_task_lane");
  });

  it("converges same-task created, edited, duplicate-delivery, and same-event retry preflights to one state record", () => {
    const harness = createPreflightHarness({ runStatus: "in_progress" });
    const created = harness.run({ runId: "1001", commentId: "501" });
    expect(created.status, created.stderr).toBe(0);
    expect(created.outputs.proceed).toBe("yes");

    const edited = harness.run({
      runId: "1002",
      commentId: "501",
      taskPacket: packet({ task_title: "Edited duplicate delivery" }),
    });
    expect(edited.outputs.proceed).not.toBe("yes");
    expect(edited.comments.filter((comment) => String(comment.body ?? "").includes("proffera-worker-task-state:SUP-TEST-1"))).toHaveLength(1);
    expect(String(edited.comments[0]?.body ?? "")).toBe(String(created.comments[0]?.body ?? ""));

    const duplicate = harness.run({ runId: "1002", commentId: "501" });
    expect(duplicate.status, duplicate.stderr).toBe(0);
    expect(duplicate.outputs.proceed).toBe("no");

    const retry = harness.run({ runId: "1001", commentId: "501" });
    expect(retry.status, retry.stderr).toBe(0);
    expect(retry.outputs.proceed).toBe("yes");
    const taskStates = retry.comments.filter((comment) => String(comment.body ?? "").includes("proffera-worker-task-state:SUP-TEST-1"));
    expect(taskStates).toHaveLength(1);
    expect(String(taskStates[0].body)).toContain("- State: `TASK_CREATED`");
    expect(created.calls.filter((args) => args.includes("--method") && args.includes("POST") && args.some((arg) => arg.endsWith("/issues/548/comments")))).toHaveLength(1);
    expect(edited.calls.filter((args) => args.includes("--method") && args.includes("POST") && args.some((arg) => arg.endsWith("/issues/548/comments")))).toHaveLength(0);
    expect(duplicate.calls.filter((args) => args.includes("--method") && args.includes("POST") && args.some((arg) => arg.endsWith("/issues/548/comments")))).toHaveLength(0);
  }, 20_000);

  it("keeps two different disjoint task preflights independently dispatchable", () => {
    const harness = createPreflightHarness();
    const first = harness.run({ runId: "1001", commentId: "501" });
    const secondPacket = packet({
      task_id: "SUP-OTHER-2",
      task_title: "Independent disjoint task",
      task_goal: "Exercise an independent task lane.",
      graph_path: "feature/other",
      branch: "work/proffera-independent",
      allowed_paths: ["src/features/other/"],
      forbidden_paths: ["src/features/test/"],
    });
    const second = harness.run({ runId: "1002", commentId: "502", taskPacket: secondPacket });
    expect(first.status, first.stderr).toBe(0);
    expect(second.status, second.stderr).toBe(0);
    expect(first.outputs.proceed).toBe("yes");
    expect(second.outputs.proceed).toBe("yes");
    const taskStates = second.comments.filter((comment) => String(comment.body ?? "").includes("proffera-worker-task-state:"));
    expect(taskStates).toHaveLength(2);
    expect(new Set(taskStates.map((comment) => String(comment.body).match(/task-state:([^ ]+)/)?.[1]))).toEqual(
      new Set(["SUP-TEST-1", "SUP-OTHER-2"]),
    );
  });

  it.each(["RESERVED", "RECOVERABLE"] as const)(
    "reclaims the exact expired unbound %s reservation before canonical preflight rejection",
    (reservationState) => {
      const evidence = expiredSameTaskEvidence(reservationState);
      const result = createPreflightHarness({ comments: evidence.comments }).run({ taskPacket: evidence.packet, runId: "1002" });
      expect(result.status, result.stderr).toBe(0);
      expect(result.outputs.proceed).toBe("yes");
      expect(result.stdout).toContain('"reclaimed":["SUP-TEST-1"]');
      const reservation = result.comments.find((comment) => comment.id === 201);
      const reservationPayload = JSON.parse(Buffer.from(
        String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "",
        "base64",
      ).toString("utf8"));
      expect(reservationPayload).toMatchObject({
        state: "RELEASED",
        task_id: "SUP-TEST-1",
        recovery: { kind: "expired_reservation", verified_run_status: "completed", retryable: true },
      });
      const taskStates = result.comments.filter((comment) => String(comment.body ?? "").includes("proffera-worker-task-state:SUP-TEST-1"));
      expect(taskStates).toHaveLength(1);
      expect(String(taskStates[0].body)).toContain("- State: `TASK_CREATED`");
      expect(String(taskStates[0].body)).toContain("- Run ID: `1002`");
    },
  );

  it.each([1, 2])("recovers TASK_CREATED after %i transient verification reads without another state record", (failVerificationReads) => {
    const blocked = { id: 701, user: { login: "github-actions[bot]" }, body: runText("state-body", {
      packet: packet(), state: "TASK_BLOCKED", run_id: "9001", reason: "No capacity before dispatch",
    }) };
    for (const comments of [[], [blocked]]) {
      const result = createPreflightHarness({ comments }).run({ mutation: { failVerificationReads } });
      expect(result.status, result.stderr).toBe(0);
      expect(result.outputs.proceed).toBe("yes");
      expect(result.comments).toHaveLength(1);
      expect(result.waits).toEqual([1000, 2000].slice(0, failVerificationReads)
        .map((milliseconds) => ({ mode: "task-comments", milliseconds })));
      expect(verificationReadCalls(result.calls)).toHaveLength(failVerificationReads + 1);
      expect(result.calls.filter((args) => args.includes("POST") && args.some((arg) => arg.endsWith("/issues/548/comments")))).toHaveLength(comments.length ? 0 : 1);
      if (comments.length) expect(commentPatchCalls(result.calls, 701)).toHaveLength(1);
    }
  });

  it("converges a completed orphan after verification retries are exhausted through the same retryable transition", () => {
    const harness = createPreflightHarness();
    const interrupted = harness.run({ mutation: { failVerificationReads: 3 } });
    expect(interrupted.status).toBe(1);
    expect(interrupted.outputs.proceed).toBeUndefined();
    expect(interrupted.comments).toHaveLength(1);
    expect(String(interrupted.comments[0].body)).toContain("- State: `TASK_CREATED`");
    expect(interrupted.waits).toEqual([1000, 2000].map((milliseconds) => ({ mode: "task-comments", milliseconds })));
    expect(verificationReadCalls(interrupted.calls)).toHaveLength(3);
    const retry = harness.run({ runId: "1002" });
    expect(retry.status, retry.stderr).toBe(0);
    expect(retry.outputs.proceed).toBe("yes");
    expect(retry.comments).toHaveLength(1);
    expect(retry.comments[0].id).toBe(interrupted.comments[0].id);
    expect(String(retry.comments[0].body)).toContain("- Run ID: `1002`");
    expect(retry.waits).toEqual([]);
    expect(verificationReadCalls(retry.calls)).toHaveLength(1);
    expect(commentPatchCalls(retry.calls, Number(retry.comments[0].id)).map((args) => args.find((arg) => arg.startsWith("body="))))
      .toEqual([expect.stringContaining("- State: `TASK_BLOCKED`"), expect.stringContaining("- State: `TASK_CREATED`")]);
  });

  it.each(["active run", "reservation", "dispatch marker", "branch", "PR on another base", "advanced task state"] as const)(
    "keeps genuinely dispatched and reserved, branched, or PR-backed TASK_CREATED tasks non-dispatchable (%s)",
    (binding) => {
      const task = { id: 701, user: { login: "github-actions[bot]" }, body: runText("state-body", {
        packet: packet(), state: "TASK_CREATED", run_id: "9001", reason: "Prior preflight",
      }) };
      const evidence = expiredSameTaskEvidence("RESERVED", { lease_expires_at: "2099-01-01T00:00:00Z" });
      const openPr = { number: 830, base: { ref: "other-base" }, head: { ref: packet().branch, repo: { full_name: "ibboabdoli-ai/Proffera" } }, user: { login: "ibboabdoli-ai" }, body: "", files: [] };
      const cases = {
        "active run": { comments: [task], runStatus: "in_progress" },
        "reservation": { comments: [task, evidence.comments[0]] },
        "dispatch marker": { comments: [task, evidence.comments[1]] },
        "branch": { comments: [task], branches: [String(packet().branch)] },
        "PR on another base": { comments: [task], pulls: [openPr] },
        "advanced task state": { comments: [{ ...task, body: String(task.body).replace("TASK_CREATED", "WORKER_PR_OPENED") }] },
      };
      const result = createPreflightHarness(cases[binding]).run({ runId: "1002" });
      expect(result.status, result.stderr).toBe(0);
      expect(result.outputs.proceed).toBe("no");
      expect(commentPatchCalls(result.calls, 701)).toHaveLength(0);
      expect(result.calls.filter((args) => args.includes("PATCH"))).toHaveLength(0);
      expect(result.waits).toEqual([]);
    },
  );

  it("does not redispatch an orphan when Worker or aliased reservation evidence appears after the retryable write", () => {
    const task = { id: 701, user: { login: "github-actions[bot]" }, body: runText("state-body", {
      packet: packet(), state: "TASK_CREATED", run_id: "9001", reason: "Prior preflight",
    }) };
    for (const mutation of [{ dispatchOnCommentRead: 3 }, { aliasReservationOnCommentRead: 3 }]) {
      const harness = createPreflightHarness({ comments: [task] });
      const changed = harness.run({ runId: "1002", mutation });
      expect(changed.outputs.proceed).not.toBe("yes");
      expect(String(changed.comments.find((comment) => comment.id === 701)?.body)).toContain("TASK_CREATED");
      expect(commentPatchCalls(changed.calls, 701)).toHaveLength(0);
      const retry = harness.run({ runId: "1003" });
      expect(retry.outputs.proceed).not.toBe("yes");
      expect(commentPatchCalls(retry.calls, 701)).toHaveLength(0);
    }
  });

  it("recovers a lost mutex POST response only by its exact new descriptor", () => {
    const result = createPreflightHarness().run({ mutation: { loseMutexResponse: true } });
    expect(result.status, result.stderr).toBe(0);
    expect(result.outputs.proceed).toBe("yes");
    expect(result.calls.filter((args) => args.includes("POST") && args.some((arg) => arg.endsWith("/labels")))).toHaveLength(1);
    expect(result.calls.filter((args) => args.includes("DELETE"))).toHaveLength(1);
  });

  it("retains a same-task reservation when it is live, branched, or represented by an open PR", () => {
    const future = expiredSameTaskEvidence("RESERVED", { lease_expires_at: "2099-01-01T00:00:00Z" });
    const branch = expiredSameTaskEvidence("RESERVED");
    const openPr = {
      number: 830,
      base: { ref: "main" },
      head: { ref: "work/proffera-test-task", sha, repo: { full_name: "ibboabdoli-ai/Proffera" } },
      user: { login: "ibboabdoli-ai" },
      body: packetComment(),
      files: [],
    };
    for (const result of [
      createPreflightHarness({ comments: future.comments }).run({ runId: "1002" }),
      createPreflightHarness({ comments: branch.comments, branches: ["work/proffera-test-task"] }).run({ runId: "1002" }),
      createPreflightHarness({ comments: branch.comments, pulls: [openPr] }).run({ runId: "1002" }),
      createPreflightHarness({ comments: branch.comments, runStatus: "in_progress" }).run({ runId: "1002" }),
    ]) {
      expect(result.status, result.stderr).toBe(0);
      expect(result.outputs.proceed).toBe("no");
      expect(commentPatchCalls(result.calls, 201)).toHaveLength(0);
      expect(String(result.comments.find((comment) => comment.id === 203)?.body)).toContain("- State: `WORKER_BLOCKED`");
    }
  }, 20_000);

  it("fails closed when same-task expiry evidence changes or becomes duplicate during reconciliation", () => {
    const evidence = expiredSameTaskEvidence("RECOVERABLE");
    for (const mutation of [
      { mutateReservationOnCommentRead: 2 },
      { mutateTaskOnCommentRead: 2 },
      { duplicateReservationOnCommentRead: 2 },
      { duplicateTaskOnCommentRead: 2 },
    ]) {
      const result = createPreflightHarness({ comments: evidence.comments }).run({ runId: "1002", mutation });
      expect(result.outputs.proceed).not.toBe("yes");
      expect(commentPatchCalls(result.calls, 201)).toHaveLength(0);
      expect(commentPatchCalls(result.calls, 203)).toHaveLength(0);
    }
  });

  it("fails closed on initial duplicate task-state or reservation evidence and never reclaims another task", () => {
    const evidence = expiredSameTaskEvidence("RESERVED");
    for (const comments of [
      [...evidence.comments, { ...evidence.comments[0], id: 204 }],
      [...evidence.comments, { ...evidence.comments[2], id: 204 }],
    ]) {
      const result = createPreflightHarness({ comments }).run({ runId: "1002" });
      expect(result.status).toBe(1);
      expect(result.calls.filter((args) => args.includes("--method") && args.includes("PATCH"))).toHaveLength(0);
    }

    const unrelated = expiredSameTaskEvidence("RESERVED");
    const newTask = packet({
      task_id: "SUP-OTHER-2",
      task_title: "Unrelated task",
      task_goal: "Must not reclaim another task reservation.",
      graph_path: "feature/other",
      branch: "work/proffera-independent",
      allowed_paths: ["src/features/other/"],
      forbidden_paths: ["src/features/test/"],
    });
    const result = createPreflightHarness({ comments: unrelated.comments }).run({ taskPacket: newTask, runId: "1002" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.outputs.proceed).toBe("yes");
    expect(commentPatchCalls(result.calls, 201)).toHaveLength(0);
    expect(String(result.comments.find((comment) => comment.id === 201)?.body)).toContain("- State: `RESERVED`");
  });

  it("fails closed on missing, duplicate, or mismatched same-task dispatch and reservation provenance", () => {
    const evidence = expiredSameTaskEvidence("RESERVED");
    const duplicateDispatch = { ...evidence.comments[1], id: 204 };
    const mismatched = expiredSameTaskEvidence("RESERVED", { packet_digest: "f".repeat(64) });
    for (const comments of [
      [evidence.comments[0], evidence.comments[2]],
      [evidence.comments[0], evidence.comments[1]],
      [...evidence.comments, duplicateDispatch],
      mismatched.comments,
    ]) {
      const result = createPreflightHarness({ comments }).run({ runId: "1002" });
      expect(result.status).toBe(1);
      expect(result.calls.filter((args) => args.includes("--method") && args.includes("PATCH"))).toHaveLength(0);
    }
  });

  it("ignores a spoofed task-state comment not authored by the trusted bot", () => {
    const spoofed = { ...trustedState("WORKER_PR_OPENED", "1000"), user: { login: "attacker" } };
    expect(evaluate(baseContext({ comments: [spoofed] })).status).toBe("TASK_CREATED");
  });

  it("fails closed on an untrusted Worker PR author", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ author: "attacker" })] })).code).toBe("untrusted_worker_pr");
  });

  it("fails closed on an untrusted Worker PR head repository", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ head_repo: "attacker/fork" })] })).code).toBe("untrusted_worker_pr");
  });

  it("filters foreign Worker-prefix PRs before writable-slot accounting", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const filters = [...workflow.matchAll(/pulls_json=.*jq -s --arg repository "\$REPOSITORY" '([^']+)'/g)]
      .map((match) => match[1]);
    expect(filters).toHaveLength(3);
    const openPulls = [
      {
        number: 900,
        base: { ref: "main" },
        head: { ref: "work/proffera-trusted", repo: { full_name: "ibboabdoli-ai/Proffera" } },
        user: { login: "ibboabdoli-ai" },
      },
      {
        number: 901,
        base: { ref: "main" },
        head: { ref: "work/proffera-prefix-impostor", repo: { full_name: "attacker/fork" } },
        user: { login: "attacker" },
      },
    ];
    for (const filter of filters) {
      const result = spawnSync("jq", ["--arg", "repository", "ibboabdoli-ai/Proffera", filter], {
        input: JSON.stringify(openPulls),
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout).map((pr: { number: number }) => pr.number)).toEqual([900]);
    }
  });

  it("fails closed when an open Dependabot PR overlaps the declared scope", () => {
    const bot = workerPr({
      number: 940,
      head_ref: "dependabot/npm_and_yarn/example",
      author: "dependabot[bot]",
      body: "",
      files: ["src/features/test/a.ts"],
    });
    expect(evaluate(baseContext({ open_prs: [bot] })).code).toBe("dependabot_overlap");
  });

  it("rejects a stale base SHA", () => {
    expect(evaluate(baseContext({ live_main_sha: otherSha })).code).toBe("stale_base");
  });

  it("rejects the wrong Supervisor issue", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).issue_number = 549;
    expect(evaluate(context).code).toBe("wrong_supervisor_issue");
  });

  it("rejects an invalid branch", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).comment_body = packetComment(packet({ branch: "feature/not-worker" }));
    expect(evaluate(context).code).toBe("malformed_packet");
  });

  it("rejects active graph-path ownership collisions", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ body: 'Task ID: OTHER-1\nGraph path: feature/test\nAllowed paths: ["src/features/other/"]' })] })).code).toBe("graph_collision");
  });

  it("rejects detected changed-file overlap", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ files: ["src/features/test/live.ts"] })] })).code).toBe("file_overlap");
  });

  it("allows a disjoint second writable Worker", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr()] })).status).toBe("TASK_CREATED");
  });

  it("does not let bare interrupted TASK_CREATED records consume writable capacity", () => {
    const orphan = (taskId: string, id: number) => ({
      id,
      created_at: "2026-09-20T18:00:00Z",
      user: { login: "github-actions[bot]" },
      body: [
        `<!-- proffera-worker-task-state:${taskId} -->`,
        `### Supervisor task: ${taskId}`,
        "- State: `TASK_CREATED`",
        "- Run ID: `7001`",
      ].join("\n"),
    });
    expect(evaluate(baseContext({ comments: [orphan("OTHER-1", 7001), orphan("OTHER-2", 7002)] })).status).toBe("TASK_CREATED");
  });

  it("leaves durable reservation accounting to the atomic reservation gate", () => {
    const orphanTask = {
      id: 7001,
      created_at: "2026-09-20T18:00:00Z",
      user: { login: "github-actions[bot]" },
      body: "<!-- proffera-worker-task-state:OTHER-2 -->\n### Supervisor task: OTHER-2\n- State: `TASK_CREATED`\n- Run ID: `7001`",
    };
    const durableReservation = {
      id: 7002,
      user: { login: "github-actions[bot]" },
      body: "<!-- proffera-worker-slot-reservation:OTHER-2 -->\n### Worker slot reservation: OTHER-2\n- State: `RESERVED`",
    };
    expect(evaluate(baseContext({ comments: [orphanTask, durableReservation], open_prs: [workerPr()] })).status).toBe("TASK_CREATED");
    expect(source("scripts/supervisor-worker-handoff.mjs")).toContain("planWorkerReservation");
  });

  it("rejects hierarchical graph overlap for a second writable Worker", () => {
    const existing = workerPr({
      body: 'Task ID: OTHER-1\nGraph path: feature/test/subpath\nAllowed paths: ["src/features/other/"]',
    });
    expect(evaluate(baseContext({ open_prs: [existing] })).code).toBe("graph_collision");
  });

  it("fails closed when dispatch would create a third writable Worker", () => {
    const second = workerPr({
      number: 901,
      head_ref: "work/proffera-second",
      body: 'Task ID: OTHER-2\nGraph path: feature/second\nAllowed paths: ["src/features/second/"]',
      files: ["src/features/second/a.ts"],
    });
    expect(evaluate(baseContext({ open_prs: [workerPr(), second] })).code).toBe("writable_worker_limit");
  });

  it("fails closed when a legacy Worker has ambiguous graph ownership", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ body: "Task/issue: legacy" })] })).code).toBe("ambiguous_graph_owner");
  });

  it("rejects unauthorized/spoofed actors", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).actor = "attacker";
    expect(evaluate(context).code).toBe("unauthorized_actor");
  });

  it("rejects fork or cross-repository sources", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).is_fork = true;
    expect(evaluate(context).code).toBe("fork_source");
  });

  it("kill switch prevents dispatch", () => {
    expect(evaluate(baseContext({ supervisor_labels: [] })).code).toBe("kill_switch_off");
  });

  it("kill switch is isolated from normal CI lifecycle", () => {
    const ci = source(".github/workflows/ci.yml");
    expect(ci).toContain("pull_request:");
    expect(ci).not.toContain("worker-dispatch-enabled");
    expect(ci).not.toContain("Supervisor Worker handoff");
  });

  it("duplicate events update one stable #548 task state instead of appending copies", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(workflow).toContain("proffera-worker-task-state:${task_id}");
    expect(workflow).toContain("--method PATCH");
    expect(sync).toContain("proffera-worker-task-state:${task_id}");
    expect(sync).toContain("--method PATCH");
  });

  it("Worker PR lifecycle still reconciles through exact-head checks", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain("WORKER_PR_OPENED");
    expect(sync).toContain("CHECKS_PENDING");
    expect(sync).toContain("READY_FOR_SUPERVISOR");
    expect(sync).toContain("CLOSED_UNMERGED");
    expect(sync).toContain("MERGED");
    expect(sync).toContain('required=("CI" "CodeQL" "Targeted CI shadow" "Production base health")');
    expect(sync).toContain("EVENT_HEAD_SHA");
    expect(sync).toContain('node "$helper" transition');
  });

  it("sensitive or Production permission cannot be granted by a Task Packet", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).comment_body = packetComment(packet({ production_mutation_allowed: true }));
    expect(evaluate(context).code).toBe("malformed_packet");

    const hardBlocked = baseContext();
    (hardBlocked.event as Record<string, unknown>).comment_body = packetComment(packet({ allowed_paths: [".github/workflows/ci.yml"] }));
    expect(evaluate(hardBlocked).code).toBe("malformed_packet");

    const helperBlocked = baseContext();
    (helperBlocked.event as Record<string, unknown>).comment_body = packetComment(packet({ allowed_paths: ["scripts/supervisor-worker-handoff.mjs"] }));
    expect(evaluate(helperBlocked).code).toBe("malformed_packet");
  });

  it("blocks the entire .github control-plane scope", () => {
    for (const path of [".github/dependabot.yml", ".github/copilot-instructions.md", ".github/CODEOWNERS"]) {
      const context = baseContext();
      (context.event as Record<string, unknown>).comment_body = packetComment(packet({ allowed_paths: [path] }));
      expect(evaluate(context).code).toBe("malformed_packet");
    }
  });

  it("merge and self-approval remain impossible through Task Packet flags and executable workflow paths", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).comment_body = packetComment(packet({ merge_allowed: true, auto_merge_allowed: true }));
    expect(evaluate(context).code).toBe("malformed_packet");

    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const executable = executableRunText(workflow);
    expect(executable).not.toMatch(/\bgh\s+pr\s+merge\b/i);
    expect(executable).not.toMatch(/enable[-_ ]?auto[-_ ]?merge|enablePullRequestAutoMerge/i);
    expect(executable).not.toMatch(/ibbo-approved/i);
    expect(executable).not.toMatch(/\bgh\s+pr\s+review\b[^\n]*--approve\b/i);
    expect(executable).not.toMatch(/\breviews?\b[^\n]*(?:APPROVE|APPROVED)/i);
  });

  it("preflight exposes secret availability booleans instead of secret values", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const preflight = workflow.slice(0, workflow.indexOf("  dispatch:"));
    expect(preflight).toContain("OPENAI_AVAILABLE: ${{ secrets.OPENAI_API_KEY != '' }}");
    expect(preflight).toContain("PUSH_AVAILABLE: ${{ secrets.PROFFERA_AUTOFIX_PUSH_TOKEN != '' }}");
    expect(preflight).not.toContain("OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}");
    expect(preflight).not.toContain("DISPATCH_PUSH_TOKEN: ${{ secrets.PROFFERA_AUTOFIX_PUSH_TOKEN }}");
  });

  it("uses one complete HEAD-relative Worker snapshot for scope, whitespace, and publication eligibility", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const verify = workflowRunStep(workflow, "Verify Worker diff is nonempty and packet-bounded with immutable helper");
    const commit = workflowRunStep(workflow, "Commit bounded Worker result locally");
    expect(verify).toContain("git add --all --intent-to-add");
    expect(verify).toContain('changed_files="$(git diff --name-only --no-renames HEAD)"');
    expect(verify).toContain('snapshot_file="$RUNNER_TEMP/proffera-worker-changed-files.txt"');
    expect(verify).toContain("git diff --check HEAD");
    expect(commit).toContain('snapshot_file="$RUNNER_TEMP/proffera-worker-changed-files.txt"');
    expect(commit).toContain("diff -u");
    expect(commit).toContain("git diff --check HEAD");
  });

  it("serializes durable lifecycle writes and cancels only superseded check reconciliation", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain("proffera-worker-lifecycle-${{ needs.resolve_worker_mutation_lane.outputs.branch }}");
    expect(sync).toContain("proffera-worker-checks-${{ needs.resolve_worker_mutation_lane.outputs.branch }}");
    expect(sync).toContain("cancel-in-progress: false");
    expect(sync).toContain("cancel-in-progress: true");
  });

  it("fails closed on an invalid trusted Phase-1 lifecycle packet", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    const lifecycleScript = workflowRunStep(sync, "Record or update Worker lifecycle state in Supervisor issue");
    const root = mkdtempSync(join(tmpdir(), "proffera-lifecycle-fail-closed-"));
    const repo = join(root, "repo");
    const bin = join(root, "bin");
    const ghLog = join(root, "gh.log");
    const prJsonFile = join(root, "pr.json");

    mkdirSync(join(repo, "scripts"), { recursive: true });
    mkdirSync(bin, { recursive: true });
    copyFileSync(helper, join(repo, "scripts", "supervisor-worker-handoff.mjs"));
    writeFileSync(ghLog, "", "utf8");
    writeFileSync(
      prJsonFile,
      JSON.stringify({
        state: "open",
        merged: false,
        user: { login: "ibboabdoli-ai" },
        head: {
          repo: { full_name: "ibboabdoli-ai/Proffera" },
          ref: "work/proffera-test-task",
          sha,
        },
        base: { sha: otherSha },
        body: `${taskMarker}\n\`\`\`json\n{broken}\n\`\`\``,
        html_url: "https://example.invalid/pr/900",
      }),
      "utf8",
    );
    writeFileSync(
      join(bin, "gh"),
      `#!/bin/sh
if [ "$1" = "api" ] && [ "$2" = "repos/ibboabdoli-ai/Proffera/pulls/900" ]; then
  cat "$PR_JSON_FILE"
  exit 0
fi
printf '%s\n' "$*" >> "$GH_LOG"
exit 0
`,
      { encoding: "utf8", mode: 0o755 },
    );
    writeFileSync(
      join(bin, "node"),
      `#!/bin/sh
case "$2" in
  reservation-mutex-acquire)
    echo 'run=1001;expires=9999999999;token=00000000-0000-4000-8000-000000000000'
    exit 0
    ;;
  reservation-mutex-release) exit 0 ;;
  parse) exit 42 ;;
  *) exit 42 ;;
esac
`,
      { encoding: "utf8", mode: 0o755 },
    );

    const result = spawnSync("bash", ["-c", lifecycleScript], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        GH_LOG: ghLog,
        PR_JSON_FILE: prJsonFile,
        GH_TOKEN: "test-token",
        REPOSITORY: "ibboabdoli-ai/Proffera",
        ACTION: "opened",
        PR_NUMBER: "900",
        EVENT_HEAD_SHA: sha,
        ACTOR: "ibboabdoli-ai",
        RUN_ID: "1001",
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Trusted Phase-1 marker carries an invalid Task Packet; refusing legacy fallback.");
    expect(readFileSync(ghLog, "utf8")).toBe("");
    expect(readFileSync(ghLog, "utf8")).not.toContain("proffera-worker-supervisor-event");
  });

  it("isolates Worker authorization and publication from the untrusted Builder job", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const dispatchStart = workflow.indexOf("  dispatch:");
    const publishStart = workflow.indexOf("  publish:");
    expect(dispatchStart).toBeGreaterThan(0);
    expect(publishStart).toBeGreaterThan(dispatchStart);
    const builder = workflow.slice(dispatchStart, publishStart);
    const publish = workflow.slice(publishStart);
    expect(builder).toContain("Run one bounded implementation Worker");
    expect(builder).toContain("Capture untrusted Worker candidate patch");
    expect(builder).toContain("Upload exact Worker candidate patch");
    expect(builder).toContain("Run full pre-publish validation for sensitive dispatch path");
    expect(builder).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(builder).toContain("issues: read");
    expect(builder).not.toContain("issues: write");
    expect(builder).not.toContain("reservation-mutex-acquire");
    expect(builder).not.toContain("gh api --method PATCH");
    expect(builder).not.toContain("gh api --method POST");
    expect(builder).not.toContain("Verify Worker diff is nonempty and packet-bounded with immutable helper");
    expect(publish).toContain("Materialize trusted publication helper in isolated job");
    expect(publish).toContain("actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0");
    expect(publish).toContain("Verify Worker diff is nonempty and packet-bounded with immutable helper");
    expect(publish).toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(publish).not.toContain("npm test");
    expect(publish).not.toContain("npm run build");
    expect(publish.indexOf("validate-changes")).toBeLessThan(publish.indexOf("PROFFERA_AUTOFIX_PUSH_TOKEN"));
  });
  it("Worker tampering with the repository helper cannot change trusted post-Worker validation", () => {
    const dir = mkdtempSync(join(tmpdir(), "proffera-handoff-trust-"));
    const trusted = join(dir, "trusted-helper.mjs");
    const workerCopy = join(dir, "worker-helper.mjs");
    copyFileSync(helper, trusted);
    writeFileSync(workerCopy, 'process.stdout.write(JSON.stringify({ok:true,status:"VALID",code:"bypassed"}));\n', "utf8");

    const input = { packet: packet(), changed_files: ["src/unrelated.ts"] };
    const trustedResult = spawnSync(process.execPath, [trusted, "validate-changes"], {
      input: JSON.stringify(input),
      encoding: "utf8",
    });
    const tamperedResult = spawnSync(process.execPath, [workerCopy, "validate-changes"], {
      input: JSON.stringify(input),
      encoding: "utf8",
    });
    expect(trustedResult.status, trustedResult.stderr).toBe(0);
    expect(JSON.parse(trustedResult.stdout).code).toBe("out_of_scope_change");
    expect(JSON.parse(tamperedResult.stdout).code).toBe("bypassed");
  });

  it("executes the actual Verify Worker diff step with the immutable RUNNER_TEMP helper", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const verifyScript = workflowRunStep(workflow, "Verify Worker diff is nonempty and packet-bounded with immutable helper");
    const root = mkdtempSync(join(tmpdir(), "proffera-handoff-step-"));
    const repo = join(root, "repo");
    const runnerTemp = join(root, "runner");
    const trustedDir = join(runnerTemp, "proffera-trusted-publish");
    const repoHelper = join(repo, "scripts", "supervisor-worker-handoff.mjs");
    const trustedHelper = join(trustedDir, "supervisor-worker-handoff.mjs");
    const manifest = join(trustedDir, "supervisor-worker-handoff.sha256");

    mkdirSync(join(repo, "scripts"), { recursive: true });
    mkdirSync(join(repo, "src"), { recursive: true });
    mkdirSync(trustedDir, { recursive: true });
    copyFileSync(helper, repoHelper);
    copyFileSync(helper, trustedHelper);

    const checksum = spawnSync("sha256sum", [trustedHelper], { encoding: "utf8" });
    expect(checksum.status, checksum.stderr).toBe(0);
    writeFileSync(manifest, checksum.stdout, "utf8");

    for (const args of [
      ["init"],
      ["config", "user.name", "test"],
      ["config", "user.email", "test@example.invalid"],
      ["add", "--all"],
      ["commit", "-m", "baseline"],
    ]) {
      const git = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(git.status, git.stderr).toBe(0);
    }

    writeFileSync(repoHelper, 'process.stdout.write(JSON.stringify({ok:true,status:"VALID",code:"bypassed"}));\n', "utf8");
    writeFileSync(join(repo, "src", "unrelated.ts"), "export const outsideScope = true;\n", "utf8");

    const result = spawnSync("bash", ["-lc", verifyScript], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        RUNNER_TEMP: runnerTemp,
        PACKET_B64: Buffer.from(JSON.stringify(packet())).toString("base64"),
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("hard-blocked path 'scripts/supervisor-worker-handoff.mjs'");
    expect(verifyScript).toContain('helper="$RUNNER_TEMP/proffera-trusted-publish/supervisor-worker-handoff.mjs"');
    expect(verifyScript).toContain("sha256sum --check --status");
  });

  it("does not expose OpenAI or push credentials to post-Worker reconciliation helper execution", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const reconcileScript = workflowRunStep(workflow, "Reconcile live state again immediately before publication");
    const publishScript = workflowRunStep(workflow, "Publish branch normally or persist validated recovery artifact");
    expectShellAndJqSyntax(reconcileScript);
    expectShellAndJqSyntax(publishScript);
    const reconcileStart = workflow.indexOf("Reconcile live state again immediately before publication");
    const reconcileEnd = workflow.indexOf("Commit bounded Worker result locally", reconcileStart);
    const reconcile = workflow.slice(reconcileStart, reconcileEnd);
    expect(reconcile).not.toContain("OPENAI_API_KEY");
    expect(reconcile).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");

    const publishStart = workflow.indexOf("Publish branch normally or persist validated recovery artifact");
    const publishEnd = workflow.indexOf("Record dispatched Worker PR", publishStart);
    const publish = workflow.slice(publishStart, publishEnd);
    expect(publish).toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(publish).toContain('node "$helper" validate-publication');
    expect(publish).toContain("proffera-publication-recovery-complete");
    expect(publish).toContain('git push --force-with-lease="refs/heads/${BRANCH}:"');
    expect(publish).not.toContain("--force ");
    expect(publish).toContain('echo "recovery_digest=$digest"');
    expect(publish).toContain('echo "recovery_chunks=$total"');

    const recoveryState = workflowRunStep(workflow, "Record persisted recovery artifact in stable Supervisor task state");
    expect(recoveryState).toContain('--arg state "WORKER_BLOCKED"');
    expect(recoveryState).toContain("sha256=${RECOVERY_DIGEST}");
    expect(recoveryState).toContain("chunks=${RECOVERY_CHUNKS:-0}");
    expect(recoveryState).toContain("target_head=${HEAD_SHA}");
  });

  it("wires bounded idempotent recovery and an actionable readiness diagnostic", () => {
    const handoff = source(".github/workflows/supervisor-worker-handoff.yml");
    expect(handoff).toContain("Build and validate deterministic publication artifact");
    expect(handoff).toContain("BASE64_GZIP_JSON");
    expect(handoff).toContain("current_source_head:$current_source_head");
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain('node "$helper" worker-pr-admit');
    expect(source("scripts/supervisor-worker-handoff.mjs")).toContain("READY_FOR_SUPERVISOR requires an exact head_sha and pr_number");
    expect(sync).toContain("exit 1");
  });

  it("shares authenticated reclamation between preflight and global reservation accounting", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const closeStep = workflowRunStep(workflow, "Require exact durable reservation before accepting Worker PR");
    const preflightStep = workflowRunStep(workflow, "Validate trust, freshness, idempotency, graph ownership, and scope");
    expectShellAndJqSyntax(closeStep);
    expectShellAndJqSyntax(preflightStep);
    expectShellAndJqSyntax(workflowRunStep(workflow, "Atomically reserve writable Worker slot"));
    expectShellAndJqSyntax(workflowRunStep(workflow, "Finalize reserved Worker snapshot before publication"));
    const recoverySyntax = spawnSync("bash", ["-n"], {
      input: workflowRunStep(workflow, "Release or recover reservation on dispatch failure"),
      encoding: "utf8",
    });
    expect(recoverySyntax.status, recoverySyntax.stderr).toBe(0);
    expect(closeStep).toContain("has_trusted_dispatch_provenance");
    expect(closeStep.indexOf("if ! has_trusted_dispatch_provenance")).toBeLessThan(
      closeStep.indexOf('close_unreserved "missing bounded Task Packet"'),
    );
    expect(closeStep).toContain('reserved_digest" != "$packet_digest');
    expect(closeStep).toContain('reserved_head" != "$live_head');
    expect(closeStep).toContain('terminal_state="MERGED"');
    expect(closeStep).toContain('terminal_state="CLOSED_UNMERGED"');
    expect(closeStep).toContain("in the same close writer");
    expect(source("scripts/supervisor-worker-handoff.mjs")).toContain("lease_expires_at");
    const reserveStep = workflowRunStep(workflow, "Atomically reserve writable Worker slot");
    for (const step of [preflightStep, reserveStep]) {
      expect(step).toContain('node "$helper" reservation-mutex-acquire');
      expect(step).toContain('node "$helper" reconcile-unbound-tasks');
      expect(step.indexOf('node "$helper" reconcile-unbound-tasks')).toBeLessThan(step.indexOf('node "$helper" evaluate'));
    }
    expect(reserveStep).toContain('. + {all:true}');
    expect(preflightStep).toContain('node "$helper" task-comments');
  });

  it("re-evaluates Worker reservation enforcement after head and body updates", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    expect(workflow).toContain("types: [opened, reopened, synchronize, edited, closed]");
  });

  it("leaves a PR unchanged when trusted dispatch provenance is missing", () => {
    const result = runReservationEnforcement();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("has no exact trusted Supervisor dispatch provenance; leaving it unchanged");
    expect(prPatchCalls(result.calls)).toHaveLength(0);
  });

  it("accepts one exact reservation and matching bot-authored dispatch record", () => {
    const evidence = exactReservationEvidence();
    const result = runReservationEnforcement({ ...evidence, comments: [
      ...evidence.comments,
      { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("TASK_CREATED") },
    ] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("is bound to durable reservation SUP-TEST-1@");
    expect(result.stdout).not.toContain("leaving it unchanged");
    expect(prPatchCalls(result.calls)).toHaveLength(0);
  });

  it("closes a malformed trusted Worker PR and releases its exact published reservation on the closed event", () => {
    const evidence = exactReservationEvidence(sha, {
      state: "PUBLISHED",
      pr_number: 849,
      recovery: null,
    });
    const malformedBody = "Worker result with its bounded Task Packet removed";
    const taskState = {
      id: 103,
      user: { login: "github-actions[bot]" },
      body: durableStateBody("CHECKS_PENDING"),
    };
    const result = runReservationEnforcement({
      body: malformedBody,
      comments: [...evidence.comments, taskState],
      eventAction: "edited",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing bounded Task Packet");
    expect(prPatchCalls(result.calls)).toHaveLength(1);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(0);
    expect(result.pr).toMatchObject({ state: "closed" });
    const closed = runReservationEnforcement({
      body: malformedBody,
      comments: result.comments,
      eventAction: "closed",
      liveState: "closed",
    });
    expect(closed.status, closed.stderr).toBe(0);
    expect(closed.stdout).toContain("Released trusted Worker slot reservation SUP-TEST-1");
    expect(prPatchCalls(closed.calls)).toHaveLength(0);
    expect(commentPatchCalls(closed.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(closed.calls, 103)).toHaveLength(1);
    const reservation = closed.comments.find((comment) => comment.id === 101);
    const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
      state: "RELEASED",
      pr_number: 849,
      head_sha: sha,
      recovery: { kind: "closed_pr_invalid_packet", merged: false },
    });
    expect(String(closed.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `CLOSED_UNMERGED`");

    const existing = {
      version: 1,
      state: "RESERVED",
      task_id: "SUP-OTHER-SLOT-1",
      run_id: "7001",
      branch: "work/proffera-other-slot",
      head_sha: otherSha,
      graph_path: "feature/other-slot",
      packet_digest: "c".repeat(64),
      lease_expires_at: "2099-01-01T00:00:00Z",
      allowed_paths: ["src/features/other-slot/"],
      changed_files: [],
      snapshot_finalized: false,
      pr_number: null,
      recovery: null,
    };
    const freedCapacity = runSlotReservation({ reservation: existing, extraComments: closed.comments });
    expect(freedCapacity.status, freedCapacity.stderr).toBe(0);
    expect(freedCapacity.comments.some((comment) => comment.id === 999)).toBe(true);

    const replay = runReservationEnforcement({
      body: malformedBody,
      comments: closed.comments,
      eventAction: "closed",
      liveState: "closed",
    });
    expect(replay.status, replay.stderr).toBe(0);
    expect(replay.stdout).toContain("already released idempotently");
    expect(prPatchCalls(replay.calls)).toHaveLength(0);
    expect(commentPatchCalls(replay.calls, 101)).toHaveLength(0);
  });

  it("retries transient malformed-close evidence reads before releasing the exact reservation", () => {
    const evidence = exactReservationEvidence(sha, {
      state: "PUBLISHED",
      pr_number: 849,
      recovery: null,
    });
    const result = runReservationEnforcement({
      body: "Worker result with its bounded Task Packet removed",
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
      ],
      eventAction: "closed",
      failPagedCommentReads: 3,
      liveState: "closed",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("Transient malformed-close reconciliation failure; retrying (1/5).");
    expect(result.calls.filter((args) => args.some((arg) => arg.includes("comments?per_page=100&page=1"))).length).toBeGreaterThanOrEqual(6);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
  }, 20_000);

  it("does not close or release a malformed prefixed PR without exact trusted provenance", () => {
    const result = runReservationEnforcement({
      body: "Worker result with no Task Packet",
      comments: [],
      eventAction: "edited",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("has no exact trusted Supervisor dispatch provenance; leaving it unchanged");
    expect(prPatchCalls(result.calls)).toHaveLength(0);
    expect(result.calls.filter((args) => args.includes("repos/ibboabdoli-ai/Proffera/issues/comments/101"))).toHaveLength(0);
  });

  it("routes closed pull_request_target events through lifecycle reconciliation", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const result = runLifecycleReconciliation({
      action: "closed",
      body: "Worker result with no Task Packet",
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
      ],
      liveState: "closed",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
  });

  it("makes every same-lane replacement writer converge a malformed trusted close", () => {
    const malformedBodies = [
      "Worker result with its bounded Task Packet removed",
      `${taskMarker}\n\`\`\`json\n{broken}\n\`\`\``,
      packetComment(packet({ branch: "work/proffera-other-task" })),
    ];
    const replacementWriters = [
      (options: SyncCheckOptions) => runLifecycleReconciliation({ ...options, action: "synchronize" }),
      (options: SyncCheckOptions) => runLifecycleReconciliation({ ...options, action: "ready_for_review" }),
      runSyncCheckReconciliation,
    ];
    for (const reconcile of replacementWriters) {
      for (const body of malformedBodies) {
        const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
        const result = reconcile({
          body,
          comments: [
            ...evidence.comments,
            { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING", otherSha) },
          ],
          eventHead: sha,
          liveHead: otherSha,
          liveState: "closed",
        });
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain("Converged malformed closed Worker PR #849");
        expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
        expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
        const reservation = result.comments.find((comment) => comment.id === 101);
        const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
        expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
          state: "RELEASED",
          pr_number: 849,
          head_sha: otherSha,
          recovery: { kind: "closed_pr_invalid_packet", merged: false },
        });
        expect(String(result.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `CLOSED_UNMERGED`");
      }
    }
  }, 20_000);

  it("binds a syntactically valid edited packet to the original reservation in every replacement writer", () => {
    const editedBodies = [
      packetComment(packet({ task_id: "SUP-TAMPERED-1" })),
      packetComment(packet({ task_title: "Syntactically valid digest-only edit" })),
      packetComment(packet({ graph_path: "feature/edited-graph" })),
      packetComment(packet({ allowed_paths: ["tests/edited-worker/"] })),
      packetComment(packet({ base_sha: otherSha })),
    ];
    const replacementWriters = [
      (options: SyncCheckOptions) => runReservationEnforcement({ ...options, eventAction: "closed" }),
      (options: SyncCheckOptions) => runLifecycleReconciliation({ ...options, action: "synchronize" }),
      runSyncCheckReconciliation,
    ];
    for (const reconcile of replacementWriters) {
      for (const editedBody of editedBodies) {
        const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
        const result = reconcile({
          body: editedBody,
          comments: [
            ...evidence.comments,
            { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
          ],
          liveState: "closed",
        });
        expect(result.status, result.stderr).toBe(0);
        expect(prPatchCalls(result.calls)).toHaveLength(0);
        expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
        expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
        const reservation = result.comments.find((comment) => comment.id === 101);
        const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
        expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
          state: "RELEASED",
          task_id: "SUP-TEST-1",
          recovery: { kind: "closed_pr_invalid_packet", merged: false, reservation_head_sha: sha },
        });
        expect(String(result.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `CLOSED_UNMERGED`");
      }
    }

    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    for (const comments of [
      [...evidence.comments, { ...evidence.comments[0], id: 104 }],
      [...evidence.comments, { ...evidence.comments[1], id: 105 }],
    ]) {
      const ambiguous = runSyncCheckReconciliation({ body: editedBodies[0], comments });
      expect(ambiguous.status, ambiguous.stderr).toBe(0);
      expect(durableMutationCalls(ambiguous.calls)).toHaveLength(0);
    }
  }, 40_000);

  it("advances an exact prior-reservation task head during malformed-close convergence", () => {
    const replacementWriters = [
      (options: SyncCheckOptions) => runReservationEnforcement({ ...options, eventAction: "closed" }),
      (options: SyncCheckOptions) => runLifecycleReconciliation({ ...options, action: "synchronize" }),
      runSyncCheckReconciliation,
    ];
    for (const reconcile of replacementWriters) {
      for (const liveMerged of [false, true]) {
        const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
        const result = reconcile({
          body: "bounded Task Packet removed after a repair push",
          comments: [
            ...evidence.comments,
            { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING", sha) },
          ],
          eventHead: sha,
          liveHead: otherSha,
          liveMerged,
          liveState: "closed",
        });
        expect(result.status, result.stderr).toBe(0);
        expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
        expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
        const terminalBody = String(result.comments.find((comment) => comment.id === 103)?.body);
        expect(terminalBody).toContain(liveMerged ? "- State: `MERGED`" : "- State: `CLOSED_UNMERGED`");
        expect(terminalBody).toContain(`- Head: \`${otherSha}\``);
      }
    }

    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const unrelatedTaskHead = runSyncCheckReconciliation({
      body: "bounded Task Packet removed after a repair push",
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING", "c".repeat(40)) },
      ],
      liveHead: otherSha,
      liveState: "closed",
    });
    expect(unrelatedTaskHead.status, unrelatedTaskHead.stderr).toBe(0);
    expect(durableMutationCalls(unrelatedTaskHead.calls)).toHaveLength(0);
  }, 30_000);

  it("converges both partial malformed-close outcomes across an unrecorded repair head", () => {
    const released = exactReservationEvidence(otherSha, {
      state: "RELEASED",
      pr_number: 849,
      recovery: { kind: "closed_pr_invalid_packet", merged: false, reservation_head_sha: sha },
    });
    const reservationAlreadyReleased = runSyncCheckReconciliation({
      body: "missing packet",
      comments: [
        ...released.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING", sha) },
      ],
      liveHead: otherSha,
    });
    expect(reservationAlreadyReleased.status, reservationAlreadyReleased.stderr).toBe(0);
    expect(commentPatchCalls(reservationAlreadyReleased.calls, 101)).toHaveLength(0);
    expect(commentPatchCalls(reservationAlreadyReleased.calls, 103)).toHaveLength(1);

    const published = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const taskAlreadyTerminal = runSyncCheckReconciliation({
      body: "missing packet",
      comments: [
        ...published.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CLOSED_UNMERGED", otherSha) },
      ],
      liveHead: otherSha,
    });
    expect(taskAlreadyTerminal.status, taskAlreadyTerminal.stderr).toBe(0);
    expect(commentPatchCalls(taskAlreadyTerminal.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(taskAlreadyTerminal.calls, 103)).toHaveLength(0);
  });

  it("keeps malformed-close convergence idempotent in every replacement writer", () => {
    for (const reconcile of [runLifecycleReconciliation, runSyncCheckReconciliation]) {
      const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
      const first = reconcile({
        body: "missing packet",
        comments: [
          ...evidence.comments,
          { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
        ],
      });
      expect(first.status, first.stderr).toBe(0);
      const replay = reconcile({ body: "missing packet", comments: first.comments });
      expect(replay.status, replay.stderr).toBe(0);
      expect(commentPatchCalls(replay.calls, 101)).toHaveLength(0);
      expect(commentPatchCalls(replay.calls, 103)).toHaveLength(0);
    }
  });

  it("does not let malformed-close replacement writers accept ambiguous provenance", () => {
    for (const reconcile of [runLifecycleReconciliation, runSyncCheckReconciliation]) {
      const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
      const duplicateReservation = { ...evidence.comments[0], id: 104 };
      const duplicateDispatch = { ...evidence.comments[1], id: 105 };
      for (const comments of [
        [evidence.comments[0]],
        [...evidence.comments, duplicateReservation],
        [...evidence.comments, duplicateDispatch],
      ]) {
        const result = reconcile({ body: "missing packet", comments });
        expect(result.status, result.stderr).toBe(0);
        expect(durableMutationCalls(result.calls)).toHaveLength(0);
      }
    }
  });

  it("reconciles exact unbound RESERVED and RECOVERABLE closes without fabricating prior PR/head evidence", () => {
    const taskStateWithoutPrOrHead = runText("state-body", {
      packet: packet(),
      state: "WORKER_BLOCKED",
      reason: "Publication did not complete before the trusted Worker PR closed.",
      run_id: "9001",
    });
    for (const reservationState of ["RESERVED", "RECOVERABLE"]) {
      const evidence = exactReservationEvidence(sha, {
        state: reservationState,
        pr_number: null,
        recovery: reservationState === "RECOVERABLE" ? { kind: "branch", expires_at: "2099-01-01T00:00:00Z" } : null,
      });
      const result = runSyncCheckReconciliation({
        body: "missing packet",
        comments: [
          ...evidence.comments,
          { id: 103, user: { login: "github-actions[bot]" }, body: taskStateWithoutPrOrHead },
        ],
      });
      expect(result.status, result.stderr).toBe(0);
      expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
      expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
      const terminalBody = String(result.comments.find((comment) => comment.id === 103)?.body);
      expect(terminalBody).toContain("- State: `CLOSED_UNMERGED`");
      expect(terminalBody).toContain("- PR: #849");
      expect(terminalBody).toContain(`- Head: \`${sha}\``);
    }
  });

  it("preserves exact dispatch run provenance during malformed-close reconciliation", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const currentBody = durableStateBody("CHECKS_PENDING");
    const reconciled = runSyncCheckReconciliation({
      body: "missing packet",
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: currentBody },
      ],
    });
    expect(reconciled.status, reconciled.stderr).toBe(0);
    expect(commentPatchCalls(reconciled.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(reconciled.calls, 103)).toHaveLength(1);
    const terminalBody = String(reconciled.comments.find((comment) => comment.id === 103)?.body);
    expect(terminalBody).toContain("- Run ID: `9001`");
    expect(terminalBody).not.toContain("- Run ID: `9003`");

    const invalidRunBodies = [
      currentBody.replace(/^- Run ID: `9001`\n/mu, ""),
      `${currentBody}- Run ID: \`9001\`\n`,
      currentBody.replace("- Run ID: `9001`", "- Run ID: `8001`"),
      currentBody.replace("- Graph path: `feature/test`", "- Graph path: `feature/other`"),
      currentBody.replace("- Branch: `work/proffera-test-task`", "- Branch: `work/proffera-other-task`"),
      currentBody.replace(/^- Packet SHA-256: `[0-9a-f]{64}`$/mu, `- Packet SHA-256: \`${"c".repeat(64)}\``),
      currentBody.replace("- PR: #849", "- PR: #850"),
      currentBody.replace(`- Head: \`${sha}\``, `- Head: \`${"c".repeat(40)}\``),
      currentBody.replace("- Production mutation: `false`\n", ""),
      `${currentBody}- Production mutation: \`false\`\n`,
    ];
    for (const body of invalidRunBodies) {
      const rejected = runSyncCheckReconciliation({
        body: "missing packet",
        comments: [
          ...evidence.comments,
          { id: 103, user: { login: "github-actions[bot]" }, body },
        ],
      });
      expect(rejected.status, rejected.stderr).toBe(0);
      expect(durableMutationCalls(rejected.calls)).toHaveLength(0);
    }

    const duplicateTaskState = runSyncCheckReconciliation({
      body: "missing packet",
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: currentBody },
        { id: 104, user: { login: "github-actions[bot]" }, body: currentBody },
      ],
    });
    expect(duplicateTaskState.status, duplicateTaskState.stderr).toBe(0);
    expect(durableMutationCalls(duplicateTaskState.calls)).toHaveLength(0);
  }, 20_000);

  it("rejects every untrusted malformed-close replacement identity or binding without mutation", () => {
    for (const reconcile of [runLifecycleReconciliation, runSyncCheckReconciliation]) {
      const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
      const encoded = String(evidence.comments[0].body).match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
      const payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
      const cases: SyncCheckOptions[] = [
        { body: "missing packet", comments: [reservationComment({ ...payload, state: "RESERVED", pr_number: null, head_sha: otherSha }, 101), evidence.comments[1]] },
        { body: "missing packet", comments: [reservationComment({ ...payload, pr_number: 850 }, 101), evidence.comments[1]] },
        { body: "missing packet", comments: [reservationComment({ ...payload, branch: "work/proffera-other-task" }, 101), evidence.comments[1]] },
        { body: "missing packet", comments: [{ ...evidence.comments[0], body: "malformed reservation" }, evidence.comments[1]] },
        { body: "missing packet", comments: evidence.comments, liveAuthor: "other-owner" },
        { body: "missing packet", comments: evidence.comments, liveHeadRepository: "other-owner/Proffera" },
        { body: "missing packet", comments: evidence.comments, liveRef: "feature/not-a-worker" },
      ];
      for (const current of cases) {
        const result = reconcile(current);
        expect(result.status, result.stderr).toBe(0);
        expect(durableMutationCalls(result.calls)).toHaveLength(0);
      }
    }
  }, 20_000);

  it("does not use terminal malformed-close reconciliation while the live PR is open", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    for (const reconcile of [runLifecycleReconciliation, runSyncCheckReconciliation]) {
      const result = reconcile({ body: "missing packet", comments: evidence.comments, liveState: "open" });
      expect(result.status, result.stderr).toBe(0);
      expect(durableMutationCalls(result.calls)).toHaveLength(0);
    }
  });

  it("converges either partial malformed-close outcome and preserves terminal monotonicity", () => {
    const published = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const taskAlreadyTerminal = runSyncCheckReconciliation({
      body: "missing packet",
      comments: [
        ...published.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CLOSED_UNMERGED") },
      ],
    });
    expect(taskAlreadyTerminal.status, taskAlreadyTerminal.stderr).toBe(0);
    expect(commentPatchCalls(taskAlreadyTerminal.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(taskAlreadyTerminal.calls, 103)).toHaveLength(0);
    expect(String(taskAlreadyTerminal.comments.find((comment) => comment.id === 103)?.body)).toContain("- Run ID: `9001`");

    const released = exactReservationEvidence(sha, {
      state: "RELEASED",
      pr_number: 849,
      recovery: { kind: "closed_pr_invalid_packet", merged: false },
    });
    const reservationAlreadyReleased = runSyncCheckReconciliation({
      body: "missing packet",
      comments: [
        ...released.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
      ],
    });
    expect(reservationAlreadyReleased.status, reservationAlreadyReleased.stderr).toBe(0);
    expect(commentPatchCalls(reservationAlreadyReleased.calls, 101)).toHaveLength(0);
    expect(commentPatchCalls(reservationAlreadyReleased.calls, 103)).toHaveLength(1);
    expect(String(reservationAlreadyReleased.comments.find((comment) => comment.id === 103)?.body)).toContain("- Run ID: `9001`");
    expect(String(reservationAlreadyReleased.comments.find((comment) => comment.id === 103)?.body)).not.toContain("- Run ID: `9003`");

    const conflictingTerminal = runSyncCheckReconciliation({
      body: "missing packet",
      comments: [
        ...published.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("MERGED") },
      ],
    });
    expect(conflictingTerminal.status, conflictingTerminal.stderr).toBe(0);
    expect(durableMutationCalls(conflictingTerminal.calls)).toHaveLength(0);
  });

  it("uses the live merged bit as the only malformed-close terminal selector", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const result = runReservationEnforcement({
      body: "missing packet",
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
      ],
      eventAction: "closed",
      liveState: "closed",
      liveMerged: true,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(String(result.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `MERGED`");
  });

  it("re-fetches live PR and comment evidence before each malformed-close mutation", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const comments = [
      ...evidence.comments,
      { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
    ];
    for (const current of [
      { mutateHeadOnPrFetch: 3 },
      { mutateReservationOnCommentFetch: 2 },
    ]) {
      const result = runSyncCheckReconciliation({ body: "missing packet", comments, ...current });
      expect(result.status, result.stderr).toBe(0);
      expect(durableMutationCalls(result.calls)).toHaveLength(0);
    }

    const changedTask = runSyncCheckReconciliation({
      body: "missing packet",
      comments,
      mutateTaskOnCommentFetch: 3,
    });
    expect(changedTask.status, changedTask.stderr).toBe(0);
    expect(commentPatchCalls(changedTask.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(changedTask.calls, 103)).toHaveLength(0);
  });

  it("retries bounded evidence reads, emits structured failure, and scans comment pages incrementally", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const taskState = { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") };
    const retried = runSyncCheckReconciliation({
      body: "missing packet",
      comments: [...evidence.comments, taskState],
      failPagedCommentReads: 2,
    });
    expect(retried.status, retried.stderr).toBe(0);
    expect(retried.calls.filter((args) => args.some((arg) => arg.includes("comments?per_page=100&page=1"))).length).toBeGreaterThanOrEqual(5);
    expect(commentPatchCalls(retried.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(retried.calls, 103)).toHaveLength(1);

    const unavailable = runSyncCheckReconciliation({
      body: "missing packet",
      comments: [...evidence.comments, taskState],
      failPagedCommentReads: 3,
    });
    expect(unavailable.status, unavailable.stderr).toBe(0);
    expect(unavailable.stdout).toContain("unavailable after bounded retries");
    expect(durableMutationCalls(unavailable.calls)).toHaveLength(0);

    const recoveryNoise = Array.from({ length: 100 }, (_, index) => ({
      id: 1000 + index,
      user: { login: "github-actions[bot]" },
      body: `<!-- proffera-publication-recovery-chunk:${index} -->`,
    }));
    const paged = runSyncCheckReconciliation({
      body: "missing packet",
      comments: [...recoveryNoise, ...evidence.comments, taskState],
    });
    expect(paged.status, paged.stderr).toBe(0);
    expect(paged.calls.some((args) => args.some((arg) => arg.includes("comments?per_page=100&page=2")))).toBe(true);
    expect(commentPatchCalls(paged.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(paged.calls, 103)).toHaveLength(1);
  }, 20_000);

  it("releases exact malformed-close capacity without fabricating a missing task record", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const result = runSyncCheckReconciliation({ body: "missing packet", comments: evidence.comments });
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    expect(result.calls.filter((args) => args.includes("--method") && args.includes("POST") && args.some((arg) => arg.endsWith("/issues/548/comments")))).toHaveLength(0);
  });

  it("refuses malformed closed-PR release for ambiguous or mismatched provenance", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const payloadBase64 = String(evidence.comments[0].body).match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
    const exactDispatch = evidence.comments[1];
    const variants = [
      { comments: [evidence.comments[0]] },
      { comments: [...evidence.comments, { ...exactDispatch, id: 104 }] },
      { comments: [...evidence.comments, { ...evidence.comments[0], id: 104 }] },
      { comments: [reservationComment({ ...payload, pr_number: 850 }, 101), exactDispatch] },
      { comments: [reservationComment({ ...payload, branch: "work/proffera-other" }, 101), exactDispatch] },
      { comments: [reservationComment({ ...payload, state: "RESERVED", pr_number: null, head_sha: otherSha }, 101), exactDispatch] },
      {
        comments: [
          { ...evidence.comments[0], body: "<!-- proffera-worker-slot-reservation:SUP-TEST-1 -->\n- Reservation payload: `not-base64`" },
          exactDispatch,
        ],
      },
      { comments: evidence.comments, liveAuthor: "other-owner" },
      { comments: evidence.comments, liveHeadRepository: "other-owner/Proffera" },
    ];
    for (const variant of variants) {
      const result = runReservationEnforcement({
        body: "Worker result with no Task Packet",
        eventAction: "closed",
        liveState: "closed",
        ...variant,
      });
      expect(prPatchCalls(result.calls)).toHaveLength(0);
      expect(commentPatchCalls(result.calls, 101)).toHaveLength(0);
    }
  });

  it("promotes an exact recoverable reservation when its trusted PR appears", () => {
    const evidence = exactReservationEvidence(sha, {
      state: "RECOVERABLE",
      pr_number: null,
      recovery: { kind: "branch", expires_at: "2099-01-01T00:00:00Z" },
    });
    const result = runReservationEnforcement({ ...evidence, comments: [
      ...evidence.comments,
      { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("WORKER_BLOCKED") },
    ] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("is bound to durable reservation SUP-TEST-1@");
    expect(prPatchCalls(result.calls)).toHaveLength(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    const reservation = result.comments.find((comment) => comment.id === 101);
    const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
      state: "PUBLISHED",
      pr_number: 849,
      recovery: null,
    });
  });

  it("advances a published reservation to the exact trusted same-PR repair head", () => {
    const evidence = exactReservationEvidence(sha, {
      state: "PUBLISHED",
      pr_number: 849,
      recovery: null,
    });
    const result = runReservationEnforcement({
      body: evidence.body,
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
      ],
      eventHead: otherSha,
      liveHead: otherSha,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`is bound to durable reservation SUP-TEST-1@${otherSha}`);
    expect(prPatchCalls(result.calls)).toHaveLength(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(2);
    expect(result.comments.filter((comment) => String(comment.body ?? "").includes("proffera-worker-slot-reservation:SUP-TEST-1"))).toHaveLength(1);
    const reservation = result.comments.find((comment) => comment.id === 101);
    const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
      state: "PUBLISHED",
      pr_number: 849,
      head_sha: otherSha,
      recovery: null,
    });
    expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).not.toHaveProperty("activation_task_sha256");
  });

  it("does not advance a published reservation for an unbound or non-owner repair event", () => {
    for (const overrides of [
      { pr_number: null },
      { pr_number: 850 },
    ]) {
      const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", recovery: null, ...overrides });
      const result = runReservationEnforcement({
        body: evidence.body,
        comments: evidence.comments,
        eventHead: otherSha,
        liveHead: otherSha,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("has no exact trusted Supervisor dispatch provenance; leaving it unchanged");
      expect(commentPatchCalls(result.calls, 101)).toHaveLength(0);
      expect(prPatchCalls(result.calls)).toHaveLength(0);
    }

    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const untrustedActor = runReservationEnforcement({
      body: evidence.body,
      comments: evidence.comments,
      eventActor: "untrusted-collaborator",
      eventHead: otherSha,
      liveHead: otherSha,
    });
    expect(untrustedActor.status, untrustedActor.stderr).toBe(0);
    expect(untrustedActor.stdout).toContain("has no exact trusted Supervisor dispatch provenance; leaving it unchanged");
    expect(commentPatchCalls(untrustedActor.calls, 101)).toHaveLength(0);
    expect(prPatchCalls(untrustedActor.calls)).toHaveLength(0);
  });

  it("rejects duplicate or mismatched reservation and dispatch evidence", () => {
    const evidence = exactReservationEvidence();
    const duplicateReservation = { ...evidence.comments[0], id: 103 };
    const mismatchedDispatch = {
      ...evidence.comments[1],
      body: String(evidence.comments[1].body).replace(":9001 -->", ":different-run -->"),
    };
    for (const comments of [
      [...evidence.comments, duplicateReservation],
      [evidence.comments[0], mismatchedDispatch],
    ]) {
      const result = runReservationEnforcement({ body: evidence.body, comments });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("has no exact trusted Supervisor dispatch provenance; leaving it unchanged");
      expect(result.stdout).not.toContain("is bound to durable reservation");
      expect(prPatchCalls(result.calls)).toHaveLength(0);
    }
  });

  it("does not reuse reservation evidence after the live PR head changes", () => {
    const evidence = exactReservationEvidence();
    const result = runReservationEnforcement({
      body: evidence.body,
      comments: evidence.comments,
      liveHead: otherSha,
      eventHead: sha,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("PR changed before reservation enforcement; newer event will reconcile it.");
    expect(result.stdout).not.toContain("is bound to durable reservation");
    expect(result.calls.filter((args) => args.some((arg) => arg.includes("/issues/548/comments")))).toHaveLength(0);
    expect(prPatchCalls(result.calls)).toHaveLength(0);
  });

  it("releases the reservation and records the terminal task state in one trusted close writer", () => {
    for (const liveMerged of [false, true]) {
      const evidence = exactReservationEvidence();
      const taskState = {
        id: 103,
        user: { login: "github-actions[bot]" },
        body: stateBody("CHECKS_PENDING"),
      };
      const result = runReservationEnforcement({
        body: evidence.body,
        comments: [...evidence.comments, taskState],
        eventAction: "closed",
        liveState: "closed",
        liveMerged,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
      expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
      const reservation = result.comments.find((comment) => comment.id === 101);
      const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
      expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
        state: "RELEASED",
        pr_number: 849,
        recovery: { kind: "closed_pr", merged: liveMerged },
        activation_task_sha256: createHash("sha256").update(taskState.body).digest("hex"),
      });
      const terminal = result.comments.find((comment) => comment.id === 103);
      const terminalBody = String(terminal?.body);
      expect(terminalBody).toContain(liveMerged ? "- State: `MERGED`" : "- State: `CLOSED_UNMERGED`");
      expect(terminalBody).toContain("- Run ID: `9001`");
      expect(terminalBody).not.toContain("- Run ID: `9002`");
    }
  });

  it("makes repeated trusted close delivery idempotent", () => {
    const evidence = exactReservationEvidence();
    const first = runReservationEnforcement({
      body: evidence.body,
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING") },
      ],
      eventAction: "closed",
      liveState: "closed",
    });
    expect(first.status, first.stderr).toBe(0);
    const second = runReservationEnforcement({
      body: evidence.body,
      comments: first.comments,
      eventAction: "closed",
      liveState: "closed",
    });
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain("already released idempotently");
    expect(second.stdout).toContain("already reconciled idempotently");
    expect(commentPatchCalls(second.calls, 101)).toHaveLength(0);
    expect(commentPatchCalls(second.calls, 103)).toHaveLength(0);
  });

  it("makes a stale non-close enforcement job converge the live closed PR", () => {
    const liveHead = otherSha;
    const evidence = exactReservationEvidence(liveHead);
    const result = runReservationEnforcement({
      body: evidence.body,
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING", liveHead) },
      ],
      eventAction: "synchronize",
      eventHead: sha,
      liveHead,
      liveState: "closed",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
    expect(String(result.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `CLOSED_UNMERGED`");
  });

  it("releases a published reservation when a trusted repair closes before head rebinding", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const result = runReservationEnforcement({
      body: evidence.body,
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING", otherSha) },
      ],
      eventAction: "closed",
      eventHead: otherSha,
      liveHead: otherSha,
      liveState: "closed",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    const reservation = result.comments.find((comment) => comment.id === 101);
    const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
      state: "RELEASED",
      pr_number: 849,
      head_sha: otherSha,
      recovery: { kind: "closed_pr", merged: false },
    });
  });

  it("does not regress a terminal task state during close reconciliation", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const result = runReservationEnforcement({
      body: evidence.body,
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("MERGED") },
      ],
      eventAction: "closed",
      liveState: "closed",
      liveMerged: false,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(result.calls, 103)).toHaveLength(0);
    expect(String(result.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `MERGED`");
  });

  it("performs no close mutation for missing, duplicate, mismatched, or stale provenance", () => {
    const evidence = exactReservationEvidence();
    const taskState = { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") };
    const duplicateReservation = { ...evidence.comments[0], id: 104 };
    const mismatchedDispatch = {
      ...evidence.comments[1],
      body: String(evidence.comments[1].body).replace(":9001 -->", ":different-run -->"),
    };
    const cases = [
      { comments: [taskState] },
      { comments: [...evidence.comments, duplicateReservation, taskState] },
      { comments: [evidence.comments[0], mismatchedDispatch, taskState] },
      { comments: [...evidence.comments, taskState], liveHead: otherSha, eventHead: sha },
    ];
    for (const current of cases) {
      const result = runReservationEnforcement({
        body: evidence.body,
        eventAction: "closed",
        liveState: "closed",
        ...current,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(durableMutationCalls(result.calls)).toHaveLength(0);
    }
  });

  it("makes a replacing check job converge a trusted closed PR", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const result = runSyncCheckReconciliation({
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
      ],
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Converged closed Worker PR #849 to reservation RELEASED and task CLOSED_UNMERGED.");
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
    const reservation = result.comments.find((comment) => comment.id === 101);
    const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({ state: "RELEASED" });
    expect(String(result.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `CLOSED_UNMERGED`");
  });

  it("makes repeated check-job close reconciliation idempotent", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const first = runSyncCheckReconciliation({
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
      ],
    });
    expect(first.status, first.stderr).toBe(0);
    const second = runSyncCheckReconciliation({ comments: first.comments });
    expect(second.status, second.stderr).toBe(0);
    expect(commentPatchCalls(second.calls, 101)).toHaveLength(0);
    expect(commentPatchCalls(second.calls, 103)).toHaveLength(0);
  });

  it("makes a check replacement reject invalid or stale close provenance without mutation", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const taskState = { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") };
    const duplicateReservation = { ...evidence.comments[0], id: 104 };
    const mismatchedDispatch = {
      ...evidence.comments[1],
      body: String(evidence.comments[1].body).replace(":9001 -->", ":different-run -->"),
    };
    for (const current of [
      { comments: [taskState] },
      { comments: [...evidence.comments, duplicateReservation, taskState] },
      { comments: [evidence.comments[0], mismatchedDispatch, taskState] },
      { comments: [...evidence.comments, taskState], liveHead: otherSha },
    ]) {
      const result = runSyncCheckReconciliation(current);
      expect(result.status, result.stderr).toBe(0);
      expect(durableMutationCalls(result.calls)).toHaveLength(0);
    }
  }, 20_000);

  it("keeps terminal task state monotonic in convergent check close reconciliation", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const result = runSyncCheckReconciliation({
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("MERGED") },
      ],
    });
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(result.calls, 103)).toHaveLength(0);
    expect(String(result.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `MERGED`");
  });

  it("converges a live closed PR before rejecting stale workflow-run evidence", () => {
    const liveHead = otherSha;
    const evidence = exactReservationEvidence(liveHead, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const result = runSyncCheckReconciliation({
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING", liveHead) },
      ],
      eventHead: sha,
      liveHead,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Converged closed Worker PR #849 to reservation RELEASED and task CLOSED_UNMERGED.");
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
  });

  it("does not reuse stale workflow-run evidence for an open PR", () => {
    const result = runSyncCheckReconciliation({
      comments: [{ id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING", otherSha) }],
      eventHead: sha,
      liveHead: otherSha,
      liveState: "open",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Workflow completion is stale for open PR #849");
    expect(durableMutationCalls(result.calls)).toHaveLength(0);
  });

  it("converges live-closed synchronize and ready-for-review lifecycle replacements", () => {
    for (const action of ["synchronize", "ready_for_review"]) {
      const liveHead = otherSha;
      const evidence = exactReservationEvidence(liveHead, { state: "PUBLISHED", pr_number: 849, recovery: null });
      const result = runLifecycleReconciliation({
        action,
        comments: [
          ...evidence.comments,
          { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING", liveHead) },
        ],
        eventHead: sha,
        liveHead,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        "Converged live-closed lifecycle event for PR #849 to reservation RELEASED and task CLOSED_UNMERGED.",
      );
      expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
      expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
    }
  });

  it("lets both alternate close writers release a published reservation after an unrecorded repair head", () => {
    for (const reconcile of [runLifecycleReconciliation, runSyncCheckReconciliation]) {
      const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
      const result = reconcile({
        action: "synchronize",
        comments: [
          ...evidence.comments,
          { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING", otherSha) },
        ],
        eventHead: sha,
        liveHead: otherSha,
        liveState: "closed",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
      const reservation = result.comments.find((comment) => comment.id === 101);
      const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
      expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
        state: "RELEASED",
        pr_number: 849,
        head_sha: otherSha,
        recovery: { kind: "closed_pr", merged: false },
        activation_task_sha256: createHash("sha256").update(durableStateBody("CHECKS_PENDING", otherSha)).digest("hex"),
      });
    }
  });

  it("makes repeated live-closed lifecycle replacement idempotent", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const first = runLifecycleReconciliation({
      action: "synchronize",
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
      ],
    });
    expect(first.status, first.stderr).toBe(0);
    const second = runLifecycleReconciliation({
      action: "ready_for_review",
      comments: first.comments,
    });
    expect(second.status, second.stderr).toBe(0);
    expect(commentPatchCalls(second.calls, 101)).toHaveLength(0);
    expect(commentPatchCalls(second.calls, 103)).toHaveLength(0);
  });

  it("requires exactly one canonical bound task-state before releasing a valid closed Worker reservation", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const validTask = { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") };
    const invalidTaskSets = [
      [],
      [validTask, { ...validTask, id: 104 }],
      [{ ...validTask, body: String(validTask.body).replace("- Branch: `work/proffera-test-task`", "- Branch: `work/proffera-other-task`") }],
      [{ ...validTask, body: String(validTask.body).replace("- Run ID: `9001`", "- Run ID: `8001`") }],
    ];

    for (const taskComments of invalidTaskSets) {
      const result = runLifecycleReconciliation({
        action: "closed",
        comments: [...evidence.comments, ...taskComments],
      });
      expect(result.status, result.stderr).toBe(0);
      expect(commentPatchCalls(result.calls, 101)).toHaveLength(0);
      expect(durableMutationCalls(result.calls)).toHaveLength(0);
    }

    const valid = runLifecycleReconciliation({
      action: "closed",
      comments: [...evidence.comments, validTask],
    });
    expect(valid.status, valid.stderr).toBe(0);
    expect(commentPatchCalls(valid.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(valid.calls, 103)).toHaveLength(1);
  });

  it("rejects invalid lifecycle close provenance without mutation", () => {
    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const taskState = { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") };
    const duplicateReservation = { ...evidence.comments[0], id: 104 };
    const mismatchedDispatch = {
      ...evidence.comments[1],
      body: String(evidence.comments[1].body).replace(":9001 -->", ":different-run -->"),
    };
    for (const comments of [
      [taskState],
      [...evidence.comments, duplicateReservation, taskState],
      [evidence.comments[0], mismatchedDispatch, taskState],
    ]) {
      const result = runLifecycleReconciliation({ action: "synchronize", comments });
      expect(result.status, result.stderr).toBe(0);
      expect(durableMutationCalls(result.calls)).toHaveLength(0);
    }
  });

  it("preserves exact event-head enforcement for the open lifecycle path", () => {
    const stale = runLifecycleReconciliation({
      action: "synchronize",
      comments: [{ id: 103, user: { login: "github-actions[bot]" }, body: stateBody("WORKER_PR_OPENED", otherSha) }],
      eventHead: sha,
      liveHead: otherSha,
      liveState: "open",
    });
    expect(stale.status, stale.stderr).toBe(0);
    expect(stale.stdout).toContain("Ignoring stale open lifecycle event");
    expect(durableMutationCalls(stale.calls)).toHaveLength(0);

    const current = runLifecycleReconciliation({
      action: "synchronize",
      comments: [
        ...exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849 }).comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("WORKER_PR_OPENED") },
      ],
      liveState: "open",
    });
    expect(current.status, current.stderr).toBe(0);
    expect(commentPatchCalls(current.calls, 103)).toHaveLength(1);
    const currentBody = String(current.comments.find((comment) => comment.id === 103)?.body);
    expect(currentBody).toContain("- State: `CHECKS_PENDING`");
    expect(currentBody).toContain("- Run ID: `9001`");
    expect(currentBody).not.toContain("- Run ID: `9003`");
  });

  it("preserves the normal exact-head check-evidence path for an open PR", () => {
    const result = runSyncCheckReconciliation({
      comments: [
        ...exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849 }).comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CHECKS_PENDING") },
      ],
      liveState: "open",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
    const currentBody = String(result.comments.find((comment) => comment.id === 103)?.body);
    expect(currentBody).toContain("- State: `READY_FOR_SUPERVISOR`");
    expect(currentBody).toContain("- Run ID: `9001`");
    expect(currentBody).not.toContain("- Run ID: `9003`");
  });

  it("binds reservation publication and recovery to trusted live PR identity", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const enforcement = workflowRunStep(workflow, "Require exact durable reservation before accepting Worker PR");
    const publish = workflowRunStep(workflow, "Mark reservation published");
    const recovery = workflowRunStep(workflow, "Release or recover reservation on dispatch failure");
    expect(enforcement).toContain('live_author" = "${REPOSITORY%%/*}');
    expect(enforcement).toContain('live_head_repository" = "$REPOSITORY');
    expect(enforcement).toContain('node "$helper" worker-pr-admit');
    expect(source("scripts/supervisor-worker-handoff.mjs")).toContain("reservation belongs to another PR");
    expect(publish).toContain('test "$(jq -r \'.state\' <<< "$payload")" = "RESERVED"');
    expect(publish).toContain('test "$(jq -r \'.state\' <<< "$pr")" = "open"');
    expect(recovery).toContain('.head.sha == $head');
    expect(recovery).toContain('.head.repo.full_name == $repo');
    expect(recovery).toContain('.user.login == $owner');
  });

  it("validates exact same-run recovery artifact bytes before persisting RECOVERABLE", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const cleanupStart = workflow.indexOf("  cleanup:");
    expect(cleanupStart).toBeGreaterThanOrEqual(0);
    const cleanup = workflow.slice(cleanupStart);
    const reconcile = workflowRunStep(workflow, "Reconcile exact stranded reservation after publish setup failure");
    expect(cleanup).toContain("Checkout exact cleanup baseline");
    expect(reconcile).toContain('actions/runs/${RUN_ID}/artifacts?per_page=100');
    expect(reconcile).toContain('actions/artifacts/${artifact_id}/zip');
    expect(reconcile).toContain('test "$archive_entries" = "proffera-publication-artifact.json"');
    expect(reconcile).toContain('actual_recovery_digest="$(sha256sum "$recovery_artifact"');
    expect(reconcile).toContain('node "$helper" validate-publication');
    expect(reconcile).toContain('--arg expected_target_head "$head_sha"');
    expect(reconcile).toContain('--arg expected_target_tree_sha "$target_tree_sha"');
    expect(reconcile).toContain('--arg expected_run_id "$RUN_ID"');
    expect(reconcile).toContain('test "$snapshot_finalized" = "true"');
    expect(reconcile).toContain('test "$head_sha" != "$BASE_SHA"');
    expect(reconcile).toContain("test \"$(jq -c '.paths | sort' <<< \"$recovery_validation\")\" = \"$reserved_paths\"");
    const digestCheck = reconcile.indexOf('test "$actual_recovery_digest" = "$recovery_digest"');
    const validation = reconcile.indexOf('node "$helper" validate-publication');
    const recoverableArtifact = reconcile.indexOf('.recovery={kind:"artifact",digest:$digest,expires_at:$expires}');
    expect(digestCheck).toBeGreaterThanOrEqual(0);
    expect(validation).toBeGreaterThan(digestCheck);
    expect(recoverableArtifact).toBeGreaterThan(validation);

    const markRecoverable = workflowRunStep(workflow, "Mark reservation recoverable after durable artifact upload");
    expect(markRecoverable).toContain("snapshot_finalized == true");
    expect(markRecoverable).toContain("target_tree_sha");
    expect(markRecoverable).toContain('node "$helper" validate-publication');
    expect(markRecoverable).toContain("test \"$(jq -c '.paths | sort' <<< \"$validation\")\" = \"$reserved_paths\"");
    const finalize = workflowRunStep(workflow, "Finalize reserved Worker snapshot before publication");
    expect(finalize).toContain('target_tree_sha="$(git rev-parse HEAD^{tree})"');
    expect(finalize).toContain(".target_tree_sha=$target_tree_sha");
  });

  it("defers uploaded failure artifacts to independent trusted cleanup validation", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const recovery = workflowRunStep(workflow, "Release or recover reservation on dispatch failure");
    expect(workflow).toContain("id: recovery_upload");
    expect(recovery).toContain('ARTIFACT_UPLOADED" = "true"');
    expect(recovery).toContain("artifact-backed recovery is deferred");
    expect(recovery).not.toContain('.recovery={kind:"artifact"');
    const deferred = runReservationRecovery({ artifactUploaded: true, branchExists: false });
    expect(deferred.status, deferred.stderr).toBe(0);
    expect(commentPatchCalls(deferred.calls, 101)).toHaveLength(0);
    expect(String(deferred.comments.find((comment) => comment.id === 101)?.body ?? "")).toContain("- State: `RESERVED`");
    expect(source("scripts/supervisor-worker-handoff.mjs")).toContain("payload.recovery?.expires_at");
    expect(source("scripts/supervisor-worker-handoff.mjs")).toContain("retryable: true");
    expect(workflow).toContain("retention-days: 7");
  });

  it("couples an empty dispatch cleanup to RELEASED plus retryable TASK_BLOCKED", () => {
    const released = runReservationRecovery({ branchExists: false });
    expect(released.status, released.stderr).toBe(0);
    expect(commentPatchCalls(released.calls, 99)).toHaveLength(1);
    expect(commentPatchCalls(released.calls, 101)).toHaveLength(1);
    expect(String(released.comments.find((comment) => comment.id === 99)?.body)).toContain("- State: `TASK_BLOCKED`");
    expect(String(released.comments.find((comment) => comment.id === 99)?.body)).toContain("same task may be resubmitted safely");
    const reservationBody = String(released.comments.find((comment) => comment.id === 101)?.body ?? "");
    expect(reservationBody).toContain("- State: `RELEASED`");

    const retry = createPreflightHarness({ comments: released.comments }).run({ runId: "9002" });
    expect(retry.status, retry.stderr).toBe(0);
    expect(retry.outputs.proceed).toBe("yes");
    expect(retry.comments.filter((comment) => String(comment.body ?? "").includes("proffera-worker-task-state:SUP-TEST-1"))).toHaveLength(1);
    expect(String(retry.comments.find((comment) => comment.id === 99)?.body)).toContain("- State: `TASK_CREATED`");
  }, 15_000);

  it("does not rewrite a reservation that a serialized close writer already RELEASED", () => {
    const released = runReservationRecovery({ branchExists: true, reservationState: "RELEASED" });
    expect(released.status, released.stderr).toBe(0);
    expect(commentPatchCalls(released.calls, 99)).toHaveLength(0);
    expect(commentPatchCalls(released.calls, 101)).toHaveLength(0);
    expect(String(released.comments.find((comment) => comment.id === 101)?.body)).toContain("- State: `RELEASED`");
  });

  it("keeps the reservation unreleased when its exact task state cannot become retryable", () => {
    const changed = runReservationRecovery({ branchExists: false, taskState: "CHECKS_PENDING" });
    expect(changed.status).not.toBe(0);
    expect(changed.stderr).toContain("released reservation task is not retryable from its current state");
    expect(commentPatchCalls(changed.calls, 99)).toHaveLength(0);
    expect(commentPatchCalls(changed.calls, 101)).toHaveLength(0);
    expect(String(changed.comments.find((comment) => comment.id === 101)?.body)).toContain("- State: `RESERVED`");
  });

  it("does not release when branch evidence appears during the coupled transition", () => {
    const changed = runReservationRecovery({
      branchAppearsOnSecondVerification: true,
      branchExists: false,
    });
    expect(changed.status).not.toBe(0);
    expect(changed.stderr).toContain("branch or open PR evidence appeared while persisting retryable task state");
    expect(commentPatchCalls(changed.calls, 99)).toHaveLength(1);
    expect(commentPatchCalls(changed.calls, 101)).toHaveLength(0);
    expect(String(changed.comments.find((comment) => comment.id === 99)?.body)).toContain("- State: `TASK_BLOCKED`");
    expect(String(changed.comments.find((comment) => comment.id === 101)?.body)).toContain("- State: `RESERVED`");
  });

  it("does not resurrect a slot when the exact Worker PR closed but its branch still exists", () => {
    const closed = runReservationRecovery({
      branchExists: true,
      livePrState: "closed",
      prNumber: "900",
    });
    expect(closed.status, closed.stderr).toBe(0);
    expect(commentPatchCalls(closed.calls, 101)).toHaveLength(0);
    expect(String(closed.comments.find((comment) => comment.id === 101)?.body ?? "")).toContain("- State: `RESERVED`");

    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const recovery = workflowRunStep(workflow, "Release or recover reservation on dispatch failure");
    const acquire = recovery.indexOf("reservation-mutex-acquire");
    const read = recovery.indexOf('comment="$(gh api "repos/${REPOSITORY}/issues/comments/${RESERVATION_COMMENT_ID}"');
    const finalReservationGuard = recovery.indexOf("Refused: reservation changed before dispatch-failure recovery mutation.");
    const finalPrGuard = recovery.indexOf("guard_exact_live_pr_open", finalReservationGuard);
    const patch = recovery.indexOf('gh api --method PATCH "repos/${REPOSITORY}/issues/comments/${RESERVATION_COMMENT_ID}"', finalPrGuard);
    expect(acquire).toBeGreaterThanOrEqual(0);
    expect(read).toBeGreaterThan(acquire);
    expect(finalReservationGuard).toBeGreaterThan(read);
    expect(finalPrGuard).toBeGreaterThan(finalReservationGuard);
    expect(patch).toBeGreaterThan(finalPrGuard);
    expect(recovery).toContain("reservation-mutex-release");
  });

  it("revalidates a discovered PR even when the publish step lost its PR-number output", () => {
    const closed = runReservationRecovery({
      branchExists: true,
      discoveredPrState: "closed",
      prNumber: "",
    });
    expect(closed.status, closed.stderr).toBe(0);
    expect(commentPatchCalls(closed.calls, 101)).toHaveLength(0);
    expect(String(closed.comments.find((comment) => comment.id === 101)?.body ?? "")).toContain("- State: `RESERVED`");

    const recovery = workflowRunStep(source(".github/workflows/supervisor-worker-handoff.yml"), "Release or recover reservation on dispatch failure");
    expect(recovery).toContain("pulls?state=all&base=main&per_page=100");
    expect(recovery).toContain('guard_exact_live_pr_open "$pr_number"');
    expect(recovery).toContain('guard_exact_live_pr_open "${pr_number:-${PR_NUMBER:-}}"');
  });


  it("gives branch-backed recovery a bounded durable lease", () => {
    const result = runReservationRecovery();
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    const reservation = result.comments.find((comment) => comment.id === 101);
    const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
    expect(payload).toMatchObject({ state: "RECOVERABLE", recovery: { kind: "branch" } });
    expect(Date.parse(payload.recovery.expires_at)).toBeGreaterThan(Date.now() + 5 * 24 * 60 * 60 * 1000);
  });

  it("reserves durable capacity before dispatching the Worker", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const reserveIndex = workflow.indexOf("Atomically reserve writable Worker slot");
    const dispatchEvidenceIndex = workflow.indexOf("Persist trusted Worker dispatch-start evidence");
    const workerIndex = workflow.indexOf("Run one bounded implementation Worker");
    expect(reserveIndex).toBeGreaterThanOrEqual(0);
    expect(reserveIndex).toBeLessThan(dispatchEvidenceIndex);
    expect(dispatchEvidenceIndex).toBeLessThan(workerIndex);

    const result = runSlotReservation();
    expect(result.status, result.stderr).toBe(0);
    const reservation = result.comments.find((comment) => comment.id === 999);
    const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
      state: "RESERVED",
      changed_files: [],
      snapshot_finalized: false,
      pr_number: null,
    });
  });

  it("reuses the one canonical RELEASED reservation record when the same task becomes dispatchable", () => {
    const localHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).stdout.trim();
    const retryPacket = packet({
      task_id: "SUP-NEW-SLOT-1",
      task_title: "Disjoint slot behavior test",
      graph_path: "feature/new-slot",
      base_sha: localHead,
      branch: "work/proffera-new-slot",
      allowed_paths: ["tests/new-slot/"],
    });
    const released = {
      version: 1,
      state: "RELEASED",
      task_id: retryPacket.task_id,
      run_id: "9001",
      branch: retryPacket.branch,
      head_sha: otherSha,
      graph_path: retryPacket.graph_path,
      packet_digest: createHash("sha256").update(JSON.stringify(retryPacket)).digest("hex"),
      allowed_paths: retryPacket.allowed_paths,
      changed_files: [],
      snapshot_finalized: false,
      pr_number: null,
      recovery: { kind: "expired_reservation", verified_run_status: "completed", retryable: true },
      lease_expires_at: "2000-01-01T00:00:00Z",
    };
    const result = runSlotReservation({ reservation: released });
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 201)).toHaveLength(1);
    expect(result.comments.filter((comment) => String(comment.body ?? "").includes("proffera-worker-slot-reservation:SUP-NEW-SLOT-1"))).toHaveLength(1);
    expect(result.comments.some((comment) => comment.id === 999)).toBe(false);
    const body = String(result.comments.find((comment) => comment.id === 201)?.body ?? "");
    const payload = JSON.parse(Buffer.from(body.match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "", "base64").toString("utf8"));
    expect(payload).toMatchObject({ state: "RESERVED", task_id: "SUP-NEW-SLOT-1", run_id: "1001" });
  });

  it("rejects a third durable unit before Worker execution and keeps the task retryable", () => {
    const activeReservation = (id: number) => ({
      version: 1,
      state: "RESERVED",
      task_id: `SUP-OLD-SLOT-${id}`,
      run_id: String(7000 + id),
      branch: `work/proffera-old-slot-${id}`,
      head_sha: otherSha,
      graph_path: `feature/old-slot-${id}`,
      packet_digest: String(id).repeat(64),
      lease_expires_at: "2099-01-01T00:00:00Z",
      allowed_paths: [`src/features/old-slot-${id}/`],
      changed_files: [],
      snapshot_finalized: false,
      pr_number: null,
      recovery: null,
    });
    const result = runSlotReservation({
      reservation: activeReservation(1),
      extraComments: [reservationComment(activeReservation(2), 202)],
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("both writable Worker slots are already occupied or durably reserved");
    expect(result.outputs.capacity_blocked).toBe("true");
    expect(result.comments.some((comment) => comment.id === 999)).toBe(false);

    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const failure = workflowRunStep(workflow, "Fail closed into WORKER_BLOCKED on dispatch failure");
    expect(failure).toContain('state="TASK_BLOCKED"');
    expect(failure).toContain("No reservation was acquired and no Worker was invoked");
  });

  it("keeps every failure before reservation acquisition retryable", () => {
    for (const capacityBlocked of [false, true]) {
      const result = runDispatchFailureState({ capacityBlocked });
      expect(result.status, result.stderr).toBe(0);
      expect(result.body).toContain("- State: `TASK_BLOCKED`");
      expect(result.body).toMatch(/no Worker was invoked/iu);
      expect(result.body).toContain("same task may be resubmitted");
    }

    const postReservation = runDispatchFailureState({ reservationCommentId: "101" });
    expect(postReservation.status, postReservation.stderr).toBe(0);
    expect(postReservation.body).toContain("- State: `WORKER_BLOCKED`");
  });

  it("admits a disjoint second reservation and rejects declared overlap before Worker execution", () => {
    const existing = {
      version: 1,
      state: "RESERVED",
      task_id: "SUP-OLD-SLOT-1",
      run_id: "7001",
      branch: "work/proffera-old-slot",
      head_sha: otherSha,
      graph_path: "feature/old-slot",
      packet_digest: "c".repeat(64),
      lease_expires_at: "2099-01-01T00:00:00Z",
      allowed_paths: ["src/features/old-slot/"],
      changed_files: [],
      snapshot_finalized: false,
      pr_number: null,
      recovery: null,
    };
    const disjoint = runSlotReservation({ reservation: existing });
    expect(disjoint.status, disjoint.stderr).toBe(0);
    expect(disjoint.comments.some((comment) => comment.id === 999)).toBe(true);

    for (const overlapping of [
      { ...existing, graph_path: "feature/new-slot/subpath" },
      { ...existing, allowed_paths: ["tests/new-slot/collision.ts"] },
    ]) {
      const rejected = runSlotReservation({ reservation: overlapping });
      expect(rejected.status).toBe(1);
      expect(rejected.comments.some((comment) => comment.id === 999)).toBe(false);
    }
  });

  it("finalizes the exact observed Worker snapshot before publication", () => {
    const result = runReservationFinalization();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Finalized reserved Worker snapshot SUP-TEST-1@${result.targetHead}`);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    const reservation = result.comments.find((comment) => comment.id === 101);
    const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
      state: "RESERVED",
      head_sha: result.targetHead,
      changed_files: ["src/change.txt"],
      snapshot_finalized: true,
      pr_number: null,
    });

    const changed = runReservationFinalization({ changedReservationBody: true });
    expect(changed.status).toBe(1);
    expect(commentPatchCalls(changed.calls, 101)).toHaveLength(0);
  });

  it.each(["RESERVED", "RECOVERABLE"] as const)("reclaims task A's expired %s reservation when task B requests global capacity", (state) => {
    const old = globalExpiryEvidence(1, state);
    const result = runSlotReservation({ extraComments: old.comments });
    expect(result.status, result.stderr).toBe(0);
    expect(String(result.comments.find((comment) => comment.id === 210)?.body)).toContain("- State: `RELEASED`");
    expect(String(result.comments.find((comment) => comment.id === 212)?.body)).toContain("- State: `TASK_BLOCKED`");
    expect(result.outputs.reservation_comment_id).toBe("999");
    const taskWrite = result.calls.findIndex((args) => args.includes("PATCH") && args.some((arg) => arg.endsWith("/212")));
    const release = result.calls.findIndex((args) => args.includes("PATCH") && args.some((arg) => arg.endsWith("/210")));
    expect(taskWrite).toBeGreaterThanOrEqual(0);
    expect(release).toBeGreaterThan(taskWrite);
  });

  it("reclaims two abandoned reservations before counting capacity and admits task B", () => {
    const result = runSlotReservation({ extraComments: [...globalExpiryEvidence(1).comments, ...globalExpiryEvidence(2, "RECOVERABLE").comments] });
    expect(result.status, result.stderr).toBe(0);
    for (const id of [210, 220]) expect(String(result.comments.find((comment) => comment.id === id)?.body)).toContain("- State: `RELEASED`");
    expect(result.outputs.reservation_comment_id).toBe("999");
  });

  it("retains global reservations with an unexpired lease, active run, branch, or open PR on any base", () => {
    const old = globalExpiryEvidence(1);
    const future = [...old.comments];
    future[0] = reservationComment({ ...old.payload, lease_expires_at: "2099-01-01T00:00:00Z" }, 210);
    const pull = { number: 830, base: { ref: "another-base" }, head: { ref: old.packet.branch, repo: { full_name: "ibboabdoli-ai/Proffera" } }, user: { login: "ibboabdoli-ai" }, body: "", files: [] };
    for (const options of [
      { extraComments: future },
      { extraComments: old.comments, runStatus: "in_progress" },
      { extraComments: old.comments, branches: [String(old.packet.branch)] },
      { extraComments: old.comments, pulls: [pull] },
    ]) {
      const result = runSlotReservation(options);
      expect(result.status, result.stderr).toBe(0);
      expect(commentPatchCalls(result.calls, 210)).toHaveLength(0);
      expect(String(result.comments.find((comment) => comment.id === 210)?.body)).toContain("- State: `RESERVED`");
    }
  });

  it("fails closed on missing, duplicate, or mismatched global task, reservation, dispatch, and packet evidence", () => {
    const old = globalExpiryEvidence(1);
    for (const comments of [
      old.comments.filter((comment) => comment.id !== 212),
      old.comments.filter((comment) => comment.id !== 211),
      old.comments.filter((comment) => comment.id !== 213),
      [...old.comments, { ...old.comments[0], id: 300 }],
      [...old.comments, { ...old.comments[1], id: 300 }],
      [...old.comments, { ...old.comments[2], id: 300 }],
      [reservationComment({ ...old.payload, packet_digest: "f".repeat(64) }, 210), ...old.comments.slice(1)],
      old.comments.map((comment) => comment.id === 212 ? { ...comment, body: comment.body.replace("9001", "9002") } : comment),
      old.comments.map((comment) => comment.id === 212 ? { ...comment, body: comment.body + "\n<!-- proffera-worker-task-state:SUP-FOREIGN-1 -->" } : comment),
      [...old.comments, { id: 300, user: { login: "ibboabdoli-ai" }, body: packetComment({ ...old.packet, task_title: "Conflicting packet identity" }) }],
    ]) {
      const result = runSlotReservation({ extraComments: comments });
      expect(result.status).toBe(1);
      expect(result.calls.filter((args) => args.includes("PATCH"))).toHaveLength(0);
      expect(result.outputs.reservation_comment_id).toBeUndefined();
    }
  }, 20_000);

  it("fails closed when global reclamation evidence changes before either mutation", () => {
    const old = globalExpiryEvidence(1);
    for (const mutation of [
      { mutateReservationOnCommentRead: 2 }, { mutateTaskOnCommentRead: 2 },
      { duplicateReservationOnCommentRead: 2 }, { duplicateTaskOnCommentRead: 2 },
      { mutateReservationOnCommentRead: 3 }, { mutateTaskOnCommentRead: 3 },
      { branchAfterTaskPatch: String(old.packet.branch) },
    ]) {
      const result = runSlotReservation({ extraComments: old.comments, mutation });
      expect(result.status).toBe(1);
      expect(commentPatchCalls(result.calls, 210)).toHaveLength(0);
      expect(result.outputs.reservation_comment_id).toBeUndefined();
    }
  }, 20_000);

  it("retries a partial task-first reclamation without creating another task or reservation identity", () => {
    const old = globalExpiryEvidence(1);
    const failed = runSlotReservation({ extraComments: old.comments, mutation: { failReservationRelease: true } });
    expect(failed.status).toBe(1);
    expect(String(failed.comments.find((comment) => comment.id === 212)?.body)).toContain("TASK_BLOCKED");
    expect(String(failed.comments.find((comment) => comment.id === 210)?.body)).toContain("RESERVED");
    const retry = runSlotReservation({ extraComments: failed.comments });
    expect(retry.status, retry.stderr).toBe(0);
    expect(commentPatchCalls(retry.calls, 212)).toHaveLength(0);
    expect(commentPatchCalls(retry.calls, 210)).toHaveLength(1);
    expect(retry.outputs.reservation_comment_id).toBe("999");
  });

  it("fails closed on an expired global reservation with missing task and packet provenance", () => {
    const oldReservation = {
      version: 1,
      state: "RECOVERABLE",
      task_id: "SUP-OLD-SLOT-1",
      run_id: "7001",
      branch: "work/proffera-old-slot",
      head_sha: otherSha,
      graph_path: "feature/old-slot",
      packet_digest: "c".repeat(64),
      lease_expires_at: "2000-01-01T00:00:00Z",
      snapshot_finalized: true,
      allowed_paths: ["src/features/old-slot/"],
      changed_files: [],
      pr_number: null,
      recovery: { kind: "branch", expires_at: "2000-01-01T00:00:00Z" },
    };
    const result = runSlotReservation({ reservation: oldReservation });
    expect(result.status).toBe(1);
    expect(commentPatchCalls(result.calls, 201)).toHaveLength(0);
    expect(String(result.comments.find((comment) => comment.id === 201)?.body)).toContain("- State: `RECOVERABLE`");
  });

  it.each(["RESERVED", "RECOVERABLE"] as const)("reclaims an expired Planner %s reservation from durable packet evidence without an owner Task Packet comment", (state) => {
    const old = globalExpiryEvidence(3, state);
    const plannerEvidence = {
      source: "planner",
      packet_b64: Buffer.from(JSON.stringify(old.packet)).toString("base64"),
      planner_packet_sha256: createHash("sha256").update(JSON.stringify(old.packet)).digest("hex"),
      planner_run_id: String(old.payload.run_id),
      planner_head_sha: old.packet.base_sha,
      planner_workflow_ref: "ibboabdoli-ai/Proffera/.github/workflows/supervisor-planner.yml@refs/heads/main",
    };
    const comments = old.comments
      .filter((comment) => comment.id !== 233)
      .map((comment) => comment.id === 230
        ? reservationComment({ ...old.payload, planner_packet_evidence: plannerEvidence }, 230)
        : comment);
    const result = runSlotReservation({ extraComments: comments });
    expect(result.status, result.stderr).toBe(0);
    expect(String(result.comments.find((comment) => comment.id === 230)?.body)).toContain("- State: `RELEASED`");
    expect(String(result.comments.find((comment) => comment.id === 232)?.body)).toContain("- State: `TASK_BLOCKED`");
    expect(result.outputs.reservation_comment_id).toBe("999");
  });

  it("fails closed when durable Planner packet evidence is forged or reservation-mismatched", () => {
    const old = globalExpiryEvidence(3, "RECOVERABLE");
    const exact = {
      source: "planner",
      packet_b64: Buffer.from(JSON.stringify(old.packet)).toString("base64"),
      planner_packet_sha256: createHash("sha256").update(JSON.stringify(old.packet)).digest("hex"),
      planner_run_id: String(old.payload.run_id),
      planner_head_sha: old.packet.base_sha,
      planner_workflow_ref: "ibboabdoli-ai/Proffera/.github/workflows/supervisor-planner.yml@refs/heads/main",
    };
    const variants = [
      { ...exact, planner_packet_sha256: "f".repeat(64) },
      { ...exact, planner_run_id: "999999" },
      { ...exact, planner_head_sha: "f".repeat(40) },
      { ...exact, planner_workflow_ref: "ibboabdoli-ai/Proffera/.github/workflows/other.yml@refs/heads/main" },
      { ...exact, packet_b64: Buffer.from(JSON.stringify({ ...old.packet, task_title: "forged" })).toString("base64") },
    ];
    for (const planner_packet_evidence of variants) {
      const comments = old.comments
        .filter((comment) => comment.id !== 233)
        .map((comment) => comment.id === 230
          ? reservationComment({ ...old.payload, planner_packet_evidence }, 230)
          : comment);
      const result = runSlotReservation({ extraComments: comments });
      expect(result.status).toBe(1);
      expect(commentPatchCalls(result.calls, 230)).toHaveLength(0);
      expect(result.outputs.reservation_comment_id).toBeUndefined();
    }
  });
  it("counts a promoted recovery PR and its published reservation as one slot", () => {
    const existingPacket = packet({ task_id: "SUP-OLD-SLOT-1", branch: "work/proffera-old-slot",
      graph_path: "feature/old-slot", allowed_paths: ["src/features/old-slot/"] });
    const reservation = {
      version: 1,
      state: "PUBLISHED",
      task_id: "SUP-OLD-SLOT-1",
      run_id: "7001",
      branch: "work/proffera-old-slot",
      head_sha: otherSha,
      graph_path: "feature/old-slot",
      packet_digest: createHash("sha256").update(JSON.stringify(existingPacket)).digest("hex"),
      lease_expires_at: "2099-01-01T00:00:00Z",
      snapshot_finalized: true,
      allowed_paths: ["src/features/old-slot/"],
      changed_files: [],
      pr_number: 830,
      recovery: null,
    };
    const openPull = {
      number: 830,
      base: { ref: "main" },
      head: { ref: "work/proffera-old-slot", sha: otherSha, repo: { full_name: "ibboabdoli-ai/Proffera" } },
      user: { login: "ibboabdoli-ai" },
      body: runText("pr-body", { packet: existingPacket, changed_files: [] }),
      files: [],
    };
    const result = runSlotReservation({ reservation, pulls: [openPull], extraComments: [
      { id: 202, user: { login: "github-actions[bot]" }, body: "<!-- proffera-worker-dispatch-start:SUP-OLD-SLOT-1:7001 -->" },
    ] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.comments.some((comment) => comment.id === 999)).toBe(true);
  });

  it("counts an exact trusted recoverable PR as one slot during the promotion gap", () => {
    const recoveryPacket = packet({
      task_id: "SUP-OLD-SLOT-1",
      task_title: "Existing recovery Worker",
      graph_path: "feature/old-slot",
      branch: "work/proffera-old-slot",
      allowed_paths: ["src/features/old-slot/"],
    });
    const recoveryPrBody = runText("pr-body", { packet: recoveryPacket, changed_files: [] });
    const parsed = spawnSync(process.execPath, [helper, "parse"], {
      input: recoveryPrBody,
      encoding: "utf8",
    });
    expect(parsed.status, parsed.stderr).toBe(0);
    const normalizedPacket = parsed.stdout.replace(/\n+$/, "");
    const reservation = {
      version: 1,
      state: "RECOVERABLE",
      task_id: "SUP-OLD-SLOT-1",
      run_id: "7001",
      branch: "work/proffera-old-slot",
      head_sha: otherSha,
      graph_path: "feature/old-slot",
      packet_digest: createHash("sha256").update(normalizedPacket).digest("hex"),
      lease_expires_at: "2099-01-01T00:00:00Z",
      snapshot_finalized: true,
      allowed_paths: ["src/features/old-slot/"],
      changed_files: [],
      pr_number: null,
      recovery: { kind: "branch", expires_at: "2099-01-01T00:00:00Z" },
    };
    const openPull = {
      number: 830,
      state: "open",
      base: { ref: "main" },
      head: { ref: "work/proffera-old-slot", sha: otherSha, repo: { full_name: "ibboabdoli-ai/Proffera" } },
      user: { login: "ibboabdoli-ai" },
      body: recoveryPrBody,
      files: [],
    };
    const dispatch = {
      id: 202,
      user: { login: "github-actions[bot]" },
      body: "<!-- proffera-worker-dispatch-start:SUP-OLD-SLOT-1:7001 -->",
    };
    const exact = runSlotReservation({ reservation, pulls: [openPull], extraComments: [dispatch] });
    expect(exact.status, exact.stderr).toBe(0);
    expect(exact.outputs.reservation_comment_id).toBe("999");
    expect(exact.comments.some((comment) => comment.id === 999)).toBe(true);

    for (const extraComments of [
      [],
      [dispatch, { ...dispatch, id: 203 }],
    ]) {
      const ambiguous = runSlotReservation({ reservation, pulls: [openPull], extraComments });
      expect(ambiguous.status, ambiguous.stderr).toBe(1);
      expect(ambiguous.comments.some((comment) => comment.id === 999)).toBe(false);
      expect(commentPatchCalls(ambiguous.calls, 201)).toHaveLength(0);
    }

    for (const mismatchedReservation of [
      { ...reservation, branch: "work/proffera-other-slot" },
      { ...reservation, packet_digest: "d".repeat(64) },
      { ...reservation, graph_path: "feature/different-slot" },
      { ...reservation, allowed_paths: ["src/features/different-slot/"] },
      { ...reservation, pr_number: 831 },
    ]) {
      const mismatched = runSlotReservation({ reservation: mismatchedReservation, pulls: [openPull], extraComments: [dispatch] });
      expect(mismatched.status, mismatched.stderr).toBe(1);
      expect(mismatched.comments.some((comment) => comment.id === 999)).toBe(false);
    }

    const staleHeadPull = structuredClone(openPull);
    staleHeadPull.head.sha = "d".repeat(40);
    const mismatched = runSlotReservation({ reservation, pulls: [staleHeadPull], extraComments: [dispatch] });
    expect(mismatched.status, mismatched.stderr).toBe(1);
    expect(mismatched.comments.some((comment) => comment.id === 999)).toBe(false);

    const foreignPull = structuredClone(openPull);
    foreignPull.head.repo.full_name = "attacker/fork";
    foreignPull.user.login = "attacker";
    const foreign = runSlotReservation({ reservation, pulls: [foreignPull], extraComments: [dispatch] });
    expect(foreign.status, foreign.stderr).toBe(0);
    expect(foreign.stdout).not.toContain("represents recoverable reservation");
    expect(foreign.calls.some((args) => args.includes("--method") && args.includes("PATCH"))).toBe(false);
  }, process.platform === "win32" ? 120_000 : 20_000);

  it("applies the helper-approved WORKER_PR_OPENED task-state transition", () => {
    const result = runWorkerPrStateRecord(stateBody("TASK_CREATED"));
    expect(result.status, result.stderr).toBe(0);
    const patches = taskStatePatchCalls(result.calls);
    expect(patches).toHaveLength(1);
    expect(patches[0].join("\n")).toContain("- State: `WORKER_PR_OPENED`");
  });

  it("does not write a WORKER_PR_OPENED state when the helper refuses the transition", () => {
    const result = runWorkerPrStateRecord(stateBody("MERGED"));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("task state cannot activate a Worker");
    expect(taskStatePatchCalls(result.calls)).toHaveLength(0);
  });

  it("keeps an #830-style independent parallel Worker unaffected", () => {
    const parallel = workerPr({
      number: 830,
      body: 'Task ID: OPS-COST-1\nGraph path: operations/neon-cost\nAllowed paths: ["src/app/api/cron/"]',
      files: ["src/app/api/cron/booking-reminders/route.ts"],
    });
    expect(evaluate(baseContext({ open_prs: [parallel] })).status).toBe("TASK_CREATED");
  });

  it("serializes dispatch publication with PR lifecycle reservation mutations", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    const workflowHeader = workflow.slice(0, workflow.indexOf("jobs:"));
    expect(workflowHeader).not.toContain("concurrency:");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("format('untrusted-pr-{0}', github.event.pull_request.number)");
    expect(workflow).toContain("group: proffera-supervisor-worker-admission-${{ inputs.comment_id || inputs.planner_run_id || github.run_id }}");
    expect(workflow).toContain("group: proffera-worker-task-state-${{ needs.preflight.outputs.branch }}");
    expect(sync).toContain("group: proffera-worker-lifecycle-${{ needs.resolve_worker_mutation_lane.outputs.branch }}");
    const markPublished = workflowRunStep(workflow, "Mark reservation published");
    const publishMutexAcquire = markPublished.indexOf("reservation-mutex-acquire");
    const publishPrGuard = markPublished.indexOf('pr_guard="$(gh api "repos/${REPOSITORY}/pulls/${PR_NUMBER}")"');
    const publishReservationPatch = markPublished.indexOf('gh api --method PATCH "repos/${REPOSITORY}/issues/comments/${RESERVATION_COMMENT_ID}"');
    expect(publishMutexAcquire).toBeGreaterThanOrEqual(0);
    expect(markPublished).toContain("reservation-mutex-release");
    expect(publishPrGuard).toBeGreaterThan(publishMutexAcquire);
    expect(publishReservationPatch).toBeGreaterThan(publishPrGuard);
    expect(sync).toContain("group: proffera-worker-checks-${{ needs.resolve_worker_mutation_lane.outputs.branch }}");
    const lifecycleHeader = sync.slice(sync.indexOf("  sync-pr-event:"), sync.indexOf("    runs-on:", sync.indexOf("  sync-pr-event:")));
    const checksHeader = sync.slice(sync.indexOf("  sync-check-state:"), sync.indexOf("    runs-on:", sync.indexOf("  sync-check-state:")));
    expect(lifecycleHeader).toContain("cancel-in-progress: false");
    expect(checksHeader).toContain("cancel-in-progress: true");
    const syncPrHeader = sync.slice(sync.indexOf("  sync-pr-event:"), sync.indexOf("    runs-on:", sync.indexOf("  sync-pr-event:")));
    expect(syncPrHeader).not.toContain("github.event.action != 'closed'");
    expectShellAndJqSyntax(workflowRunStep(sync, "Record or update Worker lifecycle state in Supervisor issue"));
    expectShellAndJqSyntax(workflowRunStep(sync, "Reconcile required current-head workflow evidence"));
    expect(workflowRunStep(workflow, "Require exact durable reservation before accepting Worker PR")).toContain(
      "Reconciled task ${task_id} to ${terminal_state} in the same close writer.",
    );
    const resolveLane = workflowRunStep(sync, "Resolve exact Worker branch");
    const shell = spawnSync("bash", ["-n"], { input: resolveLane, encoding: "utf8" });
    expect(shell.status, shell.stderr).toBe(0);
    for (const event of [
      { name: "pull_request_target", prHead: "work/proffera-pr-event", runHead: "", branch: "work/proffera-pr-event", headRepo: "ibboabdoli-ai/Proffera", author: "ibboabdoli-ai", trusted: true },
      { name: "workflow_run", prHead: "", runHead: "work/proffera-check-event", branch: "work/proffera-check-event", headRepo: "ibboabdoli-ai/Proffera", author: "ibboabdoli-ai", trusted: true },
      { name: "pull_request_target", prHead: "work/proffera-prefix-impostor", runHead: "", branch: "work/proffera-prefix-impostor", headRepo: "attacker/fork", author: "attacker", trusted: false },
    ]) {
      const root = mkdtempSync(join(tmpdir(), "proffera-worker-mutation-lane-"));
      const bin = join(root, "bin");
      const output = join(root, "github-output");
      mkdirSync(bin, { recursive: true });
      writeFileSync(output, "");
      writeFileSync(
        join(bin, "gh"),
        `#!/usr/bin/env node
const args = process.argv.slice(2);
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
if (args[0] !== "api" || endpoint !== "repos/ibboabdoli-ai/Proffera/pulls/900") process.exit(2);
process.stdout.write(JSON.stringify({
  head: { ref: process.env.GH_STUB_BRANCH, repo: { full_name: process.env.GH_STUB_HEAD_REPO } },
  user: { login: process.env.GH_STUB_AUTHOR },
}) + "\\n");
`,
        { encoding: "utf8", mode: 0o755 },
      );
      const result = spawnSync("bash", ["-c", resolveLane], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
          GH_TOKEN: "test-token",
          REPOSITORY: "ibboabdoli-ai/Proffera",
          PR_NUMBER: "900",
          EVENT_NAME: event.name,
          PR_HEAD_REF: event.prHead,
          RUN_HEAD_BRANCH: event.runHead,
          GH_STUB_BRANCH: event.branch,
          GH_STUB_HEAD_REPO: event.headRepo,
          GH_STUB_AUTHOR: event.author,
          GITHUB_OUTPUT: output,
        },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(output, "utf8")).toBe(event.trusted
        ? `branch=${event.branch}\ntrusted=true\n`
        : "trusted=false\n");
    }
    expect(evaluate(baseContext({ comments: [trustedState("TASK_CREATED", "9999")], run_id: "1001" })).status).toBe("ALREADY_DISPATCHED");
  });

  it("rejects two different task IDs for the same graph path", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ body: 'Task ID: OTHER-2\nGraph path: feature/test\nAllowed paths: ["src/features/other/"]' })] })).code).toBe("graph_collision");
  });

  it("rejects main moving between creation and dispatch", () => {
    expect(evaluate(baseContext({ live_main_sha: otherSha })).code).toBe("stale_base");
  });

  it("reuses an already-existing matching task PR instead of creating another", () => {
    const existing = workerPr({
      number: 912,
      head_ref: "work/proffera-test-task",
      body: 'Task ID: SUP-TEST-1\nGraph path: feature/test\nAllowed paths: ["src/features/test/"]',
      files: ["src/features/test/a.ts"],
    });
    const result = evaluate(baseContext({ open_prs: [existing] }));
    expect(result.status).toBe("ALREADY_DISPATCHED");
    expect(result.existing_pr).toBe(912);
  });

  it("rejects a pre-existing branch without trusted task binding", () => {
    expect(evaluate(baseContext({ branch: { exists: true } })).code).toBe("branch_exists");
  });

  it("fails closed when authenticated dispatch capability is missing", () => {
    expect(evaluate(baseContext({ secrets: { openai: false, push: true } })).code).toBe("dispatch_auth_unavailable");
  });

  it("does not redispatch after the source Issue comment is edited", () => {
    const context = baseContext({ comments: [trustedState("CHECKS_PENDING", "9999")] });
    (context.event as Record<string, unknown>).comment_body = `${packetComment()}\nEdited explanatory text.`;
    expect(evaluate(context).status).toBe("ALREADY_DISPATCHED");
  });

  it("closed-unmerged tasks remain terminal until Supervisor chooses a new task ID", () => {
    expect(evaluate(baseContext({ comments: [trustedState("CLOSED_UNMERGED", "9999")] })).status).toBe("ALREADY_DISPATCHED");
  });

  it("terminal MERGED cannot regress", () => {
    const result = transition({
      current_body: stateBody("MERGED"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
      live_pr_state: "closed",
      live_merged: true,
    });
    expect(result.apply).toBe(false);
    expect(result.code).toBe("terminal_state_preserved");
  });

  it("terminal CLOSED_UNMERGED cannot regress", () => {
    const result = transition({
      current_body: stateBody("CLOSED_UNMERGED"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
      live_pr_state: "closed",
      live_merged: false,
    });
    expect(result.apply).toBe(false);
    expect(result.code).toBe("terminal_state_preserved");
  });

  it("reactivates only CLOSED_UNMERGED from live reopen and upgrades it to a live merge", () => {
    const reopened = runLifecycleReconciliation({
      action: "reopened",
      comments: [
        ...exactReservationEvidence(sha, { state: "RELEASED", pr_number: 849, recovery: { kind: "closed_pr", merged: false } }).comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CLOSED_UNMERGED") },
      ],
      liveState: "open",
    });
    expect(reopened.status, reopened.stderr).toBe(0);
    expect(commentPatchCalls(reopened.calls, 103)).toHaveLength(1);
    expect(String(reopened.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `WORKER_PR_OPENED`");

    const staleReopen = runLifecycleReconciliation({
      action: "reopened",
      comments: [
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CLOSED_UNMERGED", otherSha) },
      ],
      eventHead: otherSha,
      liveHead: sha,
      liveState: "open",
    });
    expect(staleReopen.status, staleReopen.stderr).toBe(0);
    expect(commentPatchCalls(staleReopen.calls, 103)).toHaveLength(0);

    const checksPending = transition({
      current_body: stateBody("WORKER_PR_OPENED"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
      live_pr_state: "open",
    });
    expect(checksPending.apply).toBe(true);
    const ready = transition({
      current_body: stateBody("CHECKS_PENDING"),
      source: "checks",
      requested_state: "READY_FOR_SUPERVISOR",
      live_pr_state: "open",
    });
    expect(ready.apply).toBe(true);

    const evidence = exactReservationEvidence(sha, { state: "PUBLISHED", pr_number: 849, recovery: null });
    const merged = runLifecycleReconciliation({
      action: "closed",
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: durableStateBody("CLOSED_UNMERGED") },
      ],
      liveMerged: true,
      liveState: "closed",
    });
    expect(merged.status, merged.stderr).toBe(0);
    expect(commentPatchCalls(merged.calls, 103)).toHaveLength(1);
    expect(String(merged.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `MERGED`");

    const closedAgain = transition({
      current_body: stateBody("CLOSED_UNMERGED"),
      source: "lifecycle",
      requested_state: "CLOSED_UNMERGED",
      live_pr_state: "closed",
      live_merged: false,
    });
    expect(closedAgain.apply).toBe(false);
    expect(closedAgain.code).toBe("terminal_state_preserved");

    const mergedCannotReopen = transition({
      current_body: stateBody("MERGED"),
      source: "lifecycle",
      requested_state: "WORKER_PR_OPENED",
      live_pr_state: "open",
      live_merged: false,
    });
    expect(mergedCannotReopen.apply).toBe(false);
    expect(mergedCannotReopen.code).toBe("terminal_state_preserved");
  });

  it("delayed same-head lifecycle events cannot regress READY_FOR_SUPERVISOR", () => {
    const result = transition({
      current_body: stateBody("READY_FOR_SUPERVISOR"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
    });
    expect(result.apply).toBe(false);
    expect(result.code).toBe("ready_same_head_regression");
  });

  it("old synchronize events for an old head are rejected", () => {
    const result = transition({
      current_body: stateBody("CHECKS_PENDING", otherSha),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
      requested_head: otherSha,
      live_head: sha,
    });
    expect(result.apply).toBe(false);
    expect(result.code).toBe("stale_event_head");
  });

  it("a genuinely new live head invalidates old READY state", () => {
    const result = transition({
      current_body: stateBody("READY_FOR_SUPERVISOR", otherSha),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
      requested_head: sha,
      live_head: sha,
    });
    expect(result.apply).toBe(true);
    expect(result.code).toBe("transition_allowed");
  });

  it("check evidence is exact-live-head bound and can advance current head to READY", () => {
    const stale = transition({
      source: "checks",
      requested_state: "READY_FOR_SUPERVISOR",
      requested_head: otherSha,
      live_head: sha,
    });
    expect(stale.apply).toBe(false);
    expect(stale.code).toBe("stale_event_head");

    const current = transition({
      source: "checks",
      requested_state: "READY_FOR_SUPERVISOR",
      requested_head: sha,
      live_head: sha,
    });
    expect(current.apply).toBe(true);
  });

  it("writes a durable exact-task/exact-head READY checkpoint without merge authority", () => {
    const body = runText("state-body", {
      packet: packet(),
      state: "READY_FOR_SUPERVISOR",
      reason: "All required exact-head evidence is green.",
      run_id: "1001",
      pr_number: 900,
      head_sha: sha,
    });
    expect(body).toContain(`- Ready checkpoint: \`SUP-TEST-1@${sha}\``);
    expect(body).toContain("- Merge allowed: `false`");
    expect(body).toContain("- Auto-merge allowed: `false`");

    const missingHead = spawnSync(process.execPath, [helper, "state-body"], {
      input: JSON.stringify({ packet: packet(), state: "READY_FOR_SUPERVISOR", reason: "unsafe", pr_number: 900 }),
      encoding: "utf8",
    });
    expect(missingHead.status).not.toBe(0);
  });

  it("duplicate lifecycle/check events are idempotent", () => {
    const lifecycle = transition({
      current_body: stateBody("CHECKS_PENDING"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
    });
    expect(lifecycle.apply).toBe(false);
    expect(lifecycle.code).toBe("duplicate_event");

    const checks = transition({
      current_body: stateBody("READY_FOR_SUPERVISOR"),
      source: "checks",
      requested_state: "READY_FOR_SUPERVISOR",
    });
    expect(checks.apply).toBe(false);
    expect(checks.code).toBe("duplicate_event");
  });

  it("delayed concurrent lifecycle execution converges on the newer READY state", () => {
    const first = transition({
      current_body: stateBody("CHECKS_PENDING"),
      source: "checks",
      requested_state: "READY_FOR_SUPERVISOR",
    });
    expect(first.apply).toBe(true);

    const delayed = transition({
      current_body: stateBody("READY_FOR_SUPERVISOR"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
    });
    expect(delayed.apply).toBe(false);
    expect(delayed.code).toBe("ready_same_head_regression");

    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain("concurrency:");
    expect(sync).toContain("# Compute exact-head workflow evidence again just before canonical admission.");
    expect((sync.match(/read_live_pr/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect((sync.match(/compute_evidence/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("CI/review provider availability remains governed by the existing final gate", () => {
    const handoff = source(".github/workflows/supervisor-worker-handoff.yml");
    const wakeup = source(".github/workflows/proffera-final-gate-wakeup.yml");
    expect(handoff).not.toContain("coderabbitai review");
    expect(handoff).not.toContain("Codex fallback");
    expect(wakeup).toContain("coderabbitai[bot]");
    expect(wakeup).toContain("chatgpt-codex-connector[bot]");
  });

  it("validates the actual Worker diff against allowed, forbidden, hard-blocked, and control helper paths", () => {
    expect(run("validate-changes", { packet: packet(), changed_files: ["src/features/test/a.ts", "tests/test-task.test.ts"] }).ok).toBe(true);
    expect(run("validate-changes", { packet: packet(), changed_files: ["src/features/other/a.ts"] }).code).toBe("forbidden_change");
    expect(run("validate-changes", { packet: packet(), changed_files: ["package.json"] }).code).toBe("hard_blocked_change");
    expect(run("validate-changes", { packet: packet(), changed_files: ["scripts/supervisor-worker-handoff.mjs"] }).code).toBe("hard_blocked_change");
    expect(run("validate-changes", { packet: packet(), changed_files: ["src/unrelated.ts"] }).code).toBe("out_of_scope_change");
  });

  it("accepts only a complete exact-source publication artifact", () => {
    const result = run("validate-publication", publicationInput());
    expect(result.ok).toBe(true);
    expect(result.code).toBe("publication_artifact_valid");
  });

  it("requires the normalized Task Packet and canonical scope boundary", () => {
    const input = publicationInput();
    expect(run("validate-publication", { current_source_head: input.current_source_head, expected_target_head: input.expected_target_head, expected_run_id: input.expected_run_id, artifact: input.artifact }).code).toBe("packet_invalid");
    const forbidden = { ...input, packet: packet({ base_sha: input.current_source_head, allowed_paths: ["docs/SUPERVISOR_WORKER_HANDOFF.md"], forbidden_paths: ["docs/"] }) };
    expect(run("validate-publication", forbidden).code).toBe("packet_invalid");
    const hardBlocked = publicationInput({ paths: ["package.json"] });
    expect(run("validate-publication", hardBlocked).ok).toBe(false);
  });

  it("rejects a unified diff whose result diverges from replacement bytes", () => {
    const input = publicationInput();
    const artifact = input.artifact as Record<string, unknown>;
    const divergent = String(artifact.unified_diff).replace("(publication test)", "(different diff)");
    expect(run("validate-publication", { ...input, artifact: { ...artifact, unified_diff: divergent } }).code).toBe("diff_replacement_mismatch");
  });

  it("rejects stale-head and incomplete publication artifacts", () => {
    expect(run("validate-publication", publicationInput({}, otherSha)).code).toBe("stale_source_head");
    expect(run("validate-publication", publicationInput({ artifact_set_complete: "NO" })).code).toBe("artifact_incomplete");
  });

  it("binds recovery artifacts to the exact task, run, packet, and reserved target head", () => {
    const input = publicationInput();
    const artifact = input.artifact as Record<string, unknown>;
    expect(run("validate-publication", { ...input, artifact: { ...artifact, task_id: "SUP-FORGED-1" } }).code).toBe("artifact_binding_mismatch");
    expect(run("validate-publication", { ...input, artifact: { ...artifact, run_id: "9999" } }).code).toBe("artifact_binding_mismatch");
    expect(run("validate-publication", { ...input, artifact: { ...artifact, packet_sha256: "0".repeat(64) } }).code).toBe("artifact_binding_mismatch");
    expect(run("validate-publication", { ...input, expected_target_head: otherSha }).code).toBe("target_head_mismatch");
    expect(run("validate-publication", { ...input, artifact: { ...artifact, target_head: "bad" } }).code).toBe("artifact_malformed");
    expect(source("scripts/supervisor-worker-handoff.mjs")).toContain("reconstructPublicationTargetTree");
    expect(source("scripts/supervisor-worker-handoff.mjs")).toContain("write-tree");
    expect(source("scripts/supervisor-worker-handoff.mjs")).toContain("target_tree_mismatch");
  });

  it("rejects missing or discontinuous publication chunks", () => {
    const replacements = [{
      path: "docs/SUPERVISOR_WORKER_HANDOFF.md",
      chunks: [{ number: 1, total: 2, content: "new\n" }],
    }];
    expect(run("validate-publication", publicationInput({ replacements })).code).toBe("missing_chunk");

    const discontinuous = [{
      path: "docs/SUPERVISOR_WORKER_HANDOFF.md",
      chunks: [
        { number: 1, total: 2, content: "ne" },
        { number: 3, total: 2, content: "w\n" },
      ],
    }];
    expect(run("validate-publication", publicationInput({ replacements: discontinuous })).code).toBe("missing_chunk");
  });

  it("rejects publication path-set and digest mismatches", () => {
    expect(run("validate-publication", publicationInput({ paths: ["docs/other.md"] })).code).toBe("out_of_scope_change");
    const input = publicationInput();
    const artifact = input.artifact as Record<string, unknown>;
    const manifest = structuredClone(artifact.manifest) as Array<Record<string, unknown>>;
    manifest[0].sha256 = "0".repeat(64);
    expect(run("validate-publication", { ...input, artifact: { ...artifact, manifest } }).code).toBe("digest_mismatch");

    const wrongDiffDigest = String(artifact.unified_diff).replace(String((artifact.manifest as Array<Record<string, unknown>>)[0].git_blob_sha), "2".repeat(40));
    expect(run("validate-publication", { ...input, artifact: { ...artifact, unified_diff: wrongDiffDigest } }).code).toBe("digest_mismatch");
  });

  it("rejects replacement byte and line count mismatches", () => {
    const input = publicationInput();
    const artifact = input.artifact as Record<string, unknown>;
    const byteManifest = structuredClone(artifact.manifest) as Array<Record<string, unknown>>;
    byteManifest[0].bytes = 3;
    expect(run("validate-publication", { ...input, artifact: { ...artifact, manifest: byteManifest } }).code).toBe("byte_count_mismatch");

    const lineManifest = structuredClone(artifact.manifest) as Array<Record<string, unknown>>;
    lineManifest[0].lines = 2;
    expect(run("validate-publication", { ...input, artifact: { ...artifact, manifest: lineManifest } }).code).toBe("line_count_mismatch");
  });

  it("rejects a truncated unified-diff hunk", () => {
    const input = publicationInput();
    const artifact = input.artifact as Record<string, unknown>;
    const truncated = String(artifact.unified_diff).replace("@@ -1 +1 @@", "@@ -1 +1,2 @@");
    expect(run("validate-publication", { ...input, artifact: { ...artifact, unified_diff: truncated } }).code).toBe("diff_incomplete");

    const falseDeletion = String(artifact.unified_diff).replace("+++ b/docs/SUPERVISOR_WORKER_HANDOFF.md", "+++ /dev/null");
    expect(run("validate-publication", { ...input, artifact: { ...artifact, unified_diff: falseDeletion } }).code).toBe("diff_incomplete");
  });

  it("rejects every unsupported or misordered unified-diff preamble directive", () => {
    const input = publicationInput();
    const artifact = input.artifact as Record<string, unknown>;
    const unifiedDiff = String(artifact.unified_diff);
    for (const directive of [
      "rename from z.txt",
      "rename from z.txt\nrename to docs/SUPERVISOR_WORKER_HANDOFF.md",
      "similarity index 100%",
      "dissimilarity index 80%",
      "old mode 100644\nnew mode 100755",
      "copy from z.txt\ncopy to docs/SUPERVISOR_WORKER_HANDOFF.md",
      "unsupported publication directive",
    ]) {
      const tampered = unifiedDiff.replace("\nindex ", `\n${directive}\nindex `);
      expect(tampered).not.toBe(unifiedDiff);
      expect(run("validate-publication", { ...input, artifact: { ...artifact, unified_diff: tampered } }).ok).toBe(false);
    }

    const misordered = unifiedDiff.replace(/\n(index [^\n]+)\n(--- [^\n]+)\n(\+\+\+ [^\n]+)/, "\n$2\n$1\n$3");
    expect(misordered).not.toBe(unifiedDiff);
    expect(run("validate-publication", { ...input, artifact: { ...artifact, unified_diff: misordered } }).code).toBe("diff_incomplete");
  });

  it("preserves deletion, rename, and missing-final-newline artifact semantics", () => {
    const repo = mkdtempSync(join(tmpdir(), "proffera-publication-"));
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      return result.stdout.trim();
    };
    git("init");
    git("config", "user.name", "test");
    git("config", "user.email", "test@example.invalid");
    writeFileSync(join(repo, "delete.txt"), "first\nsecond\n", "utf8");
    writeFileSync(join(repo, "rename.txt"), "renamed\n", "utf8");
    writeFileSync(join(repo, "newline.txt"), "before\n", "utf8");
    git("add", "--all");
    git("commit", "-m", "source");
    const sourceHead = git("rev-parse", "HEAD");
    git("rm", "delete.txt");
    git("mv", "rename.txt", "renamed.txt");
    writeFileSync(join(repo, "newline.txt"), "after", "utf8");
    git("commit", "-am", "target");
    const targetHead = git("rev-parse", "HEAD");
    const scopedPacket = packet({ base_sha: sourceHead, allowed_paths: ["delete.txt", "rename.txt", "renamed.txt", "newline.txt"] });
    const built = spawnSync(process.execPath, [helper, "build-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead, run_id: "9001" }),
      encoding: "utf8",
    });
    expect(built.status, built.stderr).toBe(0);
    const artifact = JSON.parse(built.stdout) as Record<string, unknown>;
    const replacements = artifact.replacements as Array<Record<string, unknown>>;
    const manifest = artifact.manifest as Array<Record<string, unknown>>;
    expect(replacements.find((entry) => entry.path === "delete.txt")).toEqual({ path: "delete.txt", deleted: true });
    expect(replacements.find((entry) => entry.path === "rename.txt")).toEqual({ path: "rename.txt", deleted: true });
    expect(manifest.find((entry) => entry.path === "delete.txt")).toMatchObject({ deleted: true, bytes: 0, lines: 0, git_blob_sha: "0".repeat(40) });
    expect(String(artifact.unified_diff)).toContain("\\ No newline at end of file");
    const validate = (candidate: Record<string, unknown>) => {
      const result = spawnSync(process.execPath, [helper, "validate-publication"], {
        cwd: repo,
        input: JSON.stringify({ packet: scopedPacket, current_source_head: sourceHead, expected_target_head: targetHead, expected_run_id: "9001", artifact: candidate }),
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout) as Record<string, unknown>;
    };
    expect(validate(artifact).ok).toBe(true);

    const deleteSection = String(artifact.unified_diff).match(/diff --git a\/delete\.txt[\s\S]*?(?=diff --git |$)/)?.[0] ?? "";
    const partialSection = deleteSection.replace("@@ -1,2 +0,0 @@\n-first\n-second\n", "@@ -1 +0,0 @@\n-first\n");
    for (const section of [
      partialSection,
      deleteSection.replace("@@ -1,2 +0,0 @@\n-first\n-second\n", "@@ -1,2 +1 @@\n first\n-second\n"),
    ]) {
      const invalid = structuredClone(artifact) as Record<string, unknown>;
      invalid.unified_diff = String(artifact.unified_diff).replace(deleteSection, section);
      expect(validate(invalid).code).toBe("diff_source_mismatch");
    }

    writeFileSync(join(repo, "delete.txt"), "single", "utf8");
    git("add", "delete.txt");
    git("commit", "-m", "newline-less source");
    const noNewlineSource = git("rev-parse", "HEAD");
    git("rm", "delete.txt");
    git("commit", "-m", "delete newline-less source");
    const noNewlineTarget = git("rev-parse", "HEAD");
    const noNewlinePacket = packet({ base_sha: noNewlineSource, allowed_paths: ["delete.txt"] });
    const noNewlineBuild = spawnSync(process.execPath, [helper, "build-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: noNewlinePacket, source_head: noNewlineSource, target_head: noNewlineTarget, run_id: "9001" }),
      encoding: "utf8",
    });
    expect(noNewlineBuild.status, noNewlineBuild.stderr).toBe(0);
  });

  it("builds exact retained zero-byte targets and preserves CRLF and a real blank line", () => {
    const repo = mkdtempSync(join(tmpdir(), "proffera-empty-target-"));
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      return result.stdout;
    };
    git("init");
    git("config", "core.autocrlf", "false");
    git("config", "user.name", "test");
    git("config", "user.email", "test@example.invalid");
    const sources = { "lf.txt": "before\n", "crlf.txt": "before\r\n", "nonewline.txt": "before", "blank.txt": "\n",
      "crlf-edit.txt": "before\r\nsuffix\r\n", "one-blank-line.txt": "before\n" };
    for (const [path, content] of Object.entries(sources)) writeFileSync(join(repo, path), content);
    git("add", "--all");
    git("commit", "-m", "source");
    const sourceHead = git("rev-parse", "HEAD").trim();
    for (const path of Object.keys(sources)) writeFileSync(join(repo, path), "");
    writeFileSync(join(repo, "crlf-edit.txt"), "after\r\nsuffix\r\n");
    writeFileSync(join(repo, "one-blank-line.txt"), "\n");
    git("commit", "-am", "target");
    const targetHead = git("rev-parse", "HEAD").trim();
    const scopedPacket = packet({ base_sha: sourceHead, allowed_paths: Object.keys(sources) });
    const built = spawnSync(process.execPath, [helper, "build-publication"], { cwd: repo, encoding: "utf8",
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead, run_id: "9001" }) });
    expect(built.status, built.stderr).toBe(0);
    const artifact = JSON.parse(built.stdout);
    expect(artifact.unified_diff).toBe(git("diff", "--full-index", "--no-renames", "--no-ext-diff", sourceHead, targetHead, "--"));
    for (const path of ["lf.txt", "crlf.txt", "nonewline.txt", "blank.txt"]) {
      expect(existsSync(join(repo, path))).toBe(true);
      expect(readFileSync(join(repo, path))).toHaveLength(0);
      expect(artifact.replacements.find((entry: { path: string }) => entry.path === path)).toEqual({ path, content: "" });
      expect(artifact.manifest.find((entry: { path: string }) => entry.path === path)).toMatchObject({
        bytes: 0, lines: 0, git_blob_sha: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
      });
    }
    expect(artifact.replacements.find((entry: { path: string }) => entry.path === "crlf-edit.txt").content).toBe("after\r\nsuffix\r\n");
    expect(artifact.replacements.find((entry: { path: string }) => entry.path === "one-blank-line.txt").content).toBe("\n");
    const validate = (candidate: unknown) => {
      const result = spawnSync(process.execPath, [helper, "validate-publication"], { cwd: repo, encoding: "utf8",
        input: JSON.stringify({ packet: scopedPacket, current_source_head: sourceHead, expected_target_head: targetHead, expected_run_id: "9001", artifact: candidate }) });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout);
    };
    expect(validate(artifact).ok).toBe(true);
    const counterfeit = structuredClone(artifact);
    counterfeit.replacements.find((entry: { path: string }) => entry.path === "lf.txt").content = "\n";
    expect(validate(counterfeit).ok).toBe(false);
  });

  it("rejects misplaced and duplicate final-newline markers", () => {
    const repo = mkdtempSync(join(tmpdir(), "proffera-newline-markers-"));
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      return result.stdout.trim();
    };
    git("init");
    git("config", "user.name", "test");
    git("config", "user.email", "test@example.invalid");
    writeFileSync(join(repo, "source-marker.txt"), "first\nsecond", "utf8");
    writeFileSync(join(repo, "target-marker.txt"), "first\nsecond\n", "utf8");
    writeFileSync(join(repo, "context-marker.txt"), "first\nmiddle\nlast", "utf8");
    git("add", "--all");
    git("commit", "-m", "source");
    const sourceHead = git("rev-parse", "HEAD");
    writeFileSync(join(repo, "source-marker.txt"), "changed\nsecond\n", "utf8");
    writeFileSync(join(repo, "target-marker.txt"), "changed\nsecond", "utf8");
    writeFileSync(join(repo, "context-marker.txt"), "changed\nmiddle\nlast", "utf8");
    git("commit", "-am", "target");
    const targetHead = git("rev-parse", "HEAD");
    const allowedPaths = ["context-marker.txt", "source-marker.txt", "target-marker.txt"];
    const scopedPacket = packet({ base_sha: sourceHead, allowed_paths: allowedPaths });
    const built = spawnSync(process.execPath, [helper, "build-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead, run_id: "9001" }),
      encoding: "utf8",
    });
    expect(built.status, built.stderr).toBe(0);
    const artifact = JSON.parse(built.stdout) as Record<string, unknown>;
    const unifiedDiff = String(artifact.unified_diff);
    const section = (path: string) => unifiedDiff.match(new RegExp(`diff --git a/${path}[\\s\\S]*?(?=diff --git |$)`))?.[0] ?? "";
    const validate = (candidateDiff: string) => {
      const result = spawnSync(process.execPath, [helper, "validate-publication"], {
        cwd: repo,
        input: JSON.stringify({
          packet: scopedPacket,
          current_source_head: sourceHead,
          expected_target_head: targetHead,
          expected_run_id: "9001",
          artifact: { ...artifact, unified_diff: candidateDiff },
        }),
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout) as Record<string, unknown>;
    };
    expect(validate(unifiedDiff).ok).toBe(true);

    const sourceSection = section("source-marker.txt");
    const sourceMarker = "\\ No newline at end of file";
    expect(sourceSection).toContain(`-first\n-second\n${sourceMarker}\n+changed\n+second\n`);
    const misplacedSource = sourceSection.replace(
      `-first\n-second\n${sourceMarker}\n`,
      `-first\n${sourceMarker}\n-second\n`,
    );

    const targetSection = section("target-marker.txt");
    expect(targetSection).toContain(`-first\n-second\n+changed\n+second\n${sourceMarker}\n`);
    const misplacedTarget = targetSection.replace(
      `+changed\n+second\n${sourceMarker}\n`,
      `+changed\n${sourceMarker}\n+second\n`,
    );

    const contextSection = section("context-marker.txt");
    expect(contextSection).toContain(` middle\n last\n${sourceMarker}\n`);
    const misplacedContext = contextSection.replace(
      ` middle\n last\n${sourceMarker}\n`,
      ` middle\n${sourceMarker}\n last\n`,
    );
    const duplicateMarker = contextSection.replace(`${sourceMarker}\n`, `${sourceMarker}\n${sourceMarker}\n`);
    const boundaryMarker = contextSection.replace(/(@@[^\n]*\n)/, `$1${sourceMarker}\n`);

    for (const [original, tampered] of [
      [sourceSection, misplacedSource],
      [targetSection, misplacedTarget],
      [contextSection, misplacedContext],
      [contextSection, duplicateMarker],
      [contextSection, boundaryMarker],
    ]) {
      expect(tampered).not.toBe(original);
      expect(validate(unifiedDiff.replace(original, tampered)).ok).toBe(false);
    }
  });

  it("preserves an untouched newline-less suffix after an earlier hunk", () => {
    const repo = mkdtempSync(join(tmpdir(), "proffera-newline-suffix-"));
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      return result.stdout.trim();
    };
    const sourceText = Array.from({ length: 10 }, (_, index) => `line-${index + 1}`).join("\n");
    const targetText = Array.from({ length: 9 }, (_, index) => `line-${index + 2}`).join("\n");
    git("init");
    git("config", "user.name", "test");
    git("config", "user.email", "test@example.invalid");
    writeFileSync(join(repo, "suffix.txt"), sourceText, "utf8");
    git("add", "suffix.txt");
    git("commit", "-m", "source");
    const sourceHead = git("rev-parse", "HEAD");
    writeFileSync(join(repo, "suffix.txt"), targetText, "utf8");
    git("commit", "-am", "target");
    const targetHead = git("rev-parse", "HEAD");
    const scopedPacket = packet({ base_sha: sourceHead, allowed_paths: ["suffix.txt"] });
    const built = spawnSync(process.execPath, [helper, "build-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead, run_id: "9001" }),
      encoding: "utf8",
    });
    expect(built.status, built.stderr).toBe(0);
    const artifact = JSON.parse(built.stdout) as Record<string, unknown>;
    const replacement = (artifact.replacements as Array<Record<string, unknown>>)[0];
    expect(replacement.content).toBe(targetText);
    const validated = spawnSync(process.execPath, [helper, "validate-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, current_source_head: sourceHead, expected_target_head: targetHead, expected_run_id: "9001", artifact }),
      encoding: "utf8",
    });
    expect(validated.status, validated.stderr).toBe(0);
    expect(JSON.parse(validated.stdout).ok).toBe(true);
  });

  it("accepts exact header-only empty-file additions and deletions", () => {
    const repo = mkdtempSync(join(tmpdir(), "proffera-empty-publication-"));
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      return result.stdout.trim();
    };
    git("init");
    git("config", "user.name", "test");
    git("config", "user.email", "test@example.invalid");
    writeFileSync(join(repo, "delete-empty.txt"), "", "utf8");
    git("add", "delete-empty.txt");
    git("commit", "-m", "source");
    const sourceHead = git("rev-parse", "HEAD");
    git("rm", "delete-empty.txt");
    writeFileSync(join(repo, "add-empty.txt"), "", "utf8");
    git("add", "add-empty.txt");
    git("commit", "-m", "target");
    const targetHead = git("rev-parse", "HEAD");
    const scopedPacket = packet({ base_sha: sourceHead, allowed_paths: ["add-empty.txt", "delete-empty.txt"] });
    const built = spawnSync(process.execPath, [helper, "build-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead, run_id: "9001" }),
      encoding: "utf8",
    });
    expect(built.status, built.stderr).toBe(0);
    const artifact = JSON.parse(built.stdout) as Record<string, unknown>;
    expect(String(artifact.unified_diff)).not.toContain("@@ ");
    const validated = spawnSync(process.execPath, [helper, "validate-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, current_source_head: sourceHead, expected_target_head: targetHead, expected_run_id: "9001", artifact }),
      encoding: "utf8",
    });
    expect(validated.status, validated.stderr).toBe(0);
    expect(JSON.parse(validated.stdout).ok).toBe(true);
  });

  it("keeps sensitive work on FULL gates and permits canonical low-risk routing", () => {
    const sensitive = ciPlan([".github/workflows/worker-supervisor-sync.yml"]);
    expect(sensitive.classification).toBe("restricted-full");
    expect(sensitive.fullCiStillRequired).toBe(true);
    expect(sensitive.proposedLanes).toEqual(["governance", "whitespace", "lint", "typecheck", "unit", "build", "e2e", "discovery-worker"]);

    const docs = ciPlan(["docs/example.md"]);
    expect(docs.classification).toBe("low-docs");
    expect(docs.fullCiStillRequired).toBe(false);

    const isolatedTest = ciPlan(["tests/example.test.ts"]);
    expect(isolatedTest.classification).toBe("low-mapped");
    expect(isolatedTest.fullCiStillRequired).toBe(false);
  });

  it("uses the existing pinned Codex action but never exposes the push credential to that action", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    expect(workflow).toContain("openai/codex-action@86365089eb2b84e0a8fb0717b304f8bdcb13b20e");
    const codexStart = workflow.indexOf("Run one bounded implementation Worker");
    const codexEnd = workflow.indexOf("Verify Worker diff", codexStart);
    const codexBlock = workflow.slice(codexStart, codexEnd);
    expect(codexBlock).toContain("OPENAI_API_KEY");
    expect(codexBlock).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
  });
});
