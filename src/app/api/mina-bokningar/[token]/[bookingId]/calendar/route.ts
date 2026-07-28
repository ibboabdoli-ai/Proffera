import { getCustomerCalendarBooking } from "@/lib/customer-calendar";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string; bookingId: string }>;
};

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function formatUtc(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET(_request: Request, context: RouteContext) {
  const { token, bookingId } = await context.params;
  const booking = await getCustomerCalendarBooking(token, bookingId);
  if (!booking) return new Response("Not found", { status: 404 });

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Proffera//Mina bokningar//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(booking.id)}@proffera.se`,
    `DTSTAMP:${formatUtc(new Date().toISOString())}`,
    `DTSTART:${formatUtc(booking.startsAt)}`,
    `DTEND:${formatUtc(booking.endsAt)}`,
    `SUMMARY:${escapeIcs(booking.title || booking.service)}`,
    `DESCRIPTION:${escapeIcs(booking.service)}`,
    booking.city ? `LOCATION:${escapeIcs(booking.city)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].filter(Boolean).join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename=proffera-${booking.id}.ics`,
      "Cache-Control": "private, no-store",
    },
  });
}
