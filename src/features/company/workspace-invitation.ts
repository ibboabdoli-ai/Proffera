import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { getAuth } from "@/lib/auth";
import { getSql } from "@/lib/db/server";
import { sendWorkspaceInvitationEmail } from "@/features/email/lead-email";

const INVITATION_TTL_HOURS = 48;

type InvitationSummary = {
  companyName: string;
  contactName: string;
  email: string;
  expiresAt: string;
};

type Result =
  | { ok: true }
  | { ok: false; code: "invalid" | "expired" | "account" | "database" | "email" };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toSlug(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  const suffix = randomBytes(3).toString("hex");
  return `${base || "foretag"}-${suffix}`;
}

export async function createWorkspaceInvitation(registrationId: string, origin: string): Promise<Result> {
  const sql = getSql();
  if (!sql) return { ok: false, code: "database" };

  try {
    const rows = await sql`
      select id, company_name, contact_person, email, status
      from company_registrations
      where id = ${registrationId}::uuid
      limit 1
    `;
    const registration = rows[0];

    if (!registration || String(registration.status) !== "approved") {
      return { ok: false, code: "invalid" };
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);

    await sql`
      insert into workspace_invitations (
        company_registration_id,
        email,
        token_hash,
        status,
        expires_at
      ) values (
        ${registrationId}::uuid,
        ${String(registration.email).trim().toLowerCase()},
        ${tokenHash},
        'pending',
        ${expiresAt.toISOString()}::timestamptz
      )
      on conflict (company_registration_id) do update set
        email = excluded.email,
        token_hash = excluded.token_hash,
        status = 'pending',
        expires_at = excluded.expires_at,
        accepted_at = null,
        workspace_id = null,
        updated_at = now()
    `;

    const activationUrl = new URL(`/aktivera/${token}`, origin).toString();
    const sent = await sendWorkspaceInvitationEmail({
      companyName: String(registration.company_name),
      contactName: String(registration.contact_person),
      email: String(registration.email),
      activationUrl,
      expiresInHours: INVITATION_TTL_HOURS,
    });

    return sent.ok ? { ok: true } : { ok: false, code: "email" };
  } catch (error) {
    console.error("Failed to create workspace invitation", error);
    return { ok: false, code: "database" };
  }
}

