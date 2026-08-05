import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";

function cleanOptional(value: string, maxLength: number) {
  const cleaned = value.trim();
  if (cleaned.length > maxLength) throw new Error("Value is too long");
  return cleaned || null;
}

export async function updateWorkspaceContactInEditSession(input: {
  sessionId: string;
  contactEmail: string;
  contactPhone: string;
  primaryCity: string;
}) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql || admin.role !== "super_admin") {
    throw new Error("Super admin access required");
  }

  const contactEmail = cleanOptional(input.contactEmail, 320);
  const contactPhone = cleanOptional(input.contactPhone, 80);
  const primaryCity = cleanOptional(input.primaryCity, 160);

  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error("Invalid email address");
  }

  const sessions = await sql`
    select id, workspace_id, reason
    from admin_support_sessions
    where id = ${input.sessionId}::uuid
      and admin_user_id = ${admin.userId}
      and status = 'active'
      and mode = 'edit'
      and expires_at > now()
    limit 1
  `;
  const supportSession = sessions[0];
  if (!supportSession) throw new Error("An active edit session is required");

  const workspaceId = String(supportSession.workspace_id);
  const previousRows = await sql`
    select contact_email, contact_phone, primary_city
    from workspace_settings
    where workspace_id = ${workspaceId}
    limit 1
  `;
  const previous = previousRows[0];
  if (!previous) throw new Error("Workspace settings not found");

  const nextValue = {
    contact_email: contactEmail,
    contact_phone: contactPhone,
    primary_city: primaryCity,
  };

  await sql.transaction((tx) => [
    tx`
      update workspace_settings
      set contact_email = ${contactEmail},
          contact_phone = ${contactPhone},
          primary_city = ${primaryCity},
          updated_at = now()
      where workspace_id = ${workspaceId}
    `,
    tx`
      insert into admin_audit_logs (
        admin_user_id, workspace_id, support_session_id, action, reason,
        previous_value, new_value
      ) values (
        ${admin.userId}, ${workspaceId}::uuid, ${input.sessionId}::uuid,
        'workspace.contact.updated', ${String(supportSession.reason)},
        ${JSON.stringify({
          contact_email: previous.contact_email ?? null,
          contact_phone: previous.contact_phone ?? null,
          primary_city: previous.primary_city ?? null,
        })}::jsonb,
        ${JSON.stringify(nextValue)}::jsonb
      )
    `,
  ]);
}
