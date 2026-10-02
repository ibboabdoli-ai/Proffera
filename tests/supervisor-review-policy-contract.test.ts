import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { providerUnavailable } from "../scripts/supervisor-final-gate-memory.mjs";

const source = (path: string) => readFileSync(resolve(path), "utf8").replaceAll("\r\n", "\n");
const router = source(".github/workflows/supervisor-event-router.yml");
const wakeup = source(".github/workflows/proffera-final-gate-wakeup.yml");
const ci = source(".github/workflows/ci.yml");
const requestTime = "2026-10-01T08:00:00Z";
// Execute production shell/jq predicates rather than implementing another policy
// in the test. Full adapter tests separately cover source re-fetch and POST safety.
function block(text: string, start: string, end: string) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error("Missing workflow policy boundary");
  return text.slice(a, b).split("\n").map(line => line.trimStart()).join("\n");
}
const routerPolicy = block(router, "            wake_final=no", '            if [ "$wake_final" = "yes" ]; then');
const wakeupPolicy = block(wakeup, '          if [ "$EVENT_NAME" = "pull_request_review" ]; then\n            case', '          pr_json="');
const availabilityFilters = [...ci.matchAll(/(?:high_risk_)?unavailable_count="\$\(jq -r --arg request_time "\$coderabbit_request_time" '([\s\S]*?)' <<< "\$comments_json"\)"/g)].map(match => match[1]);

function shellPolicy(policy: string, body: string, actor: string, suffix: string) {
  const result = spawnSync("bash", ["-c", `set -euo pipefail\n${policy}\n${suffix}`], {
    encoding: "utf8", timeout: 10000,
    env: {...process.env, ACTOR: actor, COMMENT_BODY: body, EVENT_NAME: "issue_comment", EVENT_ACTOR: actor, EVENT_COMMENT_BODY: body, TRUSTED_CODEX_REQUESTER: "ibboabdoli-ai"},
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim().endsWith("ELIGIBLE");
}
function ciAvailability(filter: string, body: string, actor = "coderabbitai[bot]", createdAt = "2026-10-01T08:01:00Z") {
  const result = spawnSync("jq", ["-r", "--arg", "request_time", requestTime, filter], {
    encoding: "utf8", timeout: 10000,
    input: JSON.stringify([{id: 1, user: {login: actor}, body, created_at: createdAt, updated_at: "2026-10-01T08:02:00Z"}]),
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return Number(result.stdout.trim()) > 0;
}

describe("cross-workflow provider availability semantics", () => {
  it.each([
    ["Review skipped", false],
    ["Review skipped: automatic reviews are disabled", false],
    ["Automatic reviews disabled", false],
    ["Auto reviews are disabled", false],
    ["Automatic reviews disabled; service unavailable", false],
    ["Auto reviews disabled\nReview limit reached", false],
    ["Action not completed: pull request is in draft mode", false],
    ["A rate-limit discussion", false],
    ["Review limit reached", true],
    ["Review rate limited", true],
    ["Action not completed: Review rate limited", true],
    ["Temporarily unavailable", true],
    ["Service unavailable", true],
  ])("router, wakeup, both CI risk lanes and JS agree on %s", (body, expected) => {
    expect(availabilityFilters).toHaveLength(2);
    expect(Boolean(providerUnavailable(body))).toBe(expected);
    expect(shellPolicy(routerPolicy, body, "coderabbitai[bot]", '[ "$wake_final" != yes ] || echo ELIGIBLE')).toBe(expected);
    expect(shellPolicy(wakeupPolicy, body, "coderabbitai[bot]", "echo ELIGIBLE")).toBe(expected);
    for (const filter of availabilityFilters) expect(ciAvailability(filter, body)).toBe(expected);
  });

  it("CI authenticates provider signals and uses creation time rather than edited time", () => {
    for (const filter of availabilityFilters) {
      expect(ciAvailability(filter, "Review rate limited", "untrusted-user")).toBe(false);
      expect(ciAvailability(filter, "Review rate limited", "coderabbitai[bot]", "2026-10-01T07:59:59Z")).toBe(false);
      expect(ciAvailability(filter, "Review rate limited", "coderabbitai[bot]", requestTime)).toBe(true);
    }
    expect(shellPolicy(routerPolicy, "Review rate limited", "untrusted-user", '[ "$wake_final" != yes ] || echo ELIGIBLE')).toBe(false);
    expect(shellPolicy(wakeupPolicy, "Review rate limited", "untrusted-user", "echo ELIGIBLE")).toBe(false);
  });
});
