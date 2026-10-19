import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Isolate the real authenticated admission branch from the CLI entrypoint.
// Calls to GitHub and the durable memory adapter are explicitly faked: this
// tests dispatch identity and failure ordering, not live GitHub persistence.
function runAdmission(mode: "PUBLISHED" | "RECOVERABLE" | "STALE_HEAD" | "MISSING_START") {
  const source = readFileSync(resolve(process.cwd(), "scripts/supervisor-worker-handoff.mjs"), "utf8");
  const start = source.indexOf('  if (mode === "worker-pr-admit") {');
  const end = source.indexOf('  if (mode === "reservation-acquire" || mode === "retarget-pr-reconcile"', start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const branch = source.slice(start, end).replaceAll(
    'await import("./supervisor-worker-strategy-memory.mjs")',
    'await Promise.resolve({workerStrategyDescriptor: () => ({evidence_fingerprint: "E", strategy_fingerprint: "S"})})',
  );
  const harness = String.raw`
const mode = "worker-pr-admit";
const parsed = {repository:"ibboabdoli-ai/Proffera",run_id:777,mutex:"owned",pr_number:941};
const head = "a".repeat(40), base = "b".repeat(40);
const TRUSTED_SUPERVISOR_ACTOR = "ibboabdoli-ai";
let saved;
const assertControlIdentity = () => true;
const assertReservationMutex = (input) => {
  if (input.run_id !== 777 || input.mutex !== "owned") throw Error("wrong mutex run identity");
};
const workerReservationIO = () => ({});
const createWorkerReservationAuthority = () => ({admitPr: (input) => {
  input.beforeAdmissionPersist?.({
    packet: { task_id: "B4-TEST", base_sha: base },
    payload: { task_id: "B4-TEST", run_id: "123" },
    comments: [],
  });
  return {ok:true,task_id:"B4-TEST",head_sha:head,task_run_id:123};
}});
const retryGitHubRead = (callback) => callback();
const githubApiJson = () => ({
  state:"open",head:{sha:process.env.TEST_CASE === "STALE_HEAD" ? "c".repeat(40) : head,
    repo:{full_name:parsed.repository}},user:{login:TRUSTED_SUPERVISOR_ACTOR},body:"packet",
});
const parseTaskPacketComment = () => ({task_id:"B4-TEST",base_sha:base});
const githubAllIssueComments = () => [];
const reservationRecords = () => [{payload:{
  task_id:"B4-TEST",state:process.env.TEST_CASE === "RECOVERABLE" ? "RECOVERABLE" : "PUBLISHED",
  pr_number:941,head_sha:head,run_id:"123",
}}];
const sameReservationPacket = () => true;
const parseWorkerStrategyDispatchStarts = () => process.env.TEST_CASE === "MISSING_START" ? [] : [{
  task_id:"B4-TEST",run_id:123,run_attempt:2,head:base,
  evidence_fingerprint:"E",strategy_fingerprint:"S",
}];
const recordWorkerStrategyOutcome = async (input) => {
  saved = input;
  return {decision:"RECORDED"};
};
`;
  const tail = String.raw`
if (!saved || saved.run_id !== 777 || saved.strategy_run_id !== 123
  || saved.run_attempt !== 2 || saved.pr_number !== 941) {
  throw Error("admission did not persist original Worker attempt under lifecycle mutex");
}
`;
  const script = `${harness}\nasync function run() {\n${branch}\n}\nawait run();\n${mode === "PUBLISHED" ? tail : ""}`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8", env: {...process.env, TEST_CASE: mode},
  });
}

describe("authenticated owner-PR success recording", () => {
  it("records the original Worker attempt without replacing the current mutex run", () => {
    const result = runAdmission("PUBLISHED");
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).strategy_outcome).toBe("RECORDED");
  });

  it("never records a RECOVERABLE but unpublished handoff as succeeded", () => {
    const result = runAdmission("RECOVERABLE");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("requires exact PUBLISHED reservation provenance");
  });

  it("fails closed when original trusted dispatch-start is missing", () => {
    const result = runAdmission("MISSING_START");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("dispatch-start identity is missing or ambiguous");
  });

  it("never records success after the live PR head changes", () => {
    const result = runAdmission("STALE_HEAD");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("admitted PR identity changed");
  });
});

