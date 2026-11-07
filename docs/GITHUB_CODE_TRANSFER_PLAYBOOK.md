# Proffera — GitHub code transfer playbook

**Audience:** Supervisor, Builder, Verifier/Red Team, and any Proffera coding Worker.
**Status:** Canonical worker procedure once merged into `main`; any unmerged PR version is only a proposal.
**Last reviewed:** 2026-10-18.
**Repository:** `ibboabdoli-ai/Proffera`.

> `AGENTS.md`, `WORKER_BOOTSTRAP.md`, GitHub issue #548 and current `main` take precedence. This playbook describes transfer mechanics; it never grants permission to write, push, merge, deploy, request review, alter approval labels or bypass tests.

## Why this exists

Do not confuse three distinct conditions:

1. **Prepared:** a local patch, ZIP or Git bundle exists. GitHub cannot see it merely because it has a local path or a local commit SHA.
2. **Published:** the exact reviewed bytes exist in a GitHub commit reachable from the approved PR branch, and the live PR head/changed files were re-read to verify them.
3. **Validated:** targeted local checks and required exact-head GitHub Actions/review gates have produced real evidence. A published commit is not proof of passed tests or delivery readiness.

## Experience and evidence (historical examples, not standing authorization)

| Mechanism | Observed/reported history | How to treat it |
| --- | --- | --- |
| **GitHub Git Data API** (`create_blob` → `create_tree` → `create_commit` → `update_ref`) | Previous Proffera handoffs reported successful API transfer for PR #809 and a later PR #941 commit (`8bb2f60e482ac07d4aa63e972975911946d5acb8`). The remote commits/PR heads can be verified via GitHub. **A commit existing in GitHub does not by itself prove which transport/API was used.** | Recommended atomic multi-file fallback when a reviewed local candidate exists but shell `git push` is unavailable. Revalidate permissions and head every time. |
| **GitHub Contents API** (`create_file` / `update_file`) | Used in prior small-file Proffera tasks; other attempts were blocked by repository/tool safety restrictions. | Suitable for an explicitly approved tiny, isolated change. Each contents write creates a separate commit; avoid for a seven-file batch. |
| **Normal Git CLI** (`git push`) | Previously worked on connected hosts. Cloud Worker attempts to reach `github.com` sometimes failed with DNS errors. | Prefer for a real checkout when transport works. DNS failure in one host does **not** mean GitHub REST API is unavailable. |
| **Worker / Codex delivery** | Prior Worker flows published changes, including historical PR #809; local Worker SHA may be absent from GitHub object storage. | A Worker result is not proof the commit is remotely reachable. Verify the exact branch head and source tree via the GitHub API. |
| **Patch / ZIP / Git bundle** | Prepared successfully as handoff artifacts, but their creation alone does not establish transfer. | Transport/input artifacts only. Never point `update_ref` at an unuploaded/local-only SHA. |

## Method selection

1. If there is a real checkout, network access and valid authority, use one **non-force fast-forward Git push** after the prescribed pre-push checks.
2. If shell Git fails specifically due to DNS/network access, but **authenticated GitHub API** works and the complete verified candidate bytes are available, use the **Git Data API** atomic multi-file procedure below. Do not claim this executes project tests.
3. For a *single*, very small approved text-file write, the Contents API is an option; do not generate one commit per file in a multi-file patch.
4. If the candidate cannot be reproduced byte-for-byte, tests/authorization are missing, the PR head changed, or API writes are blocked, **stop and report the blocker**. Do not bypass repository governance or silently push to `main`.

## Required checks before any PR branch publication

- Read `AGENTS.md`, `WORKER_BOOTSTRAP.md`, issue #548 and the live PR. Confirm the approved task, one writable owner, touch set, `work/proffera-*` branch, exact `main` SHA and exact existing PR HEAD.
- Verify the live branch with GitHub REST: `GET /repos/{owner}/{repo}/pulls/{number}` and `GET /repos/{owner}/{repo}/git/ref/heads/{branch}`. Reject any disagreement, wrong repository, changed baseline or competing writer.
- Verify the candidate applies to the **same** baseline: all added/modified/deleted/renamed files, file modes, exact bytes and hashes; reject forbidden/unrelated changes and whitespace errors.
- Read GitHub-side `AGENTS.md` and perform the independent Red Team; use Node 22 and execute required local tests if available. **If full tests could not run, report `NOT RUN`; passing mock/synthetic tests are not equivalent.**
- Freeze candidate HEAD/tree and exact PR-body digest; perform `scripts/supervisor-preflight.mjs owner-handoff` when a real checkout is available. Its result is not owner authorization.
- Obtain separate owner authorization for the **exact candidate commit/tree, branch, existing PR and non-force fast-forward publication** as required by `AGENTS.md`. A generic instruction to investigate or prepare a patch is not blanket push approval.

