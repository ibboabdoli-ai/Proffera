/**
 * Temporary diagnostic for the known Proffera Production Neon destination.
 * Never return/log a URL, hostname, credential, database identifier or tenant data.
 * The Neon endpoint ID is linked to businessdirectory/main in the Neon control plane.
 */
export const EXPECTED_MARIA_TARGET = Object.freeze({
  vercelProjectId: "prj_N56e3ZLZLKq88msVCsltbe9tlauC",
  neonProjectId: "late-water-28070748",
  databaseName: "neondb",
  endpointHost: "ep-shy-forest-aduyugb7.c-2.us-east-1.aws.neon.tech",
});

/** Compare in memory only. No part of the supplied URL is returned. */
export function matchesMariaProductionDatabaseUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const expected = EXPECTED_MARIA_TARGET.endpointHost;
    const pooled = expected.replace(/^([^.]+)/, "$1-pooler");
    const secureSslMode = ["require", "verify-full", "verify-ca", "prefer"]
      .includes(url.searchParams.get("sslmode")?.toLowerCase() ?? "");
    return ["postgres:", "postgresql:", "pg:"].includes(url.protocol)
      && (hostname === expected || hostname === pooled)
      && decodeURIComponent(url.pathname) === `/${EXPECTED_MARIA_TARGET.databaseName}`
      && (url.port === "" || url.port === "5432")
      && secureSslMode;
  } catch {
    return false;
  }
}

export type MariaDatabaseProbe = {
  database_name: string;
  transaction_read_only: boolean;
  maria_workspace_count: number | string;
};

/** The sole public diagnostic payload is an opaque yes/no result. */
export function summarizeMariaProof(
  urlMatched: boolean,
  row: MariaDatabaseProbe,
  projectHintsMatch: boolean,
): { targetVerified: boolean } {
  return {
    targetVerified: urlMatched && projectHintsMatch
      && row.database_name === EXPECTED_MARIA_TARGET.databaseName
      && row.transaction_read_only === true
      && Number(row.maria_workspace_count) === 1,
  };
}
