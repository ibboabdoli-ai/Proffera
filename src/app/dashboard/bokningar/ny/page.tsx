import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createDashboardBooking,
  getDashboardCustomerOptions,
  type CreateDashboardBookingInput,
} from "@/lib/dashboard-db";
import { serviceTaxonomy } from "@/lib/service-taxonomy";

export const dynamic = "force-dynamic";

const bookingStatuses = ["requested", "confirmed", "completed", "cancelled"] as const;

const statusLabels: Record<(typeof bookingStatuses)[number], string> = {
  requested: "Förfrågad",
  confirmed: "Bekräftad",
  completed: "Klar",
  cancelled: "Avbokad",
};

const errorMessages: Record<string, string> = {
  access: "Åtkomstkoden saknas eller är fel. Ingen bokning skapades.",
  disabled: "Bokningsskapande är inte aktiverat. Kontakta administratören innan du försöker igen.",
  customer: "Välj en befintlig kund.",
  title: "Rubrik är obligatorisk och får vara max 140 tecken.",
  status: "Status är ogiltig.",
  start: "Starttid är obligatorisk och behöver vara ett giltigt datum.",
  end: "Sluttid är obligatorisk och behöver vara efter starttid.",
  city: "Ort får vara max 120 tecken.",
  notes: "Notering får vara max 1000 tecken.",
  service: "Vald tjänst finns inte i Profferas tjänstekatalog.",
  save: "Bokningen kunde inte sparas. Försök igen eller kontakta support om problemet kvarstår.",
};

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithError(error: keyof typeof errorMessages): never {
  redirect(`/dashboard/bokningar/ny?error=${error}`);
}

function parseDateTime(value: string) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function resolveServiceSelection(selection: string) {
  if (!selection) {
    return {
      serviceCategorySlug: "",
      serviceSlug: "",
      serviceName: "",
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
    serviceName: service.name,
  };
}

async function createBookingAction(formData: FormData) {
  "use server";

  const expectedCode = (process.env.DASHBOARD_WRITE_CODE ?? process.env.ADMIN_ACCESS_CODE ?? "").trim();

  if (!expectedCode) {
    redirectWithError("disabled");
  }

  const accessCode = getFormText(formData, "access_code");

  if (accessCode !== expectedCode) {
    redirectWithError("access");
  }

  const customerId = getFormText(formData, "customer_id");
  const title = getFormText(formData, "title");
  const status = getFormText(formData, "status");
  const startsAtValue = getFormText(formData, "starts_at");
  const endsAtValue = getFormText(formData, "ends_at");
  const city = getFormText(formData, "city");
  const notes = getFormText(formData, "notes");
  const serviceSelection = getFormText(formData, "service_selection");

  if (!customerId) {
    redirectWithError("customer");
  }

  if (!title || title.length > 140) {
    redirectWithError("title");
  }

  if (!bookingStatuses.includes(status as (typeof bookingStatuses)[number])) {
    redirectWithError("status");
  }

  const startsAt = parseDateTime(startsAtValue);
  const endsAt = parseDateTime(endsAtValue);

  if (!startsAt) {
    redirectWithError("start");
  }

  if (!endsAt || endsAt <= startsAt) {
    redirectWithError("end");
  }

  if (city.length > 120) {
    redirectWithError("city");
  }

  if (notes.length > 1000) {
    redirectWithError("notes");
  }

  const resolvedService = resolveServiceSelection(serviceSelection);

  if (!resolvedService) {
    redirectWithError("service");
  }

  const bookingInput: CreateDashboardBookingInput = {
    customerId,
    title,
    status: status as CreateDashboardBookingInput["status"],
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    city,
    service: resolvedService.serviceName,
    serviceCategorySlug: resolvedService.serviceCategorySlug,
    serviceSlug: resolvedService.serviceSlug,
    notes,
  };

  let bookingId: string;

  try {
    bookingId = await createDashboardBooking(bookingInput);
  } catch (error) {
    console.error("Failed to create dashboard booking", error);
    redirectWithError("save");
  }

  redirect(`/dashboard/bokningar/${bookingId}?created=1`);
}

type NewBookingPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    customer?: string | string[];
  }>;
};

export default async function NewBookingPage({ searchParams }: NewBookingPageProps) {
  const [customers, params] = await Promise.all([
    getDashboardCustomerOptions(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const errorValue = Array.isArray(params?.error) ? params?.error[0] : params?.error;
  const errorMessage = errorValue ? errorMessages[errorValue] : undefined;
  const customerValue = Array.isArray(params?.customer) ? params?.customer[0] : params?.customer;
  const selectedCustomer = customerValue ? customers.find((customer) => customer.id === customerValue) : undefined;
  const selectedCustomerId = selectedCustomer?.id ?? "";
  const selectedCustomerCity = selectedCustomer?.city === "Ok\u00e4nd ort" ? "" : (selectedCustomer?.city ?? "");

  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Bokningar</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Ny bokning</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Skapa en ny bokning i Proffera. Formuläret är skyddat med intern åtkomstkod och kopplar bokningen till vald kund.
        </p>
        <Link
          href="/dashboard/bokningar"
          className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#17452f] shadow-sm ring-1 ring-[#dfe5dd] transition hover:bg-[#eef5ef]"
        >
          Tillbaka till bokningar
        </Link>
      </section>

      {errorMessage ? (
        <section className="rounded-3xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {errorMessage}
        </section>
      ) : null}

      {customers.length === 0 ? (
        <section className="rounded-3xl bg-[#fff5f2] p-5 text-sm leading-7 text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          Det finns inga kunder att koppla bokningen till. Skapa en kund först på kundsidan.
        </section>
      ) : null}

      <form action={createBookingAction} className="grid gap-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
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
            Kund
            <select
              name="customer_id"
              required
              defaultValue={selectedCustomerId}
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
            >
              <option value="" disabled>
                Välj kund
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.city} · {customer.service}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a] md:col-span-2">
            Rubrik
            <input
              name="title"
              type="text"
              required
              maxLength={140}
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Ex. Hemstädning hos kund"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Status
            <select
              name="status"
              defaultValue="requested"
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
            >
              {bookingStatuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Ort
            <input
              name="city"
              type="text"
              maxLength={120}
              defaultValue={selectedCustomerCity}
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              placeholder="Ex. Södertälje"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Start
            <input
              name="starts_at"
              type="datetime-local"
              required
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Slut
            <input
              name="ends_at"
              type="datetime-local"
              required
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a] md:col-span-2">
            Tjänst
            <select
              name="service_selection"
              defaultValue=""
              className="rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
            >
              <option value="">Ingen tjänst vald</option>
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
              placeholder="Intern bokningsnotering. Valfritt."
            />
          </label>
        </section>

        <section className="rounded-2xl bg-[#f7f7f4] p-4 text-sm leading-7 text-[#5b665f]">
          <strong className="text-[#17201a]">Kontrollerad åtgärd:</strong> Bokningen sparas manuellt och kopplas till vald kund. Ingen e-post skickas och inga leads ändras.
        </section>

        <button
          type="submit"
          disabled={customers.length === 0}
          className="inline-flex w-fit rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322] disabled:cursor-not-allowed disabled:bg-[#9aa59d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
        >
          Skapa bokning
        </button>
      </form>
    </div>
  );
}
