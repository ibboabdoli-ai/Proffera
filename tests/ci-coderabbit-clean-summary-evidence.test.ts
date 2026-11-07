import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8").replaceAll("\r\n", "\n");
const anchor = 'guard_clean_count="$(jq -r --argjson accepted "$clean_final_comments_json"';
const start = workflow.indexOf(anchor);
const filterStart = workflow.indexOf("'\n", start);
const filterEnd = workflow.indexOf('\n              \' <<< "$guard_comments_json")', filterStart + 2);
const filter = start < 0 || filterStart < 0 || filterEnd < 0
  ? ""
  : workflow.slice(filterStart + 2, filterEnd).trim();

const head = "a".repeat(40);
const marker = "<!-- proffera-coderabbit-final-review-request:" + head + " -->";
const requestTime = "2026-11-07T10:00:00Z";
const reviewTime = "2026-11-07T10:00:01Z";
const summaryTime = "2026-11-07T10:00:02Z";

const request = {
  id: 101,
  user: { login: "github-actions[bot]" },
  body: marker + "\n@coderabbitai review",
  created_at: requestTime,
  updated_at: requestTime,
};
const summary = {
  id: 102,
  user: { login: "coderabbitai[bot]" },
  body: "Review completed for exact HEAD " + head + ".\nI found no material findings.",
  created_at: summaryTime,
  updated_at: summaryTime,
  reactions: { total_count: 0, "+1": 0 },
};

function guard(current: unknown[], accepted: unknown[] = [summary], completedAt = reviewTime) {
  const result = spawnSync("jq", [
    "-r",
    "--argjson", "accepted", JSON.stringify(accepted),
    "--arg", "review_time", completedAt,
    "--arg", "marker", marker,
    "--arg", "request_time", requestTime,
    filter,
  ], {
    input: JSON.stringify(current),
    encoding: "utf8",
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return Number(result.stdout.trim());
}

describe("CI CodeRabbit clean-summary immutable evidence guard", () => {
  it("runs the actual CI jq guard, not a reimplementation", () => {
    expect(start).toBeGreaterThan(0);
    expect(filterStart).toBeGreaterThan(start);
    expect(filterEnd).toBeGreaterThan(filterStart);
    expect(guard([request, summary])).toBe(1);
  });

  it("accepts reaction-rollup changes without losing an unchanged review witness", () => {
    const current = { ...summary, reactions: { total_count: 3, "+1": 2, eyes: 1 } };
    expect(guard([request, current])).toBe(1);
  });

  it("fails closed when accepted review identity, content, or edit time changes", () => {
    const examples = [
      { ...summary, id: 999 },
      { ...summary, user: { login: "impostor" } },
      { ...summary, body: "Edited clean summary" },
      { ...summary, updated_at: "2026-11-07T10:00:03Z" },
    ];
    for (const altered of examples) {
      expect(guard([request, altered])).toBe(0);
    }
    expect(guard([request])).toBe(0);
    expect(guard([request, summary], [summary], "2026-11-07T10:00:04Z")).toBe(0);
  });

  it("requires the original exact-request bot, body and unedited timestamp", () => {
    const alteredRequests = [
      { ...request, user: { login: "impostor" } },
      { ...request, body: "@coderabbitai review" },
      { ...request, created_at: "2026-11-07T10:00:01Z" },
      { ...request, updated_at: "2026-11-07T10:00:01Z" },
    ];
    for (const altered of alteredRequests) {
      expect(guard([altered, summary])).toBe(0);
    }
    expect(guard([summary])).toBe(0);
  });
});
