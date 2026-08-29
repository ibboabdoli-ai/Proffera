import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

import {
  requireBolagsverketHttpsUrl,
  waitForBolagsverketRequestSlot,
} from "@/lib/bolagsverket-api-policy";
import {
  mapSniToDirectoryCategory,
  normalizeSniCode,
  slugifyDirectoryBusiness,
} from "@/lib/company-directory-policy";
import { mapPrimarySniToDirectorySearchService } from "@/lib/company-directory-service-taxonomy";
import { getSql } from "@/lib/db/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

type AnyRecord = Record<string, unknown>;

type SoleTraderOfficialBusiness = {
  companyName: string;
  legalForm: string;
  primarySniCode: string;
  primarySniLabel: string;
  activityDescription: string;
  city: string;
};

export type SoleTraderOwnerOnboardingResult =
  | { status: "sole_trader_review_pending"; companyName: string }
  | { status: "sole_trader_linked"; profileSlug: string; companyName: string }
  | { status: "sole_trader_ambiguous"; companyName: string }
  | { status: "sole_trader_not_active"; companyName: string };

function object(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : null;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  const row = object(value);
  if (!row) return "";
  for (const key of ["klartext", "text", "namn", "name", "kod", "code", "value", "värde", "varde"]) {
    if (key in row) {
      const nested = text(row[key]);
      if (nested) return nested;
    }
  }
  return "";
}

function normalizePrivateIdentity10(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}

