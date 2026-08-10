import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSuperAdmin } from "@/lib/admin-authorization";

export const dynamic = "force-dynamic";

function safeText(value: unknown) {
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function fullString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeResponseDetail(raw: string, wwwAuthenticate: string | null) {
  const parts: string[] = [];
  if (wwwAuthenticate) parts.push(`www-authenticate: ${wwwAuthenticate.slice(0, 500)}`);

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const key of [
      "code",
      "message",
      "description",
      "error",
      "error_description",
      "type",
      "instance",
      "status",
      "title",
      "detail",
      "requestId",
    ]) {
      const value = parsed[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nested = value as Record<string, unknown>;
        for (const nestedKey of ["code", "message", "description", "title", "detail"]) {
          const nestedValue = safeText(nested[nestedKey]);
          if (nestedValue) parts.push(`${key}.${nestedKey}: ${nestedValue}`);
        }
      } else {
        const text = safeText(value);
        if (text) parts.push(`${key}: ${text}`);
      }
    }
  } catch {
    const plain = raw.trim();
    if (plain) parts.push(`body: ${plain.slice(0, 500)}`);
  }

  return parts.join(" · ") || "Ingen säker felbeskrivning returnerades.";
}

function replaceOrg(template: string, org: string) {
  return template.replaceAll("{organizationNumber}", encodeURIComponent(org));
}

async function runDiagnostic() {
  const tokenUrl = process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim();
  const clientId = process.env.BOLAGSVERKET_CLIENT_ID?.trim();
  const clientSecret = process.env.BOLAGSVERKET_CLIENT_SECRET?.trim();
  const configuredScope = process.env.COMPANY_DIRECTORY_OAUTH_SCOPE?.trim();
  const detailTemplate = process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim();
  const bodyTemplate = process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE?.trim();
  const org = process.env.COMPANY_DIRECTORY_SEED_ORGANIZATION_NUMBERS
    ?.split(/[\s,;]+/)
    .map((value) => value.replace(/\D/g, ""))
    .find((value) => value.length === 10);

  if (!tokenUrl || !clientId || !clientSecret || !detailTemplate || !org) {
    return { token: "Config missing", alive: "–", organisation: "–", scope: "–" };
  }

  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (configuredScope) body.set("scope", configuredScope);

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  const tokenRaw = await tokenResponse.text();
  if (!tokenResponse.ok) {
    return {
      token: `HTTP ${tokenResponse.status} · ${safeResponseDetail(tokenRaw, tokenResponse.headers.get("www-authenticate"))}`,
      alive: "–",
      organisation: "–",
      scope: "–",
    };
  }

  let token = "";
  let grantedScope = "";
  try {
    const tokenJson = JSON.parse(tokenRaw) as Record<string, unknown>;
    // Keep the full access token only in server memory. Never render or log it.
    token = fullString(tokenJson.access_token);
    grantedScope = safeText(tokenJson.scope);
  } catch {
    return { token: "Token response was not valid JSON", alive: "–", organisation: "–", scope: "–" };
  }

  if (!token) {
    return { token: "No access_token returned", alive: "–", organisation: "–", scope: grantedScope || "(none)" };
  }

  const detailUrl = replaceOrg(detailTemplate, org);
  const baseUrl = detailUrl.replace(/\/organisationer(?:\?.*)?$/, "");

  const aliveResponse = await fetch(`${baseUrl}/isalive`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "x-request-id": randomUUID(),
      accept: "application/json, text/plain",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const aliveRaw = await aliveResponse.text();
  const alive = aliveResponse.ok
    ? `HTTP ${aliveResponse.status} · OK`
    : `HTTP ${aliveResponse.status} · ${safeResponseDetail(aliveRaw, aliveResponse.headers.get("www-authenticate"))}`;

  const organisationResponse = await fetch(detailUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "x-request-id": randomUUID(),
      accept: "application/json",
      "content-type": "application/json",
    },
    body: bodyTemplate ? replaceOrg(bodyTemplate, org) : JSON.stringify({ identitetsbeteckning: org }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const organisationRaw = await organisationResponse.text();
  const organisation = organisationResponse.ok
    ? `HTTP ${organisationResponse.status} · OK`
    : `HTTP ${organisationResponse.status} · ${safeResponseDetail(organisationRaw, organisationResponse.headers.get("www-authenticate"))}`;

  return {
    token: `HTTP ${tokenResponse.status} · OK`,
    scope: grantedScope || "(inget scope-fält i svaret)",
    alive,
    organisation,
  };
}

type Props = { searchParams?: Promise<{ run?: string | string[] }> };

export default async function PreviewBolagsverketDiagnosticPage({ searchParams }: Props) {
  if (process.env.VERCEL_ENV !== "preview") notFound();
  await requireSuperAdmin();

  const params = searchParams ? await searchParams : undefined;
  const runValue = Array.isArray(params?.run) ? params?.run[0] : params?.run;
  const result = runValue === "1" ? await runDiagnostic() : null;

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]">Preview only · read-only</p>
        <h1 className="mt-2 text-3xl font-black text-[#17201a]">Bolagsverket OAuth-diagnostik</h1>
        <p className="mt-3 text-sm text-[#687169]">Visar aldrig client secret eller access token och skriver inget till Company Directory.</p>

        {!result ? (
          <Link href="?run=1" className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-[#17452f] px-5 font-black text-white">
            Kör säker diagnostik
          </Link>
        ) : (
          <div className="mt-7 grid gap-4">
            <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5"><h2 className="font-black">OAuth token</h2><p className="mt-2 break-words text-sm">{result.token}</p><p className="mt-2 break-words text-sm">Granted scope: <strong>{result.scope}</strong></p></section>
            <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5"><h2 className="font-black">GET /isalive</h2><p className="mt-2 break-words text-sm">{result.alive}</p></section>
            <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5"><h2 className="font-black">POST /organisationer</h2><p className="mt-2 break-words text-sm">{result.organisation}</p></section>
          </div>
        )}
      </section>
    </main>
  );
}
