import { NextResponse } from "next/server";
import { getSql } from "@/lib/db/server";

const allowedStatuses = ["pending", "approved", "rejected", "paused"] as const;

function isAllowedStatus(value: string) {
  return allowedStatuses.includes(value as (typeof allowedStatuses)[number]);
}

function hasAdminAccess(request: Request) {
  const expectedCode = (process.env.ADMIN_ACCESS_CODE ?? "").trim();
  const authorization = request.headers.get("authorization") ?? "";

  if (!expectedCode || !authorization.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = atob(authorization.slice(6));
    const separatorIndex = decoded.indexOf(":");
    return separatorIndex >= 0 && decoded.slice(separatorIndex + 1) === expectedCode;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!hasAdminAccess(request)) {
    return NextResponse.redirect(new URL("/admin/foretag", request.url));
  }

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const services = String(formData.get("services") ?? "");
  const sql = getSql();

  if (sql && id) {
    if (isAllowedStatus(status)) {
      await sql`
        update company_registrations
        set status = ${status}, updated_at = now()
        where id = ${id}
      `;
    }

    if (services.trim().length > 0 && services.length <= 300) {
      await sql`
        update company_registrations
        set services = ${services}, updated_at = now()
        where id = ${id}
      `;
    }
  }

  return NextResponse.redirect(new URL("/admin/foretag", request.url));
}