## Atomic multi-file publication with GitHub Git Data API

**Only after the checks and owner authorization above:**

1. **Re-read live remote identities:** PR number, `head.ref`, repository, remote HEAD SHA, base `main` SHA, current tree SHA and owner authority. No force-push. Stop if any expected value differs.
2. **Prepare each exact changed blob:** reconstruct final full contents from the reviewed patch against the live HEAD; verify changed-path list, file modes, Git blob hashes, and expected new/deleted/renamed entries. Never upload secrets or ZIP bytes as a source file.
3. **Call `create_blob`** for each added/modified text file. Check returned blob SHA. For deletion, use a null-SHA tree entry; for renames account for both old and new paths.
4. **Call `create_tree`** using the current HEAD's **base tree SHA** plus *only* approved changed entries, preserving all unrelated files and modes. Inspect returned tree SHA against the frozen proposed tree.
5. **Call `create_commit`** with that tree, a bounded message, and **the verified live PR HEAD as its sole parent**. This creates an object, not a published PR update.
6. **Before the only ref update**, confirm separate exact commit/tree owner authorization, re-read live branch and `main`, and reject any stale or changed state.
7. **Call `update_ref`** for the existing `work/proffera-*` PR branch with `force:false` and an `expected_sha` guard where the API supports it. Reject a failure; never retry with force or a guessed SHA.
8. **Read back the PR and Git tree via the API:** new live PR HEAD must equal created commit SHA; commit parent must equal old HEAD; changed files and exact blob SHAs/modes must match scope. Record evidence and publication timestamp.
9. Follow exact-head CI, CodeQL, final review and owner-handoff gates from `AGENTS.md`. A CodeRabbit status context or passing build is not sufficient when required workflow checks/reviews are missing.

## Stop / diagnose instead of trying an unsafe workaround

| Symptom | Required response |
| --- | --- |
| Shell `git push` reports `github.com` DNS failure | Treat as a **host transport issue**. Check authenticated GitHub API access separately; only use Git Data API if all publication gates are met. |
| `update_ref` rejects unknown SHA | The commit is local-only or the object was not created in that remote repository. Upload verified blobs/tree/commit first; never invent remote commit existence. |
| Remote HEAD/main changed, old patch no longer applies, or `expected_sha` mismatch | Stop, refresh the graph/base and revalidate. **No force push, no automatic rebase across conflicting scope.** |
| `create_branch`, `update_file`, `create_tree`, `update_ref`, or other write is denied | Stop and report exact tool/permission blocker. Do not use dummy access probes, change `main`, or switch to an unapproved path. |
| Git bundle / patch / ZIP exists only in a sandbox | Not published. Use a real checkout with verified import, or reconstruct exact reviewed GitHub objects by API with authorization. |
| Synthetic tests green but `npm ci` / Vitest / typecheck / lint / build were not executed | Mark unexecuted checks **NOT RUN**, not PASS. GitHub CI can be observed after an explicitly authorized push; it does not retroactively prove pre-push checks were run. |
| CodeRabbit success status while current-head review says `CHANGES_REQUESTED` | Remain blocked. Review gating is governed by current-head authenticated evidence, not one status label. |

## Worker report contract

Provide one concise transfer report with: task/PR, branch, old SHA, new SHA/tree (or `not published`), current `main`, exact changed paths and file modes, method actually used (not inferred), owner approval reference, local tests run/not run, GitHub CI/review IDs and statuses (or `not run`), rejected/stale/API failures, and confirmation that `main`, Production, secrets, merge and unrelated PRs were untouched.

**PR #941 example:** `work/proffera-b4-repair-safety` at historical head `8bb2f60e482ac07d4aa63e972975911946d5acb8` illustrates the need to re-check a live head; **do not pin that SHA as a future expected head**. Its v3 patch's synthetic tests are not a substitute for a full repository checkout or exact-head CI.
