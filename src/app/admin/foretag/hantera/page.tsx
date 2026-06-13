import { getCompanyRows } from "@/features/company/list";

type PageProps = {
  searchParams: Promise<{ code?: string }>;
};

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const code = params.code ?? "";
  const validCode = process.env.ADMIN_ACCESS_CODE;

  if (!validCode || code !== validCode) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Hantera företag</h1>
        <form action="/admin/foretag/hantera" method="get">
          <input name="code" type="password" placeholder="Admin code" />
          <button type="submit">Open</button>
        </form>
      </main>
    );
  }

  const result = await getCompanyRows();

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Hantera företag</h1>
      <p><a href={`/admin/foretag?code=${code}`}>Till företagslista</a></p>
      {!result.ok ? <p>{result.message}</p> : null}
      {result.rows.map((company) => (
        <section key={company.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h2>{company.company_name}</h2>
          <p>{company.organization_number}</p>
          <p>{company.contact_person} · {company.email} · {company.phone}</p>
          <p>{company.city} · {company.service_areas}</p>
          <p>Status: {company.status}</p>
          <p>Tjänster: {company.services}</p>

          <form action="/api/company-admin" method="post" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <input name="code" type="hidden" value={code} />
            <input name="id" type="hidden" value={company.id} />
            <button name="status" type="submit" value="approved">Approve</button>
            <button name="status" type="submit" value="pending">Pending</button>
            <button name="status" type="submit" value="rejected">Reject</button>
          </form>

          <form action="/api/company-admin" method="post" style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <input name="code" type="hidden" value={code} />
            <input name="id" type="hidden" value={company.id} />
            <input name="services" defaultValue={company.services} placeholder="Tjänster" />
            <button type="submit">Spara tjänster</button>
          </form>
        </section>
      ))}
    </main>
  );
}
