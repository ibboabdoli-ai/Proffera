import { NextResponse } from "next/server";

import { sendBookingRescheduleEmail } from "@/features/email/booking-reschedule-email";
import { sendBookingCustomerSms } from "@/features/sms/booking-sms";
import {
  CalendarMoveValidationError,
  moveDashboardCalendarBooking,
} from "@/lib/dashboard-calendar-move";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      bookingId?: string;
      localStartsAt?: string;
      staffId?: string;
    };

    const bookingId = String(body.bookingId ?? "").trim();
    const localStartsAt = String(body.localStartsAt ?? "").trim();
    const staffId = String(body.staffId ?? "").trim();
    if (!bookingId || !localStartsAt) {
      return NextResponse.json({ ok: false, error: "time" }, { status: 400 });
    }

    const result = await moveDashboardCalendarBooking({ bookingId, localStartsAt, staffId });
    if (result.notification) {
      const notification = result.notification;
      await Promise.allSettled([
        notification.customerEmail
          ? sendBookingRescheduleEmail({
              customerName: notification.customerName,
              customerEmail: notification.customerEmail,
              companyName: result.workspaceName,
              service: notification.service,
              previousStartsAt: notification.previousStartsAt,
              startsAt: notification.startsAt,
              endsAt: notification.endsAt,
              city: notification.city,
              timeZone: result.timeZone,
            })
          : Promise.resolve(null),
        notification.customerPhone
          ? sendBookingCustomerSms({
              customerPhone: notification.customerPhone,
              companyName: result.workspaceName,
              status: "rescheduled",
              service: notification.service,
              previousStartsAt: notification.previousStartsAt,
              startsAt: notification.startsAt,
              timeZone: result.timeZone,
            })
          : Promise.resolve(null),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CalendarMoveValidationError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: 409 });
    }
    console.error("Failed to move dashboard calendar booking", error);
    return NextResponse.json({ ok: false, error: "save" }, { status: 500 });
  }
}
