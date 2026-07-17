# P95 — Workspace switcher

Date: 2026-07-17

## Outcome

Users who belong to more than one active workspace can switch the dashboard context from desktop or mobile navigation.

## Security

- The selected workspace is stored in an HttpOnly, same-site cookie.
- The server validates the requested workspace against the signed-in user's active memberships before saving it.
- Every dashboard access still resolves the selected workspace through membership and workspace-status checks.
- Invalid or stale selections fall back to the user's first allowed workspace.

The switcher stays hidden for users with only one workspace. No migration was required and the AI assistant page was not changed.
