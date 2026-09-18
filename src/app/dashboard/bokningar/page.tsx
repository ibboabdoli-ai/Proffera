import Link from "next/link";
import { CalendarCheck2, CalendarClock, CalendarPlus, CheckCircle2, ClipboardList, Clock3 } from "lucide-react";

import { DashboardDataPanel, DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardBookingsInStockholm } from "@/lib/dashboard-bookings-db";

export const dynamic = "force-dynamic";

const statusStyles: Record<string, string> = {
  draft: "bg-surface-subtle text-ink-muted",
  requested: "bg-[#fff7df] text-[#805d14]",
  confirmed: "bg-[#eaf8f2] text-[#087754]",
  completed: "bg-surface-subtle text-brand-deep",
  cancelled: "bg-danger/10 text-danger",
  no_show: "bg-danger/10 text-danger",
};

const statusLabels = {
  sv: { draft: "Utkast", requested: "Förfrågan", confirmed: "Bekräftad", completed: "Klar", cancelled: "Avbokad", no_show: "Uteblev" },
  en: { draft: "Draft", requested: "Requested", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" },
} as const;

function withLang(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

function getNextStep(status: string, isEnglish: boolean) {
  if (isEnglish) {
    if (status === "confirmed") return "Prepare visit";
    if (status === "completed") return "Follow up with customer";
    if (status === "cancelled") return "Reschedule";
    if (status === "no_show") return "Contact customer";
    return "Confirm time";
  }
  if (status === "confirmed") return "Förbered besök";
  if (status === "completed") return "Följ upp kund";
  if (status === "cancelled") return "Boka om";
  if (status === "no_show") return "Kontakta kund";
  return "Bekräfta tid";
}

function shouldShowBookingTitle(title: string, service: string) {
  return title.trim().toLocaleLowerCase("sv-SE") !== service.trim().toLocaleLowerCase("sv-SE");
}

type BookingsPageProps = { searchParams?: Promise<{ lang?: string | string[] }> };

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const lang = Array.isArray(params?.lang) ? params?.lang[0] : params?.lang;
  const isEnglish = lang === "en";
  const bookings = await getDashboardBookingsInStockholm();
  const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed").length;
  const requestedBookings = bookings.filter((booking) => booking.status === "requested").length;
  const completedBookings = bookings.filter((booking) => booking.status === "completed").length;
  const labels = isEnglish ? statusLabels.en : statusLabels.sv;

  const summary = isEnglish ? [
    { label: "Bookings shown", value: String(bookings.length), helper: "Upcoming and recent appointments", icon: ClipboardList, tone: "bg-brand-soft text-brand" },
    { label: "Confirmed", value: String(confirmedBookings), helper: "Bookings ready to be completed", icon: CalendarCheck2, tone: "bg-surface-subtle text-brand-deep" },
    { label: "Requests", value: String(requestedBookings), helper: "Times waiting for a response", icon: Clock3, tone: "bg-accent-soft/35 text-brand-deep" },
    { label: "Completed", value: String(completedBookings), helper: "Completed jobs to follow up", icon: CheckCircle2, tone: "bg-canvas text-ink-muted" },
  ] as const : [
    { label: "Visade bokningar", value: String(bookings.length), helper: "Kommande och senaste tider", icon: ClipboardList, tone: "bg-brand-soft text-brand" },
    { label: "Bekräftade", value: String(confirmedBookings), helper: "Bokningar redo att utföras", icon: CalendarCheck2, tone: "bg-surface-subtle text-brand-deep" },
    { label: "Förfrågningar", value: String(requestedBookings), helper: "Tider som väntar på svar", icon: Clock3, tone: "bg-accent-soft/35 text-brand-deep" },
    { label: "Klara", value: String(completedBookings), helper: "Genomförda jobb att följa upp", icon: CheckCircle2, tone: "bg-canvas text-ink-muted" },
  ] as const;

  const columnLabels = isEnglish
    ? ["Time", "Customer", "Service", "Location", "Status", "Next step", "Profile"]
    : ["Tid", "Kund", "Tjänst", "Ort", "Status", "Nästa steg", "Profil"];

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow={isEnglish ? "Bookings" : "Bokningar"}
        title={isEnglish ? "Plan and manage bookings" : "Planera och följ bokningar"}
        description={isEnglish ? "View current bookings with time, customer, service, location and next step. Use this overview to see what needs confirmation, completion or follow-up." : "Se aktuella bokningar med tid, kund, tjänst, ort och nästa steg. Använd vyn för att snabbt se vad som behöver bekräftas, utföras eller följas upp."}
        icon={CalendarClock}
        actions={<Link href={withLang("/dashboard/bokningar/ny", isEnglish)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand-deep px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-brand-hover"><CalendarPlus className="h-4 w-4" aria-hidden="true" />{isEnglish ? "New booking" : "Ny bokning"}</Link>}
      />

      <DashboardMetricGrid items={summary} />

      <DashboardDataPanel title={isEnglish ? "Current bookings" : "Aktuella bokningar"} description={isEnglish ? "Overview with time, customer, service, status and next action." : "Översikt med tid, kund, tjänst, status och nästa åtgärd."} count={bookings.length}>
        {bookings.length === 0 ? (
          <div className="p-5 sm:p-6"><div className="rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] p-6 text-center text-sm text-ink-muted"><h4 className="font-bold text-ink">{isEnglish ? "No bookings yet" : "Inga bokningar ännu"}</h4><p className="mt-2 leading-7">{isEnglish ? "New bookings will appear here with time, customer, status and a link to the booking profile." : "När bokningar skapas visas de här med tid, kund, status och länk till bokningsprofilen."}</p><Link href={withLang("/dashboard/bokningar/ny", isEnglish)} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-control bg-brand-deep px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-hover">{isEnglish ? "Create first booking" : "Skapa första bokningen"}</Link></div></div>
        ) : (
          <>
            <div className="hidden grid-cols-[1.15fr_1.15fr_1fr_0.8fr_0.8fr_1fr_1fr] gap-4 border-b border-line bg-surface-subtle px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted lg:grid">{columnLabels.map((label) => <span key={label}>{label}</span>)}</div>
            {bookings.map((booking) => (
              <div key={booking.id} className="mx-3 my-3 grid gap-3 rounded-card border border-line bg-surface p-4 text-sm text-ink-muted shadow-sm lg:mx-0 lg:my-0 lg:grid-cols-[1.15fr_1.15fr_1fr_0.8fr_0.8fr_1fr_1fr] lg:items-center lg:gap-4 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:px-6 lg:py-4 lg:shadow-none lg:last:border-b-0">
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted lg:hidden">{columnLabels[0]}</p><p className="font-semibold text-brand">{booking.time}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted lg:hidden">{columnLabels[1]}</p><p className="font-semibold text-ink">{booking.customer}</p>{shouldShowBookingTitle(booking.title, booking.service) ? <p className="text-xs text-ink-muted">{booking.title}</p> : null}</div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted lg:hidden">{columnLabels[2]}</p><p>{booking.service}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted lg:hidden">{columnLabels[3]}</p><p>{booking.city}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted lg:hidden">{columnLabels[4]}</p><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[booking.status] ?? "bg-surface-subtle text-ink-muted"}`}>{labels[booking.status as keyof typeof labels] ?? booking.status}</span></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted lg:hidden">{columnLabels[5]}</p><p className="font-semibold text-brand">{getNextStep(booking.status, isEnglish)}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted lg:hidden">{columnLabels[6]}</p><Link href={withLang(`/dashboard/bokningar/${booking.id}`, isEnglish)} className="inline-flex min-h-9 items-center justify-center rounded-control bg-brand-deep px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-hover">{isEnglish ? "View booking" : "Visa bokning"}</Link></div>
              </div>
            ))}
          </>
        )}
      </DashboardDataPanel>

      <section className="rounded-card border border-line bg-surface shadow-card">
        <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
          <article className="p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{isEnglish ? "Booking workflow" : "Bokningsarbete"}</p>
            <h3 className="mt-2 text-lg font-bold text-ink">{isEnglish ? "Less manual work" : "Mindre manuellt arbete"}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{isEnglish ? "A clear booking overview makes it easier to see which times need confirmation, which jobs are ready and which customers need follow-up." : "En tydlig bokningsvy gör det enklare att se vilka tider som ska bekräftas, vilka jobb som är redo och vilka kunder som behöver uppföljning."}</p>
          </article>
          <article className="p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{isEnglish ? "Next layer" : "Nästa lager"}</p>
            <h3 className="mt-2 text-lg font-bold text-ink">{isEnglish ? "Reminders and calendar" : "Påminnelser och kalender"}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{isEnglish ? "Automatic confirmations, reminders and calendar connections make it easier to keep each booking updated." : "Automatiska bekräftelser, påminnelser och kalenderkopplingar gör det enklare att hålla varje bokning uppdaterad."}</p>
          </article>
        </div>
      </section>
    </div>
  );
}
