import {describe,expect,it} from "vitest";
import {createHash} from "node:crypto";
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {spawnSync} from "node:child_process";
// @ts-expect-error Canonical control-plane helper is an untyped .mjs module.
import {exclusiveReservationDecision} from "../scripts/supervisor-b4-exclusive-reservation.mjs";
// @ts-expect-error Canonical CI Autofix strategy helper is an untyped .mjs module.
import {classifyCiAutofixOutcome} from "../scripts/supervisor-ci-autofix-strategy-memory.mjs";
// @ts-expect-error Canonical Review Repair strategy helper is an untyped .mjs module.
import {reviewRepairStagedUploadEvidence} from "../scripts/supervisor-review-repair-strategy-memory.mjs";

const repository="ibboabdoli-ai/Proffera";
const pr=941, head="a".repeat(40), otherHead="c".repeat(40);
const digest="b".repeat(64);
const canonical=(x:Record<string,unknown>)=>
  JSON.stringify(Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))));
const bot=(body:string,id:number)=>({id,body,user:{login:"github-actions[bot]",type:"Bot"},
  issue_url:"https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548"});
type Lane="ci_autofix"|"review_repair";
const start=(lane:Lane,run_id:number,scope=pr,startHead=head)=>{
  const payload=lane==="ci_autofix"?{
    evidence_fingerprint:digest,failure_digest:digest,head:startHead,pr_number:scope,
    run_attempt:1,run_id,source_run_attempt:1,source_run_id:run_id+1000,
    strategy_fingerprint:digest
  }:{
    evidence_fingerprint:digest,finding_digest:digest,head:startHead,pr_number:scope,
    run_attempt:1,run_id,strategy_fingerprint:digest
  };
  const prefix=lane==="ci_autofix"?"ci-autofix":"review-repair";
  return bot("<!-- proffera-"+prefix+"-start:v1:"+scope+":"+run_id+":1 -->\n"+
    "```json\n"+canonical(payload)+"\n```",run_id+4000);
};
const check=(lane:Lane,phase:"admit"|"model",comments:ReturnType<typeof bot>[],
  run_id=101,run_attempt=1,headValue=head)=>
  exclusiveReservationDecision({repository,pr_number:pr,comments,lane,phase,
    run_id,run_attempt,head:headValue});

const issue="https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548";
const sha256=(value:string)=>createHash("sha256").update(value).digest("hex");
const ledgerBody=(kind:string,key:string,payload:Record<string,unknown>)=>
  "<!-- proffera-owner-push-"+kind+":v1:"+key+" -->\n```json\n"+canonical(payload)+"\n```";
function stagedRetired(lane:Lane,oldRun=101){
  const v={version:1,lane,repository,pr_number:pr,branch:"work/proffera-test",
    base_sha:"a".repeat(40),parent_sha:head,head_sha:"e".repeat(40),
    tree_sha:"f".repeat(40),run_id:oldRun,run_attempt:1,workflow_id:33,
    publish_job_id:44,model_job_id:45,validation_job_id:46,artifact_id:47,
    artifact_digest:digest,bundle_digest:digest,manifest_digest:digest,
    finding_digest:lane==="review_repair"?digest:null,observed_at:"2026-10-17T12:00:00Z"};
  const stage=bot(ledgerBody("staged",lane+":"+oldRun+":1",v),6001);
  const stageDigest=sha256(stage.body);
  const retireOwner={id:6002,body:"<!-- proffera-owner-push-retire:v1:"+stageDigest+" -->",
    user:{login:"ibboabdoli-ai",type:"User"},issue_url:issue};
  const retirePayload={stage_digest:stageDigest,owner_comment_id:6002,pr_number:pr,
    observed_branch_sha:head,observed_main_sha:"b".repeat(40),observed_at:"2026-10-17T13:00:00Z"};
  const retirement=bot(ledgerBody("retirement",stageDigest,retirePayload),6003);
  const retirementDigest=sha256(retirement.body);
  return {stage,retireOwner,retirement,retirementDigest,v};
}
function reentryProof(retirementDigest:string,lane:Lane,run=202,attempt=1,headValue=head){
  const action={id:7001,body:"<!-- proffera-owner-push-reentry:v1:"+retirementDigest+":"+
    lane+":"+run+":"+attempt+":"+headValue+" -->",
    issue_url:issue,user:{login:"ibboabdoli-ai",type:"User"}};
  const claim=bot(ledgerBody("reentry-claim",retirementDigest,{
    retirement_digest:retirementDigest,owner_comment_id:action.id,pr_number:pr,
    lane,run_id:run,run_attempt:attempt,head:headValue,
    observed_at:"2026-10-17T14:00:00Z"}),7002);
  return {action,claim};
}

