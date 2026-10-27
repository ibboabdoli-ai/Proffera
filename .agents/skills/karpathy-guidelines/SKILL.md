---
name: karpathy-guidelines
description: Apply Karpathy-inspired coding guardrails when implementing, reviewing, debugging or refactoring. Surface assumptions, favor simple solutions, make surgical edits, and verify explicit acceptance criteria.
---

# Karpathy-inspired guidelines for Proffera

These guidelines supplement, and never override, the repository root `AGENTS.md`, `WORKER_BOOTSTRAP.md`, security rules, graph-engineering workflow, or CI/review/merge/deploy gates.

## 1. Think before coding
- Inspect relevant existing code and evidence before proposing changes.
- State material assumptions and ambiguities. Ask when a consequential decision is unclear.
- Define the observable outcome and acceptance criteria before implementing.
- Prefer the existing canonical contract over introducing a duplicate.

## 2. Simplicity first
- Implement the smallest solution that satisfies the actual request.
- Avoid speculative features, unnecessary abstractions, new dependencies and unrelated cleanup.
- Favor clear code that follows established project patterns.

## 3. Surgical changes
- Identify the bounded dependency path and expected touch set.
- Modify only files needed for the task; preserve unrelated behavior.
- Do not rewrite working modules or reformat unrelated code.
- Keep authorization, tenant isolation, privacy, billing and deployment invariants intact.

## 4. Verify the goal
- Run focused checks for the affected behavior, then required repository gates.
- Review the diff for unrelated edits, regressions and unsafe assumptions.
- Never claim tests passed, fixes are deployed, or a PR is merge-ready without evidence.
- Report what changed, evidence collected, limitations and any remaining risk.

## Priority
If this skill conflicts with project-specific instructions, follow the root `AGENTS.md` and canonical repository policies. Do not merge or deploy unless authorized.