function expandPrivateIdentity12(value: string) {
  const yy = Number(value.slice(0, 2));
  const mm = Number(value.slice(2, 4));
  const dd = Number(value.slice(4, 6));
  if (!Number.isInteger(yy) || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const now = new Date();
  const currentCentury = Math.floor(now.getUTCFullYear() / 100) * 100;
  const candidates = [currentCentury + yy, currentCentury - 100 + yy];
  for (const year of candidates) {
    const date = new Date(Date.UTC(year, mm - 1, dd));
    if (
      date.getUTCFullYear() === year
      && date.getUTCMonth() === mm - 1
      && date.getUTCDate() === dd
      && date.getTime() <= now.getTime()
      && now.getUTCFullYear() - year <= 120
    ) {
      return `${year}${value.slice(2)}`;
    }
  }
  return null;
}

function responseIdentity10(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (/^\d{12}$/.test(digits)) return digits.slice(2);
  return /^\d{10}$/.test(digits) ? digits : "";
}

function organizationRecords(payload: unknown): AnyRecord[] {
  if (Array.isArray(payload)) {
    return payload.map(object).filter((row): row is AnyRecord => Boolean(row));
  }
  const root = object(payload);
  if (!root) return [];
  for (const key of ["organisationer", "organisations", "organizations", "items", "results"]) {
    const value = root[key];
    if (Array.isArray(value)) return value.map(object).filter((row): row is AnyRecord => Boolean(row));
  }
  for (const key of ["organisation", "organization", "data", "result"]) {
    const value = root[key];
    if (Array.isArray(value)) return value.map(object).filter((row): row is AnyRecord => Boolean(row));
    const row = object(value);
    if (row) return [row];
  }
  return [root];
}

function identityType(row: AnyRecord) {
  const identity = object(row.organisationsidentitet ?? row.organizationIdentity);
  const raw = identity?.typ ?? identity?.type;
  return text(object(raw)?.kod ?? object(raw)?.code ?? raw).toUpperCase();
}

function identityValue(row: AnyRecord) {
  const identity = object(row.organisationsidentitet ?? row.organizationIdentity);
  return identity?.identitetsbeteckning ?? identity?.identifier ?? "";
}

function legalForm(row: AnyRecord) {
  const form = object(row.organisationsform ?? row.organizationForm);
  const code = text(form?.kod ?? form?.code).toUpperCase();
  const label = text(form?.klartext ?? form?.text ?? row.organisationsform ?? row.organizationForm);
  return { code, label };
}

function isSoleTraderRecord(row: AnyRecord) {
  const form = legalForm(row);
  const normalized = form.label.toLocaleLowerCase("sv-SE");
  return form.code === "E" || normalized.includes("enskild");
}

function hasDeregistrationEvidence(row: AnyRecord) {
  const deregistered = row.avregistreradOrganisation ?? row.avregistrerad ?? row.deregisteredAt;
  if (!deregistered) return false;
  if (typeof deregistered === "string" || typeof deregistered === "number") return Boolean(text(deregistered));
  if (Array.isArray(deregistered)) return deregistered.some((item) => Boolean(text(item)) || Boolean(object(item)));
  const record = object(deregistered);
  if (!record) return false;
  return Boolean(text(record.avregistreringsdatum ?? record.date ?? record.datum ?? record.deregisteredAt))
    || record.avregistrerad === true
    || record.deregistered === true;
}

function businessName(row: AnyRecord) {
  for (const direct of [row.legalName, row.displayName, row.foretagsnamn, row["företagsnamn"], row.namn]) {
    const value = text(direct);
    if (value) return value;
  }
  const names = object(row.organisationsnamn)?.organisationsnamnLista
    ?? row.organisationsnamnLista
    ?? object(row.organizationNames)?.names;
  for (const item of Array.isArray(names) ? names : names ? [names] : []) {
    const candidate = object(item);
    const value = text(candidate?.namn ?? candidate?.name ?? item);
    if (value) return value;
  }
  return "";
}

function findNestedValues(value: unknown, keyPattern: RegExp, depth = 0): unknown[] {
  if (depth > 7) return [];
  if (Array.isArray(value)) return value.flatMap((item) => findNestedValues(item, keyPattern, depth + 1));
  const row = object(value);
  if (!row) return [];
  const found: unknown[] = [];
  for (const [key, nested] of Object.entries(row)) {
    if (keyPattern.test(key)) found.push(nested);
    if (nested && typeof nested === "object") found.push(...findNestedValues(nested, keyPattern, depth + 1));
  }
  return found;
}

function sniFromRecord(row: AnyRecord) {
  const containers = [
    row.naringsgrenOrganisation,
    row["näringsgrenOrganisation"],
    row.naringsgrenar,
    row["näringsgrenar"],
    row.sniKoder,
  ].filter(Boolean);
  const candidates: Array<{ code: string; label: string }> = [];
  for (const container of containers) {
    const codes = findNestedValues(container, /^(kod|code|sniKod|snikod|naringsgrenKod|näringsgrenKod)$/i);
    for (const raw of codes) {
      const code = normalizeSniCode(text(raw));
      if (!/^\d{2}\.\d{2,3}$/.test(code)) continue;
      candidates.push({ code, label: "" });
    }
  }
  const unique = [...new Map(candidates.map((item) => [item.code, item])).values()];
  return unique[0] ?? { code: "", label: "" };
}

function activityDescription(row: AnyRecord) {
  return text(
    object(row.verksamhetsbeskrivning)?.verksamhetsbeskrivning
      ?? object(row.verksamhetsbeskrivning)?.beskrivning
      ?? row.verksamhetsbeskrivning
      ?? row.businessDescription
      ?? row.description,
  );
}

function cityFromRecord(row: AnyRecord) {
  const post = object(object(row.postadressOrganisation)?.postadress)
    ?? object(row.postadressOrganisation)
    ?? object(row.postadress)
    ?? object(row.address);
  return text(post?.postort ?? post?.city ?? post?.ort ?? post?.postalTown);
}

function hasExplicitApiError(value: unknown, depth = 0): boolean {
  if (depth > 7 || !value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasExplicitApiError(item, depth + 1));
  const row = value as AnyRecord;
  if (Object.prototype.hasOwnProperty.call(row, "fel") && row.fel !== null && row.fel !== undefined) return true;
  return Object.entries(row).some(([key, child]) => key !== "fel" && hasExplicitApiError(child, depth + 1));
}

function selectCurrentSoleTraderBusiness(payload: unknown, requestedIdentity10: string):
  | { status: "found"; business: SoleTraderOfficialBusiness }
  | { status: "ambiguous"; companyName: string }
  | { status: "not_active"; companyName: string } {
  if (hasExplicitApiError(payload)) throw new Error("sole_trader_source_error");

  const matching = organizationRecords(payload).filter((row) => {
    const type = identityType(row);
    const supportedType = !type || type === "PERSONNUMMER" || type === "PERSONNR";
    return supportedType
      && responseIdentity10(identityValue(row)) === requestedIdentity10
      && isSoleTraderRecord(row);
  });
  if (matching.length === 0) {
    throw new Error("sole_trader_source_error");
  }

  const current = matching.filter((row) => !hasDeregistrationEvidence(row));
  if (current.length === 0) {
    return { status: "not_active", companyName: matching.map(businessName).find(Boolean) ?? "" };
  }
  if (current.length > 1) {
    return { status: "ambiguous", companyName: current.map(businessName).find(Boolean) ?? "" };
  }

  const row = current[0]!;
  const name = businessName(row);
  if (!name) throw new Error("sole_trader_source_error");
  const form = legalForm(row);
  const sni = sniFromRecord(row);
  return {
    status: "found",
    business: {
      companyName: name,
      legalForm: form.label || "Enskild näringsidkare",
      primarySniCode: sni.code,
      primarySniLabel: sni.label,
      activityDescription: activityDescription(row),
      city: cityFromRecord(row),
    },
  };
}

async function oauthAccessToken() {
  const staticToken = process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN?.trim();
  if (staticToken) return staticToken;

  const tokenUrl = process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim();
  const clientId = process.env.BOLAGSVERKET_CLIENT_ID?.trim();
  const clientSecret = process.env.BOLAGSVERKET_CLIENT_SECRET?.trim();
  if (!tokenUrl || !clientId || !clientSecret) return "";
  const secureTokenUrl = requireBolagsverketHttpsUrl(tokenUrl, "COMPANY_DIRECTORY_TOKEN_URL");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const scope = process.env.COMPANY_DIRECTORY_OAUTH_SCOPE?.trim();
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (scope) body.set("scope", scope);

  const response = await fetch(secureTokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("sole_trader_source_error");
  const payload = object(await response.json());
  const token = payload ? text(payload.access_token) : "";
  if (!token) throw new Error("sole_trader_source_error");
  return token;
}

function replaceIdentity(template: string, identity: string) {
  return template.replaceAll("{organizationNumber}", identity);
}

function soleTraderDetailEndpoint(template: string) {
  const raw = template.trim();
  if (!raw) throw new Error("sole_trader_source_error");

  const queryIndex = raw.indexOf("?");
  const hashIndex = raw.indexOf("#");
  const suffixIndex = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .reduce((lowest, index) => Math.min(lowest, index), raw.length);
  const pathPart = raw.slice(0, suffixIndex);
  const suffix = raw.slice(suffixIndex);

  if (suffix.includes("{organizationNumber}")) throw new Error("sole_trader_source_error");

  const endpointPath = pathPart.replace(/\/\{organizationNumber\}\/?$/, "");
  if (!endpointPath || endpointPath.includes("{organizationNumber}")) {
    throw new Error("sole_trader_source_error");
  }
  return `${endpointPath}${suffix}`;
}

async function requireExternalLookupBudget(input: { workspaceId: string; userId: string }) {
  const allowed = await allowPublicSubmission({
    scope: "owner_sole_trader_onboarding",
    requestHeaders: await headers(),
    identity: `${input.workspaceId}:${input.userId}`,
    maxAttempts: 4,
    windowSeconds: 60 * 60,
  });
  if (!allowed) throw new Error("rate_limited");
}

async function verifyOfficialSoleTrader(identity10: string) {
  const identity12 = expandPrivateIdentity12(identity10);
  if (!identity12) throw new Error("sole_trader_identity");
  const template = process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim();
  if (!template) throw new Error("sole_trader_source_error");

  const provider = process.env.COMPANY_DIRECTORY_PROVIDER?.trim() || "bolagsverket_vardefulla_datamangder";
  const url = requireBolagsverketHttpsUrl(soleTraderDetailEndpoint(template), "COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE");
  const token = await oauthAccessToken();
  const bodyTemplate = process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE?.trim();
  const body = bodyTemplate
    ? replaceIdentity(bodyTemplate, identity12)
    : JSON.stringify({ identitetsbeteckning: identity12 });

  await waitForBolagsverketRequestSlot(provider);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-request-id": randomUUID(),
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("sole_trader_source_error");
  return selectCurrentSoleTraderBusiness(await response.json(), identity10);
}

async function requireManageableWorkspace() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) throw new Error("workspace_access");
  return access;
}

