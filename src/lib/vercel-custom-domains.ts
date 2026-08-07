import "server-only";

import { normalizeCustomDomainInput } from "@/lib/public-site-domains";
import {
  createUnconfiguredVercelCustomDomainStatus,
  deriveVercelCustomDomainState,
  extractVercelRecommendedValues,
  extractVercelVerificationRecords,
  type VercelCustomDomainStatus,
} from "@/lib/vercel-custom-domain-policy";

const DEFAULT_PROJECT_ID = "prj_N56e3ZLZLKq88msVCsltbe9tlauC";
const DEFAULT_TEAM_ID = "team_Kk9GsI4gUolw2nOWR80jEOO5";
const VERCEL_API_ORIGIN = "https://api.vercel.com";

type VercelAutomationConfig = {
  token: string;
  projectId: string;
  teamId: string;
};

type ApiResult = {
  status: number;
  ok: boolean;
  body: Record<string, unknown> | null;
};

function automationConfig(env: NodeJS.ProcessEnv = process.env): VercelAutomationConfig | null {
  if (env.VERCEL_ENV !== "production") return null;

  const token = (env.PROFFERA_VERCEL_API_TOKEN ?? "").trim();
  const projectId = (env.PROFFERA_VERCEL_PROJECT_ID ?? DEFAULT_PROJECT_ID).trim();
  const teamId = (env.PROFFERA_VERCEL_TEAM_ID ?? DEFAULT_TEAM_ID).trim();
  if (!token || !projectId || !teamId) return null;

  return { token, projectId, teamId };
}

async function vercelRequest(
  config: VercelAutomationConfig,
  pathname: string,
  init: RequestInit = {},
): Promise<ApiResult> {
  const url = new URL(pathname, VERCEL_API_ORIGIN);
  url.searchParams.set("teamId", config.teamId);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${config.token}`);
  headers.set("Content-Type", "application/json");

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers,
    });
    const value = await response.json().catch(() => null);
    return {
      status: response.status,
      ok: response.ok,
      body: value && typeof value === "object" ? (value as Record<string, unknown>) : null,
    };
  } catch (error) {
    console.error("Vercel custom-domain API request failed", error);
    return { status: 0, ok: false, body: null };
  }
}

function errorCode(body: Record<string, unknown> | null) {
  const error = body?.error;
  if (!error || typeof error !== "object") return "";
  return String((error as Record<string, unknown>).code ?? "").toLowerCase();
}

function isDomainConflict(result: ApiResult) {
  if (result.status === 409) return true;
  const code = errorCode(result.body);
  return code.includes("already") || code.includes("conflict") || code.includes("in_use");
}

async function getVerificationRecords(config: VercelAutomationConfig, domain: string) {
  const result = await vercelRequest(config, `/v9/domains/${encodeURIComponent(domain)}/verification`);
  if (!result.ok) return [];
  return extractVercelVerificationRecords(result.body?.verification ?? result.body?.records ?? result.body);
}

async function readConfiguredStatus(
  config: VercelAutomationConfig,
  domain: string,
): Promise<VercelCustomDomainStatus> {
  const projectDomain = await vercelRequest(
    config,
    `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}`,
  );

  if (projectDomain.status === 404) {
    return {
      ...createUnconfiguredVercelCustomDomainStatus(),
      state: "missing",
      automationConfigured: true,
    };
  }
  if (!projectDomain.ok) {
    return {
      ...createUnconfiguredVercelCustomDomainStatus(),
      state: isDomainConflict(projectDomain) ? "conflict" : "error",
      automationConfigured: true,
    };
  }

  const verified = projectDomain.body?.verified === true;
  const domainConfig = await vercelRequest(
    config,
    `/v6/domains/${encodeURIComponent(domain)}/config?projectIdOrName=${encodeURIComponent(config.projectId)}`,
  );
  const misconfigured = domainConfig.ok && typeof domainConfig.body?.misconfigured === "boolean"
    ? Boolean(domainConfig.body.misconfigured)
    : null;

  let verificationRecords = extractVercelVerificationRecords(projectDomain.body?.verification);
  if (!verified && verificationRecords.length === 0) {
    verificationRecords = await getVerificationRecords(config, domain);
  }

  const recommendedCNAME = domainConfig.ok
    ? extractVercelRecommendedValues(domainConfig.body?.recommendedCNAME)
    : [];
  const recommendedIPv4 = domainConfig.ok
    ? extractVercelRecommendedValues(domainConfig.body?.recommendedIPv4)
    : [];

  return {
    state: deriveVercelCustomDomainState({ projectAttached: true, verified, misconfigured }),
    automationConfigured: true,
    projectAttached: true,
    verified,
    misconfigured,
    verificationRecords,
    recommendedCNAME,
    recommendedIPv4,
  };
}

export async function getVercelCustomDomainStatus(domainInput: string): Promise<VercelCustomDomainStatus> {
  const domain = normalizeCustomDomainInput(domainInput);
  if (!domain) {
    return { ...createUnconfiguredVercelCustomDomainStatus(), state: "error" };
  }

  const config = automationConfig();
  if (!config) return createUnconfiguredVercelCustomDomainStatus();
  return readConfiguredStatus(config, domain);
}

export async function ensureVercelCustomDomain(domainInput: string): Promise<VercelCustomDomainStatus> {
  const domain = normalizeCustomDomainInput(domainInput);
  if (!domain) {
    return { ...createUnconfiguredVercelCustomDomainStatus(), state: "error" };
  }

  const config = automationConfig();
  if (!config) return createUnconfiguredVercelCustomDomainStatus();

  let status = await readConfiguredStatus(config, domain);
  if (status.state === "error" || status.state === "conflict") return status;

  if (!status.projectAttached) {
    const added = await vercelRequest(
      config,
      `/v10/projects/${encodeURIComponent(config.projectId)}/domains`,
      { method: "POST", body: JSON.stringify({ name: domain }) },
    );
    if (!added.ok && added.status !== 409) {
      return {
        ...status,
        state: isDomainConflict(added) ? "conflict" : "error",
      };
    }
    if (!added.ok && isDomainConflict(added)) {
      return { ...status, state: "conflict" };
    }
    status = await readConfiguredStatus(config, domain);
  }

  if (status.projectAttached && !status.verified) {
    await vercelRequest(
      config,
      `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}/verify`,
      { method: "POST", body: "{}" },
    );
    status = await readConfiguredStatus(config, domain);
  }

  return status;
}
