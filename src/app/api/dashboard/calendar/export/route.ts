import { getDashboardCalendarEvents } from "@/lib/dashboard-calendar";

export const dynamic = "force-dynamic";

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function formatUtc(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET() {
  try {
    const events = await getDashboardCalendarEvents();
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Proffera//Business Calendar//SV",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...events.flatMap((event) => {
        const summary = event.type === "booking"
          ? `${event.customerName} – ${event.service}`
          : event.type === "time_off"
            ? `${event.staffName} – ${event.title}`
            : event.title;
        const description = [
          event.service,
          event.staffName ? `Personal: ${event.staffName}` : "",
          event.status ? `Status: ${event.status}` : "",
        ].filter(Boolean).join("\n");
        return [
          "BEGIN:VEVENT",
          `UID:${escapeIcs(`${event.type}-${event.id}`)}@proffera.se`,
          `DTSTAMP:${formatUtc(new Date().toISOString())}`,
          `DTSTART:${formatUtc(event.startsAt)}`,
          `DTEND:${formatUtc(event.endsAt)}`,
          `SUMMARY:${escapeIcs(summary)}`,
          `DESCRIPTION:${escapeIcs(description)}`,
          event.city ? `LOCATION:${escapeIcs(event.city)}` : "",
          "END:VEVENT",
        ].filter(Boolean);
      }),
      "END:VCALENDAR",
      "",
    ].join("\r\n");

    return new Response(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=proffera-business-calendar.ics",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export dashboard calendar", error);
    return new Response("Unauthorized", { status: 401 });
  }
}