// Exercise the real recordWorkerStrategyOutcome function body with durable fake
// memory I/O; unlike the admission test, this tracks actual write count.
function runIdempotentMemoryFixture(mode: "repeat" | "conflict") {
  const source = readFileSync(resolve(process.cwd(), "scripts/supervisor-worker-handoff.mjs"), "utf8");
  const start = source.indexOf("export async function recordWorkerStrategyOutcome(input) {");
  const end = source.indexOf("export function reconcileUnboundTasks(input)", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const fn = source.slice(start,end)
    .replace("export async function", "async function")
    .replace('await import("./supervisor-worker-strategy-memory.mjs")', "await Promise.resolve(strategyStub)");
  const runner = String.raw`
const strategyStub = {
  workerStrategyDescriptor: () => ({ evidence_fingerprint:"e", strategy_fingerprint:"s" }),
  workerStrategyObservation: (v) => v,
};
let records = [];
let writes = 0;
const normalizeTaskPacket = p => p;
const assertReservationMutex = x => { if(x.mutex !== "owned") throw Error("lost mutex"); };
const githubAllIssueComments = () => [];
const workerFailureMemorySnapshots = async () => ({
  failure: {
    memoryIdentity:x => JSON.stringify(x.memory),
    mergeObservation:(current, expected, v) => ({comment_id:8,memory:{records:[{
      action_id:"worker_codex_attempt", outcome:v.outcome, pr_number:v.pr_number,
      evidence_fingerprint:"e", strategy_fingerprint:"s",
      observations:[{head:v.packet.base_sha,source:{kind:"actions",run_id:v.run_id,attempt:v.run_attempt}}],
    }]}}),
    serializeMemory:mem => JSON.stringify(mem),
    readTrustedMemory:() => ({comment_id:8,memory:{records}}),
  },
  current:{comment_id:8,memory:{records}},
});
const patchControlRecord = (input,id,body) => { writes++; records=JSON.parse(body).records; };
const githubApiJson = () => {throw Error("unexpected create");};
${fn}
const packet={task_id:"B4-TEST",base_sha:"b".repeat(40)};
const base={repository:"ibboabdoli-ai/Proffera",packet,outcome:"succeeded",run_id:777,
  strategy_run_id:123,run_attempt:2,pr_number:941,mutex:"owned"};
const first=await recordWorkerStrategyOutcome({...base,observed_at:"2099-01-01T00:00:00.000Z"});
const next=await recordWorkerStrategyOutcome({...base,observed_at:"2099-01-02T00:00:00.000Z"});
const third=await recordWorkerStrategyOutcome({...base,observed_at:"2099-01-03T00:00:00.000Z"});
if(first.decision!=="RECORDED"||next.decision!=="ALREADY_RECORDED"||third.decision!=="ALREADY_RECORDED"||writes!==1)throw Error("replayed success mutated durable memory");
if(process.env.TEST_CASE === "conflict"){
  let denied=false;
  try {await recordWorkerStrategyOutcome({...base,pr_number:942,observed_at:"2099-01-04T00:00:00.000Z"});}
  catch(e){denied=String(e).includes("conflicts with a durable outcome");}
  if(!denied||writes!==1)throw Error("conflicting PR was not rejected without write");
}
console.log(JSON.stringify({writes,first:first.decision,next:next.decision,third:third.decision}));
`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", runner], {
    encoding: "utf8", env: {...process.env, TEST_CASE:mode},
  });
}

describe("durable Worker strategy memory idempotency", () => {
  it.each(["repeat", "conflict"] as const)("handles %s without an extra write", mode => {
    const result = runIdempotentMemoryFixture(mode);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).writes).toBe(1);
  });
});
