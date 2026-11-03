import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CalendarDays, ChevronLeft, Clock3, ShieldCheck } from "lucide-react";

import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";
import {
  changeMariaManualCalendar, MariaCalendarError, readMariaManualCalendar,
  type MariaCalendarView,
} from "@/lib/maria-manual-calendar";
import { nextMariaCalendarDay, stockholmCalendarToday } from "@/lib/maria-manual-calendar-policy";
import { MariaCalendarConfirmButton } from "./maria-calendar-confirm-button";

export const dynamic = "force-dynamic";

type Params = { date?: string | string[]; error?: string | string[]; lang?: string | string[] };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

async function calendarMutation(formData: FormData) {
  "use server";
  const date = String(formData.get("date") ?? "");
  const clock = String(formData.get("clock") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const isEnglish = formData.get("lang") === "en";
  const suffix = isEnglish ? "&lang=en" : "";
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : nextMariaCalendarDay();
  // Client-side dialogs are convenience only. No JavaScript/no hydration
  // must fail closed rather than performing an unconfirmed mutation.
  if (formData.get("confirmed") !== "yes") {
    redirect(`/dashboard/maria/kalender?date=${safeDate}&error=confirm${suffix}`);
  }
  if (mode !== "open" && mode !== "close" && mode !== "open_day" && mode !== "close_day") {
    redirect(`/dashboard/maria/kalender?date=${safeDate}&error=time${suffix}`);
  }
  try {
    await changeMariaManualCalendar({date,clock,mode});
  } catch (error) {
    const code = error instanceof MariaCalendarError ? error.code : "database";
    redirect(`/dashboard/maria/kalender?date=${safeDate}&error=${code}${suffix}`);
  }
  revalidatePath("/dashboard/maria/kalender");
  redirect(`/dashboard/maria/kalender?date=${safeDate}${suffix}`);
}

function formatBookingTime(value: string, language: "sv" | "en") {
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "sv-SE", {
    timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

function formDetails(date: string, mode: string, clock: string, lang: "sv" | "en") {
  return <>
    <input type="hidden" name="date" value={date} />
    <input type="hidden" name="mode" value={mode} />
    <input type="hidden" name="clock" value={clock} />
    <input type="hidden" name="lang" value={lang} />
  </>;
}

export default async function MariaManualCalendarPage({searchParams}: {searchParams?: Promise<Params>}) {
  const access = await getUserWorkspaceAccess();
  if (process.env.VERCEL_ENV !== "preview" || !access.ok
    || access.workspaceSlug !== "makeup-by-maria" || !canManageWorkspaceSettings(access)
    || !(await hasDashboardModuleAccess("online_booking"))) redirect("/dashboard");

  const query = (await searchParams) ?? {};
  const lang = first(query.lang) === "en" ? "en" : "sv";
  const t = (sv: string, en: string) => lang === "en" ? en : sv;
  const date = first(query.date) ?? nextMariaCalendarDay();
  let view: MariaCalendarView | null = null;
  let error = first(query.error) ?? "";
  try { view = await readMariaManualCalendar(date); }
  catch (failure) { error = failure instanceof MariaCalendarError ? failure.code : "database"; }

  const errorTexts: Record<string,string> = {
    date: t("Välj ett framtida datum på fredag, lördag eller söndag.", "Choose a future Friday, Saturday or Sunday."),
    schedule: t("Dagen är stängd i ordinarie arbetstider. Ändra arbetstiderna först.", "The day is closed in regular working hours. Edit those hours first."),
    time: t("Tiden har passerat eller är inte tillåten. Välj ett nytt intervall.", "This interval is past or unavailable. Choose another."),
    confirm: t("Bekräfta ändringen i dialogrutan innan den sparas.", "Please confirm the change in the dialog before saving."),
    conflict: t("En kund verifierar en bokning, eller arbetstiderna ändrades. Inga nya block skapades. Uppdatera och försök igen.", "A customer is verifying a booking, or working hours changed. No new blocks were created. Refresh and try again."),
    database: t("Kalendern kunde inte sparas eller läsas. Inga nya tider visas som lediga.", "The calendar could not be saved or read. No times are shown as available."),
    access: t("Du saknar behörighet till Maria-kalendern.", "You do not have access to Maria's calendar."),
  };
  const activeDate = view?.date ?? nextMariaCalendarDay();
  // The server reader supplies a stable timestamp, not an impure render-time clock.
  const now = view?.snapshotAtEpoch ?? 0;
  const upcoming = (view?.slots ?? []).filter(s => Date.parse(s.startsAt) > now);
  const canCloseDay = upcoming.some(s => !s.manuallyClosed);
  const canOpenDay = (view?.futureManualBlockCount ?? 0) > 0;
  const paramSuffix = lang === "en" ? "?lang=en" : "";

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-2 pb-10 sm:px-0">
      <header className="rounded-2xl border border-[#e8d9dc] bg-[#fcf9f8] p-5 sm:p-7">
        <Link href={`/dashboard/maria${paramSuffix}`}
          className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#754b5a]">
          <ChevronLeft size={16}/>{t("Till bokningsöversikten","Back to bookings")}
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-[#352a2c]">{t("Öppna eller stäng bokningstider","Open or close booking starts")}</h1>
        <p className="mt-2 text-sm leading-6 text-[#705f65]">
          {t("Kunden bokar först. När du har granskat bokningen och betalningen väljer du själv vilka andra starttider som ska vara öppna eller stängda. Inget stängs automatiskt.",
            "The customer books first. After checking the booking and payment, you choose which other appointment starts stay open or closed. Nothing closes automatically.")}
        </p>
        <Link href="/dashboard/bokningar" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-[#bfa1a9] bg-white px-4 py-2 text-sm font-semibold text-[#754b5a]">
          {t("1. Kontrollera bokning och Swish", "1. Review bookings and Swish")}
        </Link>
        <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="lang" value={lang}/>
          <label className="grid flex-1 gap-2 text-sm font-semibold text-[#634853]">
            {t("Datum (fre–sön)","Date (Fri–Sun)")}
            <input type="date" name="date" required min={stockholmCalendarToday()} max="2036-12-31"
              defaultValue={/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : activeDate}
              className="min-h-12 rounded-lg border border-[#d8c4cb] bg-white px-3 text-[#352a2c]"/>
          </label>
          <button type="submit" className="min-h-12 rounded-lg bg-[#845363] px-5 text-sm font-semibold text-white">
            {t("Visa dagen","Show day")}
          </button>
        </form>
      </header>

      {error && <p role="alert" className="rounded-xl border border-[#efc6bd] bg-[#fff5f2] p-4 text-sm text-[#7a1f1f]">
        {errorTexts[error] ?? errorTexts.database}
      </p>}

      {view && <>
        <section className="rounded-2xl border border-[#e8d9dc] bg-white p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <CalendarDays className="text-[#845363]" size={23}/>
            <h2 className="font-serif text-xl text-[#352a2c]">
              {new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "sv-SE", {
                timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
              }).format(new Date(`${view.date}T12:00:00Z`))}
            </h2>
          </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <form action={calendarMutation} className="grid">
                  {formDetails(view.date,"close_day","",lang)}
                  <MariaCalendarConfirmButton kind="close" label={t("Stäng alla lediga starttider","Close all remaining starts")}
                    confirmation={t("Stäng alla återstående starttider? Befintliga bokningar påverkas inte.",
                      "Close all remaining starts? Existing bookings will not change.")}
                    disabled={!canCloseDay}/>
                </form>
                <form action={calendarMutation} className="grid">
                  {formDetails(view.date,"open_day","",lang)}
                  <MariaCalendarConfirmButton kind="open" label={t("Öppna alla manuellt stängda","Open all manually closed")}
                    confirmation={t("Ta bort dagens manuella stängningar? Bokade tider förblir upptagna.",
                      "Remove today's manual blocks? Existing appointments stay occupied.")}
                    disabled={!canOpenDay}/>
                </form>
              </div>
          {view.weeklyClosed ? (
            <p className="mt-4 rounded-lg bg-[#fff5f2] p-4 text-sm text-[#6d3e4e]">
              {t("Denna veckodag är stängd i dina vanliga arbetstider. Öppna den under Mina arbetstider.",
                "This weekday is closed in your regular working hours. Open it under Working hours.")}
              <Link href="/dashboard/maria#tider" className="ml-2 font-bold underline">
                {t("Ändra arbetstider","Edit working hours")}
              </Link>
            </p>
          ) : (
            <>
              <p className="mt-3 text-xs leading-5 text-[#705f65]">
                {t("2. Varje rad är en möjlig starttid, inte behandlingens längd. Du öppnar eller stänger just den tid du väljer. Befintliga bokningar och pågående verifieringar blockerar fortfarande tider som krockar.",
                  "2. Each row is a possible appointment start, not a treatment length. You open or close only the chosen start. Existing bookings and active verifications still block overlapping times.")}
              </p>
              <div className="mt-5 space-y-3">
                {view.slots.map(slot => {
                  const past = Date.parse(slot.startsAt) <= now;
                  const occupied = slot.appointmentCount > 0;
                  const verifying = slot.holdCount > 0;
                  const protectedStart = !slot.manuallyClosed && (occupied || verifying);
                  return <article key={slot.clock} className="flex flex-col gap-3 rounded-xl border border-[#e8d9dc] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5">
                      <p className="inline-flex items-center gap-2 font-bold text-[#352a2c]">
                        <Clock3 size={16}/>{slot.clock}
                      </p>
                      <p className="text-xs text-[#705f65]">{slot.manuallyClosed
                        ? t("Stängd av Maria","Closed by Maria")
                        : t("Öppen om ingen bokning krockar","Open if no booking conflicts")}</p>
                      {slot.appointmentCount > 0 && <p className="text-xs font-semibold text-[#7c4b5a]">
                        {t("Bokning eller förfrågan under denna tid","Booking or request during this time")}
                      </p>}
                      {slot.holdCount > 0 && <p className="text-xs text-[#705f65]">
                        {t("E-postverifiering pågår","Email verification hold active")}
                      </p>}
                      {slot.otherBlock && <p className="text-xs text-[#705f65]">
                        {t("Även blockerat i den vanliga kalendern","Also blocked in the regular calendar")}
                      </p>}
                    </div>
                    <form action={calendarMutation} className="grid sm:w-44">
                      {formDetails(view.date,slot.manuallyClosed?"open":"close",slot.clock,lang)}
                      <MariaCalendarConfirmButton
                        kind={slot.manuallyClosed?"open":"close"} disabled={past || protectedStart}
                        label={past?t("Passerad","Past"):protectedStart
                          ? occupied?t("Bokad","Booked"):t("Verifiering pågår","Verification pending")
                          :slot.manuallyClosed?t("Öppna","Open"):t("Stäng","Close")}
                        confirmation={slot.manuallyClosed
                          ? t(`Öppna starttiden ${slot.clock}? Bokningar påverkas inte.`,
                              `Open the ${slot.clock} start? Bookings are unchanged.`)
                          : t(`Stäng starttiden ${slot.clock}? Befintliga bokningar påverkas inte.`,
                              `Close the ${slot.clock} start? Bookings are unchanged.`)}
                      />
                    </form>
                  </article>;
                })}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-[#e8d9dc] bg-white p-5 sm:p-7">
          <h2 className="font-serif text-xl text-[#352a2c]">{t("Bokningsförfrågningar och bokningar","Requests and appointments")}</h2>
          <p className="mt-2 text-xs text-[#705f65]">
            {t("Kontrollera betalningen i Swish och hantera kundens bokning på dess egen sida. Kalenderns knappar ändrar inga bokningar eller betalningar.",
              "Check the Swish payment and manage the customer booking on its own page. Calendar buttons never change bookings or payments.")}
          </p>
          {view.appointments.length === 0
            ? <p className="mt-4 rounded-lg border border-dashed border-[#e8d9dc] p-4 text-sm text-[#705f65]">
                {t("Inga bokningar för detta datum.","No appointments for this date.")}
              </p>
            : <div className="mt-4 space-y-3">
              {view.appointments.map(booking=><Link key={booking.id}
                href={`/dashboard/bokningar/${encodeURIComponent(booking.id)}`}
                className="block rounded-xl border border-[#e8d9dc] p-4 hover:bg-[#fcf9f8]">
                <p className="font-bold text-[#51313e]">{booking.customerName || t("Kund","Customer")}</p>
                <p className="mt-1 text-sm text-[#705f65]">
                  {booking.title} · {formatBookingTime(booking.startsAt,lang)}–{formatBookingTime(booking.endsAt,lang)}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#845363]">
                  {booking.status==="requested"?t("Förfrågan","Requested")
                    :booking.status==="confirmed"?t("Bekräftad","Confirmed")
                    :booking.status}
                </p>
              </Link>)}
            </div>}
          {view.holdCount > 0 && <p className="mt-4 text-xs text-[#705f65]">
            {t(`${view.holdCount} aktiv(a) e-postverifiering(ar) finns för dagen.`,
              `${view.holdCount} active email verification hold(s) for this day.`)}
          </p>}
        </section>
      </>}

      <div className="flex gap-3 rounded-xl border border-[#dec6cd] bg-[#fbf0ef] p-4 text-sm text-[#684956]">
        <ShieldCheck className="shrink-0" size={20}/>
        <p>{t("Endast intern Preview. Befintliga bokningar och betalningar ändras aldrig av kalendern. En öppnad tid kan fortfarande vara upptagen av en bokning eller verifieringshåll.",
          "Internal Preview only. Calendar changes never modify existing bookings or payments. An open interval can still be occupied by a booking or verification hold.")}</p>
      </div>
    </main>
  );
}
