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
const TRUSTED_REMOTE="https://github.com/"+REPO+".git";
// Match nested work/proffera-* branches admitted by the trusted preflight.
const WORK_BRANCH_RE=/^work\/proffera-[A-Za-z0-9._-]+(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;
const validWorkBranch=branch=>typeof branch==="string"&&WORK_BRANCH_RE.test(branch)
 &&!branch.includes("..")&&!branch.split("/").some(part=>part.endsWith(".")||part.endsWith(".lock"));
// Never persist checkout credentials, put GH_TOKEN into a Git URL, or alter git
// config on disk. The per-process helper authenticates read-only fetches via gh.
export function authenticatedGitFetch(ref){
 check(ref==="refs/heads/main"
  ||(typeof ref==="string"&&ref.startsWith("refs/heads/")
    &&validWorkBranch(ref.slice("refs/heads/".length)))
  ||hex(ref,40),"git_ref");
 check(typeof process.env.GH_TOKEN==="string"&&process.env.GH_TOKEN.length>0
  &&!/[^\x21-\x7e]/.test(process.env.GH_TOKEN),"git_auth");
 return cmd("git",["-c","credential.helper=","-c","credential.helper=!gh auth git-credential",
  "fetch","--no-tags",TRUSTED_REMOTE,ref],
  {env:{...process.env,GIT_TERMINAL_PROMPT:"0"}});
}
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
function readPendingLegacy(comments,pr){
 check(Array.isArray(comments)&&comments.length<=10000&&pos(pr),"comments");
 const starts=new Map(),ends=new Map();
 for(const c of comments){
  if(typeof c?.body!=="string"||!c.body.startsWith("<!-- proffera-owner-push-"))continue;
  if(c.body.startsWith("<!-- proffera-owner-push-approve:")||
     c.body.startsWith("<!-- proffera-owner-push-cancel:"))continue;
  if(c.user?.login!=="github-actions[bot]"||c.user?.type!=="Bot")continue;
  check(c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()&&c.user?.login==="github-actions[bot]"
   &&c.user?.type==="Bot"&&pos(c.id)&&c.body.length<14000,"comment_provenance");
  if(c.body.startsWith("<!-- proffera-owner-push-pending:")){
   const {key,payload:p}=decode(c,"pending");
   const fields=["version","lane","repository","pr_number","branch","base_sha","parent_sha",
    "head_sha","tree_sha","run_id","run_attempt","workflow_id","publish_job_id","model_job_id",
    "validation_job_id","artifact_id","artifact_digest","bundle_digest","manifest_digest",
    "finding_digest","observed_at"];
   check(shape(p,fields)&&p.version===1&&p.repository===REPO&&Object.hasOwn(LANES,p.lane)
    &&pos(p.pr_number)&&validWorkBranch(p.branch)
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
  }else if(["staged","retirement","reentry-claim"].some(kind=>
    c.body.startsWith("<!-- proffera-owner-push-"+kind+":")))continue;
  else throw new Error("pending:unexpected_marker");
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
// The public pending array remains v1-compatible. All consumers validate the
// staged/retirement/re-entry ledger as well, so novel markers are never silently ignored.
export function readOwnerHandoffLedger(comments,pr){
 const pending=readPendingLegacy(comments,pr);
 const staged=new Map(),retirements=new Map(),claims=new Map();
 for(const c of comments){
  if(typeof c?.body!=="string"||!c.body.startsWith("<!-- proffera-owner-push-"))continue;
  const kind=["staged","retirement","reentry-claim"].find(k=>
   c.body.startsWith("<!-- proffera-owner-push-"+k+":"));
  if(!kind)continue; // Legacy parser already rejects other unrecognized bot markers.
  if(c.user?.login!=="github-actions[bot]"||c.user?.type!=="Bot")continue;
  check(c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()&&pos(c.id)
   &&c.body.length<14000,"ledger_provenance");
  const {key,payload:v}=decode(c,kind);
  if(kind==="staged"){
   // Reuse the exact validated pending v1 schema and identity checks.
   const legacy=readPendingLegacy([{...c,body:c.body.replace(
    "proffera-owner-push-staged:","proffera-owner-push-pending:")}],pr);
   if(v.pr_number!==pr)continue;
   check(legacy.length===1,"staged_identity");
   const k=v.lane+":"+v.run_id+":"+v.run_attempt;
   const prior=staged.get(k);check(!prior||prior.body===c.body,"staged_conflict");
   if(!prior)staged.set(k,{...v,body:c.body,stage_digest:sha256(c.body),comment_id:c.id});
  }else if(kind==="retirement"){
   check(shape(v,["stage_digest","owner_comment_id","pr_number","observed_branch_sha",
      "observed_main_sha","observed_at"])
    &&key===v.stage_digest&&hex(key,64)&&pos(v.pr_number)&&pos(v.owner_comment_id)
    &&hex(v.observed_branch_sha,40)&&hex(v.observed_main_sha,40)
    &&Number.isFinite(Date.parse(v.observed_at)),"retirement_payload");
   if(v.pr_number!==pr)continue;
   const prior=retirements.get(key);check(!prior||prior.body===c.body,"retirement_conflict");
   if(!prior)retirements.set(key,{...v,body:c.body,retirement_digest:sha256(c.body),comment_id:c.id});
  }else{
   check(shape(v,["retirement_digest","owner_comment_id","pr_number","lane",
    "run_id","run_attempt","head","observed_at"])
    &&hex(v.retirement_digest,64)&&pos(v.pr_number)&&pos(v.owner_comment_id)
    &&Object.hasOwn(LANES,v.lane)&&pos(v.run_id)&&pos(v.run_attempt)&&hex(v.head,40)
    &&Number.isFinite(Date.parse(v.observed_at)),"reentry_claim_payload");
   if(v.pr_number!==pr)continue;
   // Old v1 claims use the retirement digest as their key. New claims are
   // attempt-keyed so an independently authorized, proven safe re-entry can
   // follow a pre-model attempt that ended without creating a Start.
   check(key===v.retirement_digest ||
    key===v.retirement_digest+":"+v.run_id+":"+v.run_attempt,"reentry_claim_key");
   const prior=claims.get(key);check(!prior||prior.body===c.body,"reentry_claim_conflict");
   if(!prior)claims.set(key,{...v,body:c.body,claim_digest:sha256(c.body),comment_id:c.id});
  }
 }
 const stageRows=[...staged.values()],retiredRows=[...retirements.values()];
 for(const retired of retiredRows){
  const stage=stageRows.find(x=>x.stage_digest===retired.stage_digest);
  check(stage,"retirement_missing_stage");
  check(!pending.some(x=>x.lane===stage.lane&&x.run_id===stage.run_id
   &&x.run_attempt===stage.run_attempt),"retirement_late_pending");
  const owners=comments.filter(c=>c.id===retired.owner_comment_id
   &&c.user?.login===OWNER&&c.user?.type==="User"
   &&c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()
   &&c.body?.trim()===marker("retire",retired.stage_digest));
  check(owners.length===1,"retirement_owner_provenance");
 }
 for(const stage of stageRows){
  const p=pending.find(x=>x.lane===stage.lane&&x.run_id===stage.run_id
   &&x.run_attempt===stage.run_attempt);
  if(p)check(["head_sha","tree_sha","parent_sha","artifact_id","artifact_digest",
   "bundle_digest","manifest_digest","workflow_id","observed_at"].every(k=>p[k]===stage[k]),
   "staged_pending_conflict");
 }
 const claimRows=[...claims.values()];
 for(const claim of claimRows){
  const retired=retiredRows.find(x=>x.retirement_digest===claim.retirement_digest);
  check(retired,"reentry_missing_retirement");
  const action=marker("reentry",claim.retirement_digest+":"+claim.lane+":"+
   claim.run_id+":"+claim.run_attempt+":"+claim.head);
  check(comments.filter(c=>c.id===claim.owner_comment_id&&c.user?.login===OWNER
   &&c.user?.type==="User"&&c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()
   &&c.body?.trim()===action).length===1,"reentry_owner_provenance");
 }
 // The same run/attempt cannot claim authorization twice, even across lanes.
 const attempts=new Map(),uniqueClaims=new Set();
 for(const claim of claimRows){
  const key=claim.run_id+":"+claim.run_attempt;
  const binding=claim.retirement_digest+":"+key;
  check(!uniqueClaims.has(binding),"reentry_duplicate_claim");
  uniqueClaims.add(binding);
  const prior=attempts.get(key);
  check(!prior||(prior.lane===claim.lane&&prior.head===claim.head),"reentry_duplicate_attempt");
  if(!prior)attempts.set(key,claim);
 }
 return {pending,staged:stageRows,retirements:retiredRows,claims:claimRows};
}
export function readPending(comments,pr){return readOwnerHandoffLedger(comments,pr).pending;}
function attemptAuthorized(ledger,attempt){
 if(!attempt)return false;
 return ledger.retirements.every(retired=>ledger.claims.some(c=>
  c.retirement_digest===retired.retirement_digest
  &&c.lane===attempt.lane&&c.run_id===attempt.run_id
  &&c.run_attempt===attempt.run_attempt&&c.head===attempt.head));
}
export function reentryAuthorized(comments,pr,attempt){
 return attemptAuthorized(readOwnerHandoffLedger(comments,pr),attempt);
}
export function admission(comments,pr,attempt=null){
 const ledger=readOwnerHandoffLedger(comments,pr);
 const records=ledger.pending;
 // A cancellation is not an admission token. Owner-push and model launch have
 // no shared atomic lock, so a cancelled candidate cannot be used to re-enable
 // either automatic model lane, even after an earlier nonpublication check.
 return {allow:records.every(r=>r.resolution?.decision==="push_confirmed")
  &&ledger.staged.every(s=>ledger.retirements.some(r=>r.stage_digest===s.stage_digest)
   ||records.some(p=>p.lane===s.lane&&p.run_id===s.run_id&&p.run_attempt===s.run_attempt))
  &&(ledger.retirements.length===0||attemptAuthorized(ledger,attempt)),
  records:records.map(record=>Object.fromEntries(Object.entries(record).filter(([k])=>k!=="body"))),
  unresolved:records.filter(r=>!r.resolution).length};
}
function readPR(p,{historicalResolution=false}={}){
 const pr=api("repos/"+REPO+"/pulls/"+p.pr_number);
 const mergedHistory=historicalResolution&&pr.state==="closed"&&pr.merged===true;
 check((pr.state==="open"&&pr.merged!==true||mergedHistory)
  &&pr.base?.ref==="main"&&pr.head?.ref===p.branch
  &&pr.head?.repo?.full_name===REPO&&pr.user?.login===OWNER
  &&hex(pr.head.sha,40),"pr_identity");
 // A merged PR may have no live branch. Its authenticated PR head is historical
 // evidence only; publication must be independently proven from main ancestry.
 const branch=mergedHistory?pr.head.sha:
  api("repos/"+REPO+"/git/ref/heads/"+p.branch).object.sha;
 const main=api("repos/"+REPO+"/git/ref/heads/main").object.sha;
 check(hex(branch,40)&&hex(main,40)
  &&(mergedHistory||pr.head.sha===branch),"live_refs");
 return {pr,branch,main,mergedHistory};
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
// Exact branch-tip binding is mandatory at record time. In the resolution gate,
// allow the owner to resolve a historically authenticated bundle after the branch
// advances; resolution() still checks current ancestry and publication evidence.
export function verifyHandoffBranch(remote, parent, proposed, ownerResolution=false){
 check([remote,parent,proposed].every(v=>hex(v,40))&&typeof ownerResolution==="boolean","remote_parent_evidence");
 check(ownerResolution||[parent,proposed].includes(remote),"remote_parent");
 return true;
}
function verifyArtifact(p,auth,artifactId,{ownerResolution=false}={}){
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
  const resolutionState=ownerResolution?readPR(p,{historicalResolution:true}):null;
  let observedBranchSha=null;
  if(!resolutionState?.mergedHistory){
   authenticatedGitFetch("refs/heads/"+p.branch);
   observedBranchSha=cmd("git",["rev-parse","FETCH_HEAD"]).trim();
   verifyHandoffBranch(observedBranchSha,p.parent_sha,p.head_sha,ownerResolution);
  }
  // A retained bundle can omit its parent; fetch the authenticated prerequisite
  // explicitly even if the live branch has moved away from the staged parent.
  authenticatedGitFetch(p.parent_sha);
  check(cmd("git",["cat-file","-t",p.parent_sha]).trim()==="commit","bundle_parent");
  cmd("git",["bundle","verify",path]);
  check(cmd("git",["bundle","list-heads",path]).trim()===p.head_sha+" HEAD","bundle_ref");
  cmd("git",["fetch","--no-tags",path,"HEAD"]);
  check(cmd("git",["rev-parse","FETCH_HEAD"]).trim()===p.head_sha
   &&cmd("git",["rev-parse","FETCH_HEAD^{tree}"]).trim()===p.tree_sha
   &&cmd("git",["rev-parse","FETCH_HEAD^"]).trim()===p.parent_sha,"bundle_ancestry");
  return {artifact_id:artifactId,artifact_digest:sha256(zip),bundle_digest:bundleDigest,
    manifest_digest:sha256(manifestBytes),workflow_id:auth.run.workflow_id,
    publish_job_id:auth.publish.id,model_job_id:auth.model.id,validation_job_id:auth.validate.id,
    observedBranchSha};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
function post(bodyText){
 const result=cmd("gh",["api","--method","POST","repos/"+REPO+"/issues/"+ISSUE+"/comments",
  "-f","body="+bodyText]);const out=JSON.parse(result);check(pos(out.id),"comment_write");return out;
}
// Never retry an ambiguous GitHub POST blindly. Accept only an exact,
// authenticated ledger readback; otherwise preserve the original error.
function postOnceWithReadback(text,pr,kind,key){
 let error;
 try{post(text);}catch(e){error=e;}
 const ledger=readOwnerHandoffLedger(issueComments(),pr);
 const records=kind==="staged"?ledger.staged:ledger.pending;
 const found=records.filter(r=>r.lane+":"+r.run_id+":"+r.run_attempt===key);
 check(found.every(r=>r.body===text),"post_conflict");
 if(found.length===1)return found[0];
 if(error)throw error;
 check(false,"post_readback");
}
export function verifyRecordBranch(initial,final,parent,proposed){
 check([initial,final,parent,proposed].every(v=>hex(v,40))&&parent!==proposed,"record_ref_evidence");
 check([parent,proposed].includes(initial)&&[parent,proposed].includes(final)
  &&!(initial===proposed&&final===parent),"record_ref");
 return true;
}
export function admittedRecordIdentity(env){
  // Rerun recorder identity stays bound to the original admitted model attempt.
  check(typeof env.ADMITTED_RUN_ATTEMPT==="string"
   &&/^[1-9][0-9]*$/.test(env.ADMITTED_RUN_ATTEMPT)
   &&Number.isSafeInteger(Number(env.ADMITTED_RUN_ATTEMPT))
   &&pos(Number(env.GITHUB_RUN_ID)),"record_attempt_evidence");
  return {run_id:Number(env.GITHUB_RUN_ID),run_attempt:Number(env.ADMITTED_RUN_ATTEMPT)};
}
export function record(env){
 const p={lane:env.LANE,repository:REPO,pr_number:Number(env.PR_NUMBER),
  branch:env.HEAD_REF,base_sha:env.BASE_SHA,parent_sha:env.PARENT_SHA,
  head_sha:env.NEW_HEAD,tree_sha:env.NEW_TREE,
  ...admittedRecordIdentity(env),
  finding_digest:env.LANE==="review_repair"?env.FINDINGS_SHA:null};
 check(Object.hasOwn(LANES,p.lane)&&pos(p.pr_number)&&pos(p.run_id)&&pos(p.run_attempt)
  &&["base_sha","parent_sha","head_sha","tree_sha"].every(k=>hex(p[k],40))
  &&(p.finding_digest===null||hex(p.finding_digest,64)),"record_input");
 const live=readPR(p);
 check([p.parent_sha,p.head_sha].includes(live.branch)&&live.pr.base.sha===p.base_sha,"stale_parent");
 const auth=trustedRun(p);
 const {observedBranchSha,...att}=verifyArtifact(p,auth,Number(env.ARTIFACT_ID));
 const value={version:1,...p,...att,observed_at:new Date().toISOString()};
 const key=p.lane+":"+p.run_id+":"+p.run_attempt;
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
 check(verifyRecordBranch(live.branch,observedBranchSha,p.parent_sha,p.head_sha)
   &&verifyRecordBranch(observedBranchSha,finalLive.branch,p.parent_sha,p.head_sha)
   &&verifyRecordBranch(live.branch,finalLive.branch,p.parent_sha,p.head_sha)
   &&finalLive.pr.base.sha===p.base_sha,"record_revalidation");
 const history=admission(comments,p.pr_number);
 const ledger=readOwnerHandoffLedger(comments,p.pr_number);
 const priorStage=ledger.staged.find(s=>s.lane===p.lane&&s.run_id===p.run_id
   &&s.run_attempt===p.run_attempt);
 // observed_at is part of the immutable Stage identity. A recorder rerun must
 // use the ORIGINAL authenticated Stage bytes, not a fresh timestamp.
 const stableValue=priorStage?Object.fromEntries(Object.keys(value).map(k=>[k,priorStage[k]])):value;
 if(priorStage)check(Object.keys(value).filter(k=>k!=="observed_at")
   .every(k=>priorStage[k]===value[k]),"staged_replay");
 const proposed=body("pending",key,stableValue);
 check(!ledger.retirements.some(r=>ledger.staged.some(s=>s.stage_digest===r.stage_digest
   &&s.lane===p.lane&&s.run_id===p.run_id&&s.run_attempt===p.run_attempt)),
   "record_retired_attempt");
 // Record mode is another admission surface after the workflow gate.
 // Historical cancellation cannot authorize work after contrary publication.
 for(const prior of history.records.filter(r=>r.resolution?.decision==="cancelled")){
  assertCancellationUnpublished(prior);
 }
 const existing=history.records.find(r=>r.lane===p.lane&&r.run_id===p.run_id&&r.run_attempt===p.run_attempt);
 check(history.records.every(r=>!!r.resolution||r===existing),"prior_pending");
 if(existing){
  // observed_at is immutable; compare identity/artifact fields, not a new timestamp.
  check(["head_sha","tree_sha","parent_sha","artifact_id","artifact_digest","bundle_digest",
    "manifest_digest","workflow_id"].every(k=>existing[k]===value[k]),"pending_replay");
 }else{
  // The record job already has issues:write. Persist the authenticated candidate
  // before Pending; a later Pending write failure leaves recoverable Stage evidence.
  const stageBody=body("staged",key,stableValue);
  if(!priorStage)postOnceWithReadback(stageBody,p.pr_number,"staged",key);
  const verified=readOwnerHandoffLedger(issueComments(),p.pr_number);
  check(verified.staged.some(s=>s.lane===p.lane&&s.run_id===p.run_id
    &&s.run_attempt===p.run_attempt),"staged_readback");
  // Re-read immediately before Pending to reject an intervening owner retirement.
  check(!verified.retirements.some(r=>verified.staged.some(s=>
    s.stage_digest===r.stage_digest&&s.lane===p.lane
    &&s.run_id===p.run_id&&s.run_attempt===p.run_attempt)),"late_pending_retirement");
  // POST may have persisted despite a client timeout. Resolve by exact
  // readback only, never by an uncontrolled duplicate POST.
  postOnceWithReadback(proposed,p.pr_number,"pending",key);
 }
 const readback=readPending(issueComments(),p.pr_number);
 check(readback.some(r=>r.lane===p.lane&&r.run_id===p.run_id&&r.run_attempt===p.run_attempt),"pending_readback");
 return {pending:true};
}
function ancestry(p,live){
 let branch=null;
 if(!live.mergedHistory){
  authenticatedGitFetch("refs/heads/"+p.branch);
  branch=cmd("git",["rev-parse","FETCH_HEAD"]).trim();
  check(branch===live.branch,"branch_race");
 }
 authenticatedGitFetch("refs/heads/main");
 const main=cmd("git",["rev-parse","FETCH_HEAD"]).trim();check(main===live.main,"main_race");
 const includes=ref=>cmd("git",["rev-list",ref]).split(/\r?\n/).includes(p.head_sha);
 // Never use a deleted merged-PR branch as a live publication witness.
 return {branch:branch===null?false:includes(branch),main:includes(main)};
}
export function resolveDecision(input){
 const {kind,branch,proposed,onBranch,onMain,deployments,knownCommit}=input;
 check(["approve","cancel"].includes(kind)&&hex(branch,40)&&hex(proposed,40)
  &&typeof onBranch==="boolean"&&typeof onMain==="boolean","resolution_evidence");
 if(kind==="approve"){
  check(onBranch||onMain,"push_proof");
  return "push_confirmed";
 }
 check(!onBranch&&!onMain,"reachable_commit");
 check(Array.isArray(deployments)&&deployments.length===0,"deployment_evidence");
 check(knownCommit===false,"historical_publication_ambiguous");
 return "cancelled";
}
// A cancellation comment is not an atomic ref lock. Check live ancestry and
// retained publication evidence at each admission, not just when posting it.
// A later conflicting push makes the gate fail closed, even with a persisted
// authenticated cancellation marker.
// GitHub returns a precise 422 for an unknown commit SHA on some endpoints.
// Accept only the exact CLI response bound to the requested commit.
// All transport errors and other HTTP failures remain fail-closed.
export function commitLookupKnown(result,sha){
  check(hex(sha,40)&&result&&!result.error,"publication_lookup_ambiguous");
  if(result.status===0)return true;
  check(result.status===1&&result.signal==null
    &&typeof result.stderr==="string"&&typeof result.stdout==="string",
    "publication_lookup_ambiguous");
  const error=result.stderr.trim();
  const missing404=error==="gh: Not Found (HTTP 404)"||error==="404 Not Found";
  const missing422=error==="gh: No commit found for SHA: "+sha+" (HTTP 422)";
  check(missing404||missing422,"publication_lookup_ambiguous");
  // gh api writes structured API error bodies to stdout even on HTTP failures.
  // An error body must independently agree with the exact requested SHA/status.
  if(result.stdout!==""){
   let response;
   try{response=JSON.parse(result.stdout);}catch{throw new Error("pending:publication_lookup_ambiguous");}
   check(shape(response,["message","documentation_url","status"])
    &&response.message===(missing422?"No commit found for SHA: "+sha:"Not Found")
    &&response.status===(missing422?"422":"404")
    &&response.documentation_url==="https://docs.github.com/rest/commits/commits#get-a-commit",
    "publication_lookup_ambiguous");
  }
  return false;
}
function assertCancellationUnpublished(p){
  const live=readPR(p),graph=ancestry(p,live);
  const deployments=api("repos/"+REPO+"/deployments?sha="+p.head_sha+"&per_page=100");
  const prior=spawnSync("gh",["api","repos/"+REPO+"/commits/"+p.head_sha],{encoding:"utf8"});
  const knownCommit=commitLookupKnown(prior,p.head_sha);
  check(resolveDecision({kind:"cancel",branch:live.branch,proposed:p.head_sha,
    onBranch:graph.branch,onMain:graph.main,deployments,knownCommit})==="cancelled",
   "cancel_confirmation");
  return live;
}
function resolution(p,comments){
 if(p.resolution)return;
 const owner=kind=>comments.filter(c=>c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()
  &&c.user?.login===OWNER&&c.user?.type==="User"
  &&c.body?.trim()===marker(kind,p.pending_digest));
 const approve=owner("approve"),cancel=owner("cancel");
 check(approve.length<=1&&cancel.length<=1&&!(approve.length&&cancel.length),"owner_conflict");
 if(!approve.length&&!cancel.length)return;
 const live=readPR(p,{historicalResolution:true}),graph=ancestry(p,live);
 const kind=approve.length?"approve":"cancel";
 const deployments=kind==="cancel"?
  api("repos/"+REPO+"/deployments?sha="+p.head_sha+"&per_page=100"):[];
 const prior=kind==="cancel"?spawnSync("gh",["api","repos/"+REPO+"/commits/"+p.head_sha],{encoding:"utf8"}):null;
 const knownCommit=prior?commitLookupKnown(prior,p.head_sha):false;
 const decision=resolveDecision({kind,branch:live.branch,proposed:p.head_sha,
  onBranch:graph.branch,onMain:graph.main,deployments,knownCommit});
 const proof=approve[0]||cancel[0];
 const value={pending_digest:p.pending_digest,decision,owner_comment_id:proof.id,
  observed_branch_sha:live.branch,observed_main_sha:live.main,
  historical_nonpublication_proven:false,observed_at:new Date().toISOString()};
 if(kind==="cancel"){
  const finalLive=assertCancellationUnpublished(p);
  check(finalLive.branch===live.branch&&finalLive.main===live.main,"cancel_state_changed");
 }
 post(body("resolution",p.pending_digest,value));
}
// An owner can close an authenticated pending handoff after the seven-day
// artifact retention window, but missing/tampered artifacts within retention
// remain a hard stop. This does not admit an unapproved commit.
export function mayResolveExpiredArtifact(p,artifacts,ownerAction,nowMs=Date.now()){
 check(Array.isArray(artifacts)&&artifacts.length<100&&Number.isFinite(nowMs)
  &&Number.isFinite(Date.parse(p.observed_at))&&Object.hasOwn(LANES,p.lane),"expired_artifact_list");
 if(!ownerAction||nowMs-Date.parse(p.observed_at)<7*24*60*60*1000)return false;
 const expected=LANES[p.lane].prefix+p.run_id+"-"+p.run_attempt;
 const found=artifacts.filter(a=>a.id===p.artifact_id||a.name===expected);
 if(!found.length)return true; // GitHub removed the expired artifact.
 check(found.length===1,"expired_artifact_collision");
 const a=found[0];
 check(a.id===p.artifact_id&&a.name===expected&&a.expired===true
  &&a.workflow_run?.id===p.run_id&&a.digest==="sha256:"+p.artifact_digest,"expired_artifact_identity");
 return true;
}
function verifyStagedProvenance(stage){
 const auth=trustedRun(stage);
 check(auth.run.status==="completed"&&stage.workflow_id===auth.run.workflow_id
  &&stage.publish_job_id===auth.publish.id&&stage.model_job_id===auth.model.id
  &&stage.validation_job_id===auth.validate.id,"staged_trusted_job_binding");
 // Stage evidence must originate from an authenticated finished workflow
 // attempt. A failed Record job is permitted: posting Pending can fail *after*
 // its durable Stage write. Incomplete job inventory is never proof.
 const jobs=paged("repos/"+REPO+"/actions/runs/"+stage.run_id+
  "/attempts/"+stage.run_attempt+"/jobs?per_page=100","jobs");
 const expectedName=stage.lane==="ci_autofix"?
  "Record durable CI Autofix attempt outcome":"Record durable Review Repair attempt outcome";
 const recorders=jobs.filter(j=>j.name===expectedName);
 check(recorders.length===1&&pos(recorders[0].id)
  &&recorders[0].status==="completed"
  &&["success","failure","cancelled"].includes(recorders[0].conclusion),"staged_record_job");
 return auth;
}
function retireStaged(stage,comments){
 const actions=comments.filter(c=>c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()
  &&c.user?.login===OWNER&&c.user?.type==="User"
  &&c.body?.trim()===marker("retire",stage.stage_digest));
 check(actions.length<=1,"retirement_owner_conflict");
 if(!actions.length)return;
 verifyStagedProvenance(stage);
 const before=assertCancellationUnpublished(stage);
 // Re-read ledger: an asynchronously arriving Pending may never be retired.
 const current=readOwnerHandoffLedger(issueComments(),stage.pr_number);
 check(!current.pending.some(p=>p.lane===stage.lane&&p.run_id===stage.run_id
  &&p.run_attempt===stage.run_attempt),"retirement_late_pending");
 check(!current.retirements.some(r=>r.stage_digest===stage.stage_digest),"retirement_race");
 const after=assertCancellationUnpublished(stage);
 check(before.branch===after.branch&&before.main===after.main,"retirement_state_changed");
 const v={stage_digest:stage.stage_digest,owner_comment_id:actions[0].id,
  pr_number:stage.pr_number,observed_branch_sha:after.branch,
  observed_main_sha:after.main,observed_at:new Date().toISOString()};
 post(body("retirement",stage.stage_digest,v));
 const confirmed=readOwnerHandoffLedger(issueComments(),stage.pr_number);
 check(confirmed.retirements.some(r=>r.stage_digest===stage.stage_digest),"retirement_readback");
}
// A previous claim may be superseded ONLY if its trusted workflow attempt is
// terminal, its model job was conclusively skipped, and no Start exists.
// The existing shared PR mutex surrounds this call and the subsequent write.
function proveAbandonedClaim(claim,comments,pr){
 const lane=LANES[claim.lane];check(lane,"abandoned_lane");
 const r=api("repos/"+REPO+"/actions/runs/"+claim.run_id+"/attempts/"+claim.run_attempt);
 check(r.id===claim.run_id&&r.run_attempt===claim.run_attempt
  &&r.path===lane.path&&r.name===lane.name&&r.event===lane.event
  &&r.head_branch==="main"&&r.status==="completed"
  &&["success","failure","cancelled"].includes(r.conclusion)
  &&pos(r.workflow_id),"abandoned_run_provenance");
 const jobs=paged("repos/"+REPO+"/actions/runs/"+claim.run_id+
  "/attempts/"+claim.run_attempt+"/jobs?per_page=100","jobs");
 check(jobs.length>0&&jobs.length<=1000,"abandoned_jobs");
 const models=jobs.filter(j=>j.name===lane.model);
 check(models.length===1&&models[0].status==="completed"
  &&models[0].conclusion==="skipped"
  &&(!models[0].steps||models[0].steps.every(x=>x.status==="completed"
   &&x.conclusion==="skipped")),"abandoned_model_not_skipped");
 const startMarker="<!-- proffera-"+(claim.lane==="review_repair"?"review-repair":"ci-autofix")+
  "-start:v1:"+pr+":"+claim.run_id+":"+claim.run_attempt+" -->";
 check(!comments.some(c=>typeof c.body==="string"&&c.body.startsWith(startMarker)),
  "abandoned_start_exists");
 const ledger=readOwnerHandoffLedger(comments,pr);
 check(!ledger.staged.some(s=>s.lane===claim.lane&&s.run_id===claim.run_id
  &&s.run_attempt===claim.run_attempt)
  &&!ledger.pending.some(s=>s.lane===claim.lane&&s.run_id===claim.run_id
   &&s.run_attempt===claim.run_attempt),"abandoned_handoff_exists");
 return true;
}
function establishReentryClaim(ledger,comments,attempt,pr){
 check(attempt&&Object.hasOwn(LANES,attempt.lane)&&pos(attempt.run_id)
  &&pos(attempt.run_attempt)&&hex(attempt.head,40),"reentry_attempt");
 for(const retired of ledger.retirements){
  if(ledger.claims.some(c=>c.retirement_digest===retired.retirement_digest
   &&c.lane===attempt.lane&&c.run_id===attempt.run_id
   &&c.run_attempt===attempt.run_attempt&&c.head===attempt.head))continue;
  for(const previous of ledger.claims.filter(c=>c.retirement_digest===retired.retirement_digest)){
   proveAbandonedClaim(previous,comments,pr);
  }
  const bodyText=marker("reentry",retired.retirement_digest+":"+attempt.lane+":"+
   attempt.run_id+":"+attempt.run_attempt+":"+attempt.head);
  const owner=comments.filter(c=>c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()
   &&c.user?.login===OWNER&&c.user?.type==="User"&&c.body?.trim()===bodyText);
  if(owner.length!==1)return false;
  const stage=ledger.staged.find(s=>s.stage_digest===retired.stage_digest);
  check(stage,"reentry_missing_stage");
  verifyStagedProvenance(stage);
  const before=assertCancellationUnpublished(stage);
  check(before.pr.head.sha===attempt.head&&before.branch===attempt.head,"reentry_head");
  const current=readOwnerHandoffLedger(issueComments(),pr);
  check(!current.pending.some(p=>p.lane===stage.lane&&p.run_id===stage.run_id
   &&p.run_attempt===stage.run_attempt),"reentry_late_pending");
  for(const previous of current.claims.filter(c=>c.retirement_digest===retired.retirement_digest)){
   check(!(previous.lane===attempt.lane&&previous.run_id===attempt.run_id
    &&previous.run_attempt===attempt.run_attempt),"reentry_claim_race");
   proveAbandonedClaim(previous,issueComments(),pr);
  }
  const after=assertCancellationUnpublished(stage);
  check(before.branch===after.branch&&before.main===after.main,"reentry_state_changed");
  const value={retirement_digest:retired.retirement_digest,owner_comment_id:owner[0].id,
   pr_number:pr,...attempt,observed_at:new Date().toISOString()};
  const claimBody=body("reentry-claim",retired.retirement_digest+":"+
   attempt.run_id+":"+attempt.run_attempt,value);
  let writeError;
  try{post(claimBody);}catch(e){writeError=e;}
  const confirmed=readOwnerHandoffLedger(issueComments(),pr);
  check(confirmed.claims.filter(c=>c.retirement_digest===retired.retirement_digest
   &&c.lane===attempt.lane&&c.run_id===attempt.run_id
   &&c.run_attempt===attempt.run_attempt).every(c=>c.body===claimBody),"reentry_claim_conflict");
  if(!confirmed.claims.some(c=>c.body===claimBody)){
   if(writeError)throw writeError;
   check(false,"reentry_claim_readback");
  }
 }
 return true;
}
export function gate(env){
 const pr=Number(env.PR_NUMBER);check(pos(pr),"gate_pr");
 const comments=issueComments(),rows=readPending(comments,pr);
 for(const p of rows.filter(r=>!r.resolution)){
  const auth=trustedRun(p);
  const ids={workflow_id:auth.run.workflow_id,publish_job_id:auth.publish.id,
   model_job_id:auth.model.id,validation_job_id:auth.validate.id};
  check(Object.entries(ids).every(([k,v])=>p[k]===v),"pending_job_binding");
  const ownerAction=comments.some(c=>c.issue_url?.toLowerCase()===ISSUE_URL.toLowerCase()
   &&c.user?.login===OWNER&&c.user?.type==="User"&&
   ["approve","cancel"].some(kind=>c.body?.trim()===marker(kind,p.pending_digest)));
  if(ownerAction){
   const list=api("repos/"+REPO+"/actions/runs/"+p.run_id+"/artifacts?per_page=100").artifacts;
   if(mayResolveExpiredArtifact(p,list,true)){
    resolution(p,comments);
    continue;
   }
  }
  // Without an owner decision, the handoff stays unresolved and admission stays denied.
  // Only re-authenticate artifact bytes when resolving an actual owner decision.
  if(!ownerAction)continue;
  const verified=verifyArtifact(p,auth,p.artifact_id,{ownerResolution:true});
  check(["artifact_digest","bundle_digest","manifest_digest","workflow_id",
    "publish_job_id","model_job_id","validation_job_id"].every(k=>p[k]===verified[k]),"pending_authentication");
  resolution(p,comments);
 }
 // A cancellation is not irrevocable proof of nonpublication. Repeat live
  // checks even for previously persisted owner decisions. Even successful reads
  // do not grant automatic admission once cancellation exists.
 let finalComments=issueComments();
 let ledger=readOwnerHandoffLedger(finalComments,pr);
 for(const stage of ledger.staged.filter(s=>!ledger.retirements.some(r=>
   r.stage_digest===s.stage_digest)
   &&!ledger.pending.some(p=>p.lane===s.lane&&p.run_id===s.run_id
     &&p.run_attempt===s.run_attempt))){
  retireStaged(stage,finalComments);
 }
 finalComments=issueComments();
 ledger=readOwnerHandoffLedger(finalComments,pr);
 // Even an existing retirement must be rechecked on *every* admission and
 // model boundary; the historical cancellation isn't a publication lock.
 for(const retired of ledger.retirements){
  const stage=ledger.staged.find(s=>s.stage_digest===retired.stage_digest);
  verifyStagedProvenance(stage);
  assertCancellationUnpublished(stage);
 }
 // A prior attempt's terminal/skipped-model proof is rechecked on every
 // admission AND model boundary; late starts, pending or API uncertainty block.
 const currentAttempt={lane:env.LANE,run_id:Number(env.GITHUB_RUN_ID),
  run_attempt:Number(env.GITHUB_RUN_ATTEMPT),head:env.EXPECTED_HEAD};
 for(const claim of ledger.claims){
  if(claim.lane===currentAttempt.lane&&claim.run_id===currentAttempt.run_id
   &&claim.run_attempt===currentAttempt.run_attempt&&claim.head===currentAttempt.head)continue;
  proveAbandonedClaim(claim,finalComments,pr);
 }
 const phase=env.OWNER_GATE_PHASE;
 const attempt=ledger.retirements.length?{
  lane:env.LANE,run_id:Number(env.GITHUB_RUN_ID),
  run_attempt:Number(env.GITHUB_RUN_ATTEMPT),head:env.EXPECTED_HEAD}:null;
 if(ledger.retirements.length&&phase==="admit"){
  establishReentryClaim(ledger,finalComments,attempt,pr);
  finalComments=issueComments();
  ledger=readOwnerHandoffLedger(finalComments,pr);
  for(const retired of ledger.retirements){
   const stage=ledger.staged.find(s=>s.stage_digest===retired.stage_digest);
   assertCancellationUnpublished(stage);
  }
 }
 const finalRows=ledger.pending;
 for(const p of finalRows.filter(r=>r.resolution?.decision==="cancelled")){
  assertCancellationUnpublished(p);
 }
 const result=admission(finalComments,pr,attempt);
 // Historical merged-PR owner reconciliation never grants model admission.
 // The owner may prove a past publication even if the PR branch was deleted.
 const livePr=api("repos/"+REPO+"/pulls/"+pr);
 check(livePr?.base?.ref==="main"&&livePr?.head?.repo?.full_name===REPO
  &&livePr?.user?.login===OWNER,"gate_pr_identity");
 const open=livePr.state==="open"&&livePr.merged!==true;
 return {allow:open&&result.allow,unresolved:result.unresolved,records:result.records.length};
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
