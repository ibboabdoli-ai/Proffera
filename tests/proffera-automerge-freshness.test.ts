import {spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {describe,it,expect} from "vitest";
const workflow=readFileSync(".github/workflows/proffera-automerge.yml","utf8").replaceAll("\r\n","\n");
const start=workflow.indexOf("          validate_codex_fallback() {");
const end=workflow.indexOf('          merge_output="$(gh pr merge',start);
const block=workflow.slice(start,end).split("\n").map(l=>l.slice(10)).join("\n");
const ownerStart=workflow.indexOf("          count_unedited_owner_approvals() {");
const ownerEnd=workflow.indexOf('          owner_head_approval_count=',ownerStart);
const ownerBlock=workflow.slice(ownerStart,ownerEnd).split("\n").map(l=>l.slice(10)).join("\n");
const head="a".repeat(40), time="2026-01-01T00:00:00Z";
function run(change:string) {
 const dir=mkdtempSync(join(tmpdir(),"automerge-fresh-"));
 const primary={id:1,user:{login:"github-actions[bot]"},body:"<!-- proffera-coderabbit-final-review-request:"+head+" -->\n@coderabbitai review",created_at:time,updated_at:time};
 const request={id:2,user:{login:"ibboabdoli-ai"},body:"<!-- proffera-codex-fallback-review-request:"+head+" -->\n@codex review",created_at:time,updated_at:time};
 const clean={id:3,user:{login:"chatgpt-codex-connector[bot]"},body:"Codex Review: Didn't find any major issues.\nReviewed commit: "+head,created_at:time,updated_at:time};
 const owner={id:5,node_id:"IC_5",user:{login:"ibboabdoli-ai"},body:"<!-- proffera-owner-approval:"+head+" -->\nIBBO-APPROVED: "+head,created_at:time,updated_at:time};
 let comments=[primary,request,clean,owner];
 const reviews:unknown[]=[], inline:unknown[]=[];
 const initialReviews:unknown[]=[];
 if(change==="removed")comments=[primary,request];
 if(change==="request-removed")comments=[primary,clean];
 if(change==="near-merge-codex-removed")comments=[primary,request,owner];
 if(change==="edited")clean.updated_at="2026-01-01T00:01:00Z";
 if(change==="edited-body")clean.body+="\nchanged";
 if(change==="stale")clean.body=clean.body.replace(head,"b".repeat(40));
 if(change==="bad-time")clean.created_at=clean.updated_at="not-a-time";
 if(change==="future")clean.created_at=clean.updated_at="2999-01-01T00:00:00Z";
 if(change==="spoofed")clean.user={login:"attacker"};
 // A paginated API comment can exceed Linux's 128 KiB per-argument limit.
 if(change==="large-evidence")comments.push({id:777,user:{login:"other-bot"},body:"X".repeat(170_000),created_at:time,updated_at:time});
 if(change==="inline")inline.push({id:9,user:{login:"chatgpt-codex-connector[bot]"},commit_id:head,created_at:time});
 if(change==="codex-before-request"||change==="near-merge-codex-before-request")
  inline.push({id:13,user:{login:"chatgpt-codex-connector[bot]"},original_commit_id:head,commit_id:head,
   created_at:"2025-12-31T23:59:59Z",body:"[P1] Same-head finding from earlier Codex review"});
 if(change==="near-merge-codex-original-head-inline")inline.push({id:12,user:{login:"chatgpt-codex-connector[bot]"},original_commit_id:head,commit_id:"b".repeat(40),created_at:time});
 const currentReply=change.includes("current-reply");
 const carried=change.includes("carried-before-request");
 if(change==="coderabbit-inline"||(change.includes("original-head-inline")&&!change.includes("codex-"))||change==="coderabbit-primary-inline"||currentReply||carried||change==="stale-old-thread"||change==="coderabbit-before-request"||change==="near-merge-coderabbit-before-request")
  inline.push({id:10,user:{login:"coderabbitai[bot]"},original_commit_id:currentReply||carried||change==="stale-old-thread"?"b".repeat(40):head,
   commit_id:change.includes("original-head-inline")||change==="stale-old-thread"?"b".repeat(40):head,
   created_at:carried||change.endsWith("coderabbit-before-request")?"2025-12-31T23:59:59Z":time});
 if(change==="coderabbit-primary-inline"||change==="coderabbit-primary-dismissed"||change.includes("primary-current-reply")||change.includes("primary-original-head-inline")||change==="near-merge-primary-dismissed")initialReviews.push({id:11,user:{login:"coderabbitai[bot]"},commit_id:head,state:"APPROVED",submitted_at:time});
 if(change==="review-block"||change==="coderabbit-block"||change==="near-merge-review-block")reviews.push({id:9,user:{login:change==="review-block"?"chatgpt-codex-connector[bot]":"coderabbitai[bot]"},commit_id:head,state:"CHANGES_REQUESTED",submitted_at:time});
 const initialClean={...clean,user:{login:"chatgpt-codex-connector[bot]"},body:"Codex Review: Didn't find any major issues.\nReviewed commit: "+head,created_at:time,updated_at:time};
 const summary={id:4,user:{login:"chatgpt-codex-connector[bot]"},body:"Codex Review Summary",created_at:time,updated_at:"2026-01-01T00:01:00Z"};
 if(change==="summary-edited"){comments.push(summary);}
 writeFileSync(join(dir,"initial.json"),JSON.stringify([primary,request,initialClean,owner,...(change==="summary-edited"?[summary]:[])]));
 writeFileSync(join(dir,"comments.json"),JSON.stringify(comments));
 writeFileSync(join(dir,"reviews.json"),JSON.stringify(reviews));
 writeFileSync(join(dir,"initial-reviews.json"),JSON.stringify(initialReviews));
 writeFileSync(join(dir,"inline.json"),JSON.stringify(inline));
 const script=[
 "set -euo pipefail",
 "summary() { :; }",
 'refuse() { echo "REFUSED:$1"; exit 0; }',
 "sleep() { :; }",
 ownerBlock,
 // Only transport/time are mocked; the workflow's polling and decisions run unchanged.
 'timeout() { shift; "$@"; }',
 'gh() {',
 '  local endpoint="" file=""',
 '  if [ "$1" = pr ] && [ "$2" = view ]; then',
 '    touch "$ROOT/owner-checked"; echo "{\\"headRefOid\\":\\"$head_sha\\",\\"labels\\":[{\\"name\\":\\"ibbo-approved\\"}]}"; return;',
 '  fi',
 '  if [ "$1" = api ] && [ "$2" = graphql ]; then echo \'{"data":{"node":{"__typename":"IssueComment","lastEditedAt":null}}}\'; return; fi',
 '  if [ "$1" = pr ] && [ "$2" = checks ]; then',
 '    if [ -f "$ROOT/polled" ]; then echo \'[{"name":"Validate","state":"SUCCESS","bucket":"pass"},{"name":"E2E public smoke","state":"SUCCESS","bucket":"pass"}]\'; echo 2 > "$ROOT/polled";',
 '    else echo \'[{"name":"Validate","state":"PENDING","bucket":"pending"}]\'; echo 1 > "$ROOT/polled"; fi; return;',
 '  fi',
 '  for arg in "$@"; do case "$arg" in repos/*) endpoint="$arg";; esac; done',
 '  case "$endpoint" in',
 '    */issues/695/comments\\?*) file=initial.json; [ ! -f "$ROOT/polled" ] || file=comments.json; if [ "$CHANGE" = near-merge-codex-removed ] && [ ! -f "$ROOT/owner-checked" ]; then file=initial.json; fi;;',
 '    */pulls/695/reviews\\?*) file=initial-reviews.json; [ ! -f "$ROOT/polled" ] || file=reviews.json; if [ "$CHANGE" = near-merge-primary-current-reply ] || [ "$CHANGE" = near-merge-primary-original-head-inline ] || { [[ "$CHANGE" == near-merge-review-block || "$CHANGE" == near-merge-primary-dismissed ]] && [ ! -f "$ROOT/owner-checked" ]; }; then file=initial-reviews.json; fi;;',
 '    */pulls/695/comments\\?*) if [[ "$CHANGE" != initial-* ]] && [ ! -f "$ROOT/polled" ]; then return 0; fi; if [[ "$CHANGE" == near-merge-* ]] && [ ! -f "$ROOT/owner-checked" ]; then return 0; fi; file=inline.json;;',
 '    */issues/695/events\\?*) echo \'{"event":"labeled","label":{"name":"ibbo-approved"},"actor":{"login":"ibboabdoli-ai"},"created_at":"2026-01-01T00:00:00Z"}\'; return;;',
 '    */reactions\\?*) return 0;;',
 '    */pulls/695) if [ "$CHANGE" = head ] && [ -f "$ROOT/polled" ]; then echo bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb; else echo "$head_sha"; fi; return;;',
 '    *) echo "unexpected API: $endpoint" >&2; return 92;;',
 '  esac',
 '  jq -c \'.[]\' "$ROOT/$file"',
 '}',
 "REPOSITORY=ibboabdoli-ai/Proffera; pr_number=695; head_sha="+head,
 "HUMAN_APPROVER=ibboabdoli-ai; SELF_CHECK_NAME=automerge; SELF_WORKFLOW_NAME=automerge",
 'owner_approval_marker="<!-- proffera-owner-approval:${head_sha} -->"; owner_approval_line="IBBO-APPROVED: ${head_sha}"',
 'changed_files="$(printf \'src/features/test-%s.ts\\n\' {1..12})"',
 'pr_json=\'{"labels":[{"name":"needs-ai-review"}]}\'',
 block,
 "echo FRESH_EVIDENCE_OK"
 ].join("\n");
 try {
 const result=spawnSync("bash",[],{input:script,encoding:"utf8",env:{...process.env,ROOT:dir,CHANGE:change,GITHUB_STEP_SUMMARY:join(dir,"summary")},timeout:20000});
 expect(result.error).toBeUndefined();
 expect(result.status,result.stderr).toBe(0);
 if(!change.startsWith("initial-"))expect(readFileSync(join(dir,"polled"),"utf8").trim(),result.stdout+result.stderr).toBe("2");
 return result.stdout;
 } finally {rmSync(dir,{recursive:true,force:true});}
}
describe("AutoMerge post-poll review freshness",()=>{
 it("accepts unchanged evidence after the actual bounded polling",()=>{
  expect(start).toBeGreaterThan(0);expect(end).toBeGreaterThan(start);
  expect(block).toContain("for attempt in $(seq 1 40)");
  expect(workflow.slice(end)).toContain('--match-head-commit "$head_sha"');
  expect(block).toContain('count_unedited_owner_approvals "$final_owner_comments_json"');
  expect(block.indexOf('final_owner_head_approval_count="$(count_unedited_owner_approvals')).toBeLessThan(block.indexOf('near_merge_reviews_json="$(gh api'));
  expect(run("unchanged")).toContain("FRESH_EVIDENCE_OK");
  expect(run("summary-edited")).toContain("FRESH_EVIDENCE_OK");
  expect(run("stale-old-thread")).toContain("FRESH_EVIDENCE_OK");
  expect(run("large-evidence")).toContain("FRESH_EVIDENCE_OK");
  // GitHub carries an old thread's current commit_id forward, but the finding
  // still belongs to its original commit; the fresh current-head review controls.
  for(const scenario of ["coderabbit-carried-before-request","initial-coderabbit-carried-before-request",
    "near-merge-coderabbit-carried-before-request"])
   expect(run(scenario),scenario).toContain("FRESH_EVIDENCE_OK");
 },45_000);
 it.each(["inline","codex-before-request","coderabbit-before-request","coderabbit-inline","coderabbit-original-head-inline","coderabbit-current-reply","coderabbit-primary-inline","coderabbit-primary-current-reply","coderabbit-primary-dismissed",
  "review-block","coderabbit-block","removed","request-removed","edited","edited-body","stale","head","bad-time","future","spoofed"])("rejects %s during the CI wait",change=>{
  const output=run(change);expect(output).toContain("REFUSED:");expect(output).not.toContain("FRESH_EVIDENCE_OK");
  if(change==="coderabbit-before-request"||change==="coderabbit-inline"||change==="coderabbit-original-head-inline"||change==="coderabbit-current-reply"||change==="coderabbit-primary-inline")
   expect(output).toContain("CodeRabbit posted current-head inline findings after the earlier review gate");
  if(change==="coderabbit-primary-dismissed")
   expect(output).toContain("accepted current-head CodeRabbit approval is no longer present");
 },30_000);
 it.each(["initial-coderabbit-current-reply","initial-coderabbit-original-head-inline"])("rejects %s in the initial review gate",change=>{
  const output=run(change);expect(output).toContain("CodeRabbit posted current-head review findings");expect(output).not.toContain("FRESH_EVIDENCE_OK");
 },30_000);
 it.each(["near-merge-codex-before-request","near-merge-coderabbit-before-request","near-merge-coderabbit-current-reply","near-merge-coderabbit-original-head-inline","near-merge-primary-current-reply","near-merge-primary-original-head-inline","near-merge-codex-original-head-inline","near-merge-primary-dismissed","near-merge-review-block","near-merge-codex-removed"])("rejects %s after owner authorization",change=>{
  const output=run(change);expect(output).toContain("REFUSED:");expect(output).not.toContain("FRESH_EVIDENCE_OK");
  if(change.includes("current-reply")||change.includes("coderabbit-before-request")||change.includes("coderabbit-original-head-inline")||change.includes("primary-original-head-inline"))expect(output).toContain("CodeRabbit inline findings appeared after final owner authorization");
  if(change.includes("codex-original-head-inline"))expect(output).toContain("Codex fallback posted current-head review findings");
  if(change==="near-merge-primary-dismissed")expect(output).toContain("accepted CodeRabbit approval was revoked after final owner authorization");
  if(change==="near-merge-review-block")expect(output).toContain("CodeRabbit changes were requested after final owner authorization");
  if(change==="near-merge-codex-removed")expect(output).toContain("no clean exact-current-head Codex fallback result exists");
 },30_000);
});
