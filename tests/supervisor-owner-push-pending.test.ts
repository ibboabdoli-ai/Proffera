import {describe,it,expect,vi} from "vitest";
import {spawnSync} from "node:child_process";
vi.mock("node:child_process",async(importOriginal)=>{
 const original=await importOriginal<typeof import("node:child_process")>();
 return {...original,spawnSync:vi.fn(original.spawnSync)};
});
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
// @ts-expect-error Trusted control-plane .mjs helper.
import {readPending,readOwnerHandoffLedger,admission,verifyArtifactMetadata,verifyHandoffManifest,resolveDecision,mayResolveExpiredArtifact,verifyHandoffBranch,gate,commitLookupKnown,authenticatedGitFetch,verifyRecordBranch,admittedRecordIdentity,record} from "../scripts/supervisor-owner-push-pending.mjs";
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
 it("accepts nested work/proffera branches but refuses unsafe path segments",()=>{
  const f=fixture(),nested="work/proffera-feature/subtask";
  const comment=bot(make("pending","review_repair:81:1",{...f.value,branch:nested}));
  expect(readPending([comment],pr)).toMatchObject([{branch:nested}]);
  for(const branch of ["work/proffera-feature//subtask","work/proffera-feature/../subtask",
    "work/proffera-feature/.hidden","work/proffera-feature/subtask.lock",
    "work/proffera-feature/trailing."]){
   expect(()=>readPending([bot(make("pending","review_repair:81:1",{...f.value,branch}))],pr))
    .toThrow("pending_payload");
  }
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
   expect(admission([f.comment,proof.command,proof.result],pr)).toMatchObject({allow:decision==="push_confirmed",unresolved:0});
   const staleOwner={...proof.command,id:987};
   expect(()=>readPending([f.comment,staleOwner,proof.result],pr)).toThrow("resolution_owner_provenance");
   expect(()=>readPending([f.comment,proof.result],pr)).toThrow("resolution_owner_provenance");
   expect(admission([f.comment,proof.command,proof.result,proof.result],pr).allow).toBe(decision==="push_confirmed");
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
   .toEqual({persist:false,reason:"staged_handoff_pending_unrecorded"});
 });
 it.each(["failure","cancelled","skipped"] as const)("retains staged reservation when pending record is %s",pending_result=>{
   expect(classifyCiAutofixOutcome({jobs:current(),published:"no",changed:"yes",pending_result}))
    .toEqual({persist:false,reason:"staged_handoff_pending_unrecorded"});
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
 it("grants both authenticated owner-push recorder jobs PR read without write escalation",()=>{
  type Step={run?:string};
  type Job={permissions?:Record<string,string>;steps?:Step[]};
  type Workflow={jobs:Record<string,Job>};
  const yamlLoad=createRequire(import.meta.url)("js-yaml").load as (source:string)=>Workflow;
  for(const name of ["supervisor-review-repair.yml","proffera-ci-autofix.yml"]){
   const workflow=yamlLoad(readFileSync(root+"/.github/workflows/"+name,"utf8"));
   const record=workflow.jobs.record;
   expect(record,name+": record job exists").toBeDefined();
   expect(record.steps?.some(s=>s.run?.includes("node scripts/supervisor-owner-push-pending.mjs record")),
    name+": authenticated pending recorder runs").toBe(true);
   expect(record.permissions?.["pull-requests"],name+": recorder can GET /pulls/{pr}").toBe("read");
   expect(record.permissions?.contents,name+": no source publication grant").toBe("read");
   expect(record.permissions?.issues,name+": append-only ledger writer").toBe("write");
   expect(record.permissions?.actions,name+": read CI artifact provenance").toBe("read");
  }
 });
 it("grants only deployment read access to every pending-ledger gateway and recorder",()=>{
  type Step={run?:string};
  type Job={permissions?:Record<string,string>;steps?:Step[]};
  type Workflow={jobs:Record<string,Job>};
  const yamlLoad=createRequire(import.meta.url)("js-yaml").load as (source:string)=>Workflow;
  const targets=[
   {name:"supervisor-review-repair.yml",jobNames:["admit","repair","record"]},
   {name:"proffera-ci-autofix.yml",jobNames:["admit","autofix","record"]},
  ];
  for(const {name,jobNames} of targets){
   const workflow=yamlLoad(readFileSync(root+"/.github/workflows/"+name,"utf8"));
   const callers=Object.entries(workflow.jobs)
    .filter(([,job])=>job.steps?.some(step=>
     /supervisor-owner-push-pending\.mjs (gate|record)/.test(step.run||"")))
    .map(([jobName])=>jobName).sort();
   expect(callers,name+": all live pending-ledger callers are covered").toEqual([...jobNames].sort());
   for(const jobName of jobNames){
    const permissions=workflow.jobs[jobName].permissions;
    expect(permissions?.deployments,name+":"+jobName+" may read deployments but not mutate").toBe("read");
    expect(permissions?.contents,name+":"+jobName+" retains read-only source").toBe("read");
    expect(permissions?.["pull-requests"],name+":"+jobName+" retains PR read").toBe("read");
   }
  }
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
 it("binds remote branch to exact parent/commit except on authenticated owner resolution",()=>{
  const parent="a".repeat(40),proposed="b".repeat(40),advanced="c".repeat(40);
  expect(verifyHandoffBranch(parent,parent,proposed)).toBe(true);
  expect(verifyHandoffBranch(proposed,parent,proposed)).toBe(true);
  expect(()=>verifyHandoffBranch(advanced,parent,proposed)).toThrow("remote_parent");
  expect(verifyHandoffBranch(advanced,parent,proposed,true)).toBe(true);
  expect(()=>verifyHandoffBranch("invalid",parent,proposed,true)).toThrow("remote_parent_evidence");
  expect(()=>verifyHandoffBranch(advanced,parent,proposed,"true" as unknown as boolean)).toThrow("remote_parent_evidence");
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


describe("cancelled owner-push handoff is never an automatic model-launch permit",()=>{
  it.each(["review_repair","ci_autofix"] as const)(
   "refuses the workflow admission even after a valid cancellation for %s",lane=>{
    const pending=fixture(101,lane),cancelled=resolution(pending,"cancelled");
    const decision=admission([pending.comment,cancelled.command,cancelled.result],pr);
    expect(decision).toMatchObject({allow:false,unresolved:0});
    expect(decision.records[0].resolution?.decision).toBe("cancelled");
    expect(admission([pending.comment,cancelled.command,cancelled.result],pr+1).allow).toBe(true);
  });
  // Model-launch revalidation is tested at the workflow boundary in
  // supervisor-model-launch-boundary.test.ts; repeating a saved admission
  // boolean here would pass even if the actual boundary guard were removed.
  it("keeps cancelled history closed after duplicate events and allows owner-confirmed publication",()=>{
    const pending=fixture(),cancelled=resolution(pending,"cancelled"),approved=fixture(121);
    const proof=resolution(approved,"push_confirmed");
    expect(admission([pending.comment,cancelled.command,cancelled.result,cancelled.result],pr).allow).toBe(false);
    expect(admission([approved.comment,proof.command,proof.result],pr).allow).toBe(true);
  });
  it("recognizes only request-bound absent-commit errors",()=>{
    const sha="c".repeat(40),other="d".repeat(40);
    const fail=(stderr:string,status=1)=>({status,stderr,stdout:"",error:undefined});
    expect(commitLookupKnown(fail("gh: Not Found (HTTP 404)"),sha)).toBe(false);
    expect(commitLookupKnown(fail("gh: No commit found for SHA: "+sha+" (HTTP 422)"),sha)).toBe(false);
    const githubError=(message:string,status:string)=>JSON.stringify({
      message,documentation_url:"https://docs.github.com/rest/commits/commits#get-a-commit",status
    });
    const observed422={
      status:1,stderr:"gh: No commit found for SHA: "+sha+" (HTTP 422)\n",
      stdout:githubError("No commit found for SHA: "+sha,"422"),error:undefined
    };
    expect(commitLookupKnown(observed422,sha)).toBe(false);
    expect(commitLookupKnown({...observed422,stderr:"gh: Not Found (HTTP 404)\n",
      stdout:githubError("Not Found","404")},sha)).toBe(false);
    for(const stdout of [
      githubError("No commit found for SHA: "+other,"422"),
      githubError("No commit found for SHA: "+sha,"404"),
      githubError("Validation Failed","422"),
      "  ",
      '{"message":"No commit found for SHA:',
      '[]',
      '{"message":"No commit found for SHA: '+sha+'","status":"422"}',
      githubError("No commit found for SHA: "+sha,"422")+"extra"
    ])expect(()=>commitLookupKnown({...observed422,stdout},sha))
      .toThrow("publication_lookup_ambiguous");
    for(const stderr of [
      "gh: No commit found for SHA: "+other+" (HTTP 422)","gh: Validation Failed (HTTP 422)",
      "gh: No commit found for SHA: "+sha+" (HTTP 403)","gh: Unauthorized (HTTP 401)",
      "gh: Forbidden (HTTP 403)","gh: rate limited (HTTP 429)",
      "gh: Internal Server Error (HTTP 500)","gh: Service Unavailable (HTTP 503)",
      "connection reset","gh: Not Found (HTTP 404)\ngh: some other error"
    ])expect(()=>commitLookupKnown(fail(stderr),sha)).toThrow("publication_lookup_ambiguous");
    expect(()=>commitLookupKnown(fail("gh: Not Found (HTTP 404)",1),other)).not.toThrow();
    expect(()=>commitLookupKnown({status:1,stderr:"gh: Not Found (HTTP 404)",stdout:"garbage"},sha)).toThrow("publication_lookup_ambiguous");
    expect(()=>commitLookupKnown({status:null,stderr:"gh: Not Found (HTTP 404)",error:new Error("network")},sha))
      .toThrow("publication_lookup_ambiguous");
    expect(commitLookupKnown({status:0,stderr:"",stdout:"{}",error:undefined},sha)).toBe(true);
  });
  it("checks the workflow model boundaries in both independent lanes",()=>{
    for(const [name,modelLine] of [
      [".github/workflows/supervisor-review-repair.yml","- name: Run one batched exact-head repair"],
      [".github/workflows/proffera-ci-autofix.yml","- name: Run one bounded Codex repair attempt"]
    ]){
      const source=readFileSync(name,"utf8");
      const admitGate="node scripts/supervisor-owner-push-pending.mjs gate";
      const modelGate="node .proffera-trusted-model-gate/scripts/supervisor-owner-push-pending.mjs gate";
      expect(source.indexOf(admitGate)).toBeGreaterThan(-1);
      expect(source.indexOf(modelGate)).toBeGreaterThan(source.indexOf(admitGate));
      expect(source.indexOf(modelLine)).toBeGreaterThan(source.indexOf(modelGate));
      expect(source).toContain("'.allow'");
    }
  });
});

describe("authenticated Git fetch and published-before-record handoff",()=>{
 it("uses GH_TOKEN only through an ephemeral GitHub CLI credential helper, never as a URL or stored credential",async()=>{
  const actual=await vi.importActual<typeof import("node:child_process")>("node:child_process");
  const fakeToken="redacted-test-token-not-a-secret";
  const commands:{bin:string;args:string[];env?:NodeJS.ProcessEnv}[]=[];
  vi.stubEnv("GH_TOKEN",fakeToken);
  vi.mocked(spawnSync).mockImplementation(((bin:string,args:string[],options?:{env?:NodeJS.ProcessEnv})=>{
   commands.push({bin,args,env:options?.env});
   return {status:0,stdout:"",stderr:"",error:undefined};
  }) as typeof spawnSync);
  try{
   for(const ref of ["refs/heads/main","refs/heads/work/proffera-b4-repair-safety",
    "refs/heads/work/proffera-feature/subtask","b".repeat(40)]){
    expect(authenticatedGitFetch(ref)).toBe("");
   }
   expect(commands).toHaveLength(4);
   for(const {bin,args,env} of commands){
    expect(bin).toBe("git");
    expect(args).toEqual(["-c","credential.helper=","-c","credential.helper=!gh auth git-credential",
     "fetch","--no-tags","https://github.com/ibboabdoli-ai/Proffera.git",expect.any(String)]);
    expect(args.join(" ")).not.toContain(fakeToken);
    expect(env?.GH_TOKEN).toBe(fakeToken);
    expect(env?.GIT_TERMINAL_PROMPT).toBe("0");
   }
   expect(()=>authenticatedGitFetch("refs/heads/evil")).toThrow("git_ref");
   expect(()=>authenticatedGitFetch("https://attacker.invalid/")).toThrow("git_ref");
   for(const invalid of ["refs/heads/work/proffera-feature/../subtask",
     "refs/heads/work/proffera-feature//subtask",
     "refs/heads/work/proffera-feature/.hidden"]){
    expect(()=>authenticatedGitFetch(invalid)).toThrow("git_ref");
   }
   expect(commands).toHaveLength(4);
   vi.stubEnv("GH_TOKEN","");
   expect(()=>authenticatedGitFetch("refs/heads/main")).toThrow("git_auth");
   expect(commands).toHaveLength(4);
  }finally{vi.mocked(spawnSync).mockImplementation(actual.spawnSync);vi.unstubAllEnvs();}
 });
 it("permits exact artifact head published before record, never unrelated or backward ref movement",()=>{
  const parent="b".repeat(40),candidate="c".repeat(40),other="d".repeat(40);
  for(const [initial,final] of [[parent,parent],[parent,candidate],[candidate,candidate]]){
   expect(verifyRecordBranch(initial,final,parent,candidate)).toBe(true);
  }
  for(const [initial,final] of [[candidate,parent],[parent,other],[other,candidate],[other,other]]){
   expect(()=>verifyRecordBranch(initial,final,parent,candidate)).toThrow("record_ref");
  }
  expect(()=>verifyRecordBranch("malformed",candidate,parent,candidate)).toThrow("record_ref");
 });
});
describe("trusted Git history at owner-push admission",()=>{
 it("checks out complete history without credentials in both admission workflows",()=>{
  type Step={name?:string;uses?:string;run?:string;with?:Record<string,unknown>};
  type Workflow={jobs:Record<string,{steps?:Step[]}>};
  const yamlLoad=createRequire(import.meta.url)("js-yaml").load as (s:string)=>Workflow;
  const gateLine="node scripts/supervisor-owner-push-pending.mjs gate";
  for(const path of [".github/workflows/supervisor-review-repair.yml",
                     ".github/workflows/proffera-ci-autofix.yml"]){
   const workflow=yamlLoad(readFileSync(path,"utf8"));
   const jobs=Object.values(workflow.jobs).filter(j=>j.steps?.some(s=>s.run?.includes(gateLine)));
   expect(jobs,path+": exactly one gate job").toHaveLength(1);
   const steps=jobs[0].steps||[],gateIndex=steps.findIndex(s=>s.run?.includes(gateLine));
   const checkouts=steps.slice(0,gateIndex).filter(s=>s.uses?.startsWith("actions/checkout@"));
   expect(checkouts,path+": checkout before gate").toHaveLength(1);
   expect(checkouts[0].with?.["fetch-depth"]).toBe(0);
   expect(checkouts[0].with?.["persist-credentials"]).toBe(false);
  }
 });
});

describe("admitted-attempt ownership and workflow record boundaries",()=>{
 it("binds original and rerun recorder execution to the admitted attempt only",()=>{
  const initial={GITHUB_RUN_ID:"81",GITHUB_RUN_ATTEMPT:"1",ADMITTED_RUN_ATTEMPT:"1"};
  expect(admittedRecordIdentity(initial)).toEqual({run_id:81,run_attempt:1});
  expect(admittedRecordIdentity({...initial,GITHUB_RUN_ATTEMPT:"2"}))
   .toEqual({run_id:81,run_attempt:1});
  expect(admittedRecordIdentity({...initial,GITHUB_RUN_ATTEMPT:"3",ADMITTED_RUN_ATTEMPT:"2"}))
   .toEqual({run_id:81,run_attempt:2});
 });
 it.each([undefined,"","0","-1","01","1.0","1e2","NaN","9999999999999999999999"])(
  "rejects missing or invalid admitted-attempt evidence: %s",attempt=>{
   expect(()=>admittedRecordIdentity({GITHUB_RUN_ID:"81",GITHUB_RUN_ATTEMPT:"2",
    ADMITTED_RUN_ATTEMPT:attempt})).toThrow("record_attempt_evidence");
  });
 it("requires each authenticated pending recorder to receive its admitted attempt output",()=>{
  type RecorderStep={name?:string;run?:string;env?:Record<string,string>};
  type RecorderWorkflow={jobs:{record:{steps:RecorderStep[]}}};
  const yamlLoad=createRequire(import.meta.url)("js-yaml").load as (source:string)=>unknown;
  for(const file of ["proffera-ci-autofix.yml","supervisor-review-repair.yml"]){
   const workflow=yamlLoad(readFileSync(root+"/.github/workflows/"+file,"utf8")) as RecorderWorkflow;
   const steps=workflow.jobs.record.steps;
   const pending=steps.filter(step=>step.run?.includes("supervisor-owner-push-pending.mjs record"));
   expect(pending,file).toHaveLength(1);
   expect(pending[0].env?.ADMITTED_RUN_ATTEMPT,file).toBe(
    "${{ needs.admit.outputs.admitted_run_attempt }}");
   expect(pending[0].env?.GITHUB_RUN_ATTEMPT,file+": no runner attempt override").toBeUndefined();
  }
 });
});

describe("executed owner-push pending recorder after exact owner publication",()=>{
 it.each(["parent","rerun-admitted","missing-admitted","wrong-admitted","changed-base","unauthorized-pr-identity","already-published","published-during-auth","unrelated-head","rewound-after-auth","rewound-after-fetched-tip","stage-write-error",
  "pending-write-error","pending-write-timeout-after-post","stage-write-timeout-after-post",
  "staged-conflicting-identity"] as const)(
  "records authenticated handoff without relaxing owner gate: %s",async scenario=>{
   const actual=await vi.importActual<typeof import("node:child_process")>("node:child_process");
   const p=fixture().value;
   const candidateBundle=Buffer.from("authenticated candidate bundle for record");
   const zip=Buffer.from("authenticated immutable zip");
   const lane="proffera-review-repair-owner-handoff";
   const digest=(v:Buffer)=>createHash("sha256").update(v).digest("hex");
   const manifest=Buffer.from(JSON.stringify({
    state:"OWNER_PUSH_REQUIRED",published:false,repository:repo,pr_number:pr,branch:p.branch,
    base_sha:p.base_sha,parent_sha:p.parent_sha,head_sha:p.head_sha,tree_sha:p.tree_sha,
    run_id:p.run_id,run_attempt:p.run_attempt,finding_set_sha256:p.finding_digest,
   }));
   const jobs=[
    {id:302,name:"Batch current-head review findings",status:"completed",conclusion:"success",
     steps:[{name:"Run one batched exact-head repair",status:"completed",conclusion:"success"}]},
    {id:303,name:"Validate repair without model or push credentials",status:"completed",conclusion:"success",steps:[]},
    {id:301,name:"Stage Review Repair owner-push handoff (no publication)",
     status:"completed",conclusion:"success",steps:[
      {name:"Revalidate and commit bounded repair for owner handoff",status:"completed",conclusion:"success"},
      {name:"Upload Review Repair owner handoff",status:"completed",conclusion:"success"},
     ]},
   ];
   const run={id:81,run_attempt:1,path:".github/workflows/supervisor-review-repair.yml",
    name:"Supervisor review repair",event:"workflow_dispatch",head_branch:"main",workflow_id:201};
   const marker="<!-- proffera-review-repair-start:v1:941:81:1 -->";
   const start=bot(marker+"\n"+bt+"json\n"+canon({
    head:p.parent_sha,pr_number:pr,run_id:81,run_attempt:1,
   })+"\n"+bt,130);
   const comments=[start];
   if(scenario==="staged-conflicting-identity")comments.push(bot(
    make("staged","review_repair:81:1",{
     ...p,head_sha:"9".repeat(40)
    }),131));
   const published=()=>scenario==="already-published"||scenario==="published-during-auth";
   const firstHead=scenario==="already-published"||scenario==="rewound-after-auth"?p.head_sha:
    scenario==="unrelated-head"?"9".repeat(40):p.parent_sha;
   let reads=0,posts=0,fetchHead="",parentFetched=false,fetches=0,pendingFailed=false;
   vi.stubEnv("GH_TOKEN","test-only-token-do-not-use");
   const good=(stdout:string|Buffer)=>({status:0,stdout,stderr:"",error:undefined});
   const fail=(stderr:string)=>({status:1,stdout:"",stderr,error:undefined});
   vi.mocked(spawnSync).mockImplementation(((bin:string,args:string[],opts?:{env?:NodeJS.ProcessEnv})=>{
    if(bin==="gh"&&args[0]==="api"){
     if(args[1]==="--paginate"&&args[2]==="--slurp"){
      if(args[3].includes("/issues/548/comments"))return good(JSON.stringify([comments]));
      if(args[3].includes("/jobs?"))return good(JSON.stringify([{jobs}]));
     }
     if(args[1]==="--method"&&args.includes("POST")){
      if(scenario==="stage-write-error")return fail("503 Service Unavailable");
      if(scenario==="pending-write-error" && posts===1 && !pendingFailed){
       pendingFailed=true;return fail("503 Service Unavailable");
      }
      const body=args.find(s=>s.startsWith("body="));
      if(!body)throw Error("missing record body");
      comments.push(bot(body.slice(5),300+ ++posts));
      if(scenario==="pending-write-timeout-after-post" && posts===2 && !pendingFailed){
       pendingFailed=true;return fail("504 Gateway Timeout");
      }
      if(scenario==="stage-write-timeout-after-post" && posts===1 && !pendingFailed){
       pendingFailed=true;return fail("504 Gateway Timeout");
      }
      return good(JSON.stringify({id:300+posts}));
     }
     const endpoint=args[1];
     if(endpoint==="repos/"+repo+"/pulls/"+pr){
      const current=reads++===0?firstHead:
       scenario==="rewound-after-auth"?p.parent_sha:published()?p.head_sha:p.parent_sha;
      return good(JSON.stringify({state:"open",merged:false,base:{ref:"main",sha:scenario==="changed-base"?"8".repeat(40):p.base_sha},
       head:{ref:p.branch,sha:current,repo:{full_name:repo}},user:{login:scenario==="unauthorized-pr-identity"?"untrusted-user":"ibboabdoli-ai"}}));
     }
     if(endpoint==="repos/"+repo+"/git/ref/heads/"+p.branch){
      const current=reads<=1?firstHead:
       scenario==="rewound-after-auth"?p.parent_sha:published()?p.head_sha:p.parent_sha;
      return good(JSON.stringify({object:{sha:current}}));
     }
     if(endpoint==="repos/"+repo+"/git/ref/heads/main")
      return good(JSON.stringify({object:{sha:p.base_sha}}));
     if(endpoint==="repos/"+repo+"/actions/runs/81/attempts/1")
      return good(JSON.stringify(run));
     if(endpoint==="repos/"+repo+"/actions/runs/81/attempts/2")
      return good(JSON.stringify({...run,run_attempt:2}));
     if(endpoint==="repos/"+repo+"/actions/runs/81/artifacts?per_page=100")
      return good(JSON.stringify({artifacts:[{id:401,name:"supervisor-review-repair-owner-handoff-81-1",expired:false,
       workflow_run:{id:81},digest:"sha256:"+digest(zip)}]}));
     if(endpoint==="repos/"+repo+"/actions/artifacts/401/zip")return good(zip);
    }
    if(bin==="unzip"){
     if(args[0]==="-Z1")return good([lane+".bundle",lane+".bundle.sha256",lane+".json"].join("\n")+"\n");
     if(args[0]==="-p"){
      if(args[2].endsWith(".bundle.sha256"))
       return good(Buffer.from(digest(candidateBundle)+"  "+lane+".bundle\n"));
      if(args[2].endsWith(".bundle"))return good(candidateBundle);
      if(args[2].endsWith(".json"))return good(manifest);
     }
    }
    if(bin==="git"){
     if(args.includes("fetch")){
      const ref=args.at(-1);
      if(args[0]==="-c"){
       fetches++;
       expect(opts?.env?.GH_TOKEN).toBe("test-only-token-do-not-use");
       expect(args.slice(0,7)).toEqual(["-c","credential.helper=","-c",
        "credential.helper=!gh auth git-credential","fetch","--no-tags",
        "https://github.com/ibboabdoli-ai/Proffera.git"]);
      }
      if(ref==="refs/heads/"+p.branch){
       fetchHead=scenario==="rewound-after-fetched-tip"?p.head_sha:firstHead;
       return good("");
      }
      if(ref===p.parent_sha){parentFetched=true;fetchHead=p.parent_sha;return good("");}
      if(ref==="HEAD"){fetchHead=p.head_sha;return good("");}
     }
     if(args[0]==="cat-file"&&args[2]===p.parent_sha)
      return parentFetched?good("commit\n"):fail("unfetched parent");
     if(args[0]==="bundle"&&args[1]==="verify")return parentFetched?good("verified"):fail("no parent");
     if(args[0]==="bundle"&&args[1]==="list-heads")return good(p.head_sha+" HEAD\n");
     if(args[0]==="rev-parse"){
      if(args[1]==="FETCH_HEAD")return good(fetchHead+"\n");
      if(args[1]==="FETCH_HEAD^{tree}")return good(p.tree_sha+"\n");
      if(args[1]==="FETCH_HEAD^")return good(p.parent_sha+"\n");
     }
    }
    throw Error("unexpected mock command "+bin+" "+args.join(" "));
   }) as typeof spawnSync);
   const env={LANE:"review_repair",PR_NUMBER:String(pr),HEAD_REF:p.branch,
    BASE_SHA:p.base_sha,PARENT_SHA:p.parent_sha,NEW_HEAD:p.head_sha,NEW_TREE:p.tree_sha,
    FINDINGS_SHA:p.finding_digest,ARTIFACT_ID:"401",GITHUB_RUN_ID:"81",
    GITHUB_RUN_ATTEMPT:scenario==="rerun-admitted"?"2":"1",
    ADMITTED_RUN_ATTEMPT:scenario==="missing-admitted"?undefined:scenario==="wrong-admitted"?"2":"1"};
   try{
    if(["unrelated-head","rewound-after-auth","rewound-after-fetched-tip","missing-admitted",
        "wrong-admitted","changed-base","unauthorized-pr-identity"].includes(scenario)){
     expect(()=>record(env)).toThrow(
      scenario==="unrelated-head"||scenario==="changed-base"?"stale_parent":
      scenario==="unauthorized-pr-identity"?"pr_identity":
      scenario==="missing-admitted"?"record_attempt_evidence":
      scenario==="wrong-admitted"?"artifact_id":"record_ref");
     expect(posts).toBe(0);
    }else if(scenario==="staged-conflicting-identity"){
     expect(()=>record(env)).toThrow("staged_replay");
     expect(posts).toBe(0);
    }else if(scenario==="stage-write-error"){
     expect(()=>record(env)).toThrow("command_gh");
     expect(posts).toBe(0);
     expect(readPending(comments,pr)).toEqual([]);
     expect(readOwnerHandoffLedger(comments,pr).staged).toEqual([]);
    }else{
     if(scenario==="pending-write-error"){
      expect(()=>record(env)).toThrow("command_gh");
      const frozen=readOwnerHandoffLedger(comments,pr).staged;
      expect(frozen).toHaveLength(1);
      expect(readOwnerHandoffLedger(comments,pr).pending).toHaveLength(0);
      expect(record(env)).toEqual({pending:true});
      const replay=readOwnerHandoffLedger(comments,pr);
      expect(replay.pending[0].observed_at).toBe(frozen[0].observed_at);
      expect(replay.pending[0].observed_at).not.toBeUndefined();
     }else expect(record(env)).toEqual({pending:true});
     const committedPosts=posts;
     if(scenario!=="published-during-auth"){
      expect(record(env)).toEqual({pending:true}); // same Run/Attempt replay is idempotent
      expect(posts).toBe(committedPosts);
     }
     expect(posts).toBe(2); // durable Stage then Pending
     expect(fetches).toBeGreaterThanOrEqual(2);
     const ledger=readPending(comments,pr);
     expect(ledger).toHaveLength(1);
     expect(ledger[0].head_sha).toBe(p.head_sha);
     expect(ledger[0].run_attempt).toBe(1);
     expect(ledger[0].run_id).toBe(81);
     expect(ledger[0].resolution).toBeUndefined();
     expect(admission(comments,pr)).toMatchObject({allow:false,unresolved:1});
    }
   }finally{vi.mocked(spawnSync).mockImplementation(actual.spawnSync);vi.unstubAllEnvs();}
  });
});
describe("production gate with a retained artifact and an advanced branch",()=>{
 it.each(["valid","publication-after-gate","publication-after-head-check","missing-parent","tampered-bundle","race-before-post","race-after-post","branch-moved","ambiguous-publication","merged-expired-approved","merged-retained-approved","merged-expired-cancelled","unresolved-no-owner"] as const)(
  "authenticated cancellation with retained artifact: %s",async scenario=>{
  const parentAvailable=scenario!=="missing-parent",tampered=scenario==="tampered-bundle";
  const actual=await vi.importActual<typeof import("node:child_process")>("node:child_process");
  const pending=fixture(),advanced="9".repeat(40),base=pending.value;
  const merged=scenario.startsWith("merged-");
  const expired=scenario.startsWith("merged-expired-")||scenario==="unresolved-no-owner";
  const approved=scenario.endsWith("-approved");
  const laneFile="proffera-review-repair-owner-handoff";
  const bundle=Buffer.from(tampered?"retained bundle with mismatched HEAD":"bounded retained bundle bytes");
  const zip=Buffer.from("retained artifact zip bytes");
  const digest=(x:Buffer)=>createHash("sha256").update(x).digest("hex");
  const manifest=Buffer.from(JSON.stringify({
   state:"OWNER_PUSH_REQUIRED",published:false,repository:repo,pr_number:pr,branch:base.branch,
   base_sha:base.base_sha,parent_sha:base.parent_sha,head_sha:base.head_sha,
   tree_sha:base.tree_sha,run_id:base.run_id,run_attempt:base.run_attempt,
   finding_set_sha256:base.finding_digest,
  }));
  const p={...base,artifact_digest:digest(zip),bundle_digest:digest(bundle),
   manifest_digest:digest(manifest),observed_at:expired?"2026-09-01T19:00:00.000Z":new Date().toISOString()};
  const text=make("pending","review_repair:81:1",p),key=digest(Buffer.from(text));
  const comments:ReturnType<typeof bot>[]=[bot(text),...(scenario==="unresolved-no-owner"?[]:[owner("<!-- proffera-owner-push-"+(approved?"approve":"cancel")+":v1:"+key+" -->")])];
  const steps=(...names:string[])=>names.map(name=>({name,status:"completed",conclusion:"success"}));
  const job=(name:string,id:number,names:string[])=>({name,id,status:"completed",
   conclusion:"success",steps:steps(...names)});
  const jobs=[
   job("Batch current-head review findings",302,["Run one batched exact-head repair"]),
   job("Validate repair without model or push credentials",303,[]),
   job("Stage Review Repair owner-push handoff (no publication)",301,
    ["Revalidate and commit bounded repair for owner handoff","Upload Review Repair owner handoff"]),
  ];
  const run={id:81,run_attempt:1,path:".github/workflows/supervisor-review-repair.yml",
   name:"Supervisor review repair",event:"workflow_dispatch",head_branch:"main",workflow_id:201};
  const artifact={id:401,name:"supervisor-review-repair-owner-handoff-81-1",
   workflow_run:{id:81},expired,digest:"sha256:"+digest(zip)};
  const good=(stdout:string|Buffer)=>({status:0,stdout,stderr:"",error:undefined});
  const bad=(msg:string)=>({status:1,stdout:"",stderr:msg,error:undefined});
  let fetchHead="",parentFetched=false,posts=0,revLists=0,afterGatePublication=false,artifactRequests=0;
  const fake=((bin:string,args:string[])=>{
   if(bin==="gh"&&args[0]==="api"){
    if(args[1]==="--paginate"&&args[2]==="--slurp"){
     if(args[3].includes("/issues/548/comments"))return good(JSON.stringify([comments]));
     if(args[3].includes("/jobs?"))return good(JSON.stringify([{jobs}]));
    }
    if(args[1]==="--method"&&args.includes("POST")){
     const submitted=args.find(s=>s.startsWith("body="));
     if(!submitted)throw Error("missing posted resolution");
     comments.push(bot(submitted.slice(5),333));posts++;
     return good(JSON.stringify({id:333}));
    }
    const endpoint=args[1];
    if(endpoint==="repos/"+repo+"/actions/runs/81/attempts/1")return good(JSON.stringify(run));
    if(endpoint==="repos/"+repo+"/actions/runs/81/artifacts?per_page=100"){
     artifactRequests++;return good(JSON.stringify({artifacts:[artifact]}));}
    if(endpoint==="repos/"+repo+"/actions/artifacts/401/zip"){artifactRequests++;return good(zip);}
    if(endpoint==="repos/"+repo+"/pulls/"+pr)return good(JSON.stringify({
     state:merged?"closed":"open",merged,base:{ref:"main"},head:{ref:p.branch,sha:(scenario==="branch-moved"&&revLists>=2)?"7".repeat(40):advanced,
      repo:{full_name:repo}},user:{login:"ibboabdoli-ai"},
    }));
    if(endpoint==="repos/"+repo+"/git/ref/heads/"+p.branch)
     return merged?bad("gh: Not Found (HTTP 404)"):
       good(JSON.stringify({object:{sha:(scenario==="branch-moved"&&revLists>=2)?"7".repeat(40):advanced}}));
    if(endpoint==="repos/"+repo+"/git/ref/heads/main")
     return good(JSON.stringify({object:{sha:p.base_sha}}));
    if(endpoint==="repos/"+repo+"/deployments?sha="+p.head_sha+"&per_page=100")
     return good("[]");
    if(endpoint==="repos/"+repo+"/commits/"+p.head_sha)
      return scenario==="ambiguous-publication"?bad("503 Service Unavailable"):
        scenario==="valid"?bad("gh: No commit found for SHA: "+p.head_sha+" (HTTP 422)"):bad("gh: Not Found (HTTP 404)");
   }
   if(bin==="unzip"){
    if(args[0]==="-Z1")return good([laneFile+".bundle",laneFile+".bundle.sha256",
     laneFile+".json"].join("\n")+"\n");
    if(args[0]==="-p"){
     const name=args[2];
     if(name.endsWith(".bundle.sha256"))
      return good(Buffer.from(p.bundle_digest+"  "+laneFile+".bundle\n"));
     if(name.endsWith(".bundle"))return good(bundle);
     if(name.endsWith(".json"))return good(manifest);
    }
   }
   if(bin==="git"){
    if(args.includes("fetch")){
     const ref=args.at(-1);
     if(ref==="refs/heads/"+p.branch){
      if(merged)return bad("merged PR branch was deleted");
      fetchHead=(scenario==="branch-moved"&&revLists>=2)?"7".repeat(40):advanced;return good("");}
     if(ref==="refs/heads/main"){fetchHead=p.base_sha;return good("");}
     if(ref===p.parent_sha){
      if(!parentAvailable)return bad("missing staged parent on origin");
      parentFetched=true;fetchHead=p.parent_sha;return good("");
     }
     if(ref==="HEAD"){fetchHead=p.head_sha;return good("");}
    }
    if(args[0]==="cat-file"&&args[1]==="-t"&&args[2]===p.parent_sha)
     return parentFetched?good("commit\n"):bad("missing parent");
    if(args[0]==="bundle"&&args[1]==="verify")
     return parentFetched?good("verified"):bad("missing prerequisite");
    if(args[0]==="bundle"&&args[1]==="list-heads")
     return good((tampered?"8".repeat(40):p.head_sha)+" HEAD\n");
    if(args[0]==="rev-parse"){
     if(args[1]==="FETCH_HEAD")return good(fetchHead+"\n");
     if(args[1]==="FETCH_HEAD^{tree}")return good(p.tree_sha+"\n");
     if(args[1]==="FETCH_HEAD^")return good(p.parent_sha+"\n");
    }
    if(args[0]==="rev-list"){
      revLists++;
      const published=merged||afterGatePublication||(scenario==="race-before-post"&&revLists>2)
        ||(scenario==="race-after-post"&&posts>0);
      return good(args[1]+"\n"+(published?p.head_sha+"\n":""));
     }
   }
   throw Error("unexpected mock command: "+bin+" "+args.join(" "));
  }) as typeof spawnSync;
  vi.stubEnv("GH_TOKEN","fixture-gh-token-no-secrets");
   vi.mocked(spawnSync).mockImplementation(fake);
  try{
   if(scenario==="unresolved-no-owner"){
    // Expired unresolved artifacts are not re-fetched before an owner decision.
    expect(gate({PR_NUMBER:String(pr)})).toEqual({allow:false,unresolved:1,records:1});
    expect(artifactRequests).toBe(0);
    expect(posts).toBe(0);
    expect(admission(comments,pr)).toMatchObject({allow:false,unresolved:1});
   }else if(merged){
    if(approved){
     expect(gate({PR_NUMBER:String(pr)})).toEqual({allow:false,unresolved:0,records:1});
     expect(posts).toBe(1);
     expect(admission(comments,pr).allow).toBe(true); // historic proof is not model authority
    }else{
     expect(()=>gate({PR_NUMBER:String(pr)})).toThrow("reachable_commit");
     expect(posts).toBe(0);
    }
   }else if(scenario==="valid"||scenario==="publication-after-gate"||scenario==="publication-after-head-check"){
    const first=gate({PR_NUMBER:String(pr)});
    expect(first).toEqual({allow:false,unresolved:0,records:1});
    if(scenario==="valid")expect(gate({PR_NUMBER:String(pr)})).toEqual(first);
    else {
      // Simulate owner publication after gate and after the workflow head read.
      afterGatePublication=true;
      expect(()=>gate({PR_NUMBER:String(pr)})).toThrow("reachable_commit");
    }
    expect(posts).toBe(1);
    expect(admission(comments,pr)).toMatchObject({allow:false,unresolved:0});
   }else{
    expect(()=>gate({PR_NUMBER:String(pr)})).toThrow(
     scenario==="tampered-bundle"?"bundle_ref":
      scenario==="missing-parent"?"missing staged parent":
      scenario==="branch-moved"?"cancel_state_changed":
      scenario==="ambiguous-publication"?"publication_lookup_ambiguous":"reachable_commit");
    expect(parentFetched).toBe(scenario!=="missing-parent");
    expect(posts).toBe(scenario==="race-after-post"?1:0);
    if(scenario==="race-after-post"){
      expect(admission(comments,pr).allow).toBe(false); // cancellation is never a model-launch permit
      expect(()=>gate({PR_NUMBER:String(pr)})).toThrow("reachable_commit");
      expect(posts).toBe(1);
     }else expect(admission(comments,pr).allow).toBe(false);
   }
  }finally{vi.mocked(spawnSync).mockImplementation(actual.spawnSync);vi.unstubAllEnvs();}
 });
});


describe("executed Stage -> owner retirement -> one-shot re-entry gate",()=>{
 it.each(["success","late_pending","late_publish","unknown_commit","claim_write_error",
  "safe_reissue","strategy_rejected","old_model_ran","old_run_active","old_start_late",
  "old_pending_late","old_api_uncertain","new_head_changed","cross_lane_reissue"] as const)(
  "holds the exact historical attempt and fails closed on %s",async scenario=>{
   const actual=await vi.importActual<typeof import("node:child_process")>("node:child_process");
   const f=fixture(),stage=bot(make("staged","review_repair:81:1",f.value),1300);
   const stageDigest=sha(stage.body),retire=owner("<!-- proffera-owner-push-retire:v1:"+stageDigest+" -->",1400);
   const comments:(ReturnType<typeof bot>|ReturnType<typeof owner>)[]=[stage,retire];
   const completed=(name:string)=>({name,status:"completed",conclusion:"success"});
   const jobs=[
    {id:302,name:"Batch current-head review findings",status:"completed",conclusion:"success",
     steps:[completed("Run one batched exact-head repair")]},
    {id:303,name:"Validate repair without model or push credentials",status:"completed",conclusion:"success",steps:[]},
    {id:301,name:"Stage Review Repair owner-push handoff (no publication)",status:"completed",conclusion:"success",
     steps:[completed("Revalidate and commit bounded repair for owner handoff"),
      completed("Upload Review Repair owner handoff")]},
    {id:399,name:"Record durable Review Repair attempt outcome",status:"completed",conclusion:"failure",steps:[]},
   ];
   const run={id:81,run_attempt:1,path:".github/workflows/supervisor-review-repair.yml",
    name:"Supervisor review repair",event:"workflow_dispatch",head_branch:"main",workflow_id:201,
    status:"completed",conclusion:"failure"};
   const good=(stdout:string)=>({status:0,stdout,stderr:"",error:undefined});
   const bad=(stderr:string)=>({status:1,stdout:"",stderr,error:undefined});
   let fetchHead="",posts=0,commitKnown=false,failLookup=false,oldRunStatus="in_progress";
   let currentHead=f.value.parent_sha;
   vi.stubEnv("GH_TOKEN","temporary-test-token");
   vi.mocked(spawnSync).mockImplementation(((bin:string,args:string[])=>{
    if(bin==="gh"&&args[0]==="api"){
     if(args[1]==="--paginate"&&args[2]==="--slurp"){
      if(args[3].includes("/issues/548/comments"))return good(JSON.stringify([comments]));
      if(args[3].includes("/jobs?")){
       if(args[3].includes("/runs/202/"))return good(JSON.stringify([{jobs:[{
        name:"Bounded Codex CI autofix",status:"completed",
        conclusion:scenario==="old_model_ran"?"success":"skipped",steps:[]
       }]}]));
       return good(JSON.stringify([{jobs}]));
      }
     }
     if(args[1]==="--method"&&args.includes("POST")){
      posts++;
      if(scenario==="claim_write_error"&&posts===2)return bad("503 Service Unavailable");
      const submitted=args.find(s=>s.startsWith("body="));
      if(!submitted)throw Error("POST missing body");
      comments.push(bot(submitted.slice(5),1600+posts));
      return good(JSON.stringify({id:1600+posts}));
     }
     const url=args[1];
     if(url==="repos/"+repo+"/actions/runs/81/attempts/1")return good(JSON.stringify(run));
     if(url==="repos/"+repo+"/actions/runs/202/attempts/1"){
      if(scenario==="old_api_uncertain")return bad("503 Service Unavailable");
      return good(JSON.stringify({
       ...run,id:202,run_attempt:1,status:oldRunStatus,
       conclusion:oldRunStatus==="completed"?(scenario==="strategy_rejected"?"success":"failure"):null,
       path:".github/workflows/proffera-ci-autofix.yml",name:"Proffera CI autofix",event:"workflow_run"}));
     }
     if(url==="repos/"+repo+"/pulls/"+pr)return good(JSON.stringify({
      state:"open",merged:false,user:{login:"ibboabdoli-ai"},base:{ref:"main",sha:f.value.base_sha},
      head:{ref:f.value.branch,sha:currentHead,repo:{full_name:repo}},
     }));
     if(url==="repos/"+repo+"/git/ref/heads/"+f.value.branch)
      return good(JSON.stringify({object:{sha:currentHead}}));
     if(url==="repos/"+repo+"/git/ref/heads/main")
      return good(JSON.stringify({object:{sha:f.value.base_sha}}));
     if(url==="repos/"+repo+"/deployments?sha="+f.value.head_sha+"&per_page=100")return good("[]");
     if(url==="repos/"+repo+"/commits/"+f.value.head_sha){
      if(scenario==="unknown_commit"&&failLookup)return bad("503 Service Unavailable");
      return commitKnown?good("{}"):bad("gh: No commit found for SHA: "+f.value.head_sha+" (HTTP 422)");
     }
    }
    if(bin==="git"){
     if(args.includes("fetch")){
      const ref=args.at(-1);
      fetchHead=ref==="refs/heads/main"?f.value.base_sha:currentHead;
      return good("");
     }
     if(args[0]==="rev-parse"&&args[1]==="FETCH_HEAD")return good(fetchHead+"\n");
     if(args[0]==="rev-list")return good(args[1]+"\n");
    }
    throw Error("unexpected command "+bin+" "+args.join(" "));
   }) as typeof spawnSync);
   const ctx={PR_NUMBER:String(pr)};
   const attempt={...ctx,OWNER_GATE_PHASE:"admit",LANE:"ci_autofix",GITHUB_RUN_ID:"202",
    GITHUB_RUN_ATTEMPT:"1",EXPECTED_HEAD:f.value.parent_sha};
   try{
    const first=gate(ctx);
    expect(first.allow).toBe(false);
    expect(posts).toBe(1); // independent durable Retirement, not Admission
    expect(readOwnerHandoffLedger(comments,pr).retirements).toHaveLength(1);
    const digest=readOwnerHandoffLedger(comments,pr).retirements[0].retirement_digest;
    const reentry=owner("<!-- proffera-owner-push-reentry:v1:"+digest+":ci_autofix:202:1:"+
      f.value.parent_sha+" -->",1500);
    comments.push(reentry);
    if(scenario==="late_pending")comments.push(f.comment);
    if(scenario==="late_publish")commitKnown=true;
    if(scenario==="unknown_commit")failLookup=true;
    if(["safe_reissue","strategy_rejected","old_model_ran","old_run_active","old_start_late",
      "old_pending_late","old_api_uncertain","new_head_changed","cross_lane_reissue"].includes(scenario)){
     expect(gate(attempt).allow).toBe(true); // first claim, no Start
     expect(posts).toBe(2);
     if(scenario!=="old_run_active")oldRunStatus="completed";
     if(scenario==="old_start_late")comments.push(bot(
      "<!-- proffera-ci-autofix-start:v1:941:202:1 -->",1705));
     if(scenario==="old_pending_late")comments.push(
      bot(make("pending","ci_autofix:202:1",fixture(202,"ci_autofix").value),1706));
     if(scenario==="new_head_changed")currentHead="9".repeat(40);
     const nextLane=scenario==="cross_lane_reissue"?"review_repair":"ci_autofix";
     if(scenario!=="cross_lane_reissue")comments.push(owner(
      "<!-- proffera-owner-push-reentry:v1:"+digest+":"+nextLane+":203:1:"+
       f.value.parent_sha+" -->",1501));
     const next={...attempt,LANE:nextLane,GITHUB_RUN_ID:"203"};
     if(scenario==="safe_reissue"||scenario==="strategy_rejected"){
      // A normal strategy-level suppression ends the admitted workflow with a
      // skipped model job, but cannot consume the owner's NEXT authorization.
      expect(gate(next).allow).toBe(true);
      expect(readOwnerHandoffLedger(comments,pr).claims).toHaveLength(2);
      expect(gate({...next,OWNER_GATE_PHASE:"model"}).allow).toBe(true);
      expect(posts).toBe(3);
      // New claim now owns the re-entry sequence; the earlier attempt cannot
      // launch while the new run has not conclusively ended without a model.
      expect(()=>gate({...attempt,OWNER_GATE_PHASE:"model"})).toThrow();
     }else if(scenario==="cross_lane_reissue"){
      expect(gate(next).allow).toBe(false);
      expect(posts).toBe(2);
     }else{
      expect(()=>gate(next)).toThrow();
      expect(posts).toBe(2);
     }
    }else if(scenario==="success"){
     expect(gate(attempt).allow).toBe(true);
     expect(posts).toBe(2);
     expect(gate({...attempt,OWNER_GATE_PHASE:"model"}).allow).toBe(true);
     expect(()=>gate({...attempt,GITHUB_RUN_ID:"203"})).toThrow("abandoned_run_provenance");
     expect(()=>gate({...attempt,GITHUB_RUN_ATTEMPT:"2"})).toThrow("abandoned_run_provenance");
     expect(()=>gate({...attempt,LANE:"review_repair"})).toThrow("abandoned_run_provenance");
     expect(posts).toBe(2); // one-shot claim is never replayed
    }else if(scenario==="late_pending"){
     expect(()=>gate(attempt)).toThrow("retirement_late_pending");
     expect(posts).toBe(1);
    }else if(scenario==="late_publish"){
     expect(()=>gate(attempt)).toThrow("historical_publication_ambiguous");
     expect(posts).toBe(1);
    }else if(scenario==="unknown_commit"){
     expect(()=>gate(attempt)).toThrow("publication_lookup_ambiguous");
     expect(posts).toBe(1);
    }else{
     expect(()=>gate(attempt)).toThrow();
     expect(posts).toBe(2);
     expect(readOwnerHandoffLedger(comments,pr).claims).toHaveLength(0);
     expect(admission(comments,pr,{
      lane:"ci_autofix",run_id:203,run_attempt:1,head:f.value.parent_sha}).allow).toBe(false);
    }
   }finally{vi.mocked(spawnSync).mockImplementation(actual.spawnSync);vi.unstubAllEnvs();}
  });
});
