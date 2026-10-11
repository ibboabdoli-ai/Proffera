// PR-scoped, read-only B4 reservation check. All callers must hold the existing
// proffera-final-gate-memory-${{ ... }} mutex across this check and its write/model side effect.
// A model reservation is the authenticated, unresolved start marker of EITHER lane;
// it lasts until a pending handoff or a trusted terminal/recovery record exists.
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import {unresolvedCiAutofixStarts} from "./supervisor-ci-autofix-strategy-memory.mjs";
import {unresolvedReviewRepairStarts} from "./supervisor-review-repair-strategy-memory.mjs";
import {readPending} from "./supervisor-owner-push-pending.mjs";
const REPO="ibboabdoli-ai/Proffera";
const positive=n=>Number.isSafeInteger(n)&&n>0;
const sha=v=>typeof v==="string"&&/^[a-f0-9]{40}$/.test(v);
function check(value,why){if(!value)throw new Error("b4_exclusive:"+why);}
function api(endpoint,opts=[]){
 const result=spawnSync("gh",["api",...opts,endpoint],{encoding:"utf8",maxBuffer:16*1024*1024});
 check(!result.error&&result.status===0&&typeof result.stdout==="string","api_unavailable");
 try{return JSON.parse(result.stdout);}catch{throw new Error("b4_exclusive:api_json");}
}
function comments(){
 const pages=api("repos/"+REPO+"/issues/548/comments?per_page=100",["--paginate","--slurp"]);
 check(Array.isArray(pages)&&pages.length<=100,"pages");
 const all=pages.flat();
 check(all.length<=10000&&all.every(x=>x&&typeof x==="object"&&!Array.isArray(x)),"comments");
 return all;
}
export function exclusiveReservationDecision({repository,pr_number,comments:rows,lane,run_id,run_attempt,head,phase}){
 check(repository===REPO&&positive(pr_number)&&Array.isArray(rows)&&rows.length<=10000,
   "identity");
 check(["ci_autofix","review_repair"].includes(lane)&&["admit","model"].includes(phase),
   "mode");
 check(sha(head)&&positive(run_id)&&positive(run_attempt),"attempt");
 const input={repository,pr_number,comments:rows};
 const ci=unresolvedCiAutofixStarts(input);
 const review=unresolvedReviewRepairStarts(input);
 const pending=readPending(rows,pr_number);
 const active=[...ci.map(x=>({...x,lane:"ci_autofix"})),
   ...review.map(x=>({...x,lane:"review_repair"}))];
 const ownership=active.filter(x=>x.lane===lane&&x.run_id===run_id
   &&x.run_attempt===run_attempt&&x.head===head);
 const allow=phase==="admit"?active.length===0:
   active.length===1&&ownership.length===1;
 const noUnresolvedPending=pending.every(x=>x.resolution?.decision==="push_confirmed");
 return {
   allow:allow&&noUnresolvedPending,
   reason:!noUnresolvedPending?"pending_owner_handoff":
     !allow?"other_or_missing_active_reservation":"exact_reservation",
   ci_unresolved:ci.length,review_unresolved:review.length,
 };
}
async function main(){
 const phase=process.argv[2];
 check(["admit","model"].includes(phase),"mode");
 const pr_number=Number(process.env.PR_NUMBER);
 const run_id=Number(process.env.GITHUB_RUN_ID),run_attempt=Number(process.env.GITHUB_RUN_ATTEMPT);
 const head=process.env.EXPECTED_HEAD;
 check(positive(pr_number)&&positive(run_id)&&positive(run_attempt)&&sha(head),"env");
 const pr=api("repos/"+REPO+"/pulls/"+pr_number);
 check(pr?.state==="open"&&pr?.merged===false&&pr?.head?.sha===head
   &&pr.head.ref===process.env.EXPECTED_REF
   &&pr.head.repo?.full_name===REPO&&pr.base?.ref==="main"
   &&pr.user?.login==="ibboabdoli-ai","live_pr");
 const result=exclusiveReservationDecision({repository:REPO,pr_number,comments:comments(),
   lane:process.env.LANE,run_id,run_attempt,head,phase});
 process.stdout.write(JSON.stringify(result)+"\n");
 if(phase==="model"&&!result.allow)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(error=>{process.stderr.write(String(error?.message||error)+"\n");process.exitCode=1;});
}
