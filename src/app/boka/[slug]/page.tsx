import { MapPin } from "lucide-react";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db/server";
import { sendBookingConfirmationEmail } from "@/features/email/lead-email";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

async function requestPublicBooking(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const service = String(formData.get("service") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const sql = getSql();
  if (!sql || !slug || !name || (!email && !phone) || !service || !startsAt) redirect(`/boka/${slug}?error=invalid`);
  const rows = await sql`select id, coalesce(company_name, name) as company_name, primary_city from workspaces where public_booking_slug = ${slug} and status in ('active', 'trial') limit 1`;
  const workspace = rows[0];
  if (!workspace) redirect(`/boka/${slug}?error=unavailable`);
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || start <= new Date()) redirect(`/boka/${slug}?error=time`);
  const conflict = await sql`select id from bookings where workspace_id = ${String(workspace.id)} and status not in ('cancelled', 'no_show') and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz limit 1`;
  if (conflict[0]) redirect(`/boka/${slug}?error=conflict`);
  const customer = await sql`insert into customers (workspace_id, name, email, phone, city, status, source) values (${String(workspace.id)}, ${name}, ${email || null}, ${phone || null}, ${String(workspace.primary_city ?? "") || null}, 'prospect', 'public_booking') returning id`;
  await sql`insert into bookings (workspace_id, customer_id, title, service, city, status, starts_at, ends_at, source) values (${String(workspace.id)}, ${String(customer[0]?.id)}, ${service}, ${service}, ${String(workspace.primary_city ?? "") || null}, 'requested', ${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, 'public_booking')`;
  if (email) {
    await sendBookingConfirmationEmail({ customerName: name, customerEmail: email, companyName: String(workspace.company_name), bookingTitle: service, service, startsAt: start.toISOString(), endsAt: end.toISOString(), city: String(workspace.primary_city ?? "") }).catch(() => null);
  }
  redirect(`/boka/${slug}?booked=1`);
}

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
  return <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6"><section className="mx-auto max-w-3xl rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd] sm:p-10"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#17452f]">Boka online</p><h1 className="mt-3 text-3xl font-bold text-[#17201a]">{String(workspace.company_name)}</h1><p className="mt-2 flex gap-2 text-[#5b665f]"><MapPin className="h-5 w-5" />{String(workspace.primary_city ?? "Sverige")}</p><form action={requestPublicBooking} className="mt-8 grid gap-4"><input type="hidden" name="slug" value={slug} /><input name="name" required placeholder="Ditt namn" className="rounded-xl border p-3"/><input name="email" type="email" placeholder="E-post" className="rounded-xl border p-3"/><input name="phone" placeholder="Telefon" className="rounded-xl border p-3"/><select name="service" required className="rounded-xl border p-3"><option value="">Välj tjänst</option>{services.map((service) => <option key={String(service.name)} value={String(service.name)}>{String(service.name)}</option>)}</select><input name="starts_at" required type="datetime-local" className="rounded-xl border p-3"/><button className="rounded-xl bg-[#17452f] p-3 font-bold text-white">Skicka bokningsförfrågan</button></form></section></main>;
}

function Unavailable() { return <main className="min-h-screen bg-[#f7f7f4] px-4 py-16"><section className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]"><h1 className="text-2xl font-bold text-[#17201a]">Bokning är inte tillgänglig ännu</h1><p className="mt-3 text-[#5b665f]">Företaget har ännu inte publicerat sin bokningssida.</p></section></main>; }
