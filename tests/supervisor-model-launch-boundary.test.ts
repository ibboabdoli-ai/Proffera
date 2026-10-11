import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {describe,expect,it} from "vitest";

const require=createRequire(import.meta.url);
const {load}=require("js-yaml") as {load:(source:string)=>unknown};

type Item=Record<string,unknown>;
const item=(v:unknown):Item=>{
  expect(v).toBeTruthy();
  expect(typeof v).toBe("object");
  expect(Array.isArray(v)).toBe(false);
  return v as Item;
};
type Step=Item & {name?:string,run?:string,uses?:string,env?:Item,with?:Item};
const cases=[
  {
    file:".github/workflows/proffera-ci-autofix.yml",
    modelJob:"autofix",
    modelStep:"Run one bounded Codex repair attempt",
    gateStep:"Revalidate owner-push ledger at CI Autofix model boundary",
    input:"${{ needs.prepare.outputs.pr_number }}",
    limit:60
  },
  {
    file:".github/workflows/supervisor-review-repair.yml",
    modelJob:"repair",
    modelStep:"Run one batched exact-head repair",
    gateStep:"Revalidate owner-push ledger at Review Repair model boundary",
    input:"${{ inputs.pr_number }}",
    limit:35
  }
] as const;

describe("PR-scoped pending ledger at model launch",()=>{
  it.each(cases)("$file serializes ledger writes with the model side effect",cfg=>{
    const workflow=item(load(readFileSync(cfg.file,"utf8")));
    const jobs=item(workflow.jobs);
    const admit=item(jobs.admit);
    const record=item(jobs.record);
    const model=item(jobs[cfg.modelJob]);
    const lock=item(model.concurrency);
    expect(lock).toEqual(item(admit.concurrency));
    expect(lock).toEqual(item(record.concurrency));
    expect(lock.group).toBe("proffera-final-gate-memory-${{ fromJSON("+(
      cfg.modelJob==="autofix"?"needs.prepare.outputs.pr_number":"inputs.pr_number"
    )+") }}");
    expect(lock["cancel-in-progress"]).toBe(false);
    expect(lock.queue).toBe("max");
    expect(model["timeout-minutes"]).toBeLessThanOrEqual(cfg.limit);
    expect(item(model.permissions).issues).toBe("read");

    const steps=model.steps as Step[];
    expect(Array.isArray(steps)).toBe(true);
    const launches=steps.filter(x=>x.uses?.startsWith("openai/codex-action@"));
    expect(launches).toHaveLength(1);
    const launchIndex=steps.indexOf(launches[0]);
    expect(launches[0].name).toBe(cfg.modelStep);

    // No permission-changing or fallible step may intervene between gate and model.
    const gate=steps[launchIndex-1];
    const checkout=steps[launchIndex-2];
    expect(gate.name).toBe(cfg.gateStep);
    expect(checkout.name).toBe("Checkout immutable workflow-revision owner-push gate");
    expect(checkout.uses).toMatch(/^actions\/checkout@[0-9a-f]{40}$/);
    expect(item(checkout.with).ref).toBe("${{ github.workflow_sha }}");
    expect(item(checkout.with).path).toBe(".proffera-trusted-model-gate");
    expect(item(checkout.with)["persist-credentials"]).toBe(false);
    expect(item(gate.env).GH_TOKEN).toBe("${{ github.token }}");
    expect(item(gate.env).PR_NUMBER).toBe(cfg.input);
    const script=gate.run||"";
    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("trap 'rm -rf .proffera-trusted-model-gate' EXIT");
    expect(script).toContain('test "$(git -C .proffera-trusted-model-gate rev-parse HEAD)" = "$GITHUB_WORKFLOW_SHA"');
    expect(script).toContain('test -z "$(git -C .proffera-trusted-model-gate status --porcelain=v1 --untracked-files=all)"');
    expect(script).toContain("node .proffera-trusted-model-gate/scripts/supervisor-owner-push-pending.mjs gate");
    expect(script).not.toContain("$(node scripts/supervisor-owner-push-pending.mjs gate)");
    expect(script).toContain("jq -e '.allow == true and .unresolved == 0'");
    expect(script).toContain("node .proffera-trusted-model-gate/scripts/supervisor-b4-exclusive-reservation.mjs model");
    expect(script).toContain("(.ci_unresolved + .review_unresolved) == 1");
    expect(item(gate.env).LANE).toBe(cfg.modelJob==="autofix"?"ci_autofix":"review_repair");
    expect(item(gate.env).EXPECTED_HEAD).toBeDefined();
    expect(item(gate.env).EXPECTED_REF).toBeDefined();
    const admission=(admit.steps as Step[]).map(step=>step.run||"").join("\n");
    expect(admission).toContain("node scripts/supervisor-b4-exclusive-reservation.mjs admit");
    expect(admission.indexOf("node scripts/supervisor-b4-exclusive-reservation.mjs admit"))
      .toBeLessThan(admission.indexOf('start_body="$(node scripts/supervisor-'));
    expect(steps.slice(0,launchIndex).filter(x=>x.name===cfg.gateStep)).toHaveLength(1);

    // A skipped gate must also skip the model (the ordinary GitHub success() guard).
    expect(gate.if).toBe(launches[0].if);
    expect(String(launches[0].if||"")).not.toContain("always()");
    expect(String(launches[0].if||"")).not.toContain("failure()");
  });

  it("keeps the single PR mutex on the trusted admission and recording jobs",()=>{
    for(const cfg of cases){
      const jobs=item(item(load(readFileSync(cfg.file,"utf8"))).jobs);
      const pre=item(jobs.admit);
      const post=item(jobs.record);
      expect(item(pre.concurrency).group).toEqual(item(post.concurrency).group);
      expect(item(pre.concurrency).queue).toBe("max");
      expect(item(post.concurrency).queue).toBe("max");
    }
  });
});
