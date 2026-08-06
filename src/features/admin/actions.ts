"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isQuoteRequestStatus,
  persistQuoteRequestStatusChange,
} from "@/features/admin/quote-request-status";
import { getAdminForArea } from "@/lib/admin-authorization";
import { getSql } from "@/lib/db/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateQuoteRequestStatus(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");
  const admin = await getAdminForArea("quote_admin");
  const sql = getSql();

  if (!admin || !sql || !uuidPattern.test(requestId) || !isQuoteRequestStatus(nextStatus)) {
    redirect("/admin/status");
  }

  await persistQuoteRequestStatusChange({
    sql,
    adminUserId: admin.userId,
    requestId,
    nextStatus,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/status");
  redirect("/admin/status");
}
