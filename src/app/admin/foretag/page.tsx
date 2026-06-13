import { getCompanyRows } from "@/features/company/list";

export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await getCompanyRows();

  return (
    <main style={{ padding: 24 }}>
      <h1>Företag</h1>
      <p><a href="/admin">Back to dashboard</a></p>
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
