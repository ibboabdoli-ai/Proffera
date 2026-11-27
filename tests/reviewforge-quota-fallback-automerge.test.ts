import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
const file = '.github/workflows/proffera-automerge.yml';
const yamlText = readFileSync(file, 'utf8');
// Extract the only shell run block without adding a missing @types/js-yaml
// dependency to Proffera's production TypeScript compilation.
const block = yamlText.split('        run: |\n')[1] ?? '';
const script = block.split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');

describe('ReviewForge CodeRabbit-quota fallback merge safety', () => {
  it('keeps all workflow bash syntactically valid', () => {
    expect(script).not.toBe('');
    expect(() => execFileSync('bash', ['-n'], {input: script})).not.toThrow();
  });

  it('accepts only the real ReviewForge app and exact-HEAD approval evidence', () => {
    expect(yamlText).not.toContain('pull_request_review:');
    const router = readFileSync('.github/workflows/supervisor-event-router.yml', 'utf8');
    expect(router).toContain('pull_request_review:');
    expect(router).toContain('"reviewforge-ibbo-dev[bot]"');
    expect(router).toContain('dispatch_pr proffera-automerge.yml "$pr_number"');
    expect(script).toContain('reviewforge-ibbo-dev[bot]');
    expect(script).toContain('reviewforge-fallback-approval:$head_sha');
    expect(script).toContain('.commit_id == $sha');
    expect(script).toContain('.state == "CHANGES_REQUESTED"');
    expect(script).toContain('0 actionable finding(s).');
    expect(script).toContain('Full review coverage:');
    expect(script).toContain('.submitted_at // ""');
  });

  it('never treats a CodeRabbit timeout alone as ReviewForge quota permission', () => {
    expect(script).toContain('reviewforge_quota_count');
    expect(script).toContain('Review rate limited');
    expect(script).toContain('reviewforge_quota_count" -gt 0');
    expect(script).toContain('fallback_eligible" = "true"');
    expect(script).toContain('coderabbit_request_time');
  });

  it('fails closed on silence, skipped review, timeout and clean Codex without full quota-only proof', () => {
    const start = script.indexOf('reviewforge_quota_count=');
    const end = script.indexOf('checks_json=', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const missingPrimaryGate = script.slice(start, end);
    // No legacy Codex review can grant merge permission after a timeout.
    expect(missingPrimaryGate).not.toContain('codex_marker=');
    expect(missingPrimaryGate).not.toContain('codex_clean_count=');
    expect(missingPrimaryGate).not.toContain('fallback_active=true');
    const guard = missingPrimaryGate.match(/if \[ "\$reviewforge_fallback_used" != "yes" \]; then\n\s+refuse "([^"]+)"\n\s+fi/);
    expect(guard).not.toBeNull();
    expect(guard?.[1]).toContain('no authenticated exact-current-head CodeRabbit quota');
    for (const [flag, expectedStatus] of [['no', 73], ['yes', 0], ['', 73]] as const) {
      const check = spawnSync('bash', ['-c',
        'refuse() { exit 73; }\nreviewforge_fallback_used="' + flag + '"\n' + (guard?.[0] ?? '')
      ], {encoding: 'utf8'});
      expect(check.status).toBe(expectedStatus);
    }
  });

  it('preserves existing human authorization and protected main checks', () => {
    expect(script).toContain('owner_approval_marker');
    expect(script).toContain('ibbo-approved');
    expect(script).toContain('count_unedited_owner_approvals');
    expect(script).toContain('ci_validate_pass_count');
    expect(script).toContain('final_gate_pass_count');
    expect(script).toContain('Refused: PR changes blocked sensitive paths');
    expect(script).toContain('--match-head-commit "$head_sha"');
  });

  it('rechecks ReviewForge approvals and any bot findings before merge', () => {
    const recheck = script.indexOf('final_bot_approvals=');
    const merge = script.indexOf('merge_output=');
    expect(recheck).toBeGreaterThan(0);
    expect(merge).toBeGreaterThan(recheck);
    expect(script).toContain('final_bot_findings');
    expect(script).toContain('ReviewForge approval is stale, dismissed');
  });
});


