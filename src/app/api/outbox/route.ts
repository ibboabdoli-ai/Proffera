import { NextResponse } from "next/server";
import { addOutboxRow } from "@/features/outbox/log";

export async function POST(request: Request) {
  const formData = await request.formData();

  const code = String(formData.get("code") ?? "");
  const adminCode = process.env.ADMIN_ACCESS_CODE;

  if (!adminCode || code !== adminCode) {
    return NextResponse.redirect(new URL("/admin/leverans", request.url));
  }

  await addOutboxRow({
    leadRef: String(formData.get("leadRef") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    companyEmail: String(formData.get("companyEmail") ?? ""),
    method: "mailto",
  });

  const url = new URL("/admin/leverans", request.url);
  url.searchParams.set("code", code);
  return NextResponse.redirect(url);
}
