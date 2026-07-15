import { MapPin } from "lucide-react";

import { getSql } from "@/lib/db/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export default async function PublicBookingPage({ params }: PageProps) {
  const { slug } = await params;
  const sql = getSql();

  if (!sql) return <Unavailable />;

  let workspace: Record<string, unknown> | undefined;
  let services: Array<Record<string, unknown>> = [];

  try {
    const workspaces = await sql`
      select id, coalesce(company_name, name) as company_name, primary_city
      from workspaces where public_booking_slug = ${slug} and status in ('active', 'trial') limit 1
    `;
    workspace = workspaces[0] as Record<string, unknown> | undefined;
    if (workspace) services = await sql`
      select name, description, price_label, duration_minutes
      from workspace_services where workspace_id = ${String(workspace.id)} and is_active = true
      order by sort_order asc, name asc
    `;
  } catch { workspace = undefined; }
  if (!workspace) return <Unavailable />;
  return <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6"><section className="mx-auto max-w-3xl rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd] sm:p-10"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#17452f]">Boka online</p><h1 className="mt-3 text-3xl font-bold text-[#17201a]">{String(workspace.company_name)}</h1><p className="mt-2 flex gap-2 text-[#5b665f]"><MapPin className="h-5 w-5" />{String(workspace.primary_city ?? "Sverige")}</p><h2 className="mt-9 text-xl font-bold text-[#17201a]">Välj tjänst</h2><div className="mt-4 grid gap-3">{services.map((service) => <article key={String(service.name)} className="rounded-2xl border border-[#dfe5dd] p-5"><h3 className="font-bold text-[#17201a]">{String(service.name)}</h3></article>)}</div></section></main>;
}

function Unavailable() { return <main className="min-h-screen bg-[#f7f7f4] px-4 py-16"><section className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]"><h1 className="text-2xl font-bold text-[#17201a]">Bokning är inte tillgänglig ännu</h1><p className="mt-3 text-[#5b665f]">Företaget har ännu inte publicerat sin bokningssida.</p></section></main>; }
