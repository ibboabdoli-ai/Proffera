import { getAdminOperationsHealth } from "@/lib/admin-operations-health";

export const dynamic = "force-dynamic";

export default async function Page() {
  const health = await getAdminOperationsHealth();
  const signals = [...health.configSignals, ...health.dataSignals];
  const criticalCount = signals.filter((signal) => signal.level === "critical").length;
  const warningCount = signals.filter((signal) => signal.level === "warning").length;

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <p><a href="/admin/saas">Back to SaaS dashboard</a></p>
      <h1>Operations Health</h1>
      <p>Read-only runtime, delivery and tenant-safety signals.</p>

      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <strong>Critical: {criticalCount}</strong>
        <strong>Warnings: {warningCount}</strong>
        <strong>Database: {health.databaseConnected ? "Connected" : "Unavailable"}</strong>
      </section>

      <h2>Runtime configuration</h2>
      {health.configSignals.map((signal) => (
        <section key={signal.key} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <strong>{signal.label}: {signal.level.toUpperCase()}</strong>
          <p>{signal.detail}</p>
        </section>
      ))}

      <h2>Database and delivery health</h2>
      {health.dataSignals.map((signal) => (
        <section key={signal.key} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <strong>{signal.label}: {signal.level.toUpperCase()}</strong>
          <p>{signal.detail}</p>
        </section>
      ))}
    </main>
  );
}
