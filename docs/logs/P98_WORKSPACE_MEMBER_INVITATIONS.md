# P98 — Workspace member invitations

## Outcome

Workspace owners can now invite a person who does not already have a Proffera account from **Inställningar → Team och behörigheter**. Existing users are still added directly.

## Flow

1. The owner enters the person's name, email address, and role.
2. Proffera stores only a SHA-256 hash of a 32-byte invitation token.
3. A Brevo email delivers the one-time link, which expires after 48 hours.
4. The recipient chooses a password. Proffera creates the account and its membership in the invited workspace only.

## Safeguards

- Only workspace owners can create invitations.
- Roles are limited to Admin, Staff, or Viewer; Owner cannot be assigned through this flow.
- Re-inviting the same email replaces the old pending link.
- A claimed or expired link cannot be used again.
- The AI assistant remains unchanged.

## Deployment requirement

Run `db/migrations/20260718_0009_workspace_member_invitations.sql` in Neon before testing the flow in production.
