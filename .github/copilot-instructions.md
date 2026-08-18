# Proffera repository instructions for coding agents

Before editing any file, follow `WORKER_BOOTSTRAP.md` and `AGENTS.md`.

Mandatory startup order:

1. Read `AGENTS.md`.
2. Read `WORKER_BOOTSTRAP.md`.
3. Read GitHub issue #548 for the live Supervisor baseline, active work, and blockers.
4. Read GitHub issue #276 for roadmap/dependency order.
5. Read `docs/CURRENT_STATUS.md` and `docs/README.md`.
6. Re-read current `main` and capture its SHA before implementation.

Mandatory delivery rules:

- work only on `work/proffera-*` branches;
- never edit `main` directly;
- do not duplicate an active graph path owned by another worker;
- preserve Workspace/tenant isolation, RBAC, auth, data and Production safety invariants;
- use the smallest safe patch and validate affected edges;
- include the machine-readable Worker Bootstrap fields from `.github/pull_request_template.md` in every PR;
- accurately declare documentation impact;
- never add or remove `ibbo-approved`;
- never claim Done without evidence required by `AGENTS.md`.

If a canonical source is inaccessible or conflicts with another canonical source, do not guess. Report the blocker or conflict in the task/PR handoff.