describe("authenticated staged handoff Retirement and one-shot re-entry races",()=>{
  it.each([["ci_autofix","review_repair"],["review_repair","ci_autofix"]] as const)(
    "%s retirement releases historical reservation, but %s needs its exact owner claim",(oldLane,newLane)=>{
      const evidence=stagedRetired(oldLane),old=start(oldLane,101);
      const staged=[old,evidence.stage];
      expect(check(newLane,"admit",staged,202).allow).toBe(false);
      const retired=[...staged,evidence.retireOwner,evidence.retirement];
      expect(check(newLane,"admit",retired,202)).toMatchObject({allow:false,
        reason:"owner_retired_hold",ci_unresolved:0,review_unresolved:0});
      const {action,claim}=reentryProof(evidence.retirementDigest,newLane);
      const authorized=[...retired,action,claim];
      expect(check(newLane,"admit",authorized,202).allow).toBe(true);
      expect(check(newLane,"admit",authorized,203).allow).toBe(false);
      expect(check(oldLane,"admit",authorized,202).allow).toBe(false);
      expect(check(newLane,"admit",authorized,202,2).allow).toBe(false);
      expect(check(newLane,"admit",authorized,202,1,otherHead).allow).toBe(false);
      const started=[...authorized,start(newLane,202)];
      expect(check(newLane,"model",started,202).allow).toBe(true);
      expect(check(oldLane,"model",started,101).allow).toBe(false);
      expect(check(newLane,"model",[...started,start(oldLane,303)],202).allow).toBe(false);
      expect(check(oldLane,"model",[...started,start(oldLane,303)],303).allow).toBe(false);
    });
  it("rejects missing Stage, spoofed owner, late Pending and competing claims",()=>{
    const f=stagedRetired("review_repair"),fresh=reentryProof(f.retirementDigest,"ci_autofix");
    const seed=[start("review_repair",101),f.stage];
    expect(()=>check("ci_autofix","admit",[f.retireOwner,f.retirement],202)).toThrow("retirement_missing_stage");
    expect(()=>check("ci_autofix","admit",[...seed,{...f.retireOwner,
      user:{login:"attacker",type:"User"}},f.retirement],202)).toThrow("retirement_owner_provenance");
    expect(()=>check("ci_autofix","admit",[...seed,f.retireOwner,f.retirement,fresh.claim],202))
      .toThrow("reentry_owner_provenance");
    expect(()=>check("ci_autofix","admit",[...seed,f.retireOwner,f.retirement,fresh.action,
      fresh.claim,bot(ledgerBody("pending","review_repair:101:1",f.v),8001)],202))
      .toThrow("retirement_late_pending");
    const conflict=reentryProof(f.retirementDigest,"ci_autofix",203);
    expect(()=>check("ci_autofix","admit",[...seed,f.retireOwner,f.retirement,fresh.action,
      fresh.claim,conflict.action,{...conflict.claim,id:8002}],202)).toThrow("reentry_claim_conflict");
    expect(()=>check("ci_autofix","admit",[...seed,f.retireOwner,f.retirement,fresh.action,
      fresh.claim,{...fresh.claim,body:fresh.claim.body.replace('"head":"'+head+'"',
        '"head":"'+otherHead+'"'),id:8003}],202)).toThrow();
  });
  it("rejects duplicate legacy and attempt-keyed claims for the same Run/Attempt",()=>{
    const f=stagedRetired("review_repair"),fresh=reentryProof(f.retirementDigest,"ci_autofix");
    const duplicate=bot(fresh.claim.body.replace(
      "reentry-claim:v1:"+f.retirementDigest+" -->",
      "reentry-claim:v1:"+f.retirementDigest+":202:1 -->"),8004);
    const proof=[start("review_repair",101),f.stage,f.retireOwner,f.retirement,
      fresh.action,fresh.claim,duplicate];
    expect(()=>check("ci_autofix","admit",proof,202)).toThrow("reentry_duplicate_claim");
  });
  it("a Claim without its Start does not launch a model and cannot be reused",()=>{
    const f=stagedRetired("ci_autofix"),c=reentryProof(f.retirementDigest,"review_repair");
    const proof=[start("ci_autofix",101),f.stage,f.retireOwner,f.retirement,c.action,c.claim];
    // Crash after the claim write but before the new Start must not launch anything.
    expect(check("review_repair","model",proof,202).allow).toBe(false);
    expect(check("review_repair","admit",proof,203).allow).toBe(false);
    expect(check("ci_autofix","admit",proof,303).allow).toBe(false);
  });
});

