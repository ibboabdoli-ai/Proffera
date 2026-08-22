import Link from "next/link";

import { requireAdminArea } from "@/lib/admin-authorization";
import { getDirectoryGuestLeadMatches } from "@/features/matching/directory-guest";
import { getMarketplaceInvitationSummaries } from "@/features/matching/marketplace-invitation-state";

export const dynamic = "force-dynamic";

function inviteMessage(value: string | string[] | undefined, sentValue: string | string[] | undefined) {
  const code = Array.isArray(value) ? value[0] : value;
  const sent = Math.max(0, Number(Array.isArray(sentValue) ? sentValue[0] : sentValue) || 0);
  if (code === "sent") return "Inbjudan skickades.";
  if (code === "auto_wave_sent") return `${sent} säker${sent === 1 ? "" : "a"} ${sent === 1 ? "företagsinbjudan" : "företagsinbjudningar"} skickades automatiskt.`;
  if (code === "auto_wave1_first") return "Wave 1 måste använda sina tre platser innan Wave 2 kan startas.";
  if (code === "auto_enough_offers") return "Wave 2 behövs inte – minst två offerter finns redan.";
  if (code === "auto_wave_full") return "Den här vågen har inga lediga platser kvar.";
  if (code === "auto_no_safe_contacts") return "Ingen kvarvarande kandidat har en konfliktfri officiell företagsadress för automatisk utskickning.";
  if (code === "auto_no_delivery") return "Ingen automatisk inbjudan kunde levereras. Kontrollera kandidaternas status och e-postkonfiguration.";
  if (code === "matching_failed") return "Matchningen kunde inte laddas just nu.";
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

function testMessage(value: string | string[] | undefined) {
  const code = Array.isArray(value) ? value[0] : value;
  if (code === "sent") return "Guest Quote-testet skickades. Länken är signerad och giltig i en timme.";
  if (code === "business_email_required") return "Använd en företagsdomän för det kontrollerade testet.";
  if (code === "rate_limited") return "Ett test till samma adress är redan reserverat. Vänta 15 minuter innan nästa försök.";
  if (code === "email_configuration" || code === "token_configuration") return "Testet kan inte skickas eftersom säker e-post- eller tokenkonfiguration saknas.";
  if (code && code !== "sent") return "Guest Quote-testet kunde inte skickas.";
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
  searchParams?: Promise<{ invite?: string | string[]; test?: string | string[]; sent?: string | string[] }>;
}) {
  const admin = await requireAdminArea("quote_admin");
  const [result, query] = await Promise.all([getDirectoryGuestLeadMatches(), searchParams ?? Promise.resolve(undefined)]);
  const message = inviteMessage(query?.invite, query?.sent);
  const testResult = testMessage(query?.test);
  const invitationSummaries = await getMarketplaceInvitationSummaries(result.matches.map((item) => item.lead.id));

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Marketplace – gästförfrågningar</h1>
      <p><Link href="/admin/matchning">Till verifierade workspace-matchningar</Link></p>
      <p>
        Matchningen prioriterar tjänst, verkligt avstånd när verifierade koordinater finns, bekräftat serviceområde och profilkvalitet.
        Om tre bra företag inte finns nära kunden kan sökradien växa 10 → 25 → 50 km. Svaga kandidater läggs inte till bara för att fylla fem platser.
      </p>
      <p>Wave 1 kan skicka till högst tre säkra företagskontakter. Wave 2 kan lägga till högst två endast när första vågen inte gett tillräckligt med offerter.</p>
      {message ? <p role="status" style={{ fontWeight: 700 }}>{message}</p> : null}
      {testResult ? <p role="status" style={{ fontWeight: 700 }}>{testResult}</p> : null}
      {admin.role === "super_admin" ? (
        <section style={{ border: "1px solid #9ec7aa", borderRadius: 12, padding: 16, margin: "18px 0", background: "#f4fbf5" }}>
          <h2 style={{ marginTop: 0 }}>Kontrollerat Guest Quote-test</h2>
          <p>Skickar bara ett tydligt TEST-mejl med en signerad länk. Det skapar eller ändrar ingen kund, offertförfrågan, företagsprofil, inbjudan eller avregistrering.</p>
          <form method="post" action="/api/admin/marketplace/guest-invite-test" style={{ display: "grid", gap: 8, maxWidth: 620 }}>
            <label>
              Kontrollerad företagsadress
              <input name="recipientEmail" type="email" required placeholder="test@foretag.se" style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }} />
            </label>
            <label>
              Testspråk
              <select name="language" defaultValue="sv" style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}>
                <option value="sv">Svenska</option>
                <option value="en">English</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" name="confirmControlledTestRecipient" value="yes" required style={{ marginTop: 3 }} />
              <span>Jag bekräftar att jag kontrollerar adressen och att detta är ett internt test utan verkligt företag eller kund.</span>
            </label>
            <button type="submit" style={{ width: "fit-content", padding: "10px 14px" }}>Skicka kontrollerat test</button>
          </form>
        </section>
      ) : null}
      {!result.ok ? <p>{result.message}</p> : null}

      {result.matches.map((item) => {
        const invitationSummary = invitationSummaries.get(item.lead.id);
        const wave1Count = invitationSummary?.wave1Count ?? 0;
        const wave2Count = invitationSummary?.wave2Count ?? 0;
        const totalCount = invitationSummary?.totalCount ?? 0;
        const submittedOfferCount = item.offers.filter((offer) => offer.status === "submitted" || offer.status === "selected").length;
        const safeAutomaticCandidates = item.candidates.filter((candidate) => Boolean(candidate.recipientEmail) && candidate.contactBasis === "official_business_register");

        return (
          <section key={item.lead.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <h2>{item.lead.reference_id}</h2>
            <p>{item.lead.category} / {item.lead.service_type} / {item.lead.city}</p>
            <p>Status: {item.lead.status}</p>
            <p>Skickat: Wave 1 {wave1Count}/3 · Wave 2 {wave2Count}/2{item.radiusKm ? ` · Matchradie ${item.radiusKm} km` : " · Lokal textmatch"}</p>

            {safeAutomaticCandidates.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "12px 0" }}>
                {wave1Count < 3 && totalCount < 5 ? (
                  <form method="post" action="/api/admin/marketplace/auto-invite">
                    <input type="hidden" name="quoteRequestId" value={item.lead.id} />
                    <input type="hidden" name="wave" value="1" />
                    <button type="submit" style={{ padding: "10px 14px", fontWeight: 700 }}>Skicka Wave 1 automatiskt</button>
                  </form>
                ) : null}
                {wave1Count >= 3 && wave2Count < 2 && totalCount < 5 && submittedOfferCount < 2 ? (
                  <form method="post" action="/api/admin/marketplace/auto-invite">
                    <input type="hidden" name="quoteRequestId" value={item.lead.id} />
                    <input type="hidden" name="wave" value="2" />
                    <button type="submit" style={{ padding: "10px 14px", fontWeight: 700 }}>Lägg till Wave 2 automatiskt</button>
                  </form>
                ) : null}
              </div>
            ) : null}

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

            {item.candidates.length === 0 ? <p>Inga säkra kandidater hittades inom matchningsreglerna.</p> : null}
            {item.candidates.map((candidate) => {
              const existingInvitation = invitationSummary?.byProfile.get(candidate.profileId);
              const wave = existingInvitation?.wave
                ?? (wave1Count < 3 && totalCount < 5 ? 1 : wave2Count < 2 && totalCount < 5 ? 2 : null);

              return (
                <article key={candidate.profileId} style={{ background: "#f7f7f4", borderRadius: 10, padding: 12, marginTop: 10 }}>
                  <strong>{candidate.companyName}</strong>
                  <p>
                    {candidate.city || candidate.municipality} · {candidate.serviceName}
                    {candidate.distanceKm !== null ? ` · ${candidate.distanceKm.toFixed(1)} km` : ""}
                    {candidate.serviceAreaConfirmed ? " · Bekräftat serviceområde" : ""}
                  </p>
                  <p>Score: {candidate.score} · Kvalitet: {candidate.qualityScore}{wave ? ` · Wave ${wave}` : ""}</p>
                  <p>{candidate.reasons.join(" · ")}</p>
                  {candidate.recipientEmail ? <p><strong>Automatisk kontakt:</strong> konfliktfri officiell företagsadress tillgänglig.</p> : null}
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
                        <input name="recipientEmail" type="email" required defaultValue={candidate.recipientEmail} placeholder="kontakt@foretag.se" style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }} />
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
