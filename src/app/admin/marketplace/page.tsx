import Link from "next/link";

import { requireAdminArea } from "@/lib/admin-authorization";
import { getDirectoryGuestLeadMatches } from "@/features/matching/directory-guest";

export const dynamic = "force-dynamic";

function inviteMessage(value: string | string[] | undefined) {
  const code = Array.isArray(value) ? value[0] : value;
  if (code === "sent") return "Inbjudan skickades.";
  if (code === "suppressed") return "Adressen eller företaget är avregistrerat från gästförfrågningar.";
  if (code === "already_invited") return "Företaget har redan en aktiv inbjudan för den här förfrågan.";
  if (code === "business_email_required") return "Använd en företagsdomän, inte en privat/gratis e-postadress.";
  if (code === "profile_ineligible") return "Företagsprofilen är inte längre tillgänglig för gästmatchning.";
  if (code === "quote_closed") return "Förfrågan är inte längre öppen för nya företagsinbjudningar.";
  if (code === "wave_limit") return "Vågen är full. Wave 1 får ha högst tre företag och Wave 2 högst två.";
  if (code === "invalid_wave") return "Ogiltig våg. Endast Wave 1 och Wave 2 är tillåtna.";
  if (code?.startsWith("email_")) return "Mejlet kunde inte skickas. Kontrollera e-postkonfigurationen.";
  if (code && code !== "sent") return "Inbjudan kunde inte skickas.";
  return "";
}

export default async function MarketplaceAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ invite?: string | string[] }>;
}) {
  await requireAdminArea("quote_admin");
  const [result, query] = await Promise.all([getDirectoryGuestLeadMatches(), searchParams ?? Promise.resolve(undefined)]);
  const message = inviteMessage(query?.invite);

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Marketplace – gästförfrågningar</h1>
      <p><Link href="/admin/matchning">Till verifierade workspace-matchningar</Link></p>
      <p>
        Här visas oclaimade juridiska företag som lokala kandidater. Ort/kommun är bara ett urvalssignal –
        Proffera påstår inte att företaget har ett bekräftat serviceområde där.
      </p>
      <p>Skicka först till högst tre företag. Använd nästa två endast om första vågen inte ger tillräckligt med svar.</p>
      {message ? <p role="status" style={{ fontWeight: 700 }}>{message}</p> : null}
      {!result.ok ? <p>{result.message}</p> : null}

      {result.matches.map((item) => (
        <section key={item.lead.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <h2>{item.lead.reference_id}</h2>
          <p>{item.lead.category} / {item.lead.service_type} / {item.lead.city}</p>
          <p>Status: {item.lead.status}</p>
          {item.candidates.length === 0 ? <p>Inga säkra oclaimade kandidater.</p> : null}
          {item.candidates.map((candidate, index) => {
            const wave = index < 3 ? 1 : 2;
            return (
              <article key={candidate.profileId} style={{ background: "#f7f7f4", borderRadius: 10, padding: 12, marginTop: 10 }}>
                <strong>{candidate.companyName}</strong>
                <p>{candidate.city || candidate.municipality} · {candidate.serviceName}</p>
                <p>Score: {candidate.score} · Kvalitet: {candidate.qualityScore} · Wave {wave}</p>
                <p>{candidate.reasons.join(" · ")}</p>
                <p><Link href={`/foretag/listad/${candidate.slug}`} target="_blank">Öppna företagsprofil</Link></p>
                <form method="post" action="/api/admin/marketplace/guest-invite" style={{ display: "grid", gap: 8, maxWidth: 620 }}>
                  <input type="hidden" name="quoteRequestId" value={item.lead.id} />
                  <input type="hidden" name="profileId" value={candidate.profileId} />
                  <input type="hidden" name="wave" value={wave} />
                  <input type="hidden" name="matchScore" value={candidate.score} />
                  <input type="hidden" name="matchReasons" value={JSON.stringify(candidate.reasons)} />
                  <label>
                    Företagets arbetsmejl
                    <input name="recipientEmail" type="email" required placeholder="kontakt@foretag.se" style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }} />
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <input type="checkbox" name="confirmBusinessContact" value="yes" required style={{ marginTop: 3 }} />
                    <span>Jag har kontrollerat att detta är en företagsadress och att mottagaren inte har avregistrerat sig.</span>
                  </label>
                  <button type="submit" style={{ width: "fit-content", padding: "10px 14px" }}>Skicka säker offertinbjudan</button>
                </form>
              </article>
            );
          })}
        </section>
      ))}
    </main>
  );
}
