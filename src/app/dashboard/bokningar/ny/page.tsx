import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { BookingTimeConflictError, createDashboardBooking, getDashboardCustomerOptions, type CreateDashboardBookingInput } from "@/lib/dashboard-db";
import { serviceTaxonomy } from "@/lib/service-taxonomy";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
const bookingStatuses = ["requested", "confirmed", "completed", "cancelled"] as const;
const labels = {
  sv: { requested: "Förfrågad", confirmed: "Bekräftad", completed: "Klar", cancelled: "Avbokad" },
  en: { requested: "Requested", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" },
};
const errors = {
  sv: { access: "Du saknar behörighet att skapa bokningar.", customer: "Välj en befintlig kund.", title: "Rubrik är obligatorisk och får vara max 140 tecken.", status: "Status är ogiltig.", start: "Starttid är obligatorisk och behöver vara ett giltigt datum.", end: "Sluttid är obligatorisk och behöver vara efter starttid.", city: "Ort får vara max 120 tecken.", notes: "Notering får vara max 1000 tecken.", service: "Vald tjänst finns inte i Profferas tjänstekatalog.", conflict: "Tiden är redan bokad. Välj en annan start- eller sluttid.", save: "Bokningen kunde inte sparas. Försök igen eller kontakta support om problemet kvarstår." },
  en: { access: "You do not have permission to create bookings.", customer: "Select an existing customer.", title: "Title is required and may contain no more than 140 characters.", status: "Status is invalid.", start: "A valid start time is required.", end: "The end time must be after the start time.", city: "Location may contain no more than 120 characters.", notes: "Notes may contain no more than 1,000 characters.", service: "The selected service is not available in Proffera's service catalogue.", conflict: "This time is already booked. Select another start or end time.", save: "The booking could not be saved. Try again or contact support if the problem continues." },
} as const;
type ErrorKey = keyof typeof errors.sv;
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const url = (href: string, en: boolean) => en ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
function fail(error: ErrorKey, en: boolean): never { redirect(url(`/dashboard/bokningar/ny?error=${error}`, en)); }
function parseDate(value: string) { const date = new Date(value); return !value || Number.isNaN(date.getTime()) ? null : date; }
function resolveService(value: string) {
  if (!value) return { serviceCategorySlug: "", serviceSlug: "", serviceName: "" };
  const [categorySlug, serviceSlug] = value.split("::");
  const category = serviceTaxonomy.find((item) => item.slug === categorySlug);
  const service = category?.services.find((item) => item.slug === serviceSlug);
  return category && service ? { serviceCategorySlug: category.slug, serviceSlug: service.slug, serviceName: service.name } : null;
}
async function createBookingAction(formData: FormData) {
  "use server";
  const en = text(formData, "lang") === "en";
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access) || !(await hasDashboardModuleAccess("online_booking"))) fail("access", en);
  const customerId = text(formData, "customer_id"), title = text(formData, "title"), status = text(formData, "status"), city = text(formData, "city"), notes = text(formData, "notes");
  const startsAt = parseDate(text(formData, "starts_at")), endsAt = parseDate(text(formData, "ends_at"));
  if (!customerId) fail("customer", en); if (!title || title.length > 140) fail("title", en);
  if (!bookingStatuses.includes(status as (typeof bookingStatuses)[number])) fail("status", en);
  if (!startsAt) fail("start", en); if (!endsAt || endsAt <= startsAt) fail("end", en);
  if (city.length > 120) fail("city", en); if (notes.length > 1000) fail("notes", en);
  const service = resolveService(text(formData, "service_selection")); if (!service) fail("service", en);
  const input: CreateDashboardBookingInput = { customerId, title, status: status as CreateDashboardBookingInput["status"], startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), city, service: service.serviceName, serviceCategorySlug: service.serviceCategorySlug, serviceSlug: service.serviceSlug, notes };
  let id: string;
  try { id = await createDashboardBooking(input); } catch (error) { console.error("Failed to create dashboard booking", error); if (error instanceof BookingTimeConflictError) fail("conflict", en); fail("save", en); }
  redirect(url(`/dashboard/bokningar/${id}?created=1`, en));
}

