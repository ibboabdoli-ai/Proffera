import { updateQuoteRequestStatus } from "@/features/admin/actions";
import { getAdminQuoteRequests } from "@/features/admin/quote-requests";

export const dynamic = "force-dynamic";

const nextStatuses = ["pending_review", "approved", "matched", "completed", "rejected", "cancelled"];

export default async function Page() {
  const result = await getAdminQuoteRequests();

  if (!result.ok) {
    return <main style={{ padding: 24 }}>{result.message}</main>;
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Admin status</h1>
      <p><a href="/admin">Back to dashboard</a></p>
      {result.requests.map((request) => (
        <section key={request.id} style={{ border: "1px solid #ddd", padding: 16, marginBottom: 16 }}>
          <strong>{request.reference_id}</strong>
          <p>{request.category} / {request.service_type} / {request.city}</p>
          <p>Current: {request.status}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {nextStatuses.map((status) => (
              <form key={status} action={updateQuoteRequestStatus}>
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
