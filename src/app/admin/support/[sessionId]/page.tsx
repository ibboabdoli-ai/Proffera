import Link from "next/link";
import { notFound } from "next/navigation";

import { getPlatformAdmin, getSupportSession } from "@/lib/platform-admin";
import {
  downgradeSupportSessionAction,
  elevateSupportSessionAction,
  endSupportSessionAction,
} from "../../workspaces/actions";
import { ContactEditForm } from "./contact-edit-form";

export default async function AdminSupportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const [admin, support] = await Promise.all([
    getPlatformAdmin(),
    getSupportSession(sessionId),
  ]);
  if (!admin || !support) notFound();

  const expiresAt = new Date(String(support.expires_at));
  const isEditMode = String(support.mode) === "edit";

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className={`rounded-2xl border p-5 ${isEditMode ? "border-red-300 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em]">
              {isEditMode ? "Temporary edit support mode" : "Read-only support mode"}
            </p>
            <h1 className="mt-1 text-2xl font-bold">{String(support.name)}</h1>
            <p className="mt-2 text-sm">Orsak: {String(support.reason)}</p>
            <p className="mt-1 text-xs">Sessionen löper ut {expiresAt.toLocaleString("sv-SE")}</p>
            {isEditMode ? (
              <p className="mt-2 text-sm font-semibold">Editläget är begränsat till 10 minuter och alla ändringar måste loggas.</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {isEditMode ? (
              <form action={downgradeSupportSessionAction}>
                <input type="hidden" name="sessionId" value={sessionId} />
                <button className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800" type="submit">
                  Tillbaka till read-only
                </button>
              </form>
            ) : null}
            <form action={endSupportSessionAction}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <button className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${isEditMode ? "bg-red-900" : "bg-amber-950"}`} type="submit">
                Avsluta supportläge
              </button>
            </form>
          </div>
        </div>
      </div>

      {!isEditMode && admin.role === "super_admin" ? (
        <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Tillfälligt editläge</h2>
          <p className="mt-2 text-sm text-slate-600">
            Aktivera endast när en kund uttryckligen har bett om en ändring. Läget löper ut automatiskt efter 10 minuter.
          </p>
          <form action={elevateSupportSessionAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="sessionId" value={sessionId} />
            <input
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              name="reason"
              minLength={12}
              maxLength={500}
              required
              placeholder="Separat orsak, t.ex. kunden bad oss korrigera öppettider"
            />
            <button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
              Aktivera 10 min editläge
            </button>
          </form>
        </section>
      ) : null}

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

      {isEditMode ? (
        <ContactEditForm
          sessionId={sessionId}
          contactEmail={String(support.contact_email ?? "")}
          contactPhone={String(support.contact_phone ?? "")}
          primaryCity={String(support.primary_city ?? "")}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Säkra länkar</h2>
        <p className="mt-2 text-sm text-slate-600">
          Den här supportvyn visar kundens information. Specifika ändringsformulär kräver aktivt editläge och kontrolleras på servern.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {support.public_booking_slug ? (
            <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" href={`/boka/${String(support.public_booking_slug)}`} target="_blank">
              Öppna bokningssida
            </Link>
          ) : null}
          <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" href="/admin/workspaces">
            Till workspace-listan
          </Link>
          <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" href="/admin/audit">
            Audit log
          </Link>
        </div>
      </section>
    </main>
  );
}
