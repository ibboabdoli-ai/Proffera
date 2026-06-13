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
      {!result.ok ? <p>{result.message}</p> : null}
      {result.matches.map((item) => (
        <section key={item.lead.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <h2>{item.lead.reference_id}</h2>
          <p>{item.lead.category} / {item.lead.service_type} / {item.lead.city}</p>
          {item.companies.length === 0 ? <p>Inga matchade företag.</p> : null}
          {item.companies.map((company) => (
            <article key={company.id} style={{ background: "#f7f7f4", borderRadius: 10, padding: 12, marginTop: 10 }}>
              <strong>{company.company_name}</strong>
              <p>{company.email}</p>
              <p>Score: {company.score}</p>
              <a href={buildMailto(company.email, item.lead.reference_id, item.lead.category, item.lead.city)} style={{ display: "inline-block", marginTop: 8 }}>
                Öppna mejl till företag
              </a>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
