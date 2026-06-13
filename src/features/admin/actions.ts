"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function isAllowedStatus(value: string): value is AllowedStatus {
  return allowedStatuses.includes(value as AllowedStatus);
}

export async function updateQuoteRequestStatus(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");

  if (!requestId || !isAllowedStatus(nextStatus)) {
    redirect("/admin/status");
  }

  const sql = getSql();

  if (!sql) {
    redirect("/admin/status");
  }

  await sql`
    update quote_requests
    set status = ${nextStatus}, updated_at = now()
    where id = ${requestId}
  `;

  revalidatePath("/admin");
  revalidatePath("/admin/status");
  redirect("/admin/status");
}
