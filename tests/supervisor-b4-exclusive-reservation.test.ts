import {describe,expect,it} from "vitest";
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
