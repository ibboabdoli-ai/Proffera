import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSuperAdmin } from "@/lib/admin-authorization";

export const dynamic = "force-dynamic";

type DiagnosticResult = {
  tokenStatus: number | null;
  tokenType: string;
  expiresIn: string;
  grantedScope: string;
  tokenError: string;
  isAliveStatus: number | null;
  isAliveDetail: string;
  organisationStatus: number | null;
  organisationDetail: string;
};

function safeText(value: unknown) {
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function safeResponseDetail(raw: string, wwwAuthenticate: string | null) {
  const parts: string[] = [];
  if (wwwAuthenticate) parts.push(`www-authenticate: ${wwwAuthenticate.slice(0, 500)}`);

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const key of ["code", "message", "description", "error", "error_description"]) {
      const value = parsed[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nested = value as Record<string, unknown>;
        for (const nestedKey of ["code", "message", "description"]) {
          const nestedValue = safeText(nested[nestedKey]);
          if (nestedValue) parts.push(`${key}.${nestedKey}: ${nestedValue}`);
        }
        continue;
      }
      const text = safeText(value);
      if (text) parts.push(`${key}: ${text}`);
    }
  } catch {
    const plain = raw.trim();
    if (plain) parts.push(`body: ${plain.slice(0, 500)}`);
  }

  return parts.join(" · ") || "Ingen säker felbeskrivning returnerades.";
}

function replaceOrganizationNumber(template: string, organizationNumber: string) {
  return template.replaceAll("{organizationNumber}", encodeURIComponent(organizationNumber));
}

async function runDiagnostic(): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    tokenStatus: null,
    tokenType: "",
    expiresIn: "",
    grantedScope: "",
    tokenError: "",
    isAliveStatus: null,
    isAliveDetail: "",
    organisationStatus: null,
    organisationDetail: "",
  };

  const tokenUrl = process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim();
  const clientId = process.env.BOLAGSVERKET_CLIENT_ID?.trim();
  const clientSecret = process.env.BOLAGSVERKET_CLIENT_SECRET?.trim();
  const configuredScope = process.env.COMPANY_DIRECTORY_OAUTH_SCOPE?.trim();
  const detailTemplate = process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim();
  const seed = process.env.COMPANY_DIRECTORY_SEED_ORGANIZATION_NUMBERS
    ?.split(/[\s,;]+/)
    .map((value) => value.replace(/\D/g, ""))
    .find((value) => value.length === 10);

  if (!tokenUrl || !clientId || !clientSecret || !detailTemplate || !seed) {
    result.tokenError = "Nödvändig Preview-konfiguration saknas.";
    return result;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenBody = new URLSearchParams({ grant_type: "client_credentials" });
  if (configuredScope) tokenBody.set("scope", configuredScope);

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: tokenBody.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  result.tokenStatus = tokenResponse.status;

  const tokenRaw = await tokenResponse.text();
  let token = "";
  if (tokenResponse.ok) {
    try {
      const tokenJson = JSON.parse(tokenRaw) as Record<string, unknown>;
      token = safeText(tokenJson.access_token);
      result.tokenType = safeText(tokenJson.token_type);
      result.expiresIn = safeText(tokenJson.expires_in);
      result.grantedScope = safeText(tokenJson.scope);
    } catch {
      result.tokenError = "Token-svaret var inte giltig JSON.";
    }
  } else {
    result.tokenError = safeResponseDetail(tokenRaw, tokenResponse.headers.get("www-authenticate"));
  }

  if (!token) return result;

  const detailUrl = replaceOrganizationNumber(detailTemplate, seed);
  const baseUrl = detailUrl.replace(/\/organisationer(?:\?.*)?$/, "");

  const aliveResponse = await fetch(`${baseUrl}/isalive`, {
    method: "GET",
    headers: {
      accept: "application/json, text/plain",
      authorization: `Bearer ${token}`,
      "x-request-id": randomUUID(),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  result.isAliveStatus = aliveResponse.status;
  const aliveRaw = await aliveResponse.text();
  result.isAliveDetail = aliveResponse.ok
    ? `OK${aliveRaw.trim() ? ` · ${aliveRaw.trim().slice(0, 200)}` : ""}`
    : safeResponseDetail(aliveRaw, aliveResponse.headers.get("www-authenticate"));

  const bodyTemplate = process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE?.trim();
  const detailBody = bodyTemplate
    ? replaceOrganizationNumber(bodyTemplate, seed)
    : JSON.stringify({ identitetsbeteckning: seed });

  const organisationResponse = await fetch(detailUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-request-id": randomUUID(),
    },
    body: detailBody,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  result.organisationStatus = organisationResponse.status;
  const organisationRaw = await organisationResponse.text();
  result.organisationDetail = organisationResponse.ok
    ? "OK — organisationssvaret accepterades."
    : safeResponseDetail(organisationRaw, organisationResponse.headers.get("www-authenticate"));

  return result;
}

type Props = {
  searchParams?: Promise<{ run?: string | string[] }>;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OAuthDiagnosticPage({ searchParams }: Props) {
  if (process.env.VERCEL_ENV !== "preview") notFound();
  await requireSuperAdmin();

  const params = searchParams ? await searchParams : undefined;
  const shouldRun = first(params?.run) === "1";
  const result = shouldRun ? await runDiagnostic() : null;

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl">
        <Link href="/admin/foretag/directory/preview" className="text-sm font-bold text-[#17452f]">
          ← Tillbaka till Källtest
        </Link>

        <div className="mt-6 rounded-[1.75rem] bg-[#102a1c] p-7 text-white sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Preview only · read-only</p>
          <h1 className="mt-2 text-3xl font-black">Bolagsverket OAuth-diagnostik</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Visar aldrig client secret eller access token. Testet gör inga databasändringar.
          </p>
        </div>

        {!shouldRun ? (
          <div className="mt-7">
            <Link href="?run=1" className="inline-flex min-h-12 items-center rounded-xl bg-[#17452f] px-5 font-black text-white">
              Kör säker diagnostik
            </Link>
          </div>
        ) : null}

        {result ? (
          <div className="mt-7 grid gap-4">
            <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
              <h2 className="font-black">OAuth token</h2>
              <p className="mt-2 text-sm">HTTP: <strong>{result.tokenStatus ?? "–"}</strong></p>
              <p className="mt-1 text-sm">Token type: <strong>{result.tokenType || "–"}</strong></p>
              <p className="mt-1 text-sm">Expires in: <strong>{result.expiresIn || "–"}</strong></p>
              <p className="mt-1 text-sm">Granted scope: <strong>{result.grantedScope || "(inget scope-fält i svaret)"}</strong></p>
              {result.tokenError ? <p className="mt-3 text-sm text-[#8b3024]">{result.tokenError}</p> : null}
            </section>

            <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
              <h2 className="font-black">GET /isalive</h2>
              <p className="mt-2 text-sm">HTTP: <strong>{result.isAliveStatus ?? "–"}</strong></p>
              <p className="mt-2 break-words text-sm">{result.isAliveDetail || "–"}</p>
            </section>

            <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
              <h2 className="font-black">POST /organisationer</h2>
              <p className="mt-2 text-sm">HTTP: <strong>{result.organisationStatus ?? "–"}</strong></p>
              <p className="mt-2 break-words text-sm">{result.organisationDetail || "–"}</p>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
