import { getLeadMatches } from "@/features/matching/list";

type PageProps = {
  searchParams: Promise<{ code?: string }>;
};

export const dynamic = "force-dynamic";

function buildMailto({
  email,
  companyName,
  referenceId,
  category,
  serviceType,
  city,
  description,
}: {
  email: string;
  companyName: string;
  referenceId: string;
  category: string;
  serviceType: string;
  city: string;
  description: string;
}) {
  const subject = `Ny förfrågan från Proffera: ${category} i ${city}`;
  const body = [
    `Hej ${companyName},`,
    "",
    "Ni har en matchad förfrågan i Proffera.",
    "",
    `Referens: ${referenceId}`,
    `Kategori: ${category}`,
    `Tjänst: ${serviceType}`,
    `Ort: ${city}`,
    "",
    "Beskrivning:",
    description,
    "",
    "Svara på detta mejl om ni vill gå vidare med uppdraget.",
    "",
    "Med vänliga hälsningar",
    "Proffera",
  ].join("\n");

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const code = params.code ?? "";
  const validCode = process.env.ADMIN_ACCESS_CODE;

  if (!validCode || code !== validCode) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Skicka lead</h1>
        <form action="/admin/skicka-lead" method="get">
          <input name="code" type="password" placeholder="Admin code" />
          <button type="submit">Open</button>
        </form>
      </main>
    );
  }

  const result = await getLeadMatches();

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Skicka lead</h1>
      <p><a href={`/admin/matchning?code=${code}`}>Till matchning</a></p>
      {!result.ok ? <p>{result.message}</p> : null}
      {result.matches.map((item) => (
        <section key={item.lead.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <h2>{item.lead.reference_id}</h2>
          <p>{item.lead.category} / {item.lead.service_type} / {item.lead.city}</p>
          {item.companies.length === 0 ? <p>Inga matchade företag.</p> : null}
          {item.companies.map((company) => {
            const href = buildMailto({
              email: company.email,
              companyName: company.company_name,
              referenceId: item.lead.reference_id,
              category: item.lead.category,
              serviceType: item.lead.service_type,
              city: item.lead.city,
              description: item.lead.description,
            });

            return (
              <article key={company.id} style={{ background: "#f7f7f4", borderRadius: 10, padding: 12, marginTop: 10 }}>
                <strong>{company.company_name}</strong>
                <p>{company.email}</p>
                <p>Score: {company.score}</p>
                <a href={href} style={{ display: "inline-block", marginTop: 8 }}>
                  Öppna mejl till företag
                </a>
              </article>
            );
          })}
        </section>
      ))}
    </main>
  );
}