describe("B4 cross-workflow durable model reservation",()=>{
  it.each([
    ["ci_autofix","review_repair"],
    ["review_repair","ci_autofix"]
  ] as const)("blocks %s -> %s interleaving before the first lane records", (first,second)=>{
    expect(check(first,"admit",[]).allow).toBe(true);
    const active=[start(first,101)];
    expect(check(second,"admit",active,202)).toMatchObject({allow:false,
      reason:"other_or_missing_active_reservation"});
    expect(check(first,"model",active).allow).toBe(true);
    expect(check(second,"model",active,202).allow).toBe(false);
    // Both admission jobs may have finished already on a pre-fix workflow.
    // A second authenticated start must not permit either Codex action.
    const concurrent=[...active,start(second,202)];
    expect(check(first,"model",concurrent).allow).toBe(false);
    expect(check(second,"model",concurrent,202).allow).toBe(false);
  });
  it.each(["ci_autofix","review_repair"] as const)(
    "releases an authenticated %s pre-model recovery without a model side effect", lane=>{
      const source=start(lane,101);
      const other=lane==="ci_autofix"?"review_repair":"ci_autofix";
      const restored=lane==="ci_autofix"?{
        evidence_fingerprint:digest,failure_digest:digest,head,pr_number:pr,
        reason:"model_not_launched",recovered_by_run_attempt:1,recovered_by_run_id:303,
        run_attempt:1,run_id:101,source_run_attempt:1,source_run_id:1101,
        strategy_fingerprint:digest
      }:{
        evidence_fingerprint:digest,finding_digest:digest,head,pr_number:pr,
        reason:"model_not_launched",recovered_by_run_attempt:1,recovered_by_run_id:303,
        run_attempt:1,run_id:101,strategy_fingerprint:digest
      };
      const prefix=lane==="ci_autofix"?"ci-autofix":"review-repair";
      const nl=String.fromCharCode(10);
      const recovery=bot("<!-- proffera-"+prefix+"-recovery:v1:"+pr+":101:1 -->"+nl+
        "```json"+nl+canonical(restored)+nl+"```",4501);
      expect(check(other,"admit",[source]).allow).toBe(false);
      expect(check(other,"admit",[source,recovery],202).allow).toBe(true);
    });
  it("a proven staged CI handoff with a failed pending write cannot release the other lane",()=>{
    const completed=(name:string)=>({name,status:"completed",conclusion:"success"});
    const plan=classifyCiAutofixOutcome({pending_result:"failure",jobs:[
      {name:"Bounded Codex CI autofix",status:"completed",conclusion:"success",
        steps:[completed("Run one bounded Codex repair attempt")]},
      {name:"Stage CI Autofix owner-push handoff (no publication)",
        status:"completed",conclusion:"success",steps:[completed("Upload CI Autofix owner handoff")]},
    ]});
    expect(plan).toEqual({persist:false,reason:"staged_handoff_pending_unrecorded"});
    // The workflow's output gate persists a terminal only for persist=true.
    // No terminal or pending marker exists here, so the authenticated start
    // must remain unresolved and continue to block both phases cross-lane.
    const owned=[start("ci_autofix",101)];
    expect(check("review_repair","admit",owned,202)).toMatchObject({allow:false,
      reason:"other_or_missing_active_reservation"});
    expect(check("review_repair","model",[...owned,start("review_repair",202)],202).allow).toBe(false);
  });
  it.each(["failure","cancelled"] as const)(
    "both lanes retain exact reservation when the %s staging job had already uploaded",conclusion=>{
      const success=(name:string)=>({name,status:"completed",conclusion:"success"});
      const ciJobs=[{name:"Bounded Codex CI autofix",status:"completed",conclusion:"success",
        steps:[success("Run one bounded Codex repair attempt")]},
      {name:"Stage CI Autofix owner-push handoff (no publication)",status:"completed",conclusion,
        steps:[success("Upload CI Autofix owner handoff")]}];
      const ci=classifyCiAutofixOutcome({jobs:ciJobs,pending_result:conclusion});
      expect(ci).toEqual({persist:false,reason:"staged_handoff_pending_unrecorded"});
      const review=reviewRepairStagedUploadEvidence({jobs:[{
        name:"Stage Review Repair owner-push handoff (no publication)",
        status:"completed",conclusion,steps:[success("Upload Review Repair owner handoff")]
      }]});
      expect(review).toEqual({uploaded:true});
      // CI's actual classifier and Review Repair's actual workflow proof helper
      // must not authorize a terminal/memory write. With only the authenticated
      // original start retained, the opposite lane cannot admit or launch.
      for(const [first,second] of [["ci_autofix","review_repair"],["review_repair","ci_autofix"]] as const){
        const original=[start(first,101)];
        expect(check(second,"admit",original,202).allow).toBe(false);
        expect(check(second,"model",[...original,start(second,202)],202).allow).toBe(false);
      }
    });
  it.each(["cancelled_upload","missing_stage"] as const)(
    "both lanes block sibling admission when handoff evidence is %s",reason=>{
      const completed=(name:string,conclusion="success")=>({name,status:"completed",conclusion});
      const ciModel={name:"Bounded Codex CI autofix",status:"completed",conclusion:"success",
        steps:[completed("Run one bounded Codex repair attempt")]};
      const ciJobs=reason==="missing_stage"?[ciModel]:[ciModel,{
        name:"Stage CI Autofix owner-push handoff (no publication)",
        status:"completed",conclusion:"cancelled",
        steps:[completed("Upload CI Autofix owner handoff","cancelled")]
      }];
      expect(classifyCiAutofixOutcome({jobs:ciJobs,pending_result:"failure"}))
        .toEqual({persist:false,reason:"staged_handoff_evidence_incomplete"});
      const reviewJobs=reason==="missing_stage"?[]:[{
        name:"Stage Review Repair owner-push handoff (no publication)",
        status:"completed",conclusion:"cancelled",
        steps:[completed("Upload Review Repair owner handoff","cancelled")]
      }];
      expect(reviewRepairStagedUploadEvidence({jobs:reviewJobs}))
        .toEqual({uploaded:false,uncertain:true});
      for(const [first,second] of [["ci_autofix","review_repair"],
        ["review_repair","ci_autofix"]] as const){
        const live=[start(first,101)];
        expect(check(second,"admit",live,202).allow).toBe(false);
        expect(check(second,"model",[...live,start(second,202)],202).allow).toBe(false);
      }
    });
  it("never treats missing, stale or wrong-run ownership as model permission",()=>{
    const active=[start("review_repair",101)];
    expect(check("review_repair","model",[]).allow).toBe(false);
    expect(check("review_repair","model",active,102).allow).toBe(false);
    expect(check("review_repair","model",active,101,2).allow).toBe(false);
    expect(check("review_repair","model",active,101,1,otherHead).allow).toBe(false);
    expect(check("review_repair","admit",active).allow).toBe(false);
  });
  it("ignores another PR's authenticated start but fails closed for malformed own starts",()=>{
    expect(check("ci_autofix","admit",[start("review_repair",303,942)]).allow).toBe(true);
    const corrupted=start("ci_autofix",101);
    expect(()=>check("ci_autofix","model",[{...corrupted,body:corrupted.body+"!"}]))
      .toThrow();
  });
});

