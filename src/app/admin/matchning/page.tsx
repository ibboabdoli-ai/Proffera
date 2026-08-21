import { getLeadMatches } from "@/features/matching/list";

export const dynamic = "force-dynamic";

function mailtoHref(email: string, referenceId: string) {
  const subject = encodeURIComponent(`Proffera-förfrågan ${referenceId}`);
  return `mailto:${email}?subject=${subject}`;
}

export default async function Page() {
  const result = await getLeadMatches();

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Matchning</h1>
      <p><a href="/admin">Back to dashboard</a></p>
      <p><a href="/admin/marketplace">Oclaimade företag / gästförfrågningar</a></p>
      <p>
        Förslag visas bara för verifierade företags-workspaces med publicerad offert-/kontakttjänst och aktiv lead-behörighet.
        Ingen förfrågan skickas automatiskt.
      </p>
      {!result.ok ? <p>{result.message}</p> : null}
      {result.matches.map((item) => (
        <section key={item.lead.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <h2>{item.lead.reference_id}</h2>
          <p>{item.lead.category} / {item.lead.service_type} / {item.lead.city}</p>
          <p>Status: {item.lead.status}</p>
          <h3>Föreslagna mottagare</h3>
          {item.suggestions.length === 0 ? <p>Inga säkra matchningar ännu.</p> : null}
          {item.suggestions.map((suggestion) => (
            <article key={suggestion.workspaceId} style={{ background: "#f7f7f4", borderRadius: 10, padding: 12, marginTop: 10 }}>
              <strong>{suggestion.companyName}</strong>
              <p>{suggestion.primaryCity}{suggestion.serviceArea ? ` / ${suggestion.serviceArea}` : ""}</p>
              <p>Tjänst: {suggestion.serviceName}</p>
              <p>Score: {suggestion.score} ({suggestion.reasons.join(", ")})</p>
              <p>{suggestion.email}{suggestion.phone ? ` · ${suggestion.phone}` : ""}</p>
              <p>
                <a href={mailtoHref(suggestion.email, item.lead.reference_id)}>Öppna mejl manuellt</a>
              </p>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