async function currentSoleTraderState(workspaceId: string) {
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");
  const linked = await sql`
    select public_slug, display_name
    from company_directory_profiles
    where claimed_workspace_id = ${workspaceId}::uuid
      and organization_kind = 'sole_trader'
    order by updated_at desc
    limit 1
  `;
  if (linked[0]) {
    return {
      status: "linked" as const,
      profileSlug: String(linked[0].public_slug ?? ""),
      companyName: String(linked[0].display_name ?? ""),
    };
  }

  const pending = await sql`
    select profile.display_name
    from company_directory_claims claim
    join company_directory_profiles profile on profile.id = claim.profile_id
    where claim.requested_workspace_id = ${workspaceId}::uuid
      and claim.status in ('pending', 'verified')
      and claim.verification_method = 'manual_review'
      and profile.organization_kind = 'sole_trader'
    order by claim.requested_at desc
    limit 1
  `;
  if (pending[0]) {
    return { status: "pending" as const, companyName: String(pending[0].display_name ?? "") };
  }
  return null;
}

async function persistPendingSoleTraderClaim(input: {
  workspaceId: string;
  userId: string;
  business: SoleTraderOfficialBusiness;
}) {
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");

  const profileId = randomUUID();
  const claimId = randomUUID();
  const publicSlug = `${slugifyDirectoryBusiness(input.business.companyName)}-${profileId.replace(/-/g, "").slice(0, 8)}`;
  const surrogateIdentity = `sole-trader-${profileId}`;
  const category = mapSniToDirectoryCategory(input.business.primarySniCode);
  const serviceSlug = mapPrimarySniToDirectorySearchService(input.business.primarySniCode);
  const reasons = JSON.stringify(["sole_trader_owner_verification_pending"]);
  const safeEvidence = JSON.stringify({
    kind: "sole_trader_official_lookup",
    companyName: input.business.companyName,
    legalForm: input.business.legalForm,
    checkedAt: new Date().toISOString(),
  });

  await sql.transaction((tx) => [
    tx`select pg_advisory_xact_lock(hashtextextended(${`sole-trader-owner:${input.workspaceId}`}, 0))`,
    tx`
      insert into company_directory_profiles (
        id, country_code, organization_number, organization_kind, legal_name, display_name,
        legal_form, organization_status, is_active, f_tax_status, vat_status, employer_status,
        primary_sni_code, primary_sni_label, category_slug, service_slugs, activity_description,
        address_line1, postal_code, city, municipality, region, public_slug,
        publication_status, quality_score, quality_reasons, privacy_blocked, auto_public_eligible,
        official_source, source_record_id, source_updated_at, last_synced_at, published_at
      )
      select
        ${profileId}::uuid, 'SE', ${surrogateIdentity}, 'sole_trader', ${input.business.companyName}, ${input.business.companyName},
        ${input.business.legalForm}, 'Registrerad', true, '', '', '',
        ${input.business.primarySniCode}, ${input.business.primarySniLabel}, ${category?.categorySlug ?? ""}, '{}'::text[], ${input.business.activityDescription},
        '', '', ${input.business.city}, '', '', ${publicSlug},
        'blocked', 70, ${reasons}::jsonb, true, false,
        'bolagsverket_vardefulla_datamangder:sole_trader_owner', ${profileId}, null, now(), null
      where not exists (
        select 1 from company_directory_profiles existing
        where existing.claimed_workspace_id = ${input.workspaceId}::uuid
          and existing.organization_kind = 'sole_trader'
      )
      and not exists (
        select 1
        from company_directory_claims existing_claim
        join company_directory_profiles existing_profile on existing_profile.id = existing_claim.profile_id
        where existing_claim.requested_workspace_id = ${input.workspaceId}::uuid
          and existing_claim.status in ('pending', 'verified')
          and existing_claim.verification_method = 'manual_review'
          and existing_profile.organization_kind = 'sole_trader'
      )
    `,
    tx`
      insert into company_directory_profile_services (
        profile_id, service_slug, source_type, confidence, is_primary, is_active, public_visible
      )
      select ${profileId}::uuid, service.slug, 'sni', 85, true, true, true
      from company_directory_services service
      where ${serviceSlug ?? ""} <> ''
        and service.slug = ${serviceSlug ?? ""}
        and service.is_active = true
        and exists (select 1 from company_directory_profiles profile where profile.id = ${profileId}::uuid)
      on conflict (profile_id, service_slug) do nothing
    `,
    tx`
      insert into company_directory_claims (
        id, profile_id, claimant_user_id, requested_workspace_id, status,
        verification_method, verification_reference, requested_at
      )
      select ${claimId}::uuid, ${profileId}::uuid, ${input.userId}, ${input.workspaceId}::uuid,
        'pending', 'manual_review', ${safeEvidence}, now()
      where exists (select 1 from company_directory_profiles profile where profile.id = ${profileId}::uuid)
    `,
  ]);
}