// This executes the exact workflow shell function with synthetic GraphQL
// responses. No GitHub calls or paid model requests are made by these tests.
const reviewThreadsPayload = (nodes: Array<{ isResolved?: boolean }>, hasNextPage = false) =>
  JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes, pageInfo: { hasNextPage } } } } } });

function evaluateReviewThreadGate(payload: string, githubFailure = false): number | null {
  const gateFunction = script.match(/^review_threads_resolved\(\) \{[\s\S]*?^\}/m)?.[0];
  expect(gateFunction).toBeDefined();
  const command = [
    'set -euo pipefail',
    gateFunction ?? '',
    'gh() { if [ "$GH_FAIL" = "1" ]; then return 44; fi; printf "%s\n" "$THREADS_JSON"; }',
    'review_threads_resolved',
  ].join('\n');
  const result = spawnSync('bash', ['-c', command], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPOSITORY: 'ibboabdoli-ai/Proffera',
      pr_number: '1002',
      GH_FAIL: githubFailure ? '1' : '0',
      THREADS_JSON: payload,
    },
  });
  return result.status;
}

describe('real pre-merge unresolved review thread gate', () => {
  it('is required on every review route immediately before merge', () => {
    const gateInvocation = script.lastIndexOf('if ! review_threads_resolved; then');
    const mergeInvocation = script.indexOf('merge_output=');
    expect(gateInvocation).toBeGreaterThan(0);
    expect(mergeInvocation).toBeGreaterThan(gateInvocation);
  });

  it('accepts a complete GraphQL result with all discussions resolved', () => {
    expect(evaluateReviewThreadGate(reviewThreadsPayload([{isResolved: true}, {isResolved: true}]))).toBe(0);
    expect(evaluateReviewThreadGate(reviewThreadsPayload([]))).toBe(0);
  });

  it.each([
    ['unresolved thread', reviewThreadsPayload([{isResolved: true}, {isResolved: false}])],
    ['unknown resolution', reviewThreadsPayload([{}])],
    ['missing pagination coverage', reviewThreadsPayload([{isResolved: true}], true)],
    ['missing GraphQL data', '{}'],
    ['malformed GraphQL JSON', '{not-json'],
    ['GraphQL error', JSON.stringify({ errors: [{message: 'access denied'}], data: {repository: {pullRequest: {reviewThreads: {nodes: [{isResolved: true}], pageInfo: {hasNextPage: false}}}}} })],
  ])('refuses %s', (_reason, payload) => {
    expect(evaluateReviewThreadGate(payload)).not.toBe(0);
  });

  it('refuses a GitHub GraphQL transport failure', () => {
    expect(evaluateReviewThreadGate(reviewThreadsPayload([{isResolved: true}]), true)).not.toBe(0);
  });
});


// Exercise the ACTUAL jq selector embedded in the workflow, not a copied
// interpretation. Real CodeRabbit quota notices do not include an exact-HEAD
// correlation marker; this Draft gate MUST refuse them until supported.
const quotaHead = 'a'.repeat(40);
const previousHead = 'b'.repeat(40);
const quotaRequestedAt = '2026-11-20T14:00:00Z';
const invocation = '<!-- CodeRabbit review command invocation: v2:' + 'c'.repeat(64) + ' -->';
const quotaText = (sha: string, outcome = 'Action not completed', message = 'Review rate limited.') =>
  [invocation, '<details>', '<summary>' + outcome + '</summary>', message, '<!-- CodeRabbit quota exact-head: ' + sha + ' -->', '</details>'].join('\n');
const quotaComment = (body: string, author = 'coderabbitai[bot]', createdAt = '2026-11-20T14:01:00Z') =>
  ({ user: { login: author }, created_at: createdAt, body });

function realQuotaSelectorCount(comments: Array<ReturnType<typeof quotaComment>>): number {
  const matched = script.match(/reviewforge_quota_count="\$\(jq -r --arg sha "\$head_sha" --arg request_time "\$coderabbit_request_time" '([\s\S]*?)' <<< "\$comments_json"\)"/);
  expect(matched).not.toBeNull();
  const result = spawnSync('jq', [
    '-r', '--arg', 'sha', quotaHead,
    '--arg', 'request_time', quotaRequestedAt,
    matched?.[1] ?? '',
  ], { encoding: 'utf8', input: JSON.stringify(comments) });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  return Number(result.stdout.trim());
}

