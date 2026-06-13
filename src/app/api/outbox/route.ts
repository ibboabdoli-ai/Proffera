import { NextResponse } from "next/server";
import { sendLeadEmail } from "@/features/email/lead-email";
import { getLeadMatches } from "@/features/matching/list";
import { addOutboxRow } from "@/features/outbox/log";

export async function POST(request: Request) {
  const formData = await request.formData();

  const code = String(formData.get("code") ?? "");
  const adminCode = process.env.ADMIN_ACCESS_CODE;
  const method = String(formData.get("method") ?? "mailto");
  const leadRef = String(formData.get("leadRef") ?? "");
  const companyName = String(formData.get("companyName") ?? "");
  const companyEmail = String(formData.get("companyEmail") ?? "");

  const url = new URL("/admin/leverans", request.url);
  if (code) {
    url.searchParams.set("code", code);
  }

  if (!adminCode || code !== adminCode) {
    return NextResponse.redirect(url);
  }

  if (method === "resend") {
    const matches = await getLeadMatches();
    const leadMatch = matches.ok ? matches.matches.find((item) => item.lead.reference_id === leadRef) : null;
    const company = leadMatch?.companies.find((item) => item.email === companyEmail);

    if (!leadMatch || !company) {
      url.searchParams.set("send", "not_found");
      return NextResponse.redirect(url);
    }

    const sent = await sendLeadEmail({
      leadRef: leadMatch.lead.reference_id,
      companyName: company.company_name,
      companyEmail: company.email,
      category: leadMatch.lead.category,
      serviceType: leadMatch.lead.service_type,
      city: leadMatch.lead.city,
      description: leadMatch.lead.description,
    });

    if (!sent.ok) {
      url.searchParams.set("send", "email_not_configured");
      return NextResponse.redirect(url);
    }
  }

  await addOutboxRow({
    leadRef,
    companyName,
    companyEmail,
    method,
  });

  url.searchParams.set("send", method === "resend" ? "resend_success" : "mailto_marked");
  return NextResponse.redirect(url);
}
