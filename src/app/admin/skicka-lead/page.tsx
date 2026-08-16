import { getLeadMatches } from "@/features/matching/list";

export const dynamic = "force-dynamic";

function buildMailto(email: string, referenceId: string, category: string, city: string) {
  const subject = `Ny förfrågan från Proffera: ${category} i ${city}`;
  const body = `Hej,\n\nNi har en matchad förfrågan i Proffera.\n\nReferens: ${referenceId}\nKategori: ${category}\nOrt: ${city}\n\nMed vänliga hälsningar\nProffera`;

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function Page() {
  const result = await getLeadMatches();

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Skicka lead</h1>
      <p><a href="/admin/matchning">Till matchning</a></p>
      <p>Endast manuell e-post öppnas från den här sidan. Proffera skickar inte leadet automatiskt.</p>
      {!result.ok ? <p>{result.message}</p> : null}
      {result.matches.map((item) => (
        <section key={item.lead.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <h2>{item.lead.reference_id}</h2>
          <p>{item.lead.category} / {item.lead.service_type} / {item.lead.city}</p>
          {item.suggestions.length === 0 ? <p>Inga säkra matchningar.</p> : null}
          {item.suggestions.map((suggestion) => (
            <article key={suggestion.workspaceId} style={{ background: "#f7f7f4", borderRadius: 10, padding: 12, marginTop: 10 }}>
              <strong>{suggestion.companyName}</strong>
              <p>{suggestion.email}</p>
              <p>Tjänst: {suggestion.serviceName}</p>
              <p>Score: {suggestion.score}</p>
              <a href={buildMailto(suggestion.email, item.lead.reference_id, item.lead.category, item.lead.city)} style={{ display: "inline-block", marginTop: 8 }}>
                Öppna mejl till företag
              </a>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