describe('exact-HEAD CodeRabbit quota provenance (offline, no paid calls)', () => {
  it('reproduces and blocks a delayed authentic old-HEAD quota reply after the current request', () => {
    expect(realQuotaSelectorCount([quotaComment(quotaText(previousHead))])).toBe(0);
  });
  it('rejects a real-world CodeRabbit rate-limit format with no SHA correlation', () => {
    expect(realQuotaSelectorCount([quotaComment([invocation, '<details>', '<summary>Action not completed</summary>', 'Review rate limited.', 'Your included review limit is currently reached.', '</details>'].join('\n'))])).toBe(0);
  });
  it('allows only a synthetic correctly bound bot reply when all evidence matches', () => {
    expect(realQuotaSelectorCount([quotaComment(quotaText(quotaHead))])).toBe(1);
  });
  it('rejects an untrusted actor or a response predating the current request', () => {
    expect(realQuotaSelectorCount([quotaComment(quotaText(quotaHead), 'attacker[bot]')])).toBe(0);
    expect(realQuotaSelectorCount([quotaComment(quotaText(quotaHead), 'coderabbitai[bot]', '2026-11-20T13:59:00Z')])).toBe(0);
  });
  it('rejects a completed review even if quota is mentioned', () => {
    expect(realQuotaSelectorCount([quotaComment(quotaText(quotaHead, 'Action performed', 'Review rate limited.'))])).toBe(0);
    expect(realQuotaSelectorCount([quotaComment(quotaText(quotaHead, 'Action not completed', 'Included review limit reached.'))])).toBe(0);
  });
  it('rejects mismatched or uncorrelated quota evidence mixed with unrelated comments', () => {
    expect(realQuotaSelectorCount([quotaComment(quotaText(previousHead)), quotaComment('Review rate limited.')])).toBe(0);
  });
});


// Test both real jq selectors on immutable-SHA synthetic review submissions.
// Read-only offline fixtures; no GitHub or provider request is made.
const decisionHead = 'a'.repeat(40);
const decisionMarker = '<!-- reviewforge-fallback-approval:' + decisionHead + ' -->';
const decisionRequested = '2026-11-21T12:00:00Z';
type BotReview = {
  id: number;
  user: {login: string};
  commit_id: string;
  state: string;
  submitted_at: string;
  body: string;
};
const botReview = (id: number, state: string, options: Partial<BotReview> = {}): BotReview => ({
  id,
  user: {login: 'reviewforge-ibbo-dev[bot]'},
  commit_id: decisionHead,
  state,
  submitted_at: `2026-11-21T12:${String(id).padStart(2, '0')}:00Z`,
  body: decisionMarker + String.fromCharCode(10) + 'Full review coverage: 2 eligible file(s); 0 actionable finding(s).',
  ...options,
});
function actualReviewForgeApprovalCount(
  selector: 'reviewforge_approval_count' | 'final_bot_approvals',
  reviews: BotReview[],
): number {
  const source = selector === 'reviewforge_approval_count' ? 'reviewforge_fallback_reviews' : 'final_bot_reviews';
  const begin = script.indexOf(selector + '="$(jq -r');
  expect(begin).toBeGreaterThan(0);
  const expressionStart = script.indexOf(" '", begin) + 2;
  const expressionEnd = script.indexOf("' <<< " + String.fromCharCode(34) + '$' + source + String.fromCharCode(34) + ')"', expressionStart);
  expect(expressionStart).toBeGreaterThan(begin);
  expect(expressionEnd).toBeGreaterThan(expressionStart);
  const expression = script.slice(expressionStart, expressionEnd);
  const run = spawnSync('jq', [
    '-r',
    '--arg', 'sha', decisionHead,
    '--arg', 'marker', decisionMarker,
    '--arg', 'requested', decisionRequested,
    '--arg', 'request_time', decisionRequested,
    expression,
  ], {encoding: 'utf8', input: JSON.stringify(reviews)});
  expect(run.error).toBeUndefined();
  expect(run.status).toBe(0);
  return Number(run.stdout.trim());
}

