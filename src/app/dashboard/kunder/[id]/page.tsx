import { neon } from "@neondatabase/serverless";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft, CalendarCheck2, MessageSquareText, UserRound } from "lucide-react";

import { DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardCustomerDetail } from "@/lib/dashboard-db";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const LEGACY_WORKSPACE_ID = "default";

type CustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string | string[];
    note?: string | string[];
    created?: string | string[];
  }>;
};

const customerStatusLabels: Record<string, string> = {
  prospect: "Prospekt",
  active: "Aktiv",
  paused: "Pausad",
  lost: "Förlorad",
};

const bookingStatusLabels: Record<string, string> = {
  draft: "Utkast",
  requested: "Förfrågad",
  confirmed: "Bekräftad",
  completed: "Klar",
  cancelled: "Avbokad",
  no_show: "Uteblev",
};

const eventTypeLabels: Record<string, string> = {
  note: "Notering",
  call: "Samtal",
  email: "E-post",
  booking: "Bokning",
  status_change: "Statusändring",
  ai_conversation: "AI-dialog",
};

const errorMessages: Record<string, string> = {
  access: "Åtkomstkoden saknas eller är fel. Noteringen sparades inte.",
  disabled: "Noteringar är inte aktiverade just nu.",
  title: "Rubriken saknas eller är för lång.",
  note: "Noteringen saknas eller är för lång.",
  save: "Noteringen kunde inte sparas. Försök igen eller kontrollera konfigurationen.",
};

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function getActiveWorkspaceId() {
  const access = await getUserWorkspaceAccess();

  if (!access.ok) {
    return LEGACY_WORKSPACE_ID;
  }

  return access.workspaceId;
}

function normalizeBookingDisplayText(value: string) {
  return value.trim().toLocaleLowerCase("sv-SE");
}

function getBookingMetaText(booking: { title: string; service: string; city: string }) {
  const title = normalizeBookingDisplayText(booking.title);
  const service = normalizeBookingDisplayText(booking.service);

  if (title && title === service) {
    return booking.city;
  }

  return `${booking.city} · ${booking.service}`;
}

function redirectWithNoteError(customerId: string, error: keyof typeof errorMessages): never {
  redirect(`/dashboard/kunder/${customerId}?error=${error}`);
}

async function createCustomerNoteAction(customerId: string, formData: FormData) {
  "use server";

  const expectedCode = (process.env.DASHBOARD_WRITE_CODE ?? process.env.ADMIN_ACCESS_CODE ?? "").trim();

  if (!expectedCode) {
    redirectWithNoteError(customerId, "disabled");
  }

  const accessCode = getFormText(formData, "access_code");

  if (accessCode !== expectedCode) {
    redirectWithNoteError(customerId, "access");
  }

  const title = getFormText(formData, "title");
  const note = getFormText(formData, "note");

  if (!title || title.length > 140) {
    redirectWithNoteError(customerId, "title");
  }

  if (!note || note.length > 1000) {
    redirectWithNoteError(customerId, "note");
  }

  if (!connectionString) {
    redirectWithNoteError(customerId, "disabled");
  }

  const sql = neon(connectionString);
  const workspaceId = await getActiveWorkspaceId();

  try {
    const rows = await sql`
      insert into customer_events (
        workspace_id,
        customer_id,
        booking_id,
        event_type,
        title,
        description,
        metadata
      )
      select
        workspace_id,
        id,
        null,
        'note',
        ${title},
        ${note},
        jsonb_build_object('source', 'dashboard_manual')
      from customers
      where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
        and id = ${customerId}
      returning id
    `;

    if (!rows[0]?.id) {
      redirectWithNoteError(customerId, "save");
    }
  } catch (error) {
    console.error("Failed to create dashboard customer note", error);
    redirectWithNoteError(customerId, "save");
  }

  redirect(`/dashboard/kunder/${customerId}?note=created`);
}

