import {describe,it,expect} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
// @ts-expect-error Trusted control-plane .mjs helper.
import {readPending,admission,verifyArtifactMetadata,verifyHandoffManifest,resolveDecision,mayResolveExpiredArtifact} from "../scripts/supervisor-owner-push-pending.mjs";
// @ts-expect-error Trusted control-plane .mjs helper.
import {decideReviewRepairStrategyHistory} from "../scripts/supervisor-review-repair-strategy-memory.mjs";
// @ts-expect-error Trusted control-plane .mjs helper.
import {decideCiAutofixStrategyHistory,classifyCiAutofixOutcome} from "../scripts/supervisor-ci-autofix-strategy-memory.mjs";
const root=process.cwd(),repo="ibboabdoli-ai/Proffera",pr=941;
const url="https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548";
const canon=(x:unknown):string=>JSON.stringify(x,(_k,v)=>v&&typeof v==="object"&&!Array.isArray(v)?
 Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const sha=(x:string)=>createHash("sha256").update(x).digest("hex");
const bt=String.fromCharCode(96).repeat(3);
const make=(kind:string,key:string,p:unknown)=>"<!-- proffera-owner-push-"+kind+":v1:"+key+" -->\n"
 +bt+"json\n"+canon(p)+"\n"+bt;
const bot=(body:string,id=101)=>({id,issue_url:url,user:{login:"github-actions[bot]",type:"Bot"},body});
const owner=(body:string,id=211)=>({id,issue_url:url,user:{login:"ibboabdoli-ai",type:"User"},body});
function fixture(run_id=81,lane:"review_repair"|"ci_autofix"="review_repair"){
 const value={
  version:1,lane,repository:repo,pr_number:pr,branch:"work/proffera-b4-repair-safety",
  base_sha:"a".repeat(40),parent_sha:"b".repeat(40),head_sha:"c".repeat(40),
  tree_sha:"d".repeat(40),run_id,run_attempt:1,workflow_id:201,
  publish_job_id:301,model_job_id:302,validation_job_id:303,artifact_id:401,
  artifact_digest:"e".repeat(64),bundle_digest:"f".repeat(64),
  manifest_digest:"1".repeat(64),
  finding_digest:lane==="review_repair"?"2".repeat(64):null,
  observed_at:"2026-10-09T19:00:00.000Z",
 };
 const raw=make("pending",lane+":"+run_id+":1",value);
 return {value,raw,comment:bot(raw)};
}
function resolution(original=fixture(),decision:"cancelled"|"push_confirmed"="cancelled"){
 const id=sha(original.raw),kind=decision==="cancelled"?"cancel":"approve";
 const command=owner("<!-- proffera-owner-push-"+kind+":v1:"+id+" -->");
 const v={pending_digest:id,decision,owner_comment_id:command.id,
  observed_branch_sha:"b".repeat(40),observed_main_sha:"a".repeat(40),
  historical_nonpublication_proven:false,observed_at:"2026-10-09T20:00:00.000Z"};
 return {command,result:bot(make("resolution",id,v),333)};
}
describe("versioned authenticated owner-push ledger",()=>{
 it("accepts exact pending identity, consumes the attempt and blocks cross-lane admission",()=>{
  const f=fixture();const a=admission([f.comment],pr);
  expect(a.allow).toBe(false);expect(a.unresolved).toBe(1);
  expect(a.records[0]).toMatchObject({lane:"review_repair",parent_sha:f.value.parent_sha,
   head_sha:f.value.head_sha,artifact_id:401,run_id:81});
  const changed="9".repeat(40);
  expect(decideReviewRepairStrategyHistory({pr_number:pr,head:changed,
    finding_ids:["inline:8"],records:[],starts:[],pending:a.records}))
    .toMatchObject({decision:"SUPPRESS_UNRESOLVED_ATTEMPT",attempts:1});
  expect(decideCiAutofixStrategyHistory({pr_number:pr,head:changed,
    failures:[{job:"Validate",steps:["Test"]}],records:[],starts:[],pending:a.records}))
    .toMatchObject({decision:"SUPPRESS_UNRESOLVED_ATTEMPT",prior_attempts:0});
 });
 it("blocks across lanes without debiting the other lane model budget",()=>{
  const ci=fixture(99,"ci_autofix"),pending=admission([ci.comment],pr).records;
  expect(decideReviewRepairStrategyHistory({pr_number:pr,head:"5".repeat(40),
    finding_ids:["review:22"],records:[],starts:[],pending}))
    .toMatchObject({decision:"SUPPRESS_UNRESOLVED_ATTEMPT",attempts:0});
  expect(decideCiAutofixStrategyHistory({pr_number:pr,head:"5".repeat(40),
    failures:[{job:"Validate",steps:["Test"]}],records:[],starts:[],pending}))
    .toMatchObject({decision:"SUPPRESS_UNRESOLVED_ATTEMPT",prior_attempts:1});
 });
 it("replays identical pending comments idempotently and rejects conflicting duplicates",()=>{
  const f=fixture();expect(readPending([f.comment,{...f.comment,id:101}],pr)).toHaveLength(1);
  const changed={...f.value,head_sha:"8".repeat(40)};
  const duplicate=bot(make("pending","review_repair:81:1",changed),102);
  expect(()=>readPending([f.comment,duplicate],pr)).toThrow("pending_conflict");
 });
 it("rejects spoofed user or issue origin, malformed fields and ambiguous concurrent pending records",()=>{
  const f=fixture(),other=fixture(82,"ci_autofix");
  expect(admission([{...f.comment,user:{login:"attacker",type:"User"}}],pr))
   .toMatchObject({allow:true,records:[]});
  expect(admission([f.comment,{...f.comment,user:{login:"attacker",type:"User"},id:999}],pr))
   .toMatchObject({allow:false,unresolved:1});
  expect(()=>admission([{...f.comment,issue_url:url.replace("548","549")}],pr)).toThrow("comment_provenance");
  expect(()=>admission([bot(make("pending","review_repair:81:1",{...f.value,artifact_id:0}))],pr)).toThrow("pending_payload");
  expect(()=>admission([f.comment,other.comment],pr)).toThrow("multiple_unresolved");
  expect(admission([bot("historical v1 Failure Memory content")],pr)).toMatchObject({allow:true,records:[]});
 });
 it.each(["cancelled","push_confirmed"] as const)(
  "requires the exact owner action and append-only resolution for %s",decision=>{
   const f=fixture(),proof=resolution(f,decision);
   expect(admission([f.comment,proof.command,proof.result],pr)).toMatchObject({allow:true,unresolved:0});
   const staleOwner={...proof.command,id:987};
   expect(()=>readPending([f.comment,staleOwner,proof.result],pr)).toThrow("resolution_owner_provenance");
   expect(()=>readPending([f.comment,proof.result],pr)).toThrow("resolution_owner_provenance");
   expect(admission([f.comment,proof.command,proof.result,proof.result],pr).allow).toBe(true);
  });
 it("preserves consumed-attempt count after cancellation and prevents same-head repeat",()=>{
  const f=fixture(),proof=resolution(f,"cancelled");
  const rec=admission([f.comment,proof.command,proof.result],pr).records;
  expect(decideReviewRepairStrategyHistory({pr_number:pr,head:f.value.parent_sha,
   finding_ids:["review:9"],records:[],starts:[],pending:rec}))
   .toMatchObject({decision:"SUPPRESS_REPEAT",attempts:1});
  expect(decideCiAutofixStrategyHistory({pr_number:pr,head:"a".repeat(40),
   failures:[{job:"Validate",steps:["Test"]}],records:[],starts:[],pending:rec}))
   .toMatchObject({prior_attempts:0});
 });
 it("detects contradictory or replayed resolution",()=>{
  const f=fixture(),a=resolution(f,"cancelled"),b=resolution(f,"push_confirmed");
  expect(()=>readPending([f.comment,a.command,a.result,b.command,b.result],pr)).toThrow("resolution_conflict");
 });
});
describe("CI Autofix current-versus-historical accounting",()=>{
 const step=(name:string,conclusion="success")=>({name,status:"completed",conclusion});
 const current=(conclusion="success")=>[
  {name:"Bounded Codex CI autofix",status:"completed",conclusion:"success",
   steps:[step("Run one bounded Codex repair attempt"),step("Capture bounded repair candidate")]},
  {name:"Stage CI Autofix owner-push handoff (no publication)",status:"completed",conclusion,
   steps:[step("Stage CI Autofix commit for owner push"),step("Upload CI Autofix owner handoff")]}
 ];
 it("never classifies a successful staged current attempt as publication",()=>{
  expect(classifyCiAutofixOutcome({jobs:current(),published:"yes",changed:"yes"}))
   .toEqual({persist:false,reason:"authenticated_pending_record_required"});
 });
 it("persists an unknown attempt when owner-push pending recording fails",()=>{
   expect(classifyCiAutofixOutcome({jobs:current(),published:"no",changed:"yes",pending_result:"failure"}))
    .toEqual({persist:true,outcome:"unknown"});
  });
  it("fails closed if upload evidence is absent",()=>{
  const broken=current();broken[1].steps.pop();
  expect(()=>classifyCiAutofixOutcome({jobs:broken,published:"no",changed:"yes"}))
   .toThrow("unverified_handoff_upload");
 });
 it("retains an authenticated historical publication classification",()=>{
  const jobs=[current()[0],{name:"Publish CI Autofix candidate",status:"completed",conclusion:"success",
    steps:[step("Publish validated repair")]}];
  expect(classifyCiAutofixOutcome({jobs,published:"yes",changed:"yes"}))
   .toEqual({persist:true,outcome:"succeeded"});
  expect(classifyCiAutofixOutcome({jobs,published:"no",changed:"yes"}))
   .toEqual({persist:true,outcome:"succeeded"});
 });
 it("keeps current workflow wiring under existing admission and record mutex",()=>{
  const y=createRequire(import.meta.url)("js-yaml");
  for(const name of ["supervisor-review-repair.yml","proffera-ci-autofix.yml"]){
   const jobs=y.load(readFileSync(root+"/.github/workflows/"+name,"utf8")).jobs;
   const a=JSON.stringify(jobs.admit),r=JSON.stringify(jobs.record);
   expect(a).toContain("supervisor-owner-push-pending.mjs gate");
   expect(r).toContain("supervisor-owner-push-pending.mjs record");
   expect(r).toContain("steps.pending.outputs.pending != 'yes'");
   expect(jobs.publish.outputs.artifact_id).toContain("owner_artifact.outputs.artifact-id");
   expect(jobs.admit.concurrency.group).toBe(jobs.record.concurrency.group);
  }
 });
});

describe("authenticated artifact, current-state and cancellation policy",()=>{
 it("requires actual artifact ID, digest, run binding and non-expiration",()=>{
  const a={id:401,name:"ci-autofix-owner-handoff-81-1",expired:false,
   workflow_run:{id:81},digest:"sha256:"+"a".repeat(64)};
  expect(verifyArtifactMetadata([a],401,a.name,81)).toEqual(a);
  expect(()=>verifyArtifactMetadata([a],402,a.name,81)).toThrow("artifact_id");
  expect(()=>verifyArtifactMetadata([a],401,a.name,82)).toThrow("artifact_meta");
  expect(()=>verifyArtifactMetadata([{...a,expired:true}],401,a.name,81)).toThrow("artifact_meta");
  expect(()=>verifyArtifactMetadata([{...a,digest:null}],401,a.name,81)).toThrow("artifact_meta");
  expect(()=>verifyArtifactMetadata([a,{...a,id:402}],401,a.name,81)).toThrow("artifact_id");
  expect(()=>verifyArtifactMetadata([],401,a.name,81)).toThrow("artifact_id");
 });
 it("binds the manifest to exact repository, PR, branch, base, parent, HEAD/tree and attempt",()=>{
  const p=fixture().value;
  const m={state:"OWNER_PUSH_REQUIRED",published:false,repository:repo,
   pr_number:pr,branch:p.branch,base_sha:p.base_sha,parent_sha:p.parent_sha,
   head_sha:p.head_sha,tree_sha:p.tree_sha,run_id:p.run_id,
   run_attempt:p.run_attempt,finding_set_sha256:p.finding_digest};
  expect(verifyHandoffManifest(p,m)).toBe(true);
  for(const bad of [
   {...m,branch:"work/proffera-other"},{...m,parent_sha:"9".repeat(40)},
   {...m,head_sha:"8".repeat(40)},{...m,tree_sha:"7".repeat(40)},
   {...m,base_sha:"6".repeat(40)},{...m,run_attempt:2},
   {...m,pr_number:942},{...m,state:"PUBLISHED"},{...m,published:true},
   {...m,finding_set_sha256:"1".repeat(64)},{...m,unexpected:"extra"},
  ])expect(()=>verifyHandoffManifest(p,bad)).toThrow();
 });
 it("confirms owner push on verified branch or main ancestry",()=>{
  const head="c".repeat(40),base={kind:"approve",branch:head,proposed:head,
   onBranch:true,onMain:false,deployments:[],knownCommit:true};
  expect(resolveDecision(base)).toBe("push_confirmed");
  expect(resolveDecision({...base,branch:"d".repeat(40)})).toBe("push_confirmed");
  expect(resolveDecision({...base,onMain:true})).toBe("push_confirmed");
  expect(()=>resolveDecision({...base,onBranch:false,onMain:false})).toThrow("push_proof");
 });
 it("allows exact owner resolution of expired archives only after retention with trusted metadata",()=>{
  const p=fixture().value;
  const after=Date.parse(p.observed_at)+8*24*60*60*1000;
  const before=Date.parse(p.observed_at)+6*24*60*60*1000;
  const artifact={id:p.artifact_id,name:"supervisor-review-repair-owner-handoff-81-1",
   workflow_run:{id:p.run_id},digest:"sha256:"+p.artifact_digest,expired:true};
  expect(mayResolveExpiredArtifact(p,[],true,after)).toBe(true);
  expect(mayResolveExpiredArtifact(p,[],true,before)).toBe(false);
  expect(mayResolveExpiredArtifact(p,[],false,after)).toBe(false);
  expect(mayResolveExpiredArtifact(p,[artifact],true,after)).toBe(true);
  expect(()=>mayResolveExpiredArtifact(p,[{...artifact,expired:false}],true,after))
   .toThrow("expired_artifact_identity");
  expect(()=>mayResolveExpiredArtifact(p,[{...artifact,digest:"sha256:"+"9".repeat(64)}],true,after))
   .toThrow("expired_artifact_identity");
  expect(()=>mayResolveExpiredArtifact(p,[artifact,{...artifact,id:999}],true,after))
   .toThrow("expired_artifact_collision");
 }); it("permits current non-publication cancellation but never claims historical absence",()=>{
  const base={kind:"cancel",branch:"b".repeat(40),proposed:"c".repeat(40),
   onBranch:false,onMain:false,deployments:[],knownCommit:false};
  expect(resolveDecision(base)).toBe("cancelled");
  expect(()=>resolveDecision({...base,onBranch:true})).toThrow("reachable_commit");
  expect(()=>resolveDecision({...base,onMain:true})).toThrow("reachable_commit");
  expect(()=>resolveDecision({...base,deployments:[{id:9}]})).toThrow("deployment_evidence");
  expect(()=>resolveDecision({...base,knownCommit:true})).toThrow("historical_publication_ambiguous");
  expect(()=>resolveDecision({...base,knownCommit:null})).toThrow("historical_publication_ambiguous");
 });
});