export async function getWorkspaceInvitation(token: string): Promise<InvitationSummary | null> {
  const sql = getSql();
  if (!sql || !token) return null;

  try {
    const rows = await sql`
      select
        cr.company_name,
        cr.contact_person,
        wi.email,
        wi.expires_at
      from workspace_invitations wi
      join company_registrations cr on cr.id = wi.company_registration_id
      where wi.token_hash = ${hashToken(token)}
        and wi.status = 'pending'
        and wi.expires_at > now()
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;

    return {
      companyName: String(row.company_name),
      contactName: String(row.contact_person),
      email: String(row.email),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function claimWorkspaceInvitation(token: string, password: string): Promise<Result> {
  const sql = getSql();
  if (!sql || !token) return { ok: false, code: "invalid" };
  let reservedInvitationId = "";

  try {
    const invitationRows = await sql`
      select
        wi.id,
        wi.company_registration_id,
        wi.email,
        wi.expires_at,
        cr.company_name,
        cr.contact_person,
        cr.phone,
        cr.city
      from workspace_invitations wi
      join company_registrations cr on cr.id = wi.company_registration_id
      where wi.token_hash = ${hashToken(token)}
        and wi.status = 'pending'
      limit 1
    `;
    const invitation = invitationRows[0];

    if (!invitation) return { ok: false, code: "invalid" };
    if (new Date(String(invitation.expires_at)).getTime() <= Date.now()) {
      return { ok: false, code: "expired" };
    }

    const reservationRows = await sql`
      update workspace_invitations
      set status = 'accepted', accepted_at = now(), updated_at = now()
      where id = ${String(invitation.id)}::uuid
        and status = 'pending'
        and expires_at > now()
      returning id
    `;
    reservedInvitationId = String(reservationRows[0]?.id ?? "");

    if (!reservedInvitationId) {
      return { ok: false, code: "invalid" };
    }

    const email = String(invitation.email).trim().toLowerCase();
    const existingUsers = await sql`select id from "user" where lower("email") = lower(${email}) limit 1`;
    let userId = String(existingUsers[0]?.id ?? "");

    if (userId) {
      const memberships = await sql`
        select id from workspace_memberships where user_id = ${userId} limit 1
      `;
      if (memberships[0]?.id) {
        await sql`
          update workspace_invitations
          set status = 'pending', accepted_at = null, updated_at = now()
          where id = ${reservedInvitationId}::uuid and workspace_id is null
        `;
        reservedInvitationId = "";
        return { ok: false, code: "account" };
      }
    }

    if (!userId) {
      try {
        const signUp = await getAuth().api.signUpEmail({
          body: {
            name: String(invitation.contact_person),
            email,
            password,
          },
        });
        userId = String(signUp.user.id);
      } catch (error) {
        console.error("Failed to create invited Better Auth user", error);
        await sql`
          update workspace_invitations
          set status = 'pending', accepted_at = null, updated_at = now()
          where id = ${reservedInvitationId}::uuid and workspace_id is null
        `;
        reservedInvitationId = "";
        return { ok: false, code: "account" };
      }
    }

    const workspaceId = randomUUID();
    const workspaceSlug = toSlug(String(invitation.company_name));

    await sql.transaction((tx) => [
      tx`
        insert into workspaces (
          id, slug, name, company_name, primary_city, contact_email, contact_phone,
          status
        ) values (
          ${workspaceId}::uuid, ${workspaceSlug}, ${String(invitation.company_name)},
          ${String(invitation.company_name)}, ${String(invitation.city)}, ${email},
          ${String(invitation.phone)}, 'trial'
        )
      `,
      tx`
        insert into workspace_memberships (id, workspace_id, user_id, role)
        values (gen_random_uuid(), ${workspaceId}::uuid, ${userId}, 'owner')
        on conflict (workspace_id, user_id) do nothing
      `,
      tx`
        insert into workspace_settings (
          workspace_id, company_name, primary_city, response_time_goal,
          default_cta, contact_email, contact_phone
        ) values (
          ${workspaceId}, ${String(invitation.company_name)}, ${String(invitation.city)},
          'Inom 24 timmar', 'Boka tid', ${email}, ${String(invitation.phone)}
        )
        on conflict (workspace_id) do nothing
      `,
      tx`
        insert into workspace_plans (id, workspace_id, plan_key, status, current_period_start, current_period_end)
        values (gen_random_uuid(), ${workspaceId}::uuid, 'starter', 'trialing', now(), now() + interval '14 days')
      `,
      tx`
        insert into workspace_feature_flags (id, workspace_id, feature_key, enabled)
        values
          (gen_random_uuid(), ${workspaceId}::uuid, 'booking_demo', true),
          (gen_random_uuid(), ${workspaceId}::uuid, 'crm_customers', true),
          (gen_random_uuid(), ${workspaceId}::uuid, 'lead_inbox', true)
        on conflict (workspace_id, feature_key) do update set enabled = excluded.enabled, updated_at = now()
      `,
      tx`
        update workspace_invitations
        set workspace_id = ${workspaceId}::uuid, updated_at = now()
        where id = ${reservedInvitationId}::uuid and status = 'accepted'
      `,
    ]);

    reservedInvitationId = "";
    return { ok: true };
  } catch (error) {
    console.error("Failed to claim workspace invitation", error);
    if (reservedInvitationId) {
      await sql`
        update workspace_invitations
        set status = 'pending', accepted_at = null, updated_at = now()
        where id = ${reservedInvitationId}::uuid and workspace_id is null
      `.catch(() => undefined);
    }
    return { ok: false, code: "database" };
  }
}
