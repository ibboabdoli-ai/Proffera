import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
    expect(yamlText).toContain('pull_request_review:');
    expect(yamlText).toContain("github.event.review.user.login == 'reviewforge-ibbo-dev[bot]'");
    expect(script).toContain('reviewforge-ibbo-dev[bot]');
    expect(script).toContain('reviewforge-fallback-approval:$head_sha');
    expect(script).toContain('.commit_id == $sha and .state == "APPROVED"');
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
