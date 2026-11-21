import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8").replaceAll("\r\n", "\n");
const anchor = 'guard_clean_count="$(jq -r --slurpfile accepted ';
const start = workflow.indexOf(anchor);
const end = workflow.indexOf('\n              if [[ ! "$guard_clean_count" =~ ^[1-9][0-9]*$ ]]; then', start);
const filterStart = workflow.indexOf("'\n", start);
const filterEnd = workflow.indexOf('\n              \' <<< "$guard_comments_json")', filterStart + 2);
const filter = start < 0 || filterStart < 0 || filterEnd < 0
  ? ""
  : workflow.slice(filterStart + 2, filterEnd).trim();
const command = start < 0 || end < 0 ? "" : workflow.slice(start, end).trim();

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

type GuardOptions = { acceptedRaw?: string; currentRaw?: string; missingAccepted?: boolean; missingCurrent?: boolean };
function runGuard(current: unknown[], accepted: unknown[] = [summary], completedAt = reviewTime, options: GuardOptions = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ci-cr-large-evidence-"));
  const acceptedFile = join(dir, "accepted.json");
  const currentFile = join(dir, "current.json");
  try {
    if (!options.missingAccepted) writeFileSync(acceptedFile, options.acceptedRaw ?? JSON.stringify(accepted));
    if (!options.missingCurrent) writeFileSync(currentFile, options.currentRaw ?? JSON.stringify(current));
    const shell = [
      "set -euo pipefail",
      'clean_final_comments_json="$(cat "$ACCEPTED_FILE")"',
      'guard_comments_json="$(cat "$CURRENT_FILE")"',
      'guard_review_completion_time="$REVIEW_TIME"',
      'coderabbit_marker="$MARKER"',
      'coderabbit_request_time="$REQUEST_TIME"',
      command,
      '[[ "$guard_clean_count" =~ ^[0-9]+$ ]] || exit 3',
      'printf "%s\n" "$guard_clean_count"',
    ].join("\n");
    return spawnSync("bash", ["-c", shell], {
      encoding: "utf8", timeout: 20_000,
      env: { ...process.env, ACCEPTED_FILE: acceptedFile, CURRENT_FILE: currentFile,
        REVIEW_TIME: completedAt, MARKER: marker, REQUEST_TIME: requestTime },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function guard(current: unknown[], accepted: unknown[] = [summary], completedAt = reviewTime) {
  const result = runGuard(current, accepted, completedAt);
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


describe("CI linked older-head acknowledgement", () => {
  const source = workflow.slice(workflow.indexOf('coderabbit_inline_count="$(jq -r'));
  const extracted = source.match(/'\n([\s\S]*?)\n\s*' <<< "\$coderabbit_inline_json"\)/);
  const inlineFilter = extracted?.[1] ?? "";
  const old = "b".repeat(40);
  const linked = {
    id: 500, user: { login: "coderabbitai[bot]" }, in_reply_to_id: 400,
    original_commit_id: old, commit_id: head,
    created_at: "2026-11-07T10:00:03Z",
    body: "@ibboabdoli-ai Verified by inspection. This addresses the finding.",
  };
  function count(rows: unknown[]) {
    const result = spawnSync("jq", ["-r", "--arg", "sha", head, "--arg", "request_time", requestTime, inlineFilter],
      { input: JSON.stringify(rows), encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return Number(result.stdout.trim());
  }
  it("blocks fresh older-thread replies even when they sound like acknowledgements", () => {
    expect(count([linked])).toBe(1);
    expect(count([{ ...linked, body: linked.body + " The authorization bypass remains exploitable." }])).toBe(1);
    expect(count([{ ...linked, commit_id: old }])).toBe(0);
  });
  it("retains new findings and untrusted or unlinked replies as blocking", () => {
    for (const row of [
      { ...linked, body: "**Major**: New issue.\\n<!-- cr-comment:v1:abc -->" },
      { ...linked, body: "@ibboabdoli-ai Thanks for checking, but P1 new vulnerability remains." },
      { ...linked, body: "@ibboabdoli-ai Thanks for checking. This addresses the finding. However a new P1 bug exists." },
      { ...linked, body: "Unknown new information" },
      { ...linked, in_reply_to_id: null },
      { ...linked, original_commit_id: head },
    ]) expect(count([row])).toBe(1);
  });
});

describe("CI clean-summary final inline refresh", () => {
  const source = workflow.slice(workflow.indexOf('guard_inline_count="$(jq -r'));
  const extracted = source.match(/'\n([\s\S]*?)\n\s*' <<< "\$guard_inline_json"\)/);
  const inlineFilter = extracted?.[1] ?? "";
  it("runs the refreshed current-head finding filter before accepting the summary", () => {
    expect(inlineFilter).not.toBe("");
    expect(workflow.indexOf('guard_inline_count="$(jq -r')).toBeLessThan(workflow.indexOf('guard_clean_count="$(jq -r'));
    const row = {id:501,user:{login:"coderabbitai[bot]"},original_commit_id:head,
      commit_id:head,created_at:summaryTime,body:"New blocking finding"};
    const result = spawnSync("jq", ["-r", "--arg", "sha", head, "--arg", "request_time", requestTime, inlineFilter],
      {input:JSON.stringify([row]),encoding:"utf8"});
    expect(result.status,result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("1");
  });
});

describe("CI CodeRabbit P2 file-backed JSON regression", () => {
  it("keeps the actual jq expression and a fail-closed numeric gate", () => {
    expect(command).toContain("--slurpfile accepted");
    expect(command).not.toContain("--argjson accepted");
    expect(filter).toContain('invalid accepted CodeRabbit evidence');
    expect(workflow).toContain('if [[ ! "$guard_clean_count" =~ ^[1-9][0-9]*$ ]]; then');
    expect(guard([request, summary])).toBe(1);
  });

  it("accepts three distinct unchanged summaries larger than 128 KiB in total", () => {
    const accepted = Array.from({ length: 3 }, (_, index) => ({
      ...summary, id: 202 + index, body: summary.body + "\n" + " ".repeat(51_000),
    }));
    expect(Buffer.byteLength(JSON.stringify(accepted), "utf8")).toBeGreaterThan(128 * 1024);
    expect(guard([request, ...accepted], accepted)).toBe(3);
  });

  it("rejects manipulated IDs, authors, bodies, edits, SHA and timestamps", () => {
    const altered = [
      { ...summary, id: 900 },
      { ...summary, user: { login: "spoofed[bot]" } },
      { ...summary, body: "changed" },
      { ...summary, body: summary.body.replace(head, "b".repeat(40)) },
      { ...summary, updated_at: "2026-11-07T10:00:04Z" },
      { ...summary, created_at: requestTime, updated_at: requestTime },
    ];
    for (const bad of altered) expect(guard([request, bad])).toBe(0);
    expect(guard([request, summary], [summary], "2026-11-07T10:00:04Z")).toBe(0);
    expect(guard([{ ...request, body: request.body.replace(head, "b".repeat(40)) }, summary])).toBe(0);
    expect(guard([{ ...request, user: { login: "spoofed" } }, summary])).toBe(0);
  });

  it("rejects malformed, empty, multiple, missing accepted JSON documents", () => {
    for (const raw of ["", "{", "null", "{}", "[]", '"string"', "[]\n[]"]) {
      const result = runGuard([request, summary], [summary], reviewTime, { acceptedRaw: raw });
      expect(result.error).toBeUndefined();
      expect(result.status, `raw accepted: ${raw}`).not.toBe(0);
    }
    expect(runGuard([request, summary], [summary], reviewTime, { missingAccepted: true }).status).not.toBe(0);
    expect(runGuard([request, summary], [summary], reviewTime, { currentRaw: "{" }).status).not.toBe(0);
    expect(runGuard([request, summary], [summary], reviewTime, { currentRaw: "" }).status).not.toBe(0);
    expect(runGuard([request, summary], [summary], reviewTime, { missingCurrent: true }).status).not.toBe(0);
    expect(guard([])).toBe(0);
  });

  it("preserves the actual CI blocking-findings checks", () => {
    const first = workflow.indexOf('if [ "$coderabbit_inline_count" -gt 0 ]; then');
    const last = workflow.indexOf('if [ "$terminal_count" -gt 0 ]; then', first);
    expect(first).toBeGreaterThan(0);
    expect(last).toBeGreaterThan(first);
    const block = workflow.slice(first, last);
    const run = (inline: number, changes: string, approval: string) => spawnSync("bash", ["-c", [
      "set -euo pipefail", `coderabbit_inline_count=${inline}`,
      `latest_changes="${changes}"`, `latest_approval="${approval}"`,
      block, "echo NONBLOCKING",
    ].join("\n")], { encoding: "utf8", timeout: 10_000 });
    expect(run(1, "", "").status).toBe(1);
    expect(run(0, "2026-11-07T10:00:03Z", "").status).toBe(1);
    expect(run(0, "2026-11-07T10:00:03Z", "2026-11-07T10:00:04Z").status).toBe(0);
  });
});
