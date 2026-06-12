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
        <h1>Företag admin</h1>
        <form action="/admin/foretag" method="get">
          <input name="code" type="password" placeholder="Admin code" />
          <button type="submit">Open</button>
        </form>
      </main>
    );
  }

  const result = await getCompanyRows();

  return (
    <main style={{ padding: 24 }}>
      <h1>Företag</h1>
      <p><a href={`/admin?code=${code}`}>Back to dashboard</a></p>
      {!result.ok ? <p>{result.message}</p> : null}
      {result.rows.map((row) => (
        <section key={row.id} style={{ border: "1px solid #ddd", padding: 16, marginBottom: 16 }}>
          <strong>{row.reference_id}</strong>
          <p>{row.company_name} · {row.organization_number}</p>
          <p>{row.contact_person} · {row.email} · {row.phone}</p>
          <p>{row.city} · {row.service_areas}</p>
          <p>{row.services}</p>
          <p>Status: {row.status}</p>
        </section>
      ))}
    </main>
  );
}
