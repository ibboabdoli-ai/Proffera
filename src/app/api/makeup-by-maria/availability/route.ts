import { NextResponse } from "next/server";

import { getMariaAvailability } from "@/lib/maria-booking-availability";
import { getMariaPreviewBookingReadiness } from "@/lib/maria-preview-booking";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  const readiness = await getMariaPreviewBookingReadiness();
  if (!readiness.enabled) {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 403, headers });
  }
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  const year = Number(params.get("year") ?? "");
  const kind = params.get("kind");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isInteger(year)
    || (kind !== "trial" && kind !== "without")
  ) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400, headers });

  const result = await getMariaAvailability({
    workspaceId: readiness.workspaceId, year, date, kind,
    timeZone: "Europe/Stockholm",
  });
  return result.ok
    ? NextResponse.json({ ok: true, times: result.slots }, { headers })
    : NextResponse.json({ ok: false, error: result.error },
        { status: result.error === "database" ? 503 : 409, headers });
}
