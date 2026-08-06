"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminForArea } from "@/lib/admin-authorization";
import { getSql } from "@/lib/db/server";

const allowedStatuses = [
  "submitted",
  "pending_review",
  "approved",
  "matched",
  "answered",
  "booked",
  "completed",
  "cancelled",
  "rejected",
] as const;

type AllowedStatus = (typeof allowedStatuses)[number];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAllowedStatus(value: string): value is AllowedStatus {
  return allowedStatuses.includes(value as AllowedStatus);
}

export async function updateQuoteRequestStatus(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");
  const admin = await getAdminForArea("quote");
  const sql = getSql();

  if (!admin || !sql || !uuidPattern.test(requestId) || !isAllowedStatus(nextStatus)) {
    redirect("/admin/status");
  }

  await sql`
    with previous as (
      select id, reference_id, status
      from quote_requests
      where id = ${requestId}::uuid
      for update
    ),
    updated as (
      update quote_requests qr
      set status = ${nextStatus}, updated_at = now()
      from previous p
      where qr.id = p.id
        and p.status <> ${nextStatus}
      returning qr.id, p.reference_id, p.status as previous_status, qr.status as next_status
    )
    insert into admin_audit_logs (
      admin_user_id, action, reason, previous_value, new_value
    )
    select
      ${admin.userId},
      'quote_request.status_updated',
      'Quote request status changed from Quote Admin',
      jsonb_build_object('request_id', id, 'reference_id', reference_id, 'status', previous_status),
      jsonb_build_object('request_id', id, 'reference_id', reference_id, 'status', next_status)
    from updated
  `;

  revalidatePath("/admin");
  revalidatePath("/admin/status");
  redirect("/admin/status");
}