describe.each(['reviewforge_approval_count', 'final_bot_approvals'] as const)(
  'latest exact-HEAD ReviewForge decision at %s', (selector) => {
    it('accepts a clean bot approval when no later blocking review exists', () => {
      expect(actualReviewForgeApprovalCount(selector, [botReview(1, 'APPROVED')])).toBe(1);
    });
    it('revokes an older approval on a later same-SHA CHANGES_REQUESTED', () => {
      expect(actualReviewForgeApprovalCount(selector, [
        botReview(1, 'APPROVED'), botReview(2, 'CHANGES_REQUESTED'),
      ])).toBe(0);
    });
    it('revokes an older approval when GitHub later dismisses it', () => {
      expect(actualReviewForgeApprovalCount(selector, [
        botReview(1, 'APPROVED'), botReview(2, 'DISMISSED'),
      ])).toBe(0);
    });
    it('only restores eligibility after a newer valid clean approval', () => {
      expect(actualReviewForgeApprovalCount(selector, [
        botReview(1, 'APPROVED'), botReview(2, 'CHANGES_REQUESTED'), botReview(3, 'APPROVED'),
      ])).toBe(1);
    });
    it('refuses a later unmarked approval and a blocking-only history', () => {
      expect(actualReviewForgeApprovalCount(selector, [
        botReview(1, 'APPROVED'), botReview(2, 'APPROVED', {body: 'No full coverage evidence'}),
      ])).toBe(0);
      expect(actualReviewForgeApprovalCount(selector, [botReview(1, 'CHANGES_REQUESTED')])).toBe(0);
    });
    it('ignores a different SHA, untrusted bot or old submission', () => {
      expect(actualReviewForgeApprovalCount(selector, [
        botReview(1, 'APPROVED'),
        botReview(2, 'CHANGES_REQUESTED', {commit_id: 'b'.repeat(40)}),
        botReview(3, 'CHANGES_REQUESTED', {user: {login: 'unknown[bot]'}}),
        botReview(4, 'CHANGES_REQUESTED', {submitted_at: '2026-11-21T11:59:00Z'}),
      ])).toBe(1);
    });
    it('fails closed on missing review evidence', () => {
      expect(actualReviewForgeApprovalCount(selector, [])).toBe(0);
    });
  },
);
// Exercise the exact jq filter from the real workflow rather than a simplified
// approximation. Both canonical line-ending variants are accepted by protected
// main; any extra text, wrong actor or wrong SHA must still fail closed.
describe('real owner approval jq exact-content selector', () => {
  it('accepts exactly LF or CRLF while rejecting spoofed and altered comments', () => {
    const match = script.match(/done < <\(jq -r --arg owner "\$HUMAN_APPROVER" --arg marker "\$owner_approval_marker" --arg line "\$owner_approval_line" '([\s\S]*?)' <<< "\$comments_json"\)/);
    expect(match).not.toBeNull();
    const sha = 'd'.repeat(40);
    const marker = '<!-- proffera-owner-approval:' + sha + ' -->';
    const line = 'IBBO-APPROVED: ' + sha;
    const body = (separator: string) => marker + separator + line;
    const comments = [
      { user: { login: 'ibboabdoli-ai' }, node_id: 'canonical-lf', body: body('\n') },
      { user: { login: 'ibboabdoli-ai' }, node_id: 'canonical-crlf', body: body('\r\n') },
      { user: { login: 'other-user' }, node_id: 'wrong-author', body: body('\r\n') },
      { user: { login: 'ibboabdoli-ai' }, node_id: 'extra-newline', body: body('\r\n') + '\n' },
      { user: { login: 'ibboabdoli-ai' }, node_id: 'extra-text', body: body('\n') + ' approved' },
      { user: { login: 'ibboabdoli-ai' }, node_id: 'wrong-head', body: body('\n').replaceAll(sha, 'e'.repeat(40)) },
    ];
    const result = spawnSync('jq', [
      '-r', '--arg', 'owner', 'ibboabdoli-ai', '--arg', 'marker', marker,
      '--arg', 'line', line, match?.[1] ?? '',
    ], { encoding: 'utf8', input: JSON.stringify(comments) });
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual(['canonical-lf', 'canonical-crlf']);
  });
});
