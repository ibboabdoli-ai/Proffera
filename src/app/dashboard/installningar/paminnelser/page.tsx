import Link from "next/link";
import { BellRing, ChevronLeft, Mail, MessageSquareText } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getBookingReminderSettings, getRecentReminderDeliveries, updateBookingReminderSettings } from "@/lib/booking-reminder-settings";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

function localizedHref(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

function formatDate(value: string, isEnglish: boolean) {
  return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function updateAction(formData: FormData) {
  "use server";
  const isEnglish = String(formData.get("lang") ?? "") === "en";
  try {
    await updateBookingReminderSettings({
      isEnabled: formData.get("isEnabled") === "on",
      hoursBefore: Number(String(formData.get("hoursBefore") ?? "24")),
      emailEnabled: formData.get("emailEnabled") === "on",
      smsEnabled: formData.get("smsEnabled") === "on",
    });
  } catch {
    redirect(localizedHref("/dashboard/installningar/paminnelser?error=1", isEnglish));
  }
  redirect(localizedHref("/dashboard/installningar/paminnelser?updated=1", isEnglish));
}

type ReminderSearchParams = { updated?: string | string[]; error?: string | string[]; lang?: string | string[] };

export default async function ReminderSettingsPage({ searchParams }: { searchParams?: Promise<ReminderSearchParams> }) {
  const params: ReminderSearchParams = searchParams ? await searchParams : {};
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const isEnglish = first(params.lang) === "en";
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect(localizedHref("/dashboard", isEnglish));
  const [settings, deliveries] = await Promise.all([getBookingReminderSettings(), getRecentReminderDeliveries()]);

  return <div className="grid gap-6">
    <DashboardPageHeader
      eyebrow={isEnglish ? "Booking reminders" : "Bokningspåminnelser"}
      title={isEnglish ? "Automatic reminders" : "Automatiska påminnelser"}
      description={isEnglish ? "Control when customers receive reminders and review recent deliveries for the active workspace." : "Styr när kunder får påminnelser och följ de senaste leveranserna för den aktiva arbetsytan."}
      icon={BellRing}
      actions={<Link href={localizedHref("/dashboard/installningar", isEnglish)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f]"><ChevronLeft className="h-4 w-4" />{isEnglish ? "Settings" : "Inställningar"}</Link>}
    />
    {first(params.updated) === "1" ? <section className="rounded-2xl bg-[#eef8f0] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]">{isEnglish ? "Reminder settings were saved." : "Påminnelseinställningarna sparades."}</section> : null}
    {first(params.error) === "1" ? <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{isEnglish ? "The settings could not be saved." : "Inställningarna kunde inte sparas."}</section> : null}
    <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <form action={updateAction} className="h-fit rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
        <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
        <h2 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Settings" : "Inställningar"}</h2>
        <div className="mt-5 grid gap-4">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-[#e1e7df] p-4 text-sm font-semibold"><span>{isEnglish ? "Enable reminders" : "Aktivera påminnelser"}</span><input name="isEnabled" type="checkbox" defaultChecked={settings.isEnabled} className="h-5 w-5" /></label>
          <label className="grid gap-2 text-sm font-semibold">{isEnglish ? "Hours before booking" : "Timmar före bokningen"}<input name="hoursBefore" type="number" min="1" max="168" required defaultValue={settings.hoursBefore} className="rounded-xl border border-[#d9e1d7] px-4 py-3 font-normal" /><span className="text-xs font-normal text-[#6b766e]">{isEnglish ? "1–168 hours." : "1–168 timmar."}</span></label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-[#e1e7df] p-4 text-sm font-semibold"><span className="flex items-center gap-2"><Mail className="h-4 w-4" />{isEnglish ? "Email" : "E-post"}</span><input name="emailEnabled" type="checkbox" defaultChecked={settings.emailEnabled} className="h-5 w-5" /></label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-[#e1e7df] p-4 text-sm font-semibold"><span className="flex items-center gap-2"><MessageSquareText className="h-4 w-4" />SMS</span><input name="smsEnabled" type="checkbox" defaultChecked={settings.smsEnabled} className="h-5 w-5" /></label>
          <button type="submit" className="min-h-11 rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-bold text-white">{isEnglish ? "Save reminders" : "Spara påminnelser"}</button>
        </div>
      </form>
      <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Recent deliveries" : "Senaste leveranser"}</h2><p className="mt-1 text-sm text-[#667168]">{isEnglish ? "The 50 most recent attempts." : "De 50 senaste försöken."}</p></div><span className="rounded-full bg-[#edf5ef] px-3 py-1 text-xs font-bold text-[#17452f]">{deliveries.length}</span></div>
        <div className="mt-5 grid gap-3">{deliveries.length ? deliveries.map((delivery) => <div key={delivery.id} className="rounded-xl border border-[#e3e8e1] bg-[#f8faf7] p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-[#17201a]">{delivery.customerName} · {delivery.service}</p><p className="mt-1 text-xs text-[#68736b]">{isEnglish ? "Booking" : "Bokning"}: {formatDate(delivery.startsAt, isEnglish)}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase">{delivery.channel} · {delivery.status}</span></div>{delivery.errorMessage ? <p className="mt-3 text-xs font-semibold text-[#8f2f1b]">{delivery.errorMessage}</p> : null}<p className="mt-3 text-xs text-[#7a847d]">{isEnglish ? "Scheduled" : "Planerad"}: {formatDate(delivery.scheduledFor, isEnglish)}</p></div>) : <p className="rounded-xl border border-dashed border-[#dce3da] p-5 text-sm text-[#7a847d]">{isEnglish ? "No reminders have been processed yet." : "Inga påminnelser har behandlats ännu."}</p>}</div>
      </article>
    </section>
  </div>;
}
