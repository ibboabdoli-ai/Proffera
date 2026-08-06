# Platform Admin Navigation and Access

All `/admin` pages have two server-side access layers:

1. Proxy Basic authentication using the existing `ADMIN_ACCESS_CODE` secret.
2. The shared Admin layout, which requires an active `platform_admins` record and checks the role against the requested admin area.

The Proxy forwards the verified admin pathname in an internal request header. The layout resolves that pathname to an admin area and rejects roles without access before rendering the page.

## Role matrix

| Area | super_admin | support_admin | billing_admin | operations_admin | read_only_admin | developer_admin |
| --- | --- | --- | --- | --- | --- | --- |
| SaaS Dashboard | Yes | Yes | Yes | Yes | Yes | Yes |
| Workspaces | Yes | Yes | Yes | Yes | Yes | Yes |
| Billing | Yes | No | Yes | No | No | No |
| Platform Admins | Yes | No | No | No | No | No |
| Audit Log | Yes | Yes | Yes | Yes | Yes | Yes |
| Quote Admin | Yes | No | No | Yes | No | Yes |

The same policy generates visible navigation items and authorizes the server-rendered route. Hiding a link is not treated as authorization.

Existing page-level checks remain in place for Billing and Platform Admin management as defense in depth.
