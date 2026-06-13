import { getLeadMatches } from "@/features/matching/list";

export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await getLeadMatches();

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Matchning</h1>
      <p><a href="/admin">Back to dashboard</a></p>
      {!result.ok ? <p>{result.message}</p> : null}
      {result.matches.map((item) => (
        <section key={item.lead.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <h2>{item.lead.reference_id}</h2>
          <p>{item.lead.category} / {item.lead.service_type} / {item.lead.city}</p>
          <p>Status: {item.lead.status}</p>
          <h3>Matchade företag</h3>
          {item.companies.length === 0 ? <p>Inga matchningar ännu.</p> : null}
          {item.companies.map((company) => (
            <article key={company.id} style={{ background: "#f7f7f4", borderRadius: 10, padding: 12, marginTop: 10 }}>
              <strong>{company.company_name}</strong>
              <p>{company.city} / {company.service_areas}</p>
              <p>{company.services}</p>
              <p>Status: {company.status}</p>
              <p>Score: {company.score} ({company.reasons.join(", ")})</p>
              <p>{company.contact_person} · {company.email} · {company.phone}</p>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
