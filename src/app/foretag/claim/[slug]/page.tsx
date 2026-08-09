import { ArrowLeft, BadgeCheck, Building2, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { getServerSession } from "@/lib/auth-session";
import { getPublicDirectoryBusiness } from "@/lib/company-directory-engine";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ status?: string | string[] }>;
};

const statusMessages: Record<string, { title: string; body: string }> = {
  sent: {
    title: "Anspråket är registrerat",
    body: "Vi kopplar inte profilen till ett konto förrän behörigheten till företaget har verifierats.",
  },
  rate_limited: {
    title: "För många försök",
    body: "Försök igen senare. Begränsningen skyddar företag mot automatiska eller felaktiga anspråk.",
  },
  unavailable: {
    title: "Tjänsten är tillfälligt otillgänglig",
    body: "Inga ändringar har gjorts i företagsprofilen. Försök igen senare.",
  },
  claimed: {
    title: "Profilen är redan kopplad",
    body: "Företagsprofilen har redan en verifierad koppling till en Proffera-workspace.",
  },
};

export default async function ClaimCompanyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [business, session, query] = await Promise.all([
    getPublicDirectoryBusiness(slug),
    getServerSession(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  if (!business) notFound();

  const status = Array.isArray(query?.status) ? query?.status[0] : query?.status;
  const message = status ? statusMessages[status] : null;
  const profileHref = `/foretag/listad/${encodeURIComponent(business.slug)}`;
  const returnTo = `/foretag/claim/${business.slug}`;

  return (
    <main className="min-h-screen bg-[#f6f7f5] px-4 py-10 text-[#17201a] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <a href={profileHref} className="inline-flex items-center text-sm font-black text-[#173e2b]">
          <ArrowLeft className="mr-2 h-4 w-4" /> Tillbaka till profilen
        </a>

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/10 sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f2ec] text-[#173e2b]">
            <Building2 className="h-6 w-6" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#54705e]">Gör anspråk på företaget</p>
          <h1 className="mt-2 text-3xl font-black">{business.companyName}</h1>
          <p className="mt-3 text-sm leading-6 text-[#5d685f]">
            Anspråk ger inte automatiskt kontroll över profilen. Proffera verifierar först att kontot har rätt att företräda företaget.
          </p>

          {message ? (
            <div className="mt-7 rounded-2xl border border-[#cfe1d4] bg-[#f1f8f3] p-5">
              <p className="font-black text-[#173e2b]">{message.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#536057]">{message.body}</p>
            </div>
          ) : null}

          <div className="mt-7 grid gap-3">
            <div className="flex gap-3 rounded-2xl bg-[#f7f8f6] p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#173e2b]" />
              <div><p className="font-bold">Företaget matchas mot officiella uppgifter</p><p className="mt-1 text-sm text-[#687169]">Namn, status och bransch ändras inte av ett anspråk.</p></div>
            </div>
            <div className="flex gap-3 rounded-2xl bg-[#f7f8f6] p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#173e2b]" />
              <div><p className="font-bold">Ingen workspace skapas utan verifiering</p><p className="mt-1 text-sm text-[#687169]">Detta förhindrar att fel person tar över en företagsprofil.</p></div>
            </div>
          </div>

          {status !== "sent" ? session?.user?.id ? (
            <form action="/api/public-directory/claim" method="post" className="mt-8">
              <input type="hidden" name="slug" value={business.slug} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" className="min-h-12 w-full rounded-xl bg-[#173e2b] px-5 font-black text-white">
                Skicka verifieringsbegäran
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-[#707870]">Inloggad som {session.user.email ?? "Proffera-användare"}</p>
            </form>
          ) : (
            <a href={`/logga-in?next=${encodeURIComponent(returnTo)}`} className="mt-8 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#173e2b] px-5 font-black text-white">
              Logga in för att fortsätta
            </a>
          ) : null}
        </section>
      </div>
    </main>
  );
}
