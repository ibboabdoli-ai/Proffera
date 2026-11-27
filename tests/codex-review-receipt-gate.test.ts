import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").replaceAll("\r\n", "\n");
const ci = read(".github/workflows/ci.yml");
const wakeup = read(".github/workflows/proffera-final-gate-wakeup.yml");
const automerge = read(".github/workflows/proffera-automerge.yml");
const head = "a".repeat(40);
const otherHead = "b".repeat(40);
const requestTime = "2099-09-05T12:01:00Z";
const reportedTime = "2099-09-05T12:02:00Z";
const official = (sha = head) =>
  `<!-- codex-review-receipt:v1 -->\n\nCodex Review: Didn't find any major issues. Another round soon, please!\n\n**Reviewed commit:** \`${sha.slice(0, 10)}\`\n\n<details>Additional review metadata</details>`;
const legacy = (sha = head) =>
  `Codex Review: Didn't find any major issues. Reviewed commit: ${sha.slice(0, 10)}`;

// Execute the jq filters extracted from the actual workflows, rather than
// copy a second implementation of the acceptance logic into the tests.
function extractJq(text: string, anchor: string, end: string) {
  const location = text.indexOf(anchor);
  expect(location).toBeGreaterThanOrEqual(0);
  const start = location + anchor.length;
  const close = text.indexOf(end, start);
  expect(close).toBeGreaterThan(start);
  return text.slice(start, close);
}
const ciFilter = extractJq(
  ci,
  'codex_clean_comment_count="$(jq -r --arg sha "$HEAD_SHA" --arg request_time "$codex_request_time" \'',
  '\n                \' <<< "$comments_json")"',
);
const wakeFilter = extractJq(
  wakeup,
  'reviewed_prefix="$(jq -rn --arg body "${EVENT_COMMENT_BODY:-}" \'',
  "\n            ')",
);
const mergeFilter = extractJq(
  automerge,
  'codex_clean_comment_count="$(jq -r --arg sha "$head_sha" --arg request_time "$codex_request_time" \'',
  "\n              ' <<< \"$comments_json\")\"",
);

type Comment = { user: { login: string }; created_at: string; updated_at: string; body: string };
function codexComment(body: string, overrides: Partial<Comment> = {}): Comment {
  return {
    user: { login: "chatgpt-codex-connector[bot]" },
    created_at: reportedTime,
    updated_at: reportedTime,
    body,
    ...overrides,
  };
}
function runCi(comments: Comment[], requested = requestTime) {
  const result = spawnSync("jq", [
    "-r", "--arg", "sha", head, "--arg", "request_time", requested, ciFilter,
  ], { input: JSON.stringify(comments), encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return Number(result.stdout.trim());
}
function runAutomerge(comments: Comment[]) {
  const result = spawnSync("jq", [
    "-r", "--arg", "sha", head, "--arg", "request_time", requestTime, mergeFilter,
  ], { input: JSON.stringify(comments), encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return Number(result.stdout.trim());
}
function runWake(body: string) {
  const result = spawnSync("jq", [
    "-rn", "--arg", "body", body, wakeFilter,
  ], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

describe("exact-head Codex review receipt recognition (#961)", () => {
  it("accepts the official receipt-prefixed comment and previous legacy form in both workflows", () => {
    for (const body of [official(), legacy()]) {
      expect(runCi([codexComment(body)])).toBe(1);
      expect(runAutomerge([codexComment(body)])).toBe(1);
      expect(runWake(body)).toBe(head.slice(0, 10));
    }
  });

  it("rejects spoofed, malformed, stale, and wrong-commit responses", () => {
    const negatives = [
      codexComment(official(), { user: { login: "ibboabdoli-ai" } }),
      codexComment(official(), { user: { login: "other-bot[bot]" } }),
      codexComment(official(), { created_at: "2099-09-05T11:59:59Z", updated_at: "2099-09-05T11:59:59Z" }),
      codexComment(official(), { updated_at: "2099-09-05T12:04:00Z" }),
      codexComment(official(otherHead)),
      codexComment(official().replace(head.slice(0, 10), head + "c")),
      codexComment(legacy(head + "c").replace(head.slice(0, 10), head + "c")),
      codexComment(official() + "\n\n**Reviewed commit:** `bbbbbbbbbb`"),
      codexComment(official() + "\n\nReviewed commit: " + head + "c"),
      codexComment(official() + "\n\nReviewed commit: INVALID"),
      codexComment(legacy() + "\n\nReviewed commit: " + head + "c"),
      codexComment(official().replace("codex-review-receipt:v1", "codex-review-receipt:v2")),
      codexComment(official().replace(" -->\n\n", " -->\n")),
      codexComment("Review completed\n" + official()),
      codexComment("<!-- codex-review-receipt:v1 -->\n\nCodex Review: Found an issue.\nReviewed commit: " + head),
      codexComment("<!-- codex-review-receipt:v1 -->\n\nReviewed commit: " + head),
    ];
    for (const comment of negatives) {
      expect(runCi([comment])).toBe(0);
      expect(runAutomerge([comment])).toBe(0);
    }
    expect(runWake(official(otherHead))).toBe(otherHead.slice(0, 10));
    expect(runWake(official().replace(head.slice(0, 10), head + "c"))).toBe("");
    expect(runWake(official() + "\n\n**Reviewed commit:** `bbbbbbbbbb`")).toBe("");
    expect(runWake(official() + "\n\nReviewed commit: " + head + "c")).toBe("");
    expect(runWake(official() + "\n\nReviewed commit: INVALID")).toBe("");
    expect(runWake(official().replace("codex-review-receipt:v1", "codex-review-receipt:v2"))).toBe("");
    expect(runWake("Review completed\n" + official())).toBe("");
  });

  it("does not treat a clean comment as permission to ignore primary gates", () => {
    // The jq filter is only a trusted-bot/current-head evidence selector.
    // The surrounding owner request, timeline, CodeRabbit and race guards stay mandatory.
    expect(ci).toContain('select(.user.login == "chatgpt-codex-connector[bot]")');
    expect(ci).toContain("coderabbit_request_time");
    expect(ci).toContain("codex_request_time");
    expect(ci).toContain("select(.updated_at == .created_at)");
    expect(wakeup).toContain("Codex clean comment was edited after creation");
    expect(automerge).toContain("select(.updated_at == .created_at)");
    expect(automerge).toContain("codex_inline_count");
    expect(automerge).toContain("CodeRabbit changes remain requested");
    expect(ci).toContain("if [ \"$codex_inline_count\" -gt 0 ]; then");
    expect(ci).toContain("CodeRabbit changes were recorded while Codex fallback was running");
    expect(wakeup).toContain('EVENT_ACTOR:-}" = "chatgpt-codex-connector[bot]"');
    expect(wakeup).toContain("No trusted exact-head Codex request exists after the primary CodeRabbit request and before this result");
    expect(wakeup).toContain('[[ "$head_sha" != "$reviewed_prefix"* ]]');
  });
});