/**
 * Owner-only sole-trader onboarding. The private identifier is used only for the
 * live official request. It is deliberately discarded before any Directory or
 * claim row is persisted; the profile receives an opaque surrogate identity and
 * an identifier-independent public slug.
 */
export async function onboardOwnerSoleTrader(value: unknown): Promise<SoleTraderOwnerOnboardingResult> {
  const access = await requireManageableWorkspace();
  const existing = await currentSoleTraderState(access.workspaceId);
  if (existing?.status === "linked") {
    return { status: "sole_trader_linked", profileSlug: existing.profileSlug, companyName: existing.companyName };
  }
  if (existing?.status === "pending") {
    return { status: "sole_trader_review_pending", companyName: existing.companyName };
  }

  const identity10 = normalizePrivateIdentity10(value);
  if (!identity10) throw new Error("sole_trader_identity");
  await requireExternalLookupBudget({ workspaceId: access.workspaceId, userId: access.userId });
  const verified = await verifyOfficialSoleTrader(identity10);
  if (verified.status === "ambiguous") {
    return { status: "sole_trader_ambiguous", companyName: verified.companyName };
  }
  if (verified.status === "not_active") {
    return { status: "sole_trader_not_active", companyName: verified.companyName };
  }

  await persistPendingSoleTraderClaim({
    workspaceId: access.workspaceId,
    userId: access.userId,
    business: verified.business,
  });
  const persisted = await currentSoleTraderState(access.workspaceId);
  if (persisted?.status === "linked") {
    return { status: "sole_trader_linked", profileSlug: persisted.profileSlug, companyName: persisted.companyName };
  }
  if (persisted?.status === "pending") {
    return { status: "sole_trader_review_pending", companyName: persisted.companyName };
  }
  throw new Error("sole_trader_persistence");
}

