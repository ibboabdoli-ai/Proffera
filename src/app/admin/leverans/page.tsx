import { getLeadMatches } from "@/features/matching/list";
import { getOutboxRows } from "@/features/outbox/log";

type PageProps = {
  searchParams: Promise<{ code?: string }>;
};

export const dynamic = "force-dynamic";

function mailLink(email: string, leadRef: string, category: string, city: string) {
  const subject = `Ny förfrågan från Proffera: ${category} i ${city}`;
  const body = `Hej,\n\nNi har en matchad förfrågan i Proffera.\n\nReferens: ${leadRef}\nKategori: ${category}\nOrt: ${city}\n\nMed vänliga hälsningar\nProffera`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const code = params.code ?? "";
  const validCode = process.env.ADMIN_ACCESS_CODE;

  if (!validCode || code !== validCode) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Leveranslogg</h1>
        <form action="/admin/leverans" method="get">
          <input name="code" type="password" placeholder="Admin code" />
          <button type="submit">Open</button>
        </form>
      </main>
    );
  }

  const matches = await getLeadMatches();
  const logs = await getOutboxRows();

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Leveranslogg</h1>
      <p><a href={`/admin/skicka-lead?code=${code}`}>Till skicka lead</a></p>

      <h2>Skicka och markera</h2>
      {!matches.ok ? <p>{matches.message}</p> : null}
      {matches.matches.map((item) => (
        <section key={item.lead.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <h3>{item.lead.reference_id}</h3>
          <p>{item.lead.category} / {item.lead.city}</p>
          {item.companies.map((company) => (
            <article key={company.id} style={{ background: "#f7f7f4", borderRadius: 10, padding: 12, marginTop: 10 }}>
              <strong>{company.company_name}</strong>
              <p>{company.email}</p>
              <a href={mailLink(company.email, item.lead.reference_id, item.lead.category, item.lead.city)}>
                Öppna mejl
              </a>
              <form action="/api/outbox" method="post" style={{ marginTop: 10 }}>
                <input name="code" type="hidden" value={code} />
                <input name="leadRef" type="hidden" value={item.lead.reference_id} />
                <input name="companyName" type="hidden" value={company.company_name} />
                <input name="companyEmail" type="hidden" value={company.email} />
                <button type="submit">Markera som skickad</button>
              </form>
            </article>
          ))}
        </section>
      ))}

      <h2>Senaste loggar</h2>
      {!logs.ok ? <p>{logs.message}</p> : null}
      {logs.rows.map((row) => (
        <article key={row.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <strong>{row.lead_ref}</strong>
          <p>{row.company_name} · {row.company_email}</p>
          <p>{row.status} via {row.method}</p>
        </article>
      ))}
    </main>
  );
}
