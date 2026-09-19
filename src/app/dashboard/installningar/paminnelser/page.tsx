import Link from "next/link";
import { BellRing, ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getBookingReminderSettings, getRecentReminderDeliveries, updateBookingReminderSettings } from "@/lib/booking-reminder-settings";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { getDashboardWorkspaceSettings } from "@/lib/workspace-settings-db";

export const dynamic = "force-dynamic";
const href = (value: string, en: boolean) => en ? `${value}${value.includes("?") ? "&" : "?"}lang=en` : value;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const date = (value: string, en: boolean, timeZone: string) => new Intl.DateTimeFormat(en ? "en-GB" : "sv-SE", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

async function updateAction(formData: FormData) {
  "use server";
  const en = String(formData.get("lang") ?? "") === "en";
  try {
    await updateBookingReminderSettings({
      isEnabled: formData.get("isEnabled") === "on",
      hoursBefore: Number(formData.get("hoursBefore") ?? 24),
      emailEnabled: formData.get("emailEnabled") === "on",
      smsEnabled: formData.get("smsEnabled") === "on",
      customerRescheduleEnabled: formData.get("customerRescheduleEnabled") === "on",
      customerCancelEnabled: formData.get("customerCancelEnabled") === "on",
      cancelNoticeHours: Number(formData.get("cancelNoticeHours") ?? 0),
      noShowEnabled: formData.get("noShowEnabled") === "on",
      autoCompleteEnabled: formData.get("autoCompleteEnabled") === "on",
      companyConfirmationRequired: formData.get("companyConfirmationRequired") === "on",
    });
  } catch { redirect(href("/dashboard/installningar/paminnelser?error=1", en)); }
  redirect(href("/dashboard/installningar/paminnelser?updated=1", en));
}

type Params = { updated?: string | string[]; error?: string | string[]; lang?: string | string[] };
export default async function Page({ searchParams }: { searchParams?: Promise<Params> }) {
  const params = searchParams ? await searchParams : {};
  const en = first(params.lang) === "en";
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect(href("/dashboard", en));
  const [settings, deliveries, workspace] = await Promise.all([getBookingReminderSettings(), getRecentReminderDeliveries(), getDashboardWorkspaceSettings()]);
  const toggle = (name: string, labelSv: string, labelEn: string, checked: boolean) => <label className="flex items-center justify-between gap-4 rounded-control border border-line bg-surface-subtle p-4 text-sm font-semibold text-ink"><span>{en ? labelEn : labelSv}</span><input name={name} type="checkbox" defaultChecked={checked} className="h-5 w-5 accent-[#1469d8]" /></label>;
  return <div className="grid gap-6">
    <DashboardPageHeader eyebrow={en ? "Booking policy" : "Bokningsregler"} title={en ? "Reminders and customer actions" : "Påminnelser och kundåtgärder"} description={en ? "Configure reminders, rescheduling, cancellation and status handling for this workspace." : "Styr påminnelser, ombokning, avbokning och statushantering för den aktiva arbetsytan."} icon={BellRing} actions={<Link href={href("/dashboard/installningar", en)} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-bold text-brand-deep"><ChevronLeft className="h-4 w-4" />{en ? "Settings" : "Inställningar"}</Link>} />
    {first(params.updated) === "1" ? <p className="rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-5 text-sm font-semibold text-brand">{en ? "Settings saved." : "Inställningarna sparades."}</p> : null}
    {first(params.error) === "1" ? <p className="rounded-card border border-[#f4c7ba] bg-[#fff5f2] p-5 text-sm font-semibold text-danger">{en ? "Settings could not be saved." : "Inställningarna kunde inte sparas."}</p> : null}
    <section className="grid gap-6 xl:grid-cols-[480px_1fr]">
      <form action={updateAction} className="h-fit rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <input type="hidden" name="lang" value={en ? "en" : "sv"} />
        <h2 className="text-xl font-bold text-ink">{en ? "Workspace controls" : "Inställningar för arbetsytan"}</h2>
        <div className="mt-5 grid gap-4">
          {toggle("isEnabled", "Aktivera påminnelser", "Enable reminders", settings.isEnabled)}
          <label className="grid gap-2 text-sm font-semibold">{en ? "Hours before booking" : "Timmar före bokningen"}<input name="hoursBefore" type="number" min="1" max="168" required defaultValue={settings.hoursBefore} className="rounded-control border border-line bg-surface px-4 py-3 font-normal" /></label>
          <div className="grid grid-cols-2 gap-3">{toggle("emailEnabled", "E-post", "Email", settings.emailEnabled)}{toggle("smsEnabled", "SMS", "SMS", settings.smsEnabled)}</div>
          <hr className="my-1 border-line" />
          {toggle("customerRescheduleEnabled", "Kunden får boka om", "Customer may reschedule", settings.customerRescheduleEnabled)}
          {toggle("customerCancelEnabled", "Kunden får avboka", "Customer may cancel", settings.customerCancelEnabled)}
          <label className="grid gap-2 text-sm font-semibold">{en ? "Minimum cancellation notice (hours)" : "Minsta tid före avbokning (timmar)"}<input name="cancelNoticeHours" type="number" min="0" max="720" required defaultValue={settings.cancelNoticeHours} className="rounded-control border border-line bg-surface px-4 py-3 font-normal" /><span className="text-xs font-normal text-ink-muted">{en ? "0 allows cancellation until start." : "0 tillåter avbokning fram till starttiden."}</span></label>
          {toggle("companyConfirmationRequired", "Företaget måste bekräfta nya tider", "Company confirmation required", settings.companyConfirmationRequired)}
          {toggle("noShowEnabled", "Tillåt status Uteblev", "Enable no-show status", settings.noShowEnabled)}
          {toggle("autoCompleteEnabled", "Markera passerade bekräftade bokningar som klara automatiskt", "Auto-complete past confirmed bookings", settings.autoCompleteEnabled)}
          <button className="min-h-11 rounded-control bg-brand-deep px-5 py-3 text-sm font-bold text-white">{en ? "Save settings" : "Spara inställningar"}</button>
        </div>
      </form>
      <article className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">{en ? "Recent deliveries" : "Senaste leveranser"}</h2><p className="mt-1 text-sm text-ink-muted">{en ? "The 50 most recent reminder attempts." : "De 50 senaste påminnelseförsöken."}</p></div><span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">{deliveries.length}</span></div><div className="mt-5 grid gap-3">{deliveries.length ? deliveries.map((item) => <div key={item.id} className="rounded-control border border-line bg-surface-subtle p-4 text-sm"><div className="flex justify-between gap-3"><div><p className="font-bold">{item.customerName} · {item.service}</p><p className="mt-1 text-xs text-ink-muted">{date(item.startsAt, en, workspace.timeZone)}</p></div><span className="text-xs font-bold uppercase">{item.channel} · {item.status}</span></div>{item.errorMessage ? <p className="mt-3 text-xs text-danger">{item.errorMessage}</p> : null}</div>) : <p className="rounded-xl border border-dashed p-5 text-sm text-ink-muted">{en ? "No reminders processed yet." : "Inga påminnelser har behandlats ännu."}</p>}</div></article>
    </section>
  </div>;
}
