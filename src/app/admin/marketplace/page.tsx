import Link from "next/link";

import { requireAdminArea } from "@/lib/admin-authorization";
import { getDirectoryGuestLeadMatches } from "@/features/matching/directory-guest";
import { getMarketplaceInvitationSummaries } from "@/features/matching/marketplace-invitation-state";

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

function offerPrice(priceKind: string, amountMinor: number, currency: string) {
  if (priceKind === "inspection_required") return "Platsbesök krävs";
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: currency || "SEK",
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

export default async function MarketplaceAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ invite?: string | string[] }>;
}) {
  await requireAdminArea("quote_admin");
  const [result, query] = await Promise.all([getDirectoryGuestLeadMatches(), searchParams ?? Promise.resolve(undefined)]);
  const message = inviteMessage(query?.invite);
  const invitationSummaries = await getMarketplaceInvitationSummaries(result.matches.map((item) => item.lead.id));

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

      {result.matches.map((item) => {
        const invitationSummary = invitationSummaries.get(item.lead.id);
        const wave1Count = invitationSummary?.wave1Count ?? 0;
        const wave2Count = invitationSummary?.wave2Count ?? 0;
        const totalCount = invitationSummary?.totalCount ?? 0;

        return (
          <section key={item.lead.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <h2>{item.lead.reference_id}</h2>
            <p>{item.lead.category} / {item.lead.service_type} / {item.lead.city}</p>
            <p>Status: {item.lead.status}</p>
            <p>Skickat: Wave 1 {wave1Count}/3 · Wave 2 {wave2Count}/2</p>

            {item.offers.length > 0 ? (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "#eef6f0" }}>
                <h3 style={{ marginTop: 0 }}>Inkomna företagssvar</h3>
                <p style={{ marginTop: 0 }}>Read-only i detta steg. Val av offert och kontaktöppning hanteras i nästa Marketplace-flöde.</p>
                {item.offers.map((offer) => (
                  <article key={offer.offerId} style={{ borderTop: "1px solid #cedbd1", paddingTop: 10, marginTop: 10 }}>
                    <strong>{offer.companyName}</strong>
                    <p>
                      {offerPrice(offer.priceKind, offer.amountMinor, offer.currency)}
                      {offer.availableDate ? ` · Tillgänglig ${offer.availableDate}` : ""}
                      {` · ${offer.status}`}
                    </p>
                    {offer.companyNote ? <p>{offer.companyNote}</p> : null}
                    <p><Link href={`/foretag/listad/${offer.profileSlug}`} target="_blank">Öppna företagsprofil</Link></p>
                  </article>
                ))}
              </div>
            ) : null}

            {item.candidates.length === 0 ? <p>Inga säkra oclaimade kandidater.</p> : null}
            {item.candidates.map((candidate) => {
              const existingInvitation = invitationSummary?.byProfile.get(candidate.profileId);
              const wave = existingInvitation?.wave
                ?? (wave1Count < 3 && totalCount < 5 ? 1 : wave2Count < 2 && totalCount < 5 ? 2 : null);

              return (
                <article key={candidate.profileId} style={{ background: "#f7f7f4", borderRadius: 10, padding: 12, marginTop: 10 }}>
                  <strong>{candidate.companyName}</strong>
                  <p>{candidate.city || candidate.municipality} · {candidate.serviceName}</p>
                  <p>Score: {candidate.score} · Kvalitet: {candidate.qualityScore}{wave ? ` · Wave ${wave}` : ""}</p>
                  <p>{candidate.reasons.join(" · ")}</p>
                  <p><Link href={`/foretag/listad/${candidate.slug}`} target="_blank">Öppna företagsprofil</Link></p>

                  {existingInvitation?.blocking ? (
                    <p><strong>Aktiv inbjudan:</strong> {existingInvitation.status} · Wave {existingInvitation.wave}</p>
                  ) : wave === null ? (
                    <p>Alla fem platser är redan använda för den här förfrågan.</p>
                  ) : (
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
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
    </main>
  );
}
