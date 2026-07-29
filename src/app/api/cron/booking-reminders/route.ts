import { NextResponse } from "next/server";

import { processBookingReminders } from "@/lib/booking-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processBookingReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Booking reminder cron failed", error);
    return NextResponse.json({ ok: false, error: "Reminder processing failed" }, { status: 500 });
  }
}