function safeUuid(value: string) {
  const cleaned = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)
    ? cleaned
    : null;
}

function hasPersonnummerLikeValue(value: string) {
  const candidates = value.matchAll(/(?:^|[^\d])(\d(?:[^\p{L}\d]*\d){9,11})(?!\d)/gu);
  for (const match of candidates) {
    const digits = String(match[1] ?? "").replace(/\D/g, "");
    if (digits.length !== 10 && digits.length !== 12) continue;
    const datePart = digits.length === 12 ? digits.slice(2, 8) : digits.slice(0, 6);
    const month = Number(datePart.slice(2, 4));
    const rawDay = Number(datePart.slice(4, 6));
    const day = rawDay > 60 ? rawDay - 60 : rawDay;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return true;
  }
  return false;
}

export function assertSoleTraderAdminTextHasNoPersonalIdentifier(value: string) {
  if (hasPersonnummerLikeValue(value)) {
    throw new Error("Do not include personal identifiers in the verification reference");
  }
}

function safeAdminReference(value: string) {
  const reference = value.trim();
  if (reference.length < 3 || reference.length > 500) throw new Error("Verification evidence/reference is required");
  assertSoleTraderAdminTextHasNoPersonalIdentifier(reference);
  return reference;
}

/**
 * Super-admin ownership approval for the dedicated sole-trader branch.
 * Ownership is linked, but the Directory profile deliberately remains blocked
 * until a separate publication-safety path can establish publishable evidence.
 */
