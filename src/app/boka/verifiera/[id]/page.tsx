import { redirect } from "next/navigation";

import { verifyPublicBookingCode } from "@/lib/public-booking-verification";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string | string[] }>;
};

const messages: Record<string, string> = {
  invalid: "Verifieringsförfrågan är ogiltig.",
  expired: "Koden har gått ut. Gör en ny bokning.",
  attempts: "För många felaktiga försök. Gör en ny bokning.",
  code: "Koden stämmer inte. Kontrollera mejlet och försök igen.",
  conflict: "Tiden hann bli bokad. Välj en ny tid.",
  save: "Bokningen kunde inte sparas. Försök igen.",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function verify(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const result = await verifyPublicBookingCode(id, code);
  if (!result.ok) redirect(`/boka/verifiera/${id}?error=${result.error}`);
  redirect(`/boka/${result.slug}?booked=1`);
}

export default async function VerifyBookingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const error = messages[first(query?.error) ?? ""];

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
      <section className="mx-auto max-w-md rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd] sm:p-9">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-[#17452f]">Verifiera e-post</p>
        <h1 className="mt-3 text-3xl font-bold text-[#17201a]">Ange koden från mejlet</h1>
        <p className="mt-3 text-sm leading-6 text-[#5b665f]">Vi har skickat en sexsiffrig kod. Koden gäller i 10 minuter och bokningen skapas först när den har verifierats.</p>
        {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{error}</p> : null}
        <form action={verify} className="mt-6 grid gap-4">
          <input type="hidden" name="id" value={id} />
          <label className="grid gap-2 text-sm font-bold text-[#17201a]">
            Verifieringskod
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus className="rounded-xl border border-[#cfd9d0] px-4 py-3 text-center text-2xl font-black tracking-[.35em] outline-none focus:border-[#17452f]" />
          </label>
          <button className="rounded-xl bg-[#17452f] px-4 py-3 font-bold text-white hover:bg-[#123923]">Verifiera och skapa bokning</button>
        </form>
      </section>
    </main>
  );
}
