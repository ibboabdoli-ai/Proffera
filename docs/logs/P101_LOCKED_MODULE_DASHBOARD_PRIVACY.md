# P101 — Locked module dashboard privacy

## Outcome

When CRM or online booking is locked for the active workspace, the dashboard no longer reads or displays that module's customer, booking, or activity counts. Related dashboard buttons and shortcuts are hidden as well.

## Reason

The workspace navigation already blocked the routes, but the overview still showed aggregate numbers. That was confusing for invited Staff users and exposed information from a module they could not open.

## Scope

- Workspace module checks remain server-side.
- No customer, booking, or plan records are changed.
- The Service AI Chat and dashboard AI assistant are unchanged.