export async function approveSoleTraderDirectoryClaim(input: { claimId: string; reference: string }) {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
  const claimId = safeUuid(input.claimId);
  if (!claimId) throw new Error("Invalid claim id");
  const reference = safeAdminReference(input.reference);
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const approvedEvidence = JSON.stringify({
    kind: "sole_trader_manual_review",
    adminReference: reference,
    adminReviewedAt: new Date().toISOString(),
  });

  const rows = await sql`
    with locked as (
      select
        claim.id as claim_id,
        claim.profile_id,
        claim.requested_workspace_id as workspace_id,
        profile.activity_description
      from company_directory_claims claim
      join company_directory_profiles profile on profile.id = claim.profile_id
      join workspaces workspace on workspace.id = claim.requested_workspace_id
      join workspace_memberships membership
        on membership.workspace_id = workspace.id
       and membership.user_id = claim.claimant_user_id
       and membership.role in ('owner', 'admin')
      where claim.id = ${claimId}::uuid
        and claim.status in ('pending', 'verified')
        and claim.verification_method = 'manual_review'
        and claim.requested_workspace_id is not null
        and profile.organization_kind = 'sole_trader'
        and profile.publication_status in ('blocked', 'review')
        and profile.is_active = true
        and profile.privacy_blocked = true
        and profile.auto_public_eligible = false
        and profile.claimed_workspace_id is null
        and profile.claim_reservation_id is null
        and profile.official_source = 'bolagsverket_vardefulla_datamangder:sole_trader_owner'
        and workspace.status in ('active', 'trial')
        and not exists (
          select 1 from company_directory_profiles other
          where other.claimed_workspace_id = workspace.id
            and other.id <> profile.id
        )
      for update of claim, profile, workspace
    ), claimed_profile as (
      update company_directory_profiles profile
      set claimed_workspace_id = locked.workspace_id,
          updated_at = now()
      from locked
      where profile.id = locked.profile_id
      returning profile.id, locked.workspace_id, locked.activity_description
    ), claimed_claim as (
      update company_directory_claims claim
      set status = 'claimed',
          verification_method = 'manual_review',
          verification_reference = ${approvedEvidence},
          verified_at = coalesce(claim.verified_at, now()),
          resolved_at = now()
      from locked, claimed_profile profile
      where claim.id = locked.claim_id
        and profile.id = locked.profile_id
      returning claim.id, profile.workspace_id, profile.activity_description
    ), experience as (
      insert into workspace_experience_settings (workspace_id, business_intro)
      select workspace_id, activity_description from claimed_claim
      on conflict (workspace_id) do update set
        business_intro = case
          when coalesce(workspace_experience_settings.business_intro, '') = '' then excluded.business_intro
          else workspace_experience_settings.business_intro
        end,
        updated_at = now()
      returning workspace_id
    ), audit as (
      insert into admin_audit_logs (admin_user_id, workspace_id, action, reason, previous_value, new_value)
      select
        ${admin.userId}, claimed_claim.workspace_id,
        'company_directory.sole_trader_claim.approved', ${reference},
        ${JSON.stringify({ claimId, status: "pending_or_verified", verificationMethod: "manual_review" })}::jsonb,
        jsonb_build_object(
          'claimId', ${claimId},
          'status', 'claimed',
          'workspaceId', claimed_claim.workspace_id::text,
          'publicationStatus', 'blocked'
        )
      from claimed_claim
      returning id
    )
    select claimed_claim.id::text, claimed_claim.workspace_id::text
    from claimed_claim
    join experience on true
    join audit on true
  `;

  if (!rows[0]?.id) throw new Error("Sole-trader claim is no longer eligible for approval");
  return { claimId: String(rows[0].id), workspaceId: String(rows[0].workspace_id) };
}