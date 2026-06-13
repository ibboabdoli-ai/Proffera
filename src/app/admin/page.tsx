import type { Metadata } from "next";
import { getAdminQuoteRequests, type AdminQuoteRequest } from "@/features/admin/quote-requests";

export const metadata: Metadata = {
  title: "Admin",
  description: "Adminvy för att granska offertförfrågningar i Proffera.",
};

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    status?: string;
    q?: string;
  }>;
};

const adminLinks = [
  {
    title: "Request status",
    description: "Ändra status på offertförfrågningar.",
    href: "/admin/status",
  },
  {
    title: "Företag",
    description: "Se registrerade företag.",
    href: "/admin/foretag",
  },
  {
    title: "Hantera företag",
    description: "Godkänn företag och uppdatera tjänster.",
    href: "/admin/foretag/hantera",
  },
  {
    title: "Matchning",
    description: "Se vilka företag som matchar varje request.",
    href: "/admin/matchning",
  },
  {
    title: "Skicka lead",
    description: "Öppna mailto för matchade företag.",
    href: "/admin/skicka-lead",
  },
  {
    title: "Leveranslogg",
    description: "Markera skickade leads och se outbox-logg.",
    href: "/admin/leverans",
  },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#17452f]">
      {status}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function matchesSearch(request: AdminQuoteRequest, query: string) {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return [
    request.reference_id,
    request.category,
    request.service_type,
    request.city,
    request.postal_code,
    request.contact_name,
    request.contact_email,
    request.status,
  ].some((value) => value.toLowerCase().includes(normalized));
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const result = await getAdminQuoteRequests();

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-[#f7f7f4] px-4 py-12 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#17452f]">Admin</p>
          <h1 className="mt-4 text-3xl font-bold text-[#17201a]">Kunde inte läsa requests</h1>
          <p className="mt-4 text-[#5b665f]">{result.message}</p>
        </section>
      </main>
    );
  }

  const statusFilter = params.status ?? "all";
  const searchQuery = params.q ?? "";
  const statusOptions = Array.from(new Set(result.requests.map((request) => request.status)));
  const filteredRequests = result.requests.filter((request) => {
    const statusMatches = statusFilter === "all" || request.status === statusFilter;
    return statusMatches && matchesSearch(request, searchQuery);
  });

  const submittedCount = result.requests.filter((request) => request.status === "submitted").length;
  const approvedCount = result.requests.filter((request) => request.status === "approved").length;
  const uniqueCities = new Set(result.requests.map((request) => request.city)).size;

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#17452f]">Proffera admin</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#17201a]">Admin dashboard</h1>
            <p className="mt-3 max-w-2xl text-[#5b665f]">
              Hantera requests, företag, matchning, lead-utskick och leveranslogg från en central vy.
            </p>
          </div>
          <a className="rounded-full border border-[#17452f] px-5 py-3 text-sm font-semibold text-[#17452f]" href="/fa-offert">
            Testa formulär
          </a>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold text-[#5b665f]">Totalt</p>
            <p className="mt-2 text-3xl font-bold text-[#17201a]">{result.requests.length}</p>
          </article>
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold text-[#5b665f]">Submitted</p>
            <p className="mt-2 text-3xl font-bold text-[#17201a]">{submittedCount}</p>
          </article>
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold text-[#5b665f]">Approved</p>
            <p className="mt-2 text-3xl font-bold text-[#17201a]">{approvedCount}</p>
          </article>
        </div>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#17201a]">Arbetsflöde</h2>
              <p className="mt-2 text-sm text-[#5b665f]">Gå från request till matchning, skickat lead och logg.</p>
            </div>
            <p className="text-sm font-semibold text-[#5b665f]">Städer: {uniqueCities}</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {adminLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-4 transition hover:border-[#17452f] hover:bg-white"
              >
                <p className="font-semibold text-[#17201a]">{link.title}</p>
                <p className="mt-1 text-sm text-[#5b665f]">{link.description}</p>
              </a>
            ))}
          </div>
        </section>

        <form className="mt-8 grid gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd] md:grid-cols-[1fr_220px_auto]" action="/admin" method="get">
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Sök referens, stad, kategori eller kund"
            className="rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 outline-none focus:border-[#17452f]"
          >
            <option value="all">Alla statusar</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button className="rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0e2e1e]" type="submit">
            Filtrera
          </button>
        </form>

        <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#dfe5dd] text-left text-sm">
              <thead className="bg-[#fbfbf8] text-xs uppercase tracking-[0.15em] text-[#5b665f]">
                <tr>
                  <th className="px-5 py-4">Request</th>
                  <th className="px-5 py-4">Tjänst</th>
                  <th className="px-5 py-4">Kund</th>
                  <th className="px-5 py-4">Plats</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Skapad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe5dd]">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#17201a]">{request.reference_id}</p>
                      <p className="mt-1 max-w-xs text-[#5b665f]">{request.description}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#17201a]">{request.category}</p>
                      <p className="text-[#5b665f]">{request.service_type}</p>
                      <p className="mt-1 text-[#5b665f]">{request.preferred_date}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#17201a]">{request.contact_name}</p>
                      <p className="text-[#5b665f]">{request.contact_email}</p>
                      <p className="text-[#5b665f]">{request.contact_phone}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#17201a]">{request.city}</p>
                      <p className="text-[#5b665f]">{request.postal_code}</p>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={request.status} /></td>
                    <td className="px-5 py-4 text-[#5b665f]">{formatDate(request.created_at)}</td>
                  </tr>
                ))}
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-[#5b665f]" colSpan={6}>
                      Inga requests matchar filtret.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
