import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserRoundPlus } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { createDashboardCustomer, type CreateDashboardCustomerInput } from "@/lib/dashboard-db";
import { serviceTaxonomy } from "@/lib/service-taxonomy";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

const customerTypes = ["private", "company"] as const;
const customerStatuses = ["prospect", "active", "paused", "lost"] as const;

type Locale = "sv" | "en";
type ErrorKey = "access" | "name" | "email" | "phone" | "company" | "city" | "notes" | "type" | "status" | "service" | "save";

const statusLabels = {
  sv: { prospect: "Prospekt", active: "Aktiv", paused: "Pausad", lost: "Förlorad" },
  en: { prospect: "Prospect", active: "Active", paused: "Paused", lost: "Lost" },
} satisfies Record<Locale, Record<(typeof customerStatuses)[number], string>>;

const errorMessages: Record<Locale, Record<ErrorKey, string>> = {
  sv: {
    access: "Du saknar behörighet att skapa kunder.",
    name: "Namn är obligatoriskt och får vara max 120 tecken.",
    email: "E-postadressen behöver se giltig ut.",
    phone: "Telefonnummer får vara max 40 tecken.",
    company: "Företagsnamn får vara max 160 tecken.",
    city: "Ort får vara max 120 tecken.",
    notes: "Notering får vara max 1000 tecken.",
    type: "Kundtyp är ogiltig.",
    status: "Status är ogiltig.",
    service: "Vald tjänst finns inte i Profferas tjänstekatalog.",
    save: "Kunden kunde inte sparas. Försök igen eller kontakta support om problemet kvarstår.",
  },
  en: {
    access: "You do not have permission to create customers.",
    name: "Name is required and may contain no more than 120 characters.",
    email: "Enter a valid email address.",
    phone: "Phone number may contain no more than 40 characters.",
    company: "Company name may contain no more than 160 characters.",
    city: "Location may contain no more than 120 characters.",
    notes: "Notes may contain no more than 1,000 characters.",
    type: "Customer type is invalid.",
    status: "Status is invalid.",
    service: "The selected service is not available in Proffera's service catalogue.",
    save: "The customer could not be saved. Try again or contact support if the problem continues.",
  },
};

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function withLang(href: string, locale: Locale) {
  if (locale !== "en") return href;
  return `${href}${href.includes("?") ? "&" : "?"}lang=en`;
}

function redirectWithError(error: ErrorKey, locale: Locale): never {
  redirect(withLang(`/dashboard/kunder/ny?error=${error}`, locale));
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resolveServiceSelection(selection: string) {
  if (!selection) return { serviceCategorySlug: "", serviceSlug: "" };
  const [categorySlug, serviceSlug] = selection.split("::");
  const category = serviceTaxonomy.find((item) => item.slug === categorySlug);
  const service = category?.services.find((item) => item.slug === serviceSlug);
  return category && service ? { serviceCategorySlug: category.slug, serviceSlug: service.slug } : null;
}

async function createCustomerAction(formData: FormData) {
  "use server";

  const locale: Locale = getFormText(formData, "lang") === "en" ? "en" : "sv";
  const workspaceAccess = await getUserWorkspaceAccess();

  if (!workspaceAccess.ok || !canManageWorkspaceSettings(workspaceAccess) || !(await hasDashboardModuleAccess("customer_crm"))) {
    redirectWithError("access", locale);
  }

  const name = getFormText(formData, "name");
  const email = getFormText(formData, "email");
  const phone = getFormText(formData, "phone");
  const companyName = getFormText(formData, "company_name");
  const city = getFormText(formData, "city");
  const notes = getFormText(formData, "notes");
  const customerType = getFormText(formData, "customer_type");
  const status = getFormText(formData, "status");
  const serviceSelection = getFormText(formData, "service_selection");

  if (!name || name.length > 120) redirectWithError("name", locale);
  if (email && (email.length > 160 || !isEmailLike(email))) redirectWithError("email", locale);
  if (phone.length > 40) redirectWithError("phone", locale);
  if (companyName.length > 160) redirectWithError("company", locale);
  if (city.length > 120) redirectWithError("city", locale);
  if (notes.length > 1000) redirectWithError("notes", locale);
  if (!customerTypes.includes(customerType as (typeof customerTypes)[number])) redirectWithError("type", locale);
  if (!customerStatuses.includes(status as (typeof customerStatuses)[number])) redirectWithError("status", locale);

  const resolvedService = resolveServiceSelection(serviceSelection);
  if (!resolvedService) redirectWithError("service", locale);

  const customerInput: CreateDashboardCustomerInput = {
    name,
    email,
    phone,
    companyName,
    customerType: customerType as CreateDashboardCustomerInput["customerType"],
    city,
    status: status as CreateDashboardCustomerInput["status"],
    serviceCategorySlug: resolvedService.serviceCategorySlug,
    serviceSlug: resolvedService.serviceSlug,
    notes,
  };

  let customerId: string;
  try {
    customerId = await createDashboardCustomer(customerInput);
  } catch (error) {
    console.error("Failed to create dashboard customer", error);
    redirectWithError("save", locale);
  }

  redirect(withLang(`/dashboard/kunder/${customerId}?created=1`, locale));
}

type NewCustomerPageProps = {
  searchParams?: Promise<{ error?: string | string[]; lang?: string | string[] }>;
};

export default async function NewCustomerPage({ searchParams }: NewCustomerPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const errorValue = Array.isArray(params?.error) ? params.error[0] : params?.error;
  const langValue = Array.isArray(params?.lang) ? params.lang[0] : params?.lang;
  const locale: Locale = langValue === "en" ? "en" : "sv";
  const isEnglish = locale === "en";
  const errorMessage = errorValue ? errorMessages[locale][errorValue as ErrorKey] : undefined;
  const fieldClass = "min-h-12 rounded-control border border-line bg-surface px-4 py-3 text-sm font-normal text-ink outline-none transition placeholder:text-ink-muted/60 hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow={isEnglish ? "Customers" : "Kunder"}
        title={isEnglish ? "New customer" : "Ny kund"}
        description={isEnglish ? "Create a customer and save it directly in the customer register. Only owners and administrators can save changes." : "Skapa en ny kund i Proffera och spara den direkt i kundregistret. Endast ägare och administratörer kan spara ändringar."}
        icon={UserRoundPlus}
        actions={<Link href={withLang("/dashboard/kunder", locale)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-bold text-brand transition hover:-translate-y-0.5 hover:border-line-strong hover:bg-brand-tint"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{isEnglish ? "Back to customers" : "Tillbaka till kunder"}</Link>}
      />

      {errorMessage ? <section className="rounded-card border border-danger/20 bg-danger/5 p-5 text-sm font-semibold text-danger shadow-card">{errorMessage}</section> : null}

      <form action={createCustomerAction} className="grid gap-6 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6 lg:p-7">
        <input type="hidden" name="lang" value={locale} />

        <section className="grid gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{isEnglish ? "Customer identity" : "Kundidentitet"}</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-ink">{isEnglish ? "Basic customer details" : "Grundläggande kunduppgifter"}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{isEnglish ? "Start with the information used to identify and classify the customer in CRM." : "Börja med uppgifterna som identifierar och klassificerar kunden i CRM."}</p>
          </div>
          <div className="grid gap-4 rounded-card border border-line bg-surface-subtle p-4 sm:p-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "Name" : "Namn"}<input name="name" type="text" required maxLength={120} className={fieldClass} placeholder={isEnglish ? "e.g. Sarah Anderson" : "Ex. Sara Andersson"} /></label>
            <label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "Customer type" : "Kundtyp"}<select name="customer_type" defaultValue="private" className={fieldClass}><option value="private">{isEnglish ? "Private customer" : "Privatkund"}</option><option value="company">{isEnglish ? "Company" : "Företag"}</option></select></label>
            <label className="grid gap-2 text-sm font-semibold text-ink">Status<select name="status" defaultValue="prospect" className={fieldClass}>{customerStatuses.map((item) => <option key={item} value={item}>{statusLabels[locale][item]}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "Company name" : "Företagsnamn"}<input name="company_name" type="text" maxLength={160} className={fieldClass} placeholder={isEnglish ? "Optional" : "Valfritt"} /></label>
          </div>
        </section>

        <section className="grid gap-5 border-t border-line pt-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{isEnglish ? "Contact and need" : "Kontakt och behov"}</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-ink">{isEnglish ? "Contact details and primary service" : "Kontaktuppgifter och primär tjänst"}</h3>
          </div>
          <div className="grid gap-4 rounded-card border border-line bg-surface-subtle p-4 sm:p-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "Email" : "E-post"}<input name="email" type="email" maxLength={160} className={fieldClass} placeholder="name@example.com" /></label>
            <label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "Phone" : "Telefon"}<input name="phone" type="tel" maxLength={40} className={fieldClass} placeholder="+46..." /></label>
            <label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "Location" : "Ort"}<input name="city" type="text" maxLength={120} className={fieldClass} placeholder={isEnglish ? "e.g. London" : "Ex. Södertälje"} /></label>
            <label className="grid gap-2 text-sm font-semibold text-ink md:col-span-2">{isEnglish ? "Primary service" : "Primär tjänst"}<select name="service_selection" defaultValue="" className={fieldClass}><option value="">{isEnglish ? "No primary service" : "Ingen primär tjänst"}</option>{serviceTaxonomy.map((category) => <optgroup key={category.slug} label={category.name}>{category.services.map((service) => <option key={service.slug} value={`${category.slug}::${service.slug}`}>{service.name}</option>)}</optgroup>)}</select></label>
          </div>
        </section>

        <section className="grid gap-4 border-t border-line pt-6">
          <label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "Internal notes" : "Intern notering"}<textarea name="notes" maxLength={1000} rows={5} className={fieldClass} placeholder={isEnglish ? "Internal CRM note. Optional." : "Intern CRM-notering. Valfritt."} /></label>
        </section>

        <section className="rounded-card border border-line bg-brand-tint p-4 text-sm leading-7 text-ink-muted"><strong className="text-ink">{isEnglish ? "Controlled action:" : "Kontrollerad åtgärd:"}</strong> {isEnglish ? "The customer is saved manually in the customer register. No booking is created, no email is sent and no leads are changed." : "Kunden sparas manuellt i kundregistret. Ingen bokning skapas, ingen e-post skickas och inga leads ändras."}</section>

        <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-end">
          <Link href={withLang("/dashboard/kunder", locale)} className="inline-flex min-h-12 items-center justify-center rounded-control border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition hover:bg-surface-subtle">{isEnglish ? "Cancel" : "Avbryt"}</Link>
          <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-control bg-brand px-6 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{isEnglish ? "Create customer" : "Skapa kund"}</button>
        </div>
      </form>
    </div>
  );
}