// Execute the shipped shell fragment and canonical proof helpers. Only gh is
// replaced; the stub has no network path and persists authenticated fixture rows.
function crossLaneHarness(lane: Lane, scenario: string) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-cross-recovery-"));
  const ci = lane === "ci_autofix";
  const file = ci ? ".github/workflows/supervisor-review-repair.yml"
    : ".github/workflows/proffera-ci-autofix.yml";
  const workflow = readFileSync(file, "utf8");
  const begin = workflow.indexOf(ci ? "          # Retire authenticated CI Autofix"
    : "          # Reclaim only authenticated");
  const end = workflow.indexOf(ci ? "          # Recover proven historical"
    : '          decision="$(node scripts/supervisor-ci-autofix', begin);
  expect(begin).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(begin);
  const commentsFile = join(dir, "comments.json");
  writeFileSync(commentsFile, JSON.stringify([start(lane, 101)]));
  writeFileSync(join(dir, "remote.json"), JSON.stringify([start(lane, 101)]));
  const run = {id: 101, run_attempt: 1, head_sha: otherHead, head_branch: "main",
    status: scenario === "active" ? "in_progress" : "completed",
    conclusion: scenario === "active" ? null : "cancelled",
    event: ci ? "workflow_run" : "workflow_dispatch",
    name: ci ? "Proffera CI autofix" : "Supervisor review repair",
    path: ci ? ".github/workflows/proffera-ci-autofix.yml"
      : ".github/workflows/supervisor-review-repair.yml"};
  if (scenario === "wrong_run") run.id = 999;
  if (scenario === "wrong_attempt") run.run_attempt = 2;
  if (scenario === "wrong_workflow") run.path = ".github/workflows/ci.yml";
  if (scenario === "unknown_conclusion") run.conclusion = "not_a_github_conclusion";
  const jobs: Record<string, unknown>[] = [{name: ci ? "Admit one bounded CI autofix strategy"
    : "Settle review burst and admit one bounded attempt", status: "completed", conclusion: "failure"}];
  if (scenario === "ambiguous_model") jobs.push({name: ci ? "Bounded Codex CI autofix"
    : "Batch current-head review findings", status: "completed", conclusion: "failure",
    steps: [{name: ci ? "Run one bounded Codex repair attempt"
      : "Run one batched exact-head repair", status: "completed", conclusion: "cancelled"}]});
  writeFileSync(join(dir, "run.json"), JSON.stringify(run));
  writeFileSync(join(dir, "jobs.json"), JSON.stringify(jobs));
  const gh = join(dir, "gh");
  writeFileSync(gh, `#!${process.execPath}
const fs = require("node:fs"), path = require("node:path");
const dir = process.env.RUNNER_TEMP, mode = process.env.RECOVERY_SCENARIO;
const args = process.argv.slice(2), text = args.join(" ");
const rowsPath = path.join(dir, "remote.json");
const rows = () => JSON.parse(fs.readFileSync(rowsPath, "utf8"));
if (args.includes("POST")) {
  if (mode === "post_error") process.exit(1);
  const row = {id: 9001, body: args.find(x => x.startsWith("body=")).slice(5),
    user: {login: "github-actions[bot]", type: "Bot"},
    issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548"};
  fs.writeFileSync(rowsPath, JSON.stringify([...rows(), row]));
  console.log(JSON.stringify({id: row.id}));
} else if (text.includes("/jobs?")) {
  if (mode === "jobs_error") process.exit(1);
  for (const job of JSON.parse(fs.readFileSync(path.join(dir, "jobs.json"), "utf8")))
    console.log(JSON.stringify(job));
} else if (text.includes("/actions/runs/")) {
  if (mode === "run_error") process.exit(1);
  console.log(fs.readFileSync(path.join(dir, "run.json"), "utf8"));
} else if (text.includes("/issues/548/comments?")) {
  if (mode === "reload_error") process.exit(1);
  for (const row of rows()) console.log(JSON.stringify(row));
} else process.exit(99);
`);
  chmodSync(gh, 0o755);
  const script = 'comments_file="$RUNNER_TEMP/comments.json"\n'
    + 'build_input() { printf "{}"; }\nbuild_admit_input() { :; }\n'
    + workflow.slice(begin, end);
  const execute = () => spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
    encoding: "utf8", env: {...process.env, PATH: `${dir}:${dirname(process.execPath)}:${process.env.PATH}`,
      RUNNER_TEMP: dir, REPOSITORY: repository, PR_NUMBER: String(pr),
      GITHUB_RUN_ID: "303", GITHUB_RUN_ATTEMPT: "1", RECOVERY_SCENARIO: scenario},
  });
  return {execute, rows: () => JSON.parse(readFileSync(join(dir, "remote.json"), "utf8")),
    cleanup: () => rmSync(dir, {recursive: true, force: true})};
}

