import Link from "next/link";
import { notFound } from "next/navigation";

import { getReadOnlySupportSession } from "@/lib/platform-admin";
import { endSupportSessionAction } from "../../workspaces/actions";

export default async function AdminSupportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const support = await getReadOnlySupportSession(sessionId);
  if (!support) notFound();

  const expiresAt = new Date(String(support.expires_at));

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em]">Read-only support mode</p>
            <h1 className="mt-1 text-2xl font-bold">{String(support.name)}</h1>
            <p className="mt-2 text-sm">Orsak: {String(support.reason)}</p>
            <p className="mt-1 text-xs">Sessionen löper ut {expiresAt.toLocaleString("sv-SE")}</p>
          </div>
          <form action={endSupportSessionAction}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <button className="rounded-lg bg-amber-950 px-4 py-2 text-sm font-semibold text-white" type="submit">
              Avsluta supportläge
            </button>
          </form>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Workspace</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-slate-500">Namn</dt><dd className="font-semibold text-slate-900">{String(support.name)}</dd></div>
            <div><dt className="text-slate-500">Slug</dt><dd className="font-semibold text-slate-900">{String(support.slug)}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd className="font-semibold text-slate-900">{String(support.status)}</dd></div>
            <div><dt className="text-slate-500">Plan</dt><dd className="font-semibold text-slate-900">{String(support.plan_key)} · {String(support.plan_status)}</dd></div>
          </dl>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Företagsuppgifter</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-slate-500">Företag</dt><dd className="font-semibold text-slate-900">{String(support.company_name ?? support.name)}</dd></div>
            <div><dt className="text-slate-500">Ort</dt><dd className="font-semibold text-slate-900">{String(support.primary_city ?? "-")}</dd></div>
            <div><dt className="text-slate-500">E-post</dt><dd className="font-semibold text-slate-900">{String(support.contact_email ?? "-")}</dd></div>
            <div><dt className="text-slate-500">Telefon</dt><dd className="font-semibold text-slate-900">{String(support.contact_phone ?? "-")}</dd></div>
          </dl>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Säkra länkar</h2>
        <p className="mt-2 text-sm text-slate-600">Den här vyn ändrar inte kundens data. Publika sidor kan öppnas separat för visuell felsökning.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {support.public_booking_slug ? (
            <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" href={`/boka/${String(support.public_booking_slug)}`} target="_blank">
              Öppna bokningssida
            </Link>
          ) : null}
          <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" href="/admin/workspaces">
            Till workspace-listan
          </Link>
        </div>
      </section>
    </main>
  );
}
