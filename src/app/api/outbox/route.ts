import { NextResponse } from "next/server";

import { getLeadMatches } from "@/features/matching/list";
import { addOutboxRow } from "@/features/outbox/log";
import { getAdminForArea } from "@/lib/admin-authorization";
import { getSql } from "@/lib/db/server";

const allowedMethods = new Set(["mailto"]);

export async function POST(request: Request) {
  const admin = await getAdminForArea("quote_admin");
  const requestUrl = new URL(request.url);
  const requestOrigin = request.headers.get("origin");
  const url = new URL("/admin/leverans", request.url);

  if (!admin || (requestOrigin && requestOrigin !== requestUrl.origin)) {
    url.searchParams.set("send", "forbidden");
    return NextResponse.redirect(url);
  }

  const formData = await request.formData();
  const method = String(formData.get("method") ?? "mailto");
  const leadRef = String(formData.get("leadRef") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const companyEmail = String(formData.get("companyEmail") ?? "").trim().toLowerCase();

  if (
    !allowedMethods.has(method) || !leadRef || leadRef.length > 160 ||
    !companyName || companyName.length > 240 || !companyEmail || companyEmail.length > 320
  ) {
    url.searchParams.set("send", "invalid");
    return NextResponse.redirect(url);
  }

  const matches = await getLeadMatches();
  const leadMatch = matches.ok ? matches.matches.find((item) => item.lead.reference_id === leadRef) : null;
  const suggestion = leadMatch?.suggestions.find(
    (item) => item.email.toLowerCase() === companyEmail && item.companyName === companyName,
  );

  if (!leadMatch || !suggestion) {
    url.searchParams.set("send", "not_found");
    return NextResponse.redirect(url);
  }

  const logged = await addOutboxRow({
    leadRef: leadMatch.lead.reference_id,
    companyName: suggestion.companyName,
    companyEmail: suggestion.email,
    method: "mailto",
  });
  if (!logged.ok) {
    url.searchParams.set("send", "log_error");
    return NextResponse.redirect(url);
  }

  const sql = getSql();
  if (sql) {
    try {
      await sql`
        insert into admin_audit_logs (
          admin_user_id, action, reason, previous_value, new_value
        ) values (
          ${admin.userId},
          'quote.lead_delivery_recorded',
          ${`Manual mailto delivery recorded for ${leadRef}`},
          null,
          ${JSON.stringify({
            lead_ref: leadMatch.lead.reference_id,
            company_name: suggestion.companyName,
            company_email: suggestion.email,
            method: "mailto",
            duplicate: logged.duplicate,
            email_sent: false,
          })}::jsonb
        )
      `;
    } catch (error) {
      console.error("Failed to write lead delivery admin audit log", error);
    }
  }

  url.searchParams.set("send", "mailto_marked");
  return NextResponse.redirect(url);
}
