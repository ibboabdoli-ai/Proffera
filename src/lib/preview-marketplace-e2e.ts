import "server-only";

import { createHash } from "node:crypto";

export const PREVIEW_MARKETPLACE_E2E_HEADER = "x-proffera-preview-e2e-run";
export const PREVIEW_MARKETPLACE_E2E_BRANCH = "work/proffera-marketplace-browser-lifecycle-e2e";

const runIdPattern = /^[a-f0-9]{32,64}$/;
const customerEmailPattern = /^marketplace-e2e-([a-f0-9]{32,64})@customer\.example\.invalid$/;

type PreviewTokenKind = "guest" | "customer" | "review";

function normalizedRunId(value: string | null | undefined) {
  const runId = String(value ?? "").trim().toLowerCase();
  return runIdPattern.test(runId) ? runId : null;
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
