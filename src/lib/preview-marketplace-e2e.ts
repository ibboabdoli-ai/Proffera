import "server-only";

import { createHash } from "node:crypto";

import { PREVIEW_MARKETPLACE_E2E_BRANCH } from "@/lib/preview-marketplace-e2e-constants";

export { PREVIEW_MARKETPLACE_E2E_BRANCH } from "@/lib/preview-marketplace-e2e-constants";

export const PREVIEW_MARKETPLACE_E2E_HEADER = "x-proffera-preview-e2e-run";
export const PREVIEW_MARKETPLACE_E2E_AUTH_COOKIE = "__Secure-proffera-preview-e2e-auth";
export const PREVIEW_MARKETPLACE_E2E_OIDC_AUDIENCE = "proffera-marketplace-preview-e2e";

const PREVIEW_MARKETPLACE_E2E_REPOSITORY = "ibboabdoli-ai/Proffera";
const PREVIEW_MARKETPLACE_E2E_REPOSITORY_ID = "1267669271";
const PREVIEW_MARKETPLACE_E2E_WORKFLOW = "Marketplace Preview browser E2E";
const PREVIEW_MARKETPLACE_E2E_WORKFLOW_REF_PREFIX = `${PREVIEW_MARKETPLACE_E2E_REPOSITORY}/.github/workflows/marketplace-preview-browser-e2e.yml@`;
const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_JWKS_URL = "https://token.actions.githubusercontent.com/.well-known/jwks";
const GITHUB_OIDC_SUBJECT = `repo:${PREVIEW_MARKETPLACE_E2E_REPOSITORY}:pull_request`;
const GITHUB_OIDC_MAX_TOKEN_AGE_SECONDS = 15 * 60;
const GITHUB_OIDC_CLOCK_SKEW_SECONDS = 30;
const GITHUB_OIDC_JWKS_CACHE_MS = 5 * 60 * 1000;
const GITHUB_OIDC_FETCH_TIMEOUT_MS = 5_000;

const runIdPattern = /^[a-f0-9]{32,64}$/;
const customerEmailPattern = /^marketplace-e2e-([a-f0-9]{32,64})@customer\.example\.invalid$/;
const PREVIEW_COORDINATE_LATITUDE_SLOTS = 101;
const PREVIEW_COORDINATE_LONGITUDE_SLOTS = 227;
const PREVIEW_COORDINATE_MIN_LATITUDE = -70;
const PREVIEW_COORDINATE_MIN_LONGITUDE = -170;
const PREVIEW_COORDINATE_LATITUDE_STEP = 0.5;
const PREVIEW_COORDINATE_LONGITUDE_STEP = 1.5;

type PreviewTokenKind = "guest" | "customer" | "review";
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type JsonObject = Record<string, unknown>;
type GithubOidcJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

let githubOidcJwksCache: { expiresAtMs: number; keys: GithubOidcJwk[] } | null = null;

function normalizedRunId(value: string | null | undefined) {
  const runId = String(value ?? "").trim().toLowerCase();
  return runIdPattern.test(runId) ? runId : null;
}

function jwtJson(value: string) {
  if (!value || value.length > 12_000 || !/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonObject : null;
  } catch {
    return null;
  }
}

function oidcCookie(headers: Pick<Headers, "get">) {
  const cookies = String(headers.get("cookie") ?? "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator <= 0) continue;
    if (cookie.slice(0, separator).trim() !== PREVIEW_MARKETPLACE_E2E_AUTH_COOKIE) continue;
    const value = cookie.slice(separator + 1).trim();
    return value || null;
  }
  return null;
}

function audienceMatches(value: unknown) {
  if (typeof value === "string") return value === PREVIEW_MARKETPLACE_E2E_OIDC_AUDIENCE;
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string")
    && value.includes(PREVIEW_MARKETPLACE_E2E_OIDC_AUDIENCE);
}

