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

const statusLabels: Record<(typeof customerStatuses)[number], string> = {
  prospect: "Prospekt",
  active: "Aktiv",
  paused: "Pausad",
  lost: "Förlorad",
};

const errorMessages: Record<string, string> = {
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
};

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithError(error: keyof typeof errorMessages): never {
  redirect(`/dashboard/kunder/ny?error=${error}`);
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resolveServiceSelection(selection: string) {
  if (!selection) {
    return {
      serviceCategorySlug: "",
      serviceSlug: "",
    };
  }

  const [categorySlug, serviceSlug] = selection.split("::");
  const category = serviceTaxonomy.find((item) => item.slug === categorySlug);
  const service = category?.services.find((item) => item.slug === serviceSlug);

  if (!category || !service) {
    return null;
  }

  return {
    serviceCategorySlug: category.slug,
    serviceSlug: service.slug,
  };
}

async function createCustomerAction(formData: FormData) {
  "use server";

  const workspaceAccess = await getUserWorkspaceAccess();

  if (!workspaceAccess.ok || !canManageWorkspaceSettings(workspaceAccess) || !(await hasDashboardModuleAccess("customer_crm"))) {
    redirectWithError("access");
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

  if (!name || name.length > 120) {
    redirectWithError("name");
  }

  if (email && (email.length > 160 || !isEmailLike(email))) {
    redirectWithError("email");
  }

  if (phone.length > 40) {
    redirectWithError("phone");
  }

  if (companyName.length > 160) {
    redirectWithError("company");
  }

  if (city.length > 120) {
    redirectWithError("city");
  }

  if (notes.length > 1000) {
    redirectWithError("notes");
  }

  if (!customerTypes.includes(customerType as (typeof customerTypes)[number])) {
    redirectWithError("type");
  }

  if (!customerStatuses.includes(status as (typeof customerStatuses)[number])) {
    redirectWithError("status");
  }

  const resolvedService = resolveServiceSelection(serviceSelection);
  const validatedService = resolvedService ?? redirectWithError("service");

  const customerInput: CreateDashboardCustomerInput = {
    name,
    email,
    phone,
    companyName,
    customerType: customerType as CreateDashboardCustomerInput["customerType"],
    city,
    status: status as CreateDashboardCustomerInput["status"],
    serviceCategorySlug: validatedService.serviceCategorySlug,
    serviceSlug: validatedService.serviceSlug,
    notes,
  };

  let customerId: string;

  try {
    customerId = await createDashboardCustomer(customerInput);
  } catch (error) {
    console.error("Failed to create dashboard customer", error);
    redirectWithError("save");
  }

  redirect(`/dashboard/kunder/${customerId}?created=1`);
}

type NewCustomerPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

export default async function NewCustomerPage({ searchParams }: NewCustomerPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const errorValue = Array.isArray(params?.error) ? params?.error[0] : params?.error;
  const errorMessage = errorValue ? errorMessages[errorValue] : undefined;

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Kunder"
        title="Ny kund"
        description="Skapa en ny kund i Proffera och spara den direkt i kundregistret. Endast ägare och administratörer kan spara ändringar."
        icon={UserRoundPlus}
        actions={
          <Link href="/dashboard/kunder" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f] transition hover:-translate-y-0.5 hover:bg-[#f3f6f2]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Tillbaka till kunder
          </Link>
        }
      />

      {errorMessage ? (
        <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {errorMessage}
        </section>
      ) : null}

      <form action={createCustomerAction} className="grid gap-6 rounded-[24px] border border-[#e0e5dd] bg-white p-5 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)] sm:p-6">
        <section className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Namn
            <input
              name="name"
              type="text"
              required
              maxLength={120}
              className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Ex. Sara Andersson"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Kundtyp
            <select
              name="customer_type"
              defaultValue="private"
              className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
            >
              <option value="private">Privatkund</option>
              <option value="company">Företag</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Status
            <select
              name="status"
              defaultValue="prospect"
              className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
            >
              {customerStatuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            E-post
            <input
              name="email"
              type="email"
              maxLength={160}
              className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="namn@example.se"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Telefon
            <input
              name="phone"
              type="tel"
              maxLength={40}
              className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="+46..."
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Företagsnamn
            <input
              name="company_name"
              type="text"
              maxLength={160}
              className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Valfritt"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Ort
            <input
              name="city"
              type="text"
              maxLength={120}
              className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Ex. Södertälje"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a] md:col-span-2">
            Primär tjänst
            <select
              name="service_selection"
              defaultValue=""
              className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
            >
              <option value="">Ingen primär tjänst</option>
              {serviceTaxonomy.map((category) => (
                <optgroup key={category.slug} label={category.name}>
                  {category.services.map((service) => (
                    <option key={service.slug} value={`${category.slug}::${service.slug}`}>
                      {service.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a] md:col-span-2">
            Notering
            <textarea
              name="notes"
              maxLength={1000}
              rows={5}
              className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Intern CRM-notering. Valfritt."
            />
          </label>
        </section>

        <section className="rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-7 text-[#5b665f]">
          <strong className="text-[#17201a]">Kontrollerad åtgärd:</strong> Kunden sparas manuellt i kundregistret. Ingen bokning skapas, ingen e-post skickas och inga leads ändras.
        </section>

        <button
          type="submit"
          className="inline-flex w-fit rounded-xl bg-[#173e2b] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f2f20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
        >
          Skapa kund
        </button>
      </form>
    </div>
  );
}
