import {createHash} from "node:crypto";
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import {readTrustedMemory} from "./supervisor-failure-memory.mjs";
const REPO="ibboabdoli-ai/Proffera", OWNER="ibboabdoli-ai", ISSUE=548;
const ISSUE_URL="https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548";
const LANES={
review_repair:{path:".github/workflows/supervisor-review-repair.yml",name:"Supervisor review repair",
event:"workflow_dispatch",model:"Batch current-head review findings",modelStep:"Run one batched exact-head repair",
validate:"Validate repair without model or push credentials",
publish:"Stage Review Repair owner-push handoff (no publication)",
handoff:"Revalidate and commit bounded repair for owner handoff",upload:"Upload Review Repair owner handoff",
prefix:"supervisor-review-repair-owner-handoff-",file:"proffera-review-repair-owner-handoff"},
ci_autofix:{path:".github/workflows/proffera-ci-autofix.yml",name:"Proffera CI autofix",
event:"workflow_run",model:"Bounded Codex CI autofix",modelStep:"Run one bounded Codex repair attempt",
validate:"Validate CI Autofix candidate",
publish:"Stage CI Autofix owner-push handoff (no publication)",
handoff:"Stage CI Autofix commit for owner push",upload:"Upload CI Autofix owner handoff",
prefix:"ci-autofix-owner-handoff-",file:"proffera-ci-autofix-owner-handoff"}};
function check(ok,code){if(!ok)throw new Error("pending:"+code);}
const pos=n=>Number.isSafeInteger(n)&&n>0;
const hex=(v,n)=>typeof v==="string"&&new RegExp("^[0-9a-f]{"+n+"}$").test(v);
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==="object"&&!Array.isArray(x)?
 Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const sha256=x=>createHash("sha256").update(x).digest("hex");
const shape=(v,keys)=>v&&typeof v==="object"&&!Array.isArray(v)
 &&Object.keys(v).sort().join("|")===keys.slice().sort().join("|");
function cmd(bin,args,opts={}){
 const r=spawnSync(bin,args,{encoding:"utf8",maxBuffer:64*1024*1024,...opts});
 check(!r.error&&r.status===0,"command_"+bin+"_"+(r.stderr||r.error||"failed"));
 return r.stdout;
}
const api=path=>JSON.parse(cmd("gh",["api",path]));
const paged=(path,key=null)=>{
 const pages=JSON.parse(cmd("gh",["api","--paginate","--slurp",path]));
 check(Array.isArray(pages)&&pages.length<=100,"api_pages");
 const records=pages.flatMap(page=>key?page?.[key]:page);
 check(records.every(x=>x&&typeof x==="object"),"api_items");
 return records;
};
const issueComments=()=>paged("repos/"+REPO+"/issues/"+ISSUE+"/comments?per_page=100");
const marker=(kind,key)=>"<!-- proffera-owner-push-"+kind+":v1:"+key+" -->";
const fence=String.fromCharCode(96).repeat(3);
const body=(kind,key,p)=>marker(kind,key)+"\n"+fence+"json\n"+canonical(p)+"\n"+fence;
function decode(c,kind){
 const r=new RegExp("^<!-- proffera-owner-push-"+kind+":v1:([0-9a-z:_-]+) -->\\n"
  +fence+"json\\n([^\\n]+)\\n"+fence+"$");
 const m=c.body.match(r);check(m,"malformed_"+kind);
 let payload;try{payload=JSON.parse(m[2]);}catch{throw new Error("pending:json");}
 check(canonical(payload)===m[2],"noncanonical");return {key:m[1],payload};
}
export function readPending(comments,pr){
 check(Array.isArray(comments)&&comments.length<=10000&&pos(pr),"comments");
 const starts=new Map(),ends=new Map();
 for(const c of comments){
  if(typeof c?.body!=="string"||!c.body.startsWith("<!-- proffera-owner-push-"))continue;
  if(c.body.startsWith("<!-- proffera-owner-push-approve:")||
     c.body.startsWith("<!-- proffera-owner-push-cancel:"))continue;
  check(c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()&&c.user?.login==="github-actions[bot]"
   &&c.user?.type==="Bot"&&pos(c.id)&&c.body.length<14000,"comment_provenance");
  if(c.body.startsWith("<!-- proffera-owner-push-pending:")){
   const {key,payload:p}=decode(c,"pending");
   const fields=["version","lane","repository","pr_number","branch","base_sha","parent_sha",
    "head_sha","tree_sha","run_id","run_attempt","workflow_id","publish_job_id","model_job_id",
    "validation_job_id","artifact_id","artifact_digest","bundle_digest","manifest_digest",
    "finding_digest","observed_at"];
   check(shape(p,fields)&&p.version===1&&p.repository===REPO&&Object.hasOwn(LANES,p.lane)
    &&pos(p.pr_number)&&/^work\/proffera-[a-zA-Z0-9._-]+$/.test(p.branch)
    &&["base_sha","parent_sha","head_sha","tree_sha"].every(k=>hex(p[k],40))
    &&["run_id","run_attempt","workflow_id","publish_job_id","model_job_id",
       "validation_job_id","artifact_id"].every(k=>pos(p[k]))
    &&["artifact_digest","bundle_digest","manifest_digest"].every(k=>hex(p[k],64))
    &&(p.finding_digest===null||hex(p.finding_digest,64))
    &&Number.isFinite(Date.parse(p.observed_at)),"pending_payload");
   check(key===p.lane+":"+p.run_id+":"+p.run_attempt,"pending_key");
   if(p.pr_number!==pr)continue;
   const old=starts.get(key);check(!old||old.body===c.body,"pending_conflict");
   if(!old)starts.set(key,{...p,body:c.body,comment_id:c.id,pending_digest:sha256(c.body)});
  }else if(c.body.startsWith("<!-- proffera-owner-push-resolution:")){
   const {key,payload:p}=decode(c,"resolution");
   check(shape(p,["pending_digest","decision","owner_comment_id","observed_branch_sha",
      "observed_main_sha","historical_nonpublication_proven","observed_at"])
    &&hex(key,64)&&key===p.pending_digest&&["cancelled","push_confirmed"].includes(p.decision)
    &&pos(p.owner_comment_id)&&hex(p.observed_branch_sha,40)&&hex(p.observed_main_sha,40)
    &&p.historical_nonpublication_proven===false&&Number.isFinite(Date.parse(p.observed_at)),"resolution_payload");
   const old=ends.get(key);check(!old||old.body===c.body,"resolution_conflict");
   if(!old)ends.set(key,{...p,body:c.body,comment_id:c.id});
  }else throw new Error("pending:unexpected_marker");
 }
 const records=[...starts.values()];
 for(const [key,v] of ends){const item=records.find(r=>r.pending_digest===key);
  if(!item)continue;
  const ownerKind=v.decision==="cancelled"?"cancel":"approve";
  const ownerComments=comments.filter(c=>c.id===v.owner_comment_id&&
    c.user?.login===OWNER&&c.user?.type==="User"&&
    c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()&&
    c.body?.trim()===marker(ownerKind,key));
  check(ownerComments.length===1,"resolution_owner_provenance");item.resolution=v;}
 check(records.filter(r=>!r.resolution).length<=1,"multiple_unresolved");
 return records;
}
export function admission(comments,pr){
 const records=readPending(comments,pr);
 return {allow:records.every(r=>!!r.resolution),
  records:records.map(({body,...r})=>r),
  unresolved:records.filter(r=>!r.resolution).length};
}
function readPR(p){
 const pr=api("repos/"+REPO+"/pulls/"+p.pr_number);
 check(pr.state==="open"&&pr.merged!==true&&pr.base.ref==="main"
  &&pr.head.ref===p.branch&&pr.head.repo.full_name===REPO&&pr.user.login===OWNER,"pr_identity");
 const branch=api("repos/"+REPO+"/git/ref/heads/"+p.branch).object.sha;
 const main=api("repos/"+REPO+"/git/ref/heads/main").object.sha;
 check(pr.head.sha===branch&&hex(main,40),"live_refs");return {pr,branch,main};
}
function trustedRun(p){
 const lane=LANES[p.lane];
 const run=api("repos/"+REPO+"/actions/runs/"+p.run_id+"/attempts/"+p.run_attempt);
 check(run.id===p.run_id&&run.run_attempt===p.run_attempt&&run.path===lane.path
  &&run.name===lane.name&&run.event===lane.event&&run.head_branch==="main"
  &&pos(run.workflow_id),"workflow_provenance");
 const jobs=paged("repos/"+REPO+"/actions/runs/"+p.run_id+"/attempts/"+p.run_attempt+"/jobs?per_page=100","jobs");
 check(jobs.length<=1000,"job_bound");
 const job=name=>{const m=jobs.filter(j=>j.name===name);
  check(m.length===1&&m[0].status==="completed"&&m[0].conclusion==="success"&&pos(m[0].id),"job_"+name);
  return m[0];};
 const model=job(lane.model),validate=job(lane.validate),publish=job(lane.publish);
 const step=(j,name)=>{const m=(j.steps||[]).filter(s=>s.name===name);
  check(m.length===1&&m[0].status==="completed"&&m[0].conclusion==="success","step_"+name);};
 step(model,lane.modelStep);step(publish,lane.handoff);step(publish,lane.upload);
 return {run,model,validate,publish};
}
export function verifyArtifactMetadata(list,artifactId,name,runId){
 check(Array.isArray(list)&&list.length<100&&pos(artifactId),"artifact_list");
 const m=list.filter(a=>a.id===artifactId&&a.name===name);
 check(m.length===1&&list.filter(a=>a.name===name).length===1,"artifact_id");
 const a=m[0];
 check(a.expired===false&&a.workflow_run?.id===runId
  &&typeof a.digest==="string"&&/^sha256:[0-9a-f]{64}$/.test(a.digest),"artifact_meta");
 return a;
}
export function verifyHandoffManifest(p,v){
 const fields=["state","published","repository","pr_number","branch","base_sha",
   "parent_sha","head_sha","tree_sha","run_id","run_attempt"];
 if(p.lane==="review_repair")fields.push("finding_set_sha256");
 check(shape(v,fields),"manifest_fields");
 check(v.state==="OWNER_PUSH_REQUIRED"&&v.published===false
    &&v.repository===REPO&&v.pr_number===p.pr_number&&v.branch===p.branch
    &&v.base_sha===p.base_sha&&v.parent_sha===p.parent_sha
    &&v.head_sha===p.head_sha&&v.tree_sha===p.tree_sha
    &&v.run_id===p.run_id&&v.run_attempt===p.run_attempt,"manifest");
 if(p.lane==="review_repair")check(v.finding_set_sha256===p.finding_digest,"finding_digest");
 return true;
}
function verifyArtifact(p,auth,artifactId){
 const lane=LANES[p.lane],name=lane.prefix+p.run_id+"-"+p.run_attempt;
 const list=api("repos/"+REPO+"/actions/runs/"+p.run_id+"/artifacts?per_page=100").artifacts;
 const a=verifyArtifactMetadata(list,artifactId,name,p.run_id);
 const zip=cmd("gh",["api","repos/"+REPO+"/actions/artifacts/"+artifactId+"/zip"],
  {encoding:null,maxBuffer:128*1024*1024});
 check(sha256(zip)===a.digest.slice(7),"zip_digest");
 const dir=mkdtempSync(join(tmpdir(),"proffera-pending-"));
 try{
  const archive=join(dir,"archive.zip");writeFileSync(archive,zip);
  const base=lane.file;
  const files=[base+".bundle",base+".bundle.sha256",base+".json"].sort();
  const entries=cmd("unzip",["-Z1",archive]).trim().split(/\r?\n/).sort();
  check(canonical(entries)===canonical(files),"zip_inventory");
  const read=name=>cmd("unzip",["-p",archive,name],{encoding:null,maxBuffer:40*1024*1024});
  const bundle=read(base+".bundle"),checksum=read(base+".bundle.sha256").toString("utf8");
  const manifestBytes=read(base+".json"),v=JSON.parse(manifestBytes.toString("utf8"));
  const bundleDigest=sha256(bundle);
  check(checksum===bundleDigest+"  "+base+".bundle\n","bundle_checksum");
  verifyHandoffManifest(p,v);
  const path=join(dir,"candidate.bundle");writeFileSync(path,bundle);
  cmd("git",["fetch","--no-tags","origin","refs/heads/"+p.branch]);
  check([p.parent_sha,p.head_sha].includes(cmd("git",["rev-parse","FETCH_HEAD"]).trim()),"remote_parent");
  cmd("git",["bundle","verify",path]);
  check(cmd("git",["bundle","list-heads",path]).trim()===p.head_sha+" HEAD","bundle_ref");
  cmd("git",["fetch","--no-tags",path,"HEAD"]);
  check(cmd("git",["rev-parse","FETCH_HEAD"]).trim()===p.head_sha
   &&cmd("git",["rev-parse","FETCH_HEAD^{tree}"]).trim()===p.tree_sha
   &&cmd("git",["rev-parse","FETCH_HEAD^"]).trim()===p.parent_sha,"bundle_ancestry");
  return {artifact_id:artifactId,artifact_digest:sha256(zip),bundle_digest:bundleDigest,
    manifest_digest:sha256(manifestBytes),workflow_id:auth.run.workflow_id,
    publish_job_id:auth.publish.id,model_job_id:auth.model.id,validation_job_id:auth.validate.id};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
function post(bodyText){
 const result=cmd("gh",["api","--method","POST","repos/"+REPO+"/issues/"+ISSUE+"/comments",
  "-f","body="+bodyText]);const out=JSON.parse(result);check(pos(out.id),"comment_write");return out;
}
function record(env){
 const p={lane:env.LANE,repository:REPO,pr_number:Number(env.PR_NUMBER),
  branch:env.HEAD_REF,base_sha:env.BASE_SHA,parent_sha:env.PARENT_SHA,
  head_sha:env.NEW_HEAD,tree_sha:env.NEW_TREE,
  run_id:Number(env.GITHUB_RUN_ID),run_attempt:Number(env.GITHUB_RUN_ATTEMPT),
  finding_digest:env.LANE==="review_repair"?env.FINDINGS_SHA:null};
 check(Object.hasOwn(LANES,p.lane)&&pos(p.pr_number)&&pos(p.run_id)&&pos(p.run_attempt)
  &&["base_sha","parent_sha","head_sha","tree_sha"].every(k=>hex(p[k],40))
  &&(p.finding_digest===null||hex(p.finding_digest,64)),"record_input");
 const live=readPR(p);
 check(live.branch===p.parent_sha&&live.pr.base.sha===p.base_sha,"stale_parent");
 const auth=trustedRun(p);
 const att=verifyArtifact(p,auth,Number(env.ARTIFACT_ID));
 const value={version:1,...p,...att,observed_at:new Date().toISOString()};
 const key=p.lane+":"+p.run_id+":"+p.run_attempt;
 const proposed=body("pending",key,value);
 const comments=issueComments();
 const admissionLane=p.lane==="review_repair"?"review-repair":"ci-autofix";
 const expectedStart="<!-- proffera-"+admissionLane+"-start:v1:"+
  p.pr_number+":"+p.run_id+":"+p.run_attempt+" -->";
 const starts=comments.filter(c=>c.user?.login==="github-actions[bot]"
  &&c.user?.type==="Bot"&&c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()
  &&c.body?.startsWith(expectedStart+"\n"));
 check(starts.length===1,"admission_start");
 const startText=starts[0].body.split("\n");
 check(startText.length===4&&startText[1]===fence+"json"&&startText[3]===fence,"start_format");
 const start=JSON.parse(startText[2]);
 check(start.head===p.parent_sha&&start.pr_number===p.pr_number
  &&start.run_id===p.run_id&&start.run_attempt===p.run_attempt,"start_binding");
 const historical=readTrustedMemory(comments,{
  repository:REPO,scope:{kind:"pull_request",pr_number:p.pr_number},complete:true});
 check(!historical.memory.records.some(r=>(r.observations||[]).some(o=>
  o.source?.kind==="actions"&&o.source.run_id===p.run_id&&o.source.attempt===p.run_attempt)),"prior_terminal_memory");
 const ciMarker="<!-- proffera-ci-autofix-terminal:v1:"+p.pr_number+":"+p.run_id+":"+p.run_attempt+" -->";
 check(!comments.some(c=>c.user?.login==="github-actions[bot]"&&
  c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()&&c.body?.startsWith(ciMarker)),"prior_ci_terminal");
 const finalLive=readPR(p);
 check(finalLive.branch===p.parent_sha&&finalLive.pr.base.sha===p.base_sha,"record_revalidation");
 const history=admission(comments,p.pr_number);
 const existing=history.records.find(r=>r.lane===p.lane&&r.run_id===p.run_id&&r.run_attempt===p.run_attempt);
 check(history.records.every(r=>!!r.resolution||r===existing),"prior_pending");
 if(existing){
  // observed_at is immutable; compare identity/artifact fields, not a new timestamp.
  check(["head_sha","tree_sha","parent_sha","artifact_id","artifact_digest","bundle_digest",
    "manifest_digest","workflow_id"].every(k=>existing[k]===value[k]),"pending_replay");
 }else post(proposed);
 const readback=readPending(issueComments(),p.pr_number);
 check(readback.some(r=>r.lane===p.lane&&r.run_id===p.run_id&&r.run_attempt===p.run_attempt),"pending_readback");
 return {pending:true};
}
function ancestry(p,live){
 cmd("git",["fetch","--no-tags","origin","refs/heads/"+p.branch]);
 const branch=cmd("git",["rev-parse","FETCH_HEAD"]).trim();check(branch===live.branch,"branch_race");
 cmd("git",["fetch","--no-tags","origin","refs/heads/main"]);
 const main=cmd("git",["rev-parse","FETCH_HEAD"]).trim();check(main===live.main,"main_race");
 const includes=ref=>cmd("git",["rev-list",ref]).split(/\r?\n/).includes(p.head_sha);
 return {branch:includes(branch),main:includes(main)};
}
export function resolveDecision(input){
 const {kind,branch,proposed,onBranch,onMain,deployments,knownCommit}=input;
 check(["approve","cancel"].includes(kind)&&hex(branch,40)&&hex(proposed,40)
  &&typeof onBranch==="boolean"&&typeof onMain==="boolean","resolution_evidence");
 if(kind==="approve"){
  check(onBranch&&branch===proposed&&!onMain,"push_proof");
  return "push_confirmed";
 }
 check(!onBranch&&!onMain,"reachable_commit");
 check(Array.isArray(deployments)&&deployments.length===0,"deployment_evidence");
 check(knownCommit===false,"historical_publication_ambiguous");
 return "cancelled";
}
function resolution(p,comments){
 if(p.resolution)return;
 const owner=kind=>comments.filter(c=>c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()
  &&c.user?.login===OWNER&&c.user?.type==="User"
  &&c.body?.trim()===marker(kind,p.pending_digest));
 const approve=owner("approve"),cancel=owner("cancel");
 check(approve.length<=1&&cancel.length<=1&&!(approve.length&&cancel.length),"owner_conflict");
 if(!approve.length&&!cancel.length)return;
 const live=readPR(p),graph=ancestry(p,live);
 const kind=approve.length?"approve":"cancel";
 const deployments=kind==="cancel"?
  api("repos/"+REPO+"/deployments?sha="+p.head_sha+"&per_page=100"):[];
 const prior=kind==="cancel"?spawnSync("gh",["api","repos/"+REPO+"/commits/"+p.head_sha],{encoding:"utf8"}):null;
 if(prior)check(prior.status===0||(prior.status!==0&&/404|Not Found/i.test(prior.stderr)),
  "publication_lookup_ambiguous");
 const decision=resolveDecision({kind,branch:live.branch,proposed:p.head_sha,
  onBranch:graph.branch,onMain:graph.main,deployments,knownCommit:prior?.status===0});
 const proof=approve[0]||cancel[0];
 const value={pending_digest:p.pending_digest,decision,owner_comment_id:proof.id,
  observed_branch_sha:live.branch,observed_main_sha:live.main,
  historical_nonpublication_proven:false,observed_at:new Date().toISOString()};
 post(body("resolution",p.pending_digest,value));
}
function gate(env){
 const pr=Number(env.PR_NUMBER);check(pos(pr),"gate_pr");
 const comments=issueComments(),rows=readPending(comments,pr);
 for(const p of rows.filter(r=>!r.resolution)){
  const auth=trustedRun(p);
  const verified=verifyArtifact(p,auth,p.artifact_id);
  check(["artifact_digest","bundle_digest","manifest_digest","workflow_id",
    "publish_job_id","model_job_id","validation_job_id"].every(k=>p[k]===verified[k]),"pending_authentication");
  resolution(p,comments);
 }
 const result=admission(issueComments(),pr);
 return {allow:result.allow,unresolved:result.unresolved,records:result.records.length};
}
async function main(){
 const mode=process.argv[2];
 let result;
 if(mode==="record")result=record(process.env);
 else if(mode==="gate")result=gate(process.env);
 else if(mode==="inspect"){const i=JSON.parse(readFileSync(0,"utf8"));result=admission(i.comments,i.pr_number);}
 else throw new Error("pending:mode");
 process.stdout.write(JSON.stringify(result)+"\n");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(e=>{process.stderr.write(String(e?.message||e)+"\n");process.exitCode=1;});
}