function finiteNumericClaim(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function oidcClaimsMatch(claims: JsonObject, nowMs: number) {
  const nowSeconds = Math.floor(nowMs / 1000);
  const expiresAt = finiteNumericClaim(claims.exp);
  const issuedAt = finiteNumericClaim(claims.iat);
  const notBefore = claims.nbf === undefined ? null : finiteNumericClaim(claims.nbf);
  if (expiresAt === null || issuedAt === null) return false;
  if (expiresAt <= nowSeconds - GITHUB_OIDC_CLOCK_SKEW_SECONDS) return false;
  if (expiresAt > nowSeconds + GITHUB_OIDC_MAX_TOKEN_AGE_SECONDS) return false;
  if (issuedAt > nowSeconds + GITHUB_OIDC_CLOCK_SKEW_SECONDS) return false;
  if (issuedAt < nowSeconds - GITHUB_OIDC_MAX_TOKEN_AGE_SECONDS) return false;
  if (claims.nbf !== undefined && (notBefore === null || notBefore > nowSeconds + GITHUB_OIDC_CLOCK_SKEW_SECONDS)) {
    return false;
  }

  return claims.iss === GITHUB_OIDC_ISSUER
    && audienceMatches(claims.aud)
    && claims.sub === GITHUB_OIDC_SUBJECT
    && claims.repository === PREVIEW_MARKETPLACE_E2E_REPOSITORY
    && claims.repository_id === PREVIEW_MARKETPLACE_E2E_REPOSITORY_ID
    && claims.event_name === "pull_request"
    && claims.head_ref === PREVIEW_MARKETPLACE_E2E_BRANCH
    && claims.workflow === PREVIEW_MARKETPLACE_E2E_WORKFLOW
    && typeof claims.workflow_ref === "string"
    && claims.workflow_ref.startsWith(PREVIEW_MARKETPLACE_E2E_WORKFLOW_REF_PREFIX)
    && claims.runner_environment === "github-hosted";
}

async function githubOidcKeys(fetchImpl: FetchLike, nowMs: number) {
  const usesRuntimeFetch = fetchImpl === fetch;
  if (usesRuntimeFetch && githubOidcJwksCache && githubOidcJwksCache.expiresAtMs > nowMs) {
    return githubOidcJwksCache.keys;
  }

  try {
    const response = await fetchImpl(GITHUB_OIDC_JWKS_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(GITHUB_OIDC_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = await response.json() as { keys?: unknown };
    if (!Array.isArray(body.keys)) return null;
    const keys = body.keys.filter((item): item is GithubOidcJwk => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const candidate = item as GithubOidcJwk;
      return candidate.kty === "RSA"
        && typeof candidate.kid === "string"
        && (!candidate.alg || candidate.alg === "RS256")
        && (!candidate.use || candidate.use === "sig");
    });
    if (keys.length === 0) return null;
    if (usesRuntimeFetch) {
      githubOidcJwksCache = { expiresAtMs: nowMs + GITHUB_OIDC_JWKS_CACHE_MS, keys };
    }
    return keys;
  } catch {
    return null;
  }
}

async function validGithubActionsOidcToken(
  token: string,
  options: { fetchImpl: FetchLike; nowMs: number },
) {
  if (!token || token.length > 16_000) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  if (!encodedHeader || !encodedClaims || !encodedSignature || !/^[A-Za-z0-9_-]+$/u.test(encodedSignature)) return false;

  const header = jwtJson(encodedHeader);
  const claims = jwtJson(encodedClaims);
  if (!header || !claims || header.alg !== "RS256" || typeof header.kid !== "string") return false;
  if (!oidcClaimsMatch(claims, options.nowMs)) return false;

  const keys = await githubOidcKeys(options.fetchImpl, options.nowMs);
  const jwk = keys?.find((candidate) => candidate.kid === header.kid);
  if (!jwk) return false;

  try {
    const publicKey = await globalThis.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await globalThis.crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      Buffer.from(encodedSignature, "base64url"),
      new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
    );
  } catch {
    return false;
  }
}

export function isPreviewMarketplaceE2eRuntime(env: NodeJS.ProcessEnv = process.env) {
  return env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === PREVIEW_MARKETPLACE_E2E_BRANCH;
}

export function resolvePreviewMarketplaceE2eRunId(
  headers: Pick<Headers, "get">,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!isPreviewMarketplaceE2eRuntime(env)) return null;
  return normalizedRunId(headers.get(PREVIEW_MARKETPLACE_E2E_HEADER));
}

export async function resolveAuthorizedPreviewMarketplaceE2eRunId(
  headers: Pick<Headers, "get">,
  env: NodeJS.ProcessEnv = process.env,
  options: { fetchImpl?: FetchLike; nowMs?: number } = {},
) {
  const runId = resolvePreviewMarketplaceE2eRunId(headers, env);
  if (!runId) return null;
  const token = oidcCookie(headers);
  if (!token) return null;
  const authorized = await validGithubActionsOidcToken(token, {
    fetchImpl: options.fetchImpl ?? fetch,
    nowMs: options.nowMs ?? Date.now(),
  });
  return authorized ? runId : null;
}

