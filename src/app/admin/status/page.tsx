import { updateQuoteRequestStatus } from "@/features/admin/actions";
import { getAdminQuoteRequests } from "@/features/admin/quote-requests";

export const dynamic = "force-dynamic";

const nextStatuses = ["pending_review", "approved", "matched", "completed", "rejected", "cancelled"];

type PageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const code = params.code ?? "";
  const validCode = process.env.ADMIN_ACCESS_CODE;

  if (!validCode || code !== validCode) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Admin status</h1>
        <form action="/admin/status" method="get">
          <input name="code" type="password" placeholder="Admin code" />
          <button type="submit">Open</button>
        </form>
      </main>
    );
  }

  const result = await getAdminQuoteRequests();

  if (!result.ok) {
    return <main style={{ padding: 24 }}>{result.message}</main>;
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Admin status</h1>
      <p><a href={`/admin?code=${code}`}>Back to dashboard</a></p>
      {result.requests.map((request) => (
        <section key={request.id} style={{ border: "1px solid #ddd", padding: 16, marginBottom: 16 }}>
          <strong>{request.reference_id}</strong>
          <p>{request.category} / {request.service_type} / {request.city}</p>
          <p>Current: {request.status}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {nextStatuses.map((status) => (
              <form key={status} action={updateQuoteRequestStatus}>
                <input type="hidden" name="code" value={code} />
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="nextStatus" value={status} />
                <button type="submit" disabled={request.status === status}>{status}</button>
              </form>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