describe.each(["ci_autofix", "review_repair"] as const)("%s cross-lane shell recovery", lane => {
  const sibling = lane === "ci_autofix" ? "review_repair" : "ci_autofix";
  it.each(["active", "wrong_run", "wrong_attempt", "wrong_workflow", "unknown_conclusion",
    "run_error", "jobs_error", "ambiguous_model", "post_error"])(
    "retains the reservation for %s", scenario => {
      const harness = crossLaneHarness(lane, scenario);
      try {
        const result = harness.execute();
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(["wrong_run", "wrong_attempt", "wrong_workflow", "post_error"].includes(scenario) ? 1 : 0);
        expect(harness.rows()).toHaveLength(1);
        expect(check(sibling, "admit", harness.rows(), 202).allow).toBe(false);
      } finally { harness.cleanup(); }
    });
  it("fails before admission when the post-recovery reload fails", () => {
    const harness = crossLaneHarness(lane, "reload_error");
    try {
      expect(harness.execute().status).toBe(1);
      // Durable recovery can exist even when this invocation must stop.
      expect(harness.rows()).toHaveLength(2);
    } finally { harness.cleanup(); }
  });
  it("retires once, admits one owner, and rejects stale concurrent admission", () => {
    const harness = crossLaneHarness(lane, "valid");
    try {
      expect(harness.execute().status).toBe(0);
      expect(harness.rows()).toHaveLength(2);
      expect(check(sibling, "admit", harness.rows(), 202).allow).toBe(true);
      expect(harness.execute().status).toBe(0);
      expect(harness.rows()).toHaveLength(2);
      const owned = [...harness.rows(), start(sibling, 202)];
      expect(check(lane, "admit", owned, 303).allow).toBe(false);
      expect(check(sibling, "model", owned, 202).allow).toBe(true);
      const conflicting = [...owned, start(lane, 303)];
      expect(check(lane, "model", conflicting, 303).allow).toBe(false);
      expect(check(sibling, "model", conflicting, 202).allow).toBe(false);
    } finally { harness.cleanup(); }
  });
});