type Props = { searchParams?: Promise<{ error?: string | string[]; customer?: string | string[]; lang?: string | string[] }> };
export default async function NewBookingPage({ searchParams }: Props) {
  const [customers, params] = await Promise.all([getDashboardCustomerOptions(), searchParams ?? Promise.resolve(undefined)]);
  const value = (key: "error" | "customer" | "lang") => { const v = params?.[key]; return Array.isArray(v) ? v[0] : v; };
  const en = value("lang") === "en", errorKey = value("error") as ErrorKey | undefined, selected = customers.find((item) => item.id === value("customer"));
  const field = "rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20";
  const t = en ? labels.en : labels.sv;
  return <div className="grid gap-6">
    <DashboardPageHeader eyebrow={en ? "Bookings" : "Bokningar"} title={en ? "New booking" : "Ny bokning"} description={en ? "Create a booking and connect it directly to a customer. Only owners and administrators can save changes." : "Skapa en ny bokning i Proffera och koppla den direkt till vald kund. Endast ägare och administratörer kan spara ändringar."} icon={CalendarPlus} actions={<Link href={url("/dashboard/bokningar", en)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f]"><ArrowLeft className="h-4 w-4" />{en ? "Back to bookings" : "Tillbaka till bokningar"}</Link>} />
    {errorKey ? <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{(en ? errors.en : errors.sv)[errorKey]}</section> : null}
    {customers.length === 0 ? <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm leading-7 text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{en ? "There are no customers available for this booking. Create a customer first." : "Det finns inga kunder att koppla bokningen till. Skapa en kund först på kundsidan."}</section> : null}
    <form action={createBookingAction} className="grid gap-6 rounded-[24px] border border-[#e0e5dd] bg-white p-5 shadow-sm sm:p-6">
      <input type="hidden" name="lang" value={en ? "en" : "sv"} />
      <section className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">{en ? "Customer" : "Kund"}<select name="customer_id" required defaultValue={selected?.id ?? ""} className={field}><option value="" disabled>{en ? "Select customer" : "Välj kund"}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.city} · {c.service}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold md:col-span-2">{en ? "Title" : "Rubrik"}<input name="title" required maxLength={140} className={field} placeholder={en ? "e.g. Window cleaning" : "Ex. Hemstädning hos kund"} /></label>
        <label className="grid gap-2 text-sm font-semibold">Status<select name="status" defaultValue="requested" className={field}>{bookingStatuses.map((s) => <option key={s} value={s}>{t[s]}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold">{en ? "Location" : "Ort"}<input name="city" maxLength={120} defaultValue={selected?.city === "Okänd ort" ? "" : selected?.city ?? ""} className={field} placeholder={en ? "e.g. London" : "Ex. Södertälje"} /></label>
        <label className="grid gap-2 text-sm font-semibold">{en ? "Start" : "Start"}<input name="starts_at" type="datetime-local" required className={field} /></label>
        <label className="grid gap-2 text-sm font-semibold">{en ? "End" : "Slut"}<input name="ends_at" type="datetime-local" required className={field} /></label>
        <label className="grid gap-2 text-sm font-semibold md:col-span-2">{en ? "Service" : "Tjänst"}<select name="service_selection" defaultValue="" className={field}><option value="">{en ? "No service selected" : "Ingen tjänst vald"}</option>{serviceTaxonomy.map((cat) => <optgroup key={cat.slug} label={cat.name}>{cat.services.map((service) => <option key={service.slug} value={`${cat.slug}::${service.slug}`}>{service.name}</option>)}</optgroup>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold md:col-span-2">{en ? "Notes" : "Notering"}<textarea name="notes" maxLength={1000} rows={5} className={field} placeholder={en ? "Internal booking note. Optional." : "Intern bokningsnotering. Valfritt."} /></label>
      </section>
      <section className="rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-7 text-[#5b665f]"><strong className="text-[#17201a]">{en ? "Controlled action:" : "Kontrollerad åtgärd:"}</strong> {en ? "The booking is saved manually and connected to the selected customer. No email is sent and no leads are changed." : "Bokningen sparas manuellt och kopplas till vald kund. Ingen e-post skickas och inga leads ändras."}</section>
      <button type="submit" disabled={customers.length === 0} className="inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white disabled:bg-[#9aa59d]">{en ? "Create booking" : "Skapa bokning"}</button>
    </form>
  </div>;
}
