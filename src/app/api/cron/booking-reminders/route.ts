import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { processBookingReminders } from "@/lib/booking-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function bearerMatches(authorization: string | null, secret: string | undefined) {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function authorizedSchedulerRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  return bearerMatches(authorization, process.env.CRON_SECRET)
    || bearerMatches(authorization, process.env.PRODUCTION_SCHEDULER_SECRET);
}

export async function GET(request: Request) {
  if (!authorizedSchedulerRequest(request)) {
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