export default async function CustomerDetailPage({ params, searchParams }: CustomerDetailPageProps) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const detail = await getDashboardCustomerDetail(id);

  if (!detail) {
    notFound();
  }

  const { customer, bookings, events } = detail;
  const errorValue = Array.isArray(query?.error) ? query?.error[0] : query?.error;
  const noteValue = Array.isArray(query?.note) ? query?.note[0] : query?.note;
  const createdValue = Array.isArray(query?.created) ? query?.created[0] : query?.created;
  const errorMessage = errorValue ? errorMessages[errorValue] : undefined;
  const noteAction = createCustomerNoteAction.bind(null, customer.id);
  const metrics = [
    { label: "Status", value: customerStatusLabels[customer.status] ?? customer.status, helper: "Aktuell CRM-status", icon: UserRound, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: "Bokningar", value: String(bookings.length), helper: "Kopplade bokningar", icon: CalendarCheck2, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Händelser", value: String(events.length), helper: "Registrerade aktiviteter", icon: Activity, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Noteringar", value: "Intern", helper: "Kontrollerad kundnotering", icon: MessageSquareText, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ] as const;

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Kundprofil"
        title={customer.name}
        description="Se kundens profil, bokningar och historik. Interna noteringar kan sparas kontrollerat med åtkomstkod."
        icon={UserRound}
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

      {createdValue === "1" ? (
        <section className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">
          Kunden skapades och profilen är redo för nästa steg.
        </section>
      ) : null}

      {noteValue === "created" ? (
        <section className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">
          Noteringen sparades i kundhistoriken. Ingen bokning ändrades och ingen e-post skickades.
        </section>
      ) : null}

      <DashboardMetricGrid items={metrics} />

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
            <h3 className="text-xl font-bold text-[#17201a]">Profil</h3>
            <div className="mt-5 grid gap-3 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139] sm:grid-cols-2">
              <p>
                <strong>Kundtyp:</strong> {customer.type}
              </p>
              <p>
                <strong>Ort:</strong> {customer.city}
              </p>
              <p>
                <strong>E-post:</strong> {customer.email}
              </p>
              <p>
                <strong>Telefon:</strong> {customer.phone}
              </p>
              <p>
                <strong>Företag:</strong> {customer.companyName}
              </p>
              <p>
                <strong>Tjänst:</strong> {customer.service}
              </p>
              <p>
                <strong>Skapad:</strong> {customer.createdAt}
              </p>
            </div>
            <p className="mt-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-7 text-[#344139]">
              <strong>Notering:</strong> {customer.notes}
            </p>
          </article>

          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
            <h3 className="text-xl font-bold text-[#17201a]">Lägg till notering</h3>
            <p className="mt-3 text-sm leading-7 text-[#5b665f]">
              Sparar en intern notering i kundhistoriken. Ingen bokning ändras och ingen e-post skickas.
            </p>
            <form action={noteAction} className="mt-5 grid gap-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4">
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Intern åtkomstkod
                <input
                  name="access_code"
                  type="password"
                  required
                  autoComplete="off"
                  className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
                  placeholder="Ange intern kod"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Rubrik
                <input
                  name="title"
                  type="text"
                  required
                  maxLength={140}
                  className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
                  placeholder="Till exempel: Uppföljning"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Notering
                <textarea
                  name="note"
                  required
                  maxLength={1000}
                  rows={5}
                  className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
                  placeholder="Skriv en intern kundnotering..."
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
              >
                Spara notering
              </button>
            </form>
          </article>

          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
            <div className="flex items-center justify-between border-b border-[#dfe5dd] pb-4">
              <div>
                <h3 className="text-xl font-bold text-[#17201a]">Bokningar</h3>
                <p className="text-sm text-[#5b665f]">Bokningar kopplade till kunden.</p>
              </div>
              <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Bokningsdata</span>
            </div>
            {bookings.length === 0 ? (
              <p className="mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#5b665f]">
                Inga bokningar hittades för den här kunden.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {bookings.map((booking) => (
                  <div key={booking.id} className="grid gap-2 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 sm:grid-cols-[170px_1fr_auto] sm:items-center">
                    <span className="font-bold text-[#17452f]">{booking.time}</span>
                    <span>
                      <strong>{booking.title}</strong>
                      <br />
                      <span className="text-sm text-[#5b665f]">
                        {getBookingMetaText(booking)}
                      </span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#344139]">
                        {bookingStatusLabels[booking.status] ?? booking.status}
                      </span>
                      <Link
                        href={`/dashboard/bokningar/${booking.id}`}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl bg-[#173e2b] px-3 py-2 text-xs font-semibold !text-white shadow-sm transition hover:bg-[#0f3322] hover:!text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
                      >
                        Visa bokning
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        <aside className="rounded-3xl bg-[#17452f] p-6 text-white">
          <h3 className="text-xl font-bold">Kundhistorik</h3>
          <p className="mt-3 text-sm leading-7 text-white/80">
            Här samlas interna noteringar, bokningshändelser och annan viktig kundhistorik.
          </p>
          <div className="mt-5 space-y-3">
            {events.length === 0 ? (
              <p className="rounded-2xl bg-white/10 p-4 text-sm text-white/80">Inga händelser hittades.</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="rounded-2xl bg-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                      {eventTypeLabels[event.type] ?? event.type}
                    </span>
                    <span className="text-xs text-white/70">{event.createdAt}</span>
                  </div>
                  <p className="mt-3 font-semibold">{event.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/80">{event.description}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