describe("Cross-lane orphan retirement contracts", () => {
  it.each([
    [".github/workflows/proffera-ci-autofix.yml",
      "supervisor-review-repair-strategy-memory.mjs"],
    [".github/workflows/supervisor-review-repair.yml",
      "supervisor-ci-autofix-strategy-memory.mjs"],
  ])("requires authenticated opposite-lane recovery before admission in %s", (file, helper) => {
    const workflow=readFileSync(file,"utf8");
    const admission=workflow.split(file.includes("ci-autofix")
      ? "      - name: Recover proven pre-model starts and admit exact-head CI evidence"
      : "      - name: Admit strategy history and record trusted attempt start")[1];
    expect(admission).toBeDefined();
    const unresolved=admission!.indexOf(helper+" unresolved");
    const proof=admission!.indexOf(helper+" recovery-proof");
    const body=admission!.indexOf(helper+" recovery-body");
    const post=admission!.indexOf('gh api --method POST "repos/${REPOSITORY}/issues/548/comments"',body);
    const reload=admission!.indexOf('if [ "$opposite_recovered" = yes ]; then');
    const exclusive=admission!.indexOf("supervisor-b4-exclusive-reservation.mjs admit");
    expect(unresolved).toBeGreaterThan(-1);
    expect(proof).toBeGreaterThan(unresolved);
    expect(body).toBeGreaterThan(proof);
    expect(post).toBeGreaterThan(body);
    expect(reload).toBeGreaterThan(post);
    expect(exclusive).toBeGreaterThan(reload);
    expect(admission).toContain(".recoverable");
  });
});

describe("Review Repair orphan recovery ordering",()=>{
  it("proves orphan recovery precedes the zero-finding exit",()=>{
    const workflow=readFileSync(".github/workflows/supervisor-review-repair.yml","utf8");
    const admit=workflow.split("      - name: Admit strategy history and record trusted attempt start")[1]?.split("\n  repair:")[0];
    expect(admit).toBeDefined();
    const unresolved=admit!.indexOf("supervisor-review-repair-strategy-memory.mjs unresolved");
    const proof=admit!.indexOf("supervisor-review-repair-strategy-memory.mjs recovery-proof");
    const zero=admit!.indexOf('if [ "$FINDING_COUNT" -eq 0 ]; then');
    const decision=admit!.indexOf("supervisor-review-repair-strategy-memory.mjs admit");
    expect(unresolved).toBeGreaterThan(-1);
    expect(proof).toBeGreaterThan(unresolved);
    expect(zero).toBeGreaterThan(proof);
    expect(decision).toBeGreaterThan(zero);
    expect(admit).toContain('if [ "$(jq -r');
  });
});