export function isPreviewMarketplaceE2eRunId(
  value: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  return isPreviewMarketplaceE2eRuntime(env) && Boolean(normalizedRunId(value));
}

export function previewMarketplaceE2eToken(
  kind: PreviewTokenKind,
  runIdInput: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const runId = normalizedRunId(runIdInput);
  if (!runId || !isPreviewMarketplaceE2eRuntime(env)) return null;
  return createHash("sha256")
    .update(`proffera:preview-marketplace-e2e:v1:${kind}:${runId}`)
    .digest("base64url");
}

export function isPreviewMarketplaceE2eToken(
  kind: PreviewTokenKind,
  token: string,
  runId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!runId) return false;
  const expected = previewMarketplaceE2eToken(kind, runId, env);
  return Boolean(expected && expected === token);
}

export function previewMarketplaceE2eCustomerEmail(runIdInput: string) {
  const runId = normalizedRunId(runIdInput);
  return runId ? `marketplace-e2e-${runId}@customer.example.invalid` : null;
}

export function previewMarketplaceE2eRunIdFromCustomerEmail(
  email: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!isPreviewMarketplaceE2eRuntime(env)) return null;
  const match = customerEmailPattern.exec(email.trim().toLowerCase());
  return normalizedRunId(match?.[1]);
}

export function isPreviewMarketplaceE2eCustomerEmail(
  email: string,
  runId: string | null | undefined,
) {
  if (!runId) return false;
  return previewMarketplaceE2eCustomerEmail(runId) === email.trim().toLowerCase();
}

export function previewMarketplaceE2eProviderSlug(runIdInput: string) {
  const runId = normalizedRunId(runIdInput);
  return runId ? `preview-e2e-vvs-${runId.slice(0, 20)}` : null;
}

export function previewMarketplaceE2eProviderEmail(runIdInput: string) {
  const slug = previewMarketplaceE2eProviderSlug(runIdInput);
  return slug ? `offers@${slug}.example.invalid` : null;
}

export function previewMarketplaceE2eCoordinates(runIdInput: string) {
  const runId = normalizedRunId(runIdInput);
  if (!runId) return null;

  const latitudeSlot = Number.parseInt(runId.slice(0, 8), 16) % PREVIEW_COORDINATE_LATITUDE_SLOTS;
  const longitudeSlot = Number.parseInt(runId.slice(8, 16), 16) % PREVIEW_COORDINATE_LONGITUDE_SLOTS;
  return {
    latitude: PREVIEW_COORDINATE_MIN_LATITUDE + latitudeSlot * PREVIEW_COORDINATE_LATITUDE_STEP,
    longitude: PREVIEW_COORDINATE_MIN_LONGITUDE + longitudeSlot * PREVIEW_COORDINATE_LONGITUDE_STEP,
  };
}

export function previewMarketplaceE2eUuid(scope: string, runIdInput: string) {
  const runId = normalizedRunId(runIdInput);
  if (!runId || !/^[a-z0-9_-]{1,40}$/i.test(scope)) return null;
  const hex = createHash("sha256").update(`proffera:preview-marketplace-e2e:uuid:${scope}:${runId}`).digest("hex");
  const chars = hex.slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ["8", "9", "a", "b"][Number.parseInt(chars[16] ?? "0", 16) % 4] ?? "8";
  const value = chars.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

function luhnCheckDigit(firstNineDigits: string) {
  let sum = 0;
  for (let index = 0; index < firstNineDigits.length; index += 1) {
    const digit = Number(firstNineDigits[index]);
    const product = digit * (index % 2 === 0 ? 2 : 1);
    sum += Math.floor(product / 10) + (product % 10);
  }
  return String((10 - (sum % 10)) % 10);
}

export function previewMarketplaceE2eOrganizationNumber(runIdInput: string) {
  const runId = normalizedRunId(runIdInput);
  if (!runId) return null;
  const digest = createHash("sha256").update(`proffera:preview-marketplace-e2e:org:${runId}`).digest("hex");
  const numeric = [...digest]
    .map((character) => Number.parseInt(character, 16) % 10)
    .join("");
  const firstNine = `556${numeric.slice(0, 6)}`;
  return `${firstNine}${luhnCheckDigit(firstNine)}`;
}
