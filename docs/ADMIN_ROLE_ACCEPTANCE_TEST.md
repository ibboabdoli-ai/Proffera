# Platform Admin real-session acceptance test

Use dedicated Proffera test accounts only. Never assign a Platform Admin role to a customer owner or member account for testing.

## Preconditions

- The account already exists through the normal Proffera authentication flow.
- The tester controls the account credentials and inbox.
- The account is not a customer Workspace owner.
- `super_admin` assigns one role at a time from `/admin/platform-admins`.
- Remove or deactivate the temporary Platform Admin record after verification.

## Expected access

| Role | SaaS | Workspaces | Billing | Platform Admins | Audit | Quote Admin | Company Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| super_admin | Allow | Allow | Allow | Allow | Allow | Allow | Allow |
| support_admin | Allow | Allow | Deny | Deny | Allow | Deny | Deny |
| billing_admin | Allow | Allow | Allow | Deny | Allow | Deny | Deny |
| operations_admin | Allow | Allow | Deny | Deny | Allow | Allow | Deny |
| read_only_admin | Allow | Allow | Deny | Deny | Allow | Deny | Deny |
| developer_admin | Allow | Allow | Deny | Deny | Allow | Allow | Deny |

## Test procedure for each account

1. Sign out of every existing Proffera session or use a clean private browser profile.
2. Sign in with the dedicated test account.
3. Open `/admin/saas` and confirm the shared navigation only shows allowed areas.
4. Open each allowed route and confirm it renders.
5. Manually enter every denied route and confirm redirect to `/admin/saas?denied=1`.
6. For `super_admin`, confirm `/admin/foretag` is available and Billing fields are read-only.
7. For all other roles, confirm `/admin/foretag` is denied.
8. Review `/admin/audit` and confirm role assignment/removal actions identify the correct actor.
9. Deactivate the test Platform Admin when finished.

## Audit mutation acceptance test

Use only records clearly labelled as Proffera test data.

1. Record the current status and reference ID.
2. Change a test Quote status from Quote Admin.
3. Confirm one `quote_request.status_updated` Audit entry exists with the correct admin actor, previous status and new status.
4. Change a test Company registration status from Company Admin.
5. Confirm one `company.registration_updated` entry exists with the correct actor and before/after values.
6. Restore the original test status through the same Admin flow and verify the restoring Audit entry.

Do not edit real customer records, Stripe-controlled subscription fields, payment information, tokens or secrets during acceptance testing.
