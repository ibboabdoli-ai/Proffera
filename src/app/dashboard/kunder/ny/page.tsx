import Link from "next/link";
import { redirect } from "next/navigation";

import { createDashboardCustomer, type CreateDashboardCustomerInput } from "@/lib/dashboard-db";
import { serviceTaxonomy } from "@/lib/service-taxonomy";

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
  access: "Åtkomstkoden saknas eller är fel. Ingen kund skapades.",
  disabled: "Kundskapande är inte aktiverat i miljön. Lägg till DASHBOARD_WRITE_CODE eller ADMIN_ACCESS_CODE.",
  name: "Namn är obligatoriskt och får vara max 120 tecken.",
  email: "E-postadressen behöver se giltig ut.",
  phone: "Telefonnummer får vara max 40 tecken.",
  company: "Företagsnamn får vara max 160 tecken.",
  city: "Ort får vara max 120 tecken.",
  notes: "Notering får vara max 1000 tecken.",
  type: "Kundtyp är ogiltig.",
  status: "Status är ogiltig.",
  service: "Vald tjänst finns inte i Profferas tjänstekatalog.",
  save: "Kunden kunde inte sparas. Försök igen eller kontrollera Neon-konfigurationen.",
};

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithError(error: keyof typeof errorMessages) {
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

  const expectedCode = (process.env.DASHBOARD_WRITE_CODE ?? process.env.ADMIN_ACCESS_CODE ?? "").trim();

  if (!expectedCode) {
    redirectWithError("disabled");
  }

  const accessCode = getFormText(formData, "access_code");

  if (accessCode !== expectedCode) {
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

  if (!resolvedService) {
    redirectWithError("service");
  }

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
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Kunder</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Ny kund</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Skapa en ny kund i Profferas CRM. Formuläret kräver intern åtkomstkod och skriver endast till tabellen customers.
        </p>
        <Link
          href="/dashboard/kunder"
          className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#17452f] shadow-sm ring-1 ring-[#dfe5dd] transition hover:bg-[#eef5ef]"
        >
          Tillbaka till kunder
        </Link>
      </section>

      {errorMessage ? (
        <section className="rounded-3xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {errorMessage}
        </section>
      ) : null}

      <form action={createCustomerAction} className="grid gap-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <section className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Intern åtkomstkod
            <input
              name="access_code"
              type="password"
              required
              autoComplete="off"
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Ange intern kod"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Namn
            <input
              name="name"
              type="text"
              required
              maxLength={120}
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Ex. Sara Andersson"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Kundtyp
            <select
              name="customer_type"
              defaultValue="private"
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
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
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
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
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="namn@example.se"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Telefon
            <input
              name="phone"
              type="tel"
              maxLength={40}
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="+46..."
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Företagsnamn
            <input
              name="company_name"
              type="text"
              maxLength={160}
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Valfritt"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Ort
            <input
              name="city"
              type="text"
              maxLength={120}
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Ex. Södertälje"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a] md:col-span-2">
            Primär tjänst
            <select
              name="service_selection"
              defaultValue=""
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
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
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Intern CRM-notering. Valfritt."
            />
          </label>
        </section>

        <section className="rounded-2xl bg-[#f7f7f4] p-4 text-sm leading-7 text-[#5b665f]">
          <strong className="text-[#17201a]">Säkerhetsgräns:</strong> Denna åtgärd skapar endast en kundpost med source dashboard_manual. Den skapar ingen bokning, skickar ingen e-post och ändrar inga lead-tabeller.
        </section>

        <button
          type="submit"
          className="inline-flex w-fit rounded-full bg-[#17452f] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f2f20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
        >
          Skapa kund
        </button>
      </form>
    </div>
  );
}
