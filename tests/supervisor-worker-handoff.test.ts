import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

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
  const filters = [...script.matchAll(/\bjq\b[^\n]*?'([^']+)'/g)].map((match) => match[1]);
  expect(filters.length).toBeGreaterThan(0);
  for (const filter of filters) {
    const variables = [...new Set([...filter.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]))];
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
  liveHead?: string;
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
    state: "RESERVED",
    task_id: parsedPacket.task_id,
    run_id: "9001",
    branch: parsedPacket.branch,
    head_sha: head,
    graph_path: parsedPacket.graph_path,
    allowed_paths: parsedPacket.allowed_paths,
    packet_digest: createHash("sha256").update(normalizedPacket).digest("hex"),
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
          + "- State: `RESERVED`\n"
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

function runReservationEnforcement({
  body = packetComment(),
  comments = [],
  eventAction = "synchronize",
  eventActor = "ibboabdoli-ai",
  liveHead = sha,
  eventHead = liveHead,
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
  writeFileSync(stateFile, JSON.stringify({ comments }));
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
if (args[0] !== "api" || !endpoint) {
  process.stderr.write("unexpected gh call: " + JSON.stringify(args) + "\\n");
  process.exit(2);
}
if (method !== "GET") {
  const bodyArg = args.find((arg) => arg.startsWith("body="));
  const commentMatch = endpoint.match(/issues\\/comments\\/(\\d+)$/);
  if (method === "PATCH" && bodyArg && commentMatch) {
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
  process.stdout.write(process.env.GH_STUB_PR_JSON + "\\n");
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

  const livePr = {
    state: liveState,
    merged: liveMerged,
    head: {
      sha: liveHead,
      ref: "work/proffera-test-task",
      repo: { full_name: "ibboabdoli-ai/Proffera" },
    },
    user: { login: "ibboabdoli-ai" },
    body,
  };
  const result = spawnSync("bash", ["-c", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      GH_TOKEN: "test-token",
      GH_STUB_LOG: log,
      GH_STUB_STATE_FILE: stateFile,
      GH_STUB_PR_JSON: JSON.stringify(livePr),
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
  const finalState = JSON.parse(readFileSync(stateFile, "utf8")) as { comments: Array<Record<string, unknown>> };
  return { ...result, calls, comments: finalState.comments };
}

function runReservationRecovery({ branchExists = true }: { branchExists?: boolean } = {}) {
  const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
  const script = workflowRunStep(workflow, "Release or recover reservation on dispatch failure");
  const root = mkdtempSync(join(tmpdir(), "proffera-reservation-recovery-"));
  const bin = join(root, "bin");
  const runnerTemp = join(root, "runner");
  const trusted = join(runnerTemp, "proffera-trusted-control");
  const log = join(root, "gh-calls.jsonl");
  const stateFile = join(root, "gh-state.json");
  mkdirSync(bin, { recursive: true });
  mkdirSync(trusted, { recursive: true });
  copyFileSync(helper, join(trusted, "supervisor-worker-handoff.mjs"));
  const parsed = spawnSync(process.execPath, [helper, "parse"], { input: packetComment(), encoding: "utf8" });
  expect(parsed.status, parsed.stderr).toBe(0);
  const normalizedPacket = parsed.stdout.replace(/\n+$/, "");
  const evidence = exactReservationEvidence();
  writeFileSync(log, "");
  writeFileSync(stateFile, JSON.stringify({ branchExists, comments: [evidence.comments[0]], pulls: [] }));
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
  process.stdout.write(JSON.stringify(comment) + "\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/pulls?state=open&base=main&per_page=100") {
  for (const pull of state.pulls) process.stdout.write(JSON.stringify(pull) + "\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/git/ref/heads/work/proffera-test-task") {
  if (!state.branchExists) process.exit(1);
  process.stdout.write('{"ref":"refs/heads/work/proffera-test-task"}\\n');
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
      TASK_ID: "SUP-TEST-1",
      BRANCH: "work/proffera-test-task",
      RUN_ID: "9001",
      PACKET_B64: Buffer.from(normalizedPacket).toString("base64"),
      ARTIFACT_UPLOADED: "false",
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

function runSlotReservation({
  reservation,
  extraComments = [],
  pulls = [],
  branches = [],
  runStatus = "completed",
  changedReservationBody = false,
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
  writeFileSync(stateFile, JSON.stringify({ branches, changedReservationBody, comments, mutex: "", pulls, runStatus }));
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
  comment.body = field("body");
  save();
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (method === "POST" && endpoint.endsWith("/issues/548/comments")) {
  state.comments.push({ id: 999, user: { login: "github-actions[bot]" }, body: field("body") });
  save();
  process.stdout.write("999\\n");
  process.exit(0);
}
if (method !== "GET") process.exit(2);
if (endpoint.includes("/labels/proffera-worker-slot-reservation-mutex-v1")) {
  if (!state.mutex) process.exit(1);
  process.stdout.write(state.mutex + "\\n");
  process.exit(0);
}
if (endpoint.endsWith("/git/ref/heads/main")) {
  process.stdout.write(process.env.GH_STUB_MAIN_SHA + "\\n");
  process.exit(0);
}
if (endpoint.endsWith("/issues/548")) {
  process.stdout.write('{"labels":[{"name":"worker-dispatch-enabled"}]}\\n');
  process.exit(0);
}
if (endpoint.endsWith("/issues/548/comments?per_page=100")) {
  for (const comment of state.comments) process.stdout.write(JSON.stringify(comment) + "\\n");
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
  for (const path of pull?.files ?? []) process.stdout.write(path + "\\n");
  process.exit(0);
}
const runMatch = endpoint.match(/actions\\/runs\\/(\\d+)$/);
if (runMatch) {
  process.stdout.write(state.runStatus + "\\n");
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
      EVENT_COMMENT_BODY: packetComment(newPacket),
      EVENT_ACTOR: "ibboabdoli-ai",
      EVENT_ISSUE_NUMBER: "548",
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
  const trusted = join(root, "proffera-trusted-control");
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
  comments: Array<Record<string, unknown>>;
  eventHead?: string;
  liveHead?: string;
  liveMerged?: boolean;
  liveState?: string;
  stepName?: string;
};

function runSyncCheckReconciliation({
  action = "synchronize",
  comments,
  eventHead = sha,
  liveHead = sha,
  liveMerged = false,
  liveState = "closed",
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
  writeFileSync(stateFile, JSON.stringify({ comments }));
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
if (args[0] !== "api" || !endpoint) process.exit(2);
if (method !== "GET") {
  const bodyArg = args.find((arg) => arg.startsWith("body="));
  const commentMatch = endpoint.match(/issues\\/comments\\/(\\d+)$/);
  if (method === "PATCH" && bodyArg && commentMatch) {
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
  process.stdout.write(process.env.GH_STUB_PR_JSON + "\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/issues/548/comments?per_page=100") {
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

  const pr = {
    state: liveState,
    merged: liveMerged,
    user: { login: "ibboabdoli-ai" },
    head: { repo: { full_name: "ibboabdoli-ai/Proffera" }, ref: "work/proffera-test-task", sha: liveHead },
    body: packetComment(),
  };
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
  const trusted = join(root, "proffera-trusted-control");
  const trustedHelper = join(trusted, "supervisor-worker-handoff.mjs");
  const manifest = join(trusted, "supervisor-worker-handoff.sha256");
  const log = join(root, "gh-calls.jsonl");
  mkdirSync(bin, { recursive: true });
  mkdirSync(trusted, { recursive: true });
  copyFileSync(helper, trustedHelper);
  const helperDigest = createHash("sha256").update(readFileSync(trustedHelper)).digest("hex");
  writeFileSync(manifest, `${helperDigest}  ${trustedHelper}\n`);
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.GH_STUB_LOG, JSON.stringify(args) + "\\n");
const methodIndex = args.indexOf("--method");
const method = methodIndex >= 0 ? args[methodIndex + 1] : "GET";
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
if (args[0] !== "api" || !endpoint) process.exit(2);
if (method === "PATCH" && endpoint === "repos/ibboabdoli-ai/Proffera/issues/comments/99") {
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (method !== "GET") process.exit(2);
if (endpoint === "repos/ibboabdoli-ai/Proffera/pulls/900") {
  process.stdout.write(JSON.stringify({ state: "open", merged: false, head: { sha: process.env.GH_STUB_HEAD } }) + "\\n");
  process.exit(0);
}
if (endpoint === "repos/ibboabdoli-ai/Proffera/issues/comments/99") {
  process.stdout.write(process.env.GH_STUB_STATE_BODY + "\\n");
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
      GH_STUB_HEAD: sha,
      GH_STUB_STATE_BODY: currentBody,
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
  const sourceContent = spawnSync("git", ["show", `${sourceHead}:${path}`], { encoding: "utf8" }).stdout;
  const [oldLine, ...rest] = sourceContent.split("\n");
  const newLine = `${oldLine} (publication test)`;
  const content = [newLine, ...rest].join("\n");
  const oldBytes = Buffer.from(sourceContent, "utf8");
  const bytes = Buffer.from(content, "utf8");
  const oldBlobSha = createHash("sha1").update(`blob ${oldBytes.length}\0`).update(oldBytes).digest("hex");
  const gitBlobSha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  return {
    packet: packet({ base_sha: sourceHead, allowed_paths: [path], forbidden_paths: ["src/features/other/"] }),
    current_source_head: currentSourceHead ?? sourceHead,
    artifact: {
      source_head: sourceHead,
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
    "- PR: #900",
    `- Head: \`${headSha}\``,
  ].join("\n");
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

describe("Supervisor ↔ Worker Phase-1 handoff", () => {
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

  it("keeps event ingress lanes separate while task-state writers share one branch lane", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain("proffera-worker-supervisor-sync-${{ github.event_name }}-");
    expect(sync.match(/group: proffera-worker-task-state-\$\{\{ needs\.resolve_worker_mutation_lane\.outputs\.branch \}\}/g)).toHaveLength(2);
    expect(sync).toContain("cancel-in-progress: false");
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
    writeFileSync(join(bin, "node"), "#!/bin/sh\nexit 42\n", { encoding: "utf8", mode: 0o755 });

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

  it("materializes an immutable helper before Codex and never executes the Worker checkout helper afterward", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const materialize = workflow.indexOf("Materialize immutable trusted handoff helper outside Worker workspace");
    const codex = workflow.indexOf("Run one bounded implementation Worker");
    const postWorker = workflow.slice(workflow.indexOf("Verify Worker diff", codex));
    expect(materialize).toBeGreaterThan(0);
    expect(materialize).toBeLessThan(codex);
    expect(workflow.slice(materialize, codex)).toContain("$RUNNER_TEMP/proffera-trusted-control");
    expect(workflow.slice(materialize, codex)).toContain("sha256sum --check --status");
    expect(postWorker).not.toContain('helper="scripts/supervisor-worker-handoff.mjs"');
    expect(postWorker).toContain('helper="$RUNNER_TEMP/proffera-trusted-control/supervisor-worker-handoff.mjs"');
    expect(postWorker).toContain("sha256sum --check --status");
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
    const trustedDir = join(runnerTemp, "proffera-trusted-control");
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
    expect(verifyScript).toContain('helper="$RUNNER_TEMP/proffera-trusted-control/supervisor-worker-handoff.mjs"');
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
    expect(sync).toContain("State body is missing the exact readiness checkpoint");
    expect(sync).toContain("exit 1");
  });

  it("authenticates reservation release and reclaims only verified expired reservations", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const closeStep = workflowRunStep(workflow, "Require exact durable reservation before accepting Worker PR");
    expectShellAndJqSyntax(closeStep);
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
    expect(workflow).toContain("lease_expires_at");
    expect(workflow).toContain('run_status" = "completed"');
    expect(workflow).toContain('open_pr_count" -eq 0');
    expect(workflow).toContain("reservation changed during stale-run reclamation");
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
    const result = runReservationEnforcement(evidence);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("is bound to durable reservation SUP-TEST-1@");
    expect(result.stdout).not.toContain("leaving it unchanged");
    expect(prPatchCalls(result.calls)).toHaveLength(0);
  });

  it("promotes an exact recoverable reservation when its trusted PR appears", () => {
    const evidence = exactReservationEvidence(sha, {
      state: "RECOVERABLE",
      pr_number: null,
      recovery: { kind: "branch", expires_at: "2099-01-01T00:00:00Z" },
    });
    const result = runReservationEnforcement(evidence);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Promoted exact recoverable reservation SUP-TEST-1@");
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
      comments: evidence.comments,
      eventHead: otherSha,
      liveHead: otherSha,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Advanced published reservation SUP-TEST-1 to trusted repair head ${otherSha}`);
    expect(prPatchCalls(result.calls)).toHaveLength(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    const reservation = result.comments.find((comment) => comment.id === 101);
    const payloadBase64 = String(reservation?.body ?? "").match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    expect(JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"))).toMatchObject({
      state: "PUBLISHED",
      pr_number: 849,
      head_sha: otherSha,
      recovery: null,
    });
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
      });
      const terminal = result.comments.find((comment) => comment.id === 103);
      expect(String(terminal?.body)).toContain(liveMerged ? "- State: `MERGED`" : "- State: `CLOSED_UNMERGED`");
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
    const evidence = exactReservationEvidence();
    const result = runReservationEnforcement({
      body: evidence.body,
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("MERGED") },
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
    const taskState = { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING") };
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
      expect(result.calls.filter((args) => args.includes("--method"))).toHaveLength(0);
    }
  });

  it("makes a replacing check job converge a trusted closed PR", () => {
    const evidence = exactReservationEvidence();
    const result = runSyncCheckReconciliation({
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING") },
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
    const evidence = exactReservationEvidence();
    const first = runSyncCheckReconciliation({
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING") },
      ],
    });
    expect(first.status, first.stderr).toBe(0);
    const second = runSyncCheckReconciliation({ comments: first.comments });
    expect(second.status, second.stderr).toBe(0);
    expect(commentPatchCalls(second.calls, 101)).toHaveLength(0);
    expect(commentPatchCalls(second.calls, 103)).toHaveLength(0);
  });

  it("makes a check replacement reject invalid or stale close provenance without mutation", () => {
    const evidence = exactReservationEvidence();
    const taskState = { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING") };
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
      expect(result.calls.filter((args) => args.includes("--method"))).toHaveLength(0);
    }
  });

  it("keeps terminal task state monotonic in convergent check close reconciliation", () => {
    const evidence = exactReservationEvidence();
    const result = runSyncCheckReconciliation({
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("MERGED") },
      ],
    });
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 101)).toHaveLength(1);
    expect(commentPatchCalls(result.calls, 103)).toHaveLength(0);
    expect(String(result.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `MERGED`");
  });

  it("converges a live closed PR before rejecting stale workflow-run evidence", () => {
    const liveHead = otherSha;
    const evidence = exactReservationEvidence(liveHead);
    const result = runSyncCheckReconciliation({
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING", liveHead) },
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
      comments: [{ id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING", otherSha) }],
      eventHead: sha,
      liveHead: otherSha,
      liveState: "open",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Workflow completion is stale for open PR #849");
    expect(result.calls.filter((args) => args.includes("--method"))).toHaveLength(0);
  });

  it("converges live-closed synchronize and ready-for-review lifecycle replacements", () => {
    for (const action of ["synchronize", "ready_for_review"]) {
      const liveHead = otherSha;
      const evidence = exactReservationEvidence(liveHead);
      const result = runLifecycleReconciliation({
        action,
        comments: [
          ...evidence.comments,
          { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING", liveHead) },
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
          { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING", otherSha) },
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
      });
    }
  });

  it("makes repeated live-closed lifecycle replacement idempotent", () => {
    const evidence = exactReservationEvidence();
    const first = runLifecycleReconciliation({
      action: "synchronize",
      comments: [
        ...evidence.comments,
        { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING") },
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

  it("rejects invalid lifecycle close provenance without mutation", () => {
    const evidence = exactReservationEvidence();
    const taskState = { id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING") };
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
      expect(result.calls.filter((args) => args.includes("--method"))).toHaveLength(0);
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
    expect(stale.calls.filter((args) => args.includes("--method"))).toHaveLength(0);

    const current = runLifecycleReconciliation({
      action: "synchronize",
      comments: [{ id: 103, user: { login: "github-actions[bot]" }, body: stateBody("WORKER_PR_OPENED") }],
      liveState: "open",
    });
    expect(current.status, current.stderr).toBe(0);
    expect(commentPatchCalls(current.calls, 103)).toHaveLength(1);
    expect(String(current.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `CHECKS_PENDING`");
  });

  it("preserves the normal exact-head check-evidence path for an open PR", () => {
    const result = runSyncCheckReconciliation({
      comments: [{ id: 103, user: { login: "github-actions[bot]" }, body: stateBody("CHECKS_PENDING") }],
      liveState: "open",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(commentPatchCalls(result.calls, 103)).toHaveLength(1);
    expect(String(result.comments.find((comment) => comment.id === 103)?.body)).toContain("- State: `READY_FOR_SUPERVISOR`");
  });

  it("binds reservation publication and recovery to trusted live PR identity", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const enforcement = workflowRunStep(workflow, "Require exact durable reservation before accepting Worker PR");
    const publish = workflowRunStep(workflow, "Mark reservation published");
    const recovery = workflowRunStep(workflow, "Release or recover reservation on dispatch failure");
    expect(enforcement).toContain('live_author" = "${REPOSITORY%%/*}');
    expect(enforcement).toContain('live_head_repository" = "$REPOSITORY');
    expect(enforcement).toContain('state" != "PUBLISHED" ] || [ "$reserved_pr" = "$PR_NUMBER');
    expect(publish).toContain('test "$(jq -r \'.state\' <<< "$payload")" = "RESERVED"');
    expect(publish).toContain('test "$(jq -r \'.state\' <<< "$pr")" = "open"');
    expect(recovery).toContain('.head.sha == $head');
    expect(recovery).toContain('.head.repo.full_name == $repo');
    expect(recovery).toContain('.user.login == $owner');
  });

  it("keeps uploaded fallback evidence recoverable and expires it before artifact deletion", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const recovery = workflowRunStep(workflow, "Release or recover reservation on dispatch failure");
    expect(workflow).toContain("id: recovery_upload");
    expect(recovery).toContain('ARTIFACT_UPLOADED" = "true"');
    expect(recovery).toContain("date -u -d '+6 days'");
    expect(workflow).toContain('.recovery.expires_at // ""');
    expect(workflow).toContain("retryable:true");
    expect(workflow).toContain("retention-days: 7");
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

  it("rejects a third durable unit before Worker execution and keeps the task retryable", () => {
    const activeReservation = (id: number) => ({
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

  it("admits a disjoint second reservation and rejects declared overlap before Worker execution", () => {
    const existing = {
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

  it("reclaims an expired branch recovery only after live absence checks", () => {
    const recoverable = (expiresAt: string) => ({
      state: "RECOVERABLE",
      task_id: "SUP-OLD-SLOT-1",
      run_id: "7001",
      branch: "work/proffera-old-slot",
      head_sha: otherSha,
      graph_path: "feature/old-slot",
      packet_digest: "c".repeat(64),
      allowed_paths: ["src/features/old-slot/"],
      changed_files: [],
      pr_number: null,
      recovery: { kind: "branch", expires_at: expiresAt },
    });
    const expired = recoverable("2000-01-01T00:00:00Z");
    const released = runSlotReservation({ reservation: expired });
    expect(released.status, released.stderr).toBe(0);
    expect(commentPatchCalls(released.calls, 201)).toHaveLength(1);
    const releasedPayloadBase64 = String(released.comments.find((comment) => comment.id === 201)?.body ?? "")
      .match(/^- Reservation payload: `([^`]*)`$/m)?.[1] ?? "";
    expect(JSON.parse(Buffer.from(releasedPayloadBase64, "base64").toString("utf8"))).toMatchObject({
      state: "RELEASED",
      recovery: { kind: "expired_reservation", verified_run_status: "completed", retryable: true },
    });

    const openPull = {
      number: 830,
      base: { ref: "main" },
      head: { ref: "work/proffera-old-slot", sha: otherSha, repo: { full_name: "ibboabdoli-ai/Proffera" } },
      user: { login: "ibboabdoli-ai" },
      body: [
        "Task ID: SUP-OLD-SLOT-1",
        "Graph path: feature/old-slot",
        'Allowed paths: ["src/features/old-slot/"]',
      ].join("\n"),
      files: [],
    };
    for (const { expectedStatus, ...options } of [
      { reservation: recoverable("2099-01-01T00:00:00Z"), expectedStatus: 0 },
      { reservation: expired, branches: ["work/proffera-old-slot"], expectedStatus: 0 },
      { reservation: expired, pulls: [openPull], expectedStatus: 1 },
      { reservation: expired, changedReservationBody: true, expectedStatus: 1 },
    ]) {
      const retained = runSlotReservation(options);
      expect(retained.status, retained.stderr).toBe(expectedStatus);
      expect(commentPatchCalls(retained.calls, 201)).toHaveLength(0);
    }
  });

  it("counts a promoted recovery PR and its published reservation as one slot", () => {
    const reservation = {
      state: "PUBLISHED",
      task_id: "SUP-OLD-SLOT-1",
      run_id: "7001",
      branch: "work/proffera-old-slot",
      head_sha: otherSha,
      graph_path: "feature/old-slot",
      packet_digest: "c".repeat(64),
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
      body: [
        "Task ID: SUP-OLD-SLOT-1",
        "Graph path: feature/old-slot",
        'Allowed paths: ["src/features/old-slot/"]',
      ].join("\n"),
      files: [],
    };
    const result = runSlotReservation({ reservation, pulls: [openPull] });
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
      state: "RECOVERABLE",
      task_id: "SUP-OLD-SLOT-1",
      run_id: "7001",
      branch: "work/proffera-old-slot",
      head_sha: otherSha,
      graph_path: "feature/old-slot",
      packet_digest: createHash("sha256").update(normalizedPacket).digest("hex"),
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
    expect(exact.stdout).toContain("Exact trusted recovery PR #830 represents recoverable reservation");
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
  }, 20_000);

  it("applies the helper-approved WORKER_PR_OPENED task-state transition", () => {
    const result = runWorkerPrStateRecord(stateBody("TASK_CREATED"));
    expect(result.status, result.stderr).toBe(0);
    const patches = taskStatePatchCalls(result.calls);
    expect(patches).toHaveLength(1);
    expect(patches[0].join("\n")).toContain("- State: `WORKER_PR_OPENED`");
  });

  it("does not write a WORKER_PR_OPENED state when the helper refuses the transition", () => {
    const result = runWorkerPrStateRecord(stateBody("MERGED"));
    expect(result.status, result.stderr).toBe(0);
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
    expect(workflow).toContain("group: proffera-supervisor-worker-handoff-${{ github.event.issue.number || github.run_id }}");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("format('untrusted-pr-{0}', github.event.pull_request.number)");
    expect(workflow).toContain("group: proffera-worker-task-state-${{ needs.preflight.outputs.branch }}");
    expect(sync.match(/group: proffera-worker-task-state-\$\{\{ needs\.resolve_worker_mutation_lane\.outputs\.branch \}\}/g)).toHaveLength(2);
    const syncPrHeader = sync.slice(sync.indexOf("  sync-pr-event:"), sync.indexOf("    runs-on:", sync.indexOf("  sync-pr-event:")));
    expect(syncPrHeader).toContain("github.event.action != 'closed'");
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
    expect(sync).toContain("Re-fetch live PR and current state immediately before mutation");
    expect(sync).toContain("Re-fetch both live PR and latest workflow evidence immediately before mutation");
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
    expect(run("validate-publication", { current_source_head: input.current_source_head, artifact: input.artifact }).code).toBe("packet_invalid");
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
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead }),
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
        input: JSON.stringify({ packet: scopedPacket, current_source_head: sourceHead, artifact: candidate }),
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
      input: JSON.stringify({ packet: noNewlinePacket, source_head: noNewlineSource, target_head: noNewlineTarget }),
      encoding: "utf8",
    });
    expect(noNewlineBuild.status, noNewlineBuild.stderr).toBe(0);
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
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead }),
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
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead }),
      encoding: "utf8",
    });
    expect(built.status, built.stderr).toBe(0);
    const artifact = JSON.parse(built.stdout) as Record<string, unknown>;
    const replacement = (artifact.replacements as Array<Record<string, unknown>>)[0];
    expect(replacement.content).toBe(targetText);
    const validated = spawnSync(process.execPath, [helper, "validate-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, current_source_head: sourceHead, artifact }),
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
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead }),
      encoding: "utf8",
    });
    expect(built.status, built.stderr).toBe(0);
    const artifact = JSON.parse(built.stdout) as Record<string, unknown>;
    expect(String(artifact.unified_diff)).not.toContain("@@ ");
    const validated = spawnSync(process.execPath, [helper, "validate-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, current_source_head: sourceHead, artifact }),
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
