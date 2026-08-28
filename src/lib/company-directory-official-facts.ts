import "server-only";

import { createHash, randomUUID } from "node:crypto";

import {
  isBolagsverketJuridicalOrganizationNumber,
  requireBolagsverketHttpsUrl,
  waitForBolagsverketRequestSlot,
} from "@/lib/bolagsverket-api-policy";
import { takeCompleteBolagsverketOrganizationRecord } from "@/lib/company-directory-detail-cache";
import {
  BolagsverketOrganizationNotFoundError,
  collectBolagsverketApiErrors,
  formatBolagsverketApiErrors,
  isDeterministicBolagsverketOrganizationNotFound,
  resolveBolagsverketOrganizationRecord,
} from "@/lib/company-directory-official-facts-errors";
import { getSql } from "@/lib/db/server";

type AnyRecord = Record<string, unknown>;

type OfficialFacts = {
  registrationCountryCode: string;
  registrationCountryLabel: string;
  organizationFormCode: string;
  organizationFormLabel: string;
  legalFormCode: string;
  legalFormLabel: string;
  registrationDate: string | null;
  scbRegisteredDate: string | null;
  deregistrationDate: string | null;
  deregistrationReasonCode: string;
  deregistrationReasonLabel: string;
  advertisingBlocked: boolean | null;
  coAddress: string;
  addressCountry: string;
  registeredNames: Array<{
    name: string;
    registrationDate: string;
    typeCode: string;
    typeLabel: string;
    specialBusinessDescription: string;
  }>;
  sniCodes: Array<{ code: string; label: string }>;
  ongoingProcedures: Array<{ code: string; label: string; fromDate: string }>;
  dataProducers: Record<string, string>;
  sourcePayloadHash: string;
};

const MAX_ENRICH_PER_RUN = 10;
const DEFAULT_BOLAGSVERKET_PROVIDER = "bolagsverket_vardefulla_datamangder";
const LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE = "2026-08-28T07:30:00.000Z";

function object(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : null;
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function first(row: AnyRecord | null, keys: string[]) {
  if (!row) return undefined;
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === null || value === undefined ? [] : [value];
}

function codeLabel(value: unknown) {
  const row = object(value);
  return {
    code: text(first(row, ["kod", "code"])),
    label: text(first(row, ["klartext", "text", "label", "namn", "name"])),
  };
}

function dateOnly(value: unknown): string | null {
  const raw = text(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:(?:T|\s)\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?)?$/);
  if (!match?.[1]) return null;

  const date = match[1];
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return null;
  if (raw === date) return date;

  const normalizedTimestamp = raw.replace(" ", "T");
  return Number.isNaN(Date.parse(normalizedTimestamp)) ? null : date;
}

function timestamp(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function yesNo(value: unknown): boolean | null {
  const normalized = text(value).toLocaleLowerCase("sv-SE");
  if (!normalized) return null;
  if (["ja", "yes", "true", "1"].includes(normalized)) return true;
  if (["nej", "no", "false", "0"].includes(normalized)) return false;
  return null;
}

function advertisingBlockedFromRecord(row: AnyRecord): boolean | null {
  const advertisingValue = row.reklamsparr;
  const advertising = object(advertisingValue);
  if (advertising) {
    if (advertising.fel !== null && advertising.fel !== undefined) return null;
    return yesNo(advertising.kod);
  }

  // Värdefulla datamängder documents reklamsparr=null as "no advertising
  // block registered" only when Bolagsverket returned postadressOrganisation.
  // Keep all absent/malformed cases unknown so Marketplace outreach remains
  // fail-closed. Explicit nested API errors are rejected before extraction too.
  if (advertisingValue !== null) return null;
  const postalContainer = object(row.postadressOrganisation);
  const postal = object(postalContainer?.postadress);
  if (!postalContainer || !postal) return null;
  if (text(postalContainer.dataproducent).toLocaleLowerCase("sv-SE") !== "bolagsverket") return null;
  if (postalContainer.fel !== null && postalContainer.fel !== undefined) return null;
  if (!text(postal.postnummer)) return null;
  return false;
}

function normalizeSni(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function namesFromRecord(row: AnyRecord) {
  const container = object(row.organisationsnamn);
  return list(container?.organisationsnamnLista)
    .map((value) => object(value))
    .filter((value): value is AnyRecord => Boolean(value))
    .map((value) => {
      const type = codeLabel(value.organisationsnamntyp);
      return {
        name: text(value.namn),
        registrationDate: dateOnly(value.registreringsdatum) ?? "",
        typeCode: type.code,
        typeLabel: type.label,
        specialBusinessDescription: text(value.verksamhetsbeskrivningSarskiltForetagsnamn),
      };
    })
    .filter((value) => value.name);
}

function sniFromRecord(row: AnyRecord) {
  const container = object(row.naringsgrenOrganisation ?? row["näringsgrenOrganisation"]);
  const values = list(container?.sni);
  const result: Array<{ code: string; label: string }> = [];

  for (const value of values) {
    const item = object(value);
    if (item) {
      const code = normalizeSni(first(item, ["kod", "code"]));
      const label = text(first(item, ["klartext", "text", "label"]));
      if (code) result.push({ code, label });
      continue;
    }

    const raw = text(value);
    const match = raw.match(/kod\s*=\s*([0-9.]+)(?:\s*,\s*klartext\s*=\s*(.*))?/i);
    if (match?.[1]) result.push({ code: normalizeSni(match[1]), label: text(match[2]) });
  }

  return [...new Map(result.map((item) => [`${item.code}:${item.label}`, item])).values()];
}

function proceduresFromRecord(row: AnyRecord) {
  const container = object(first(row, [
    "pagaendeAvvecklingsEllerOmstruktureringsforfarande",
    "pagandeAvvecklingsEllerOmstruktureringsforfarande",
  ]));
  return list(first(container, [
    "pagaendeAvvecklingsEllerOmstruktureringsforfarandeLista",
    "pagandeAvvecklingsEllerOmstruktureringsforfarandeLista",
  ]))
    .map((value) => object(value))
    .filter((value): value is AnyRecord => Boolean(value))
    .map((value) => ({
      code: text(value.kod),
      label: text(value.klartext),
      fromDate: dateOnly(value.fromDatum) ?? "",
    }))
    .filter((value) => value.code || value.label);
}

function dataProducersFromRecord(row: AnyRecord) {
  const sections = [
    "organisationsnamn",
    "reklamsparr",
    "organisationsform",
    "avregistreradOrganisation",
    "avregistreringsorsak",
    "juridiskForm",
    "verksamOrganisation",
    "organisationsdatum",
    "verksamhetsbeskrivning",
    "naringsgrenOrganisation",
    "postadressOrganisation",
  ];
  const result: Record<string, string> = {};
  for (const section of sections) {
    const producer = text(object(row[section])?.dataproducent);
    if (producer) result[section] = producer;
  }
  const procedureContainer = object(first(row, [
    "pagaendeAvvecklingsEllerOmstruktureringsforfarande",
    "pagandeAvvecklingsEllerOmstruktureringsforfarande",
  ]));
  const procedureProducer = text(procedureContainer?.dataproducent);
  if (procedureProducer) {
    result.pagaendeAvvecklingsEllerOmstruktureringsforfarande = procedureProducer;
  }
  return result;
}

export function extractOfficialFacts(row: AnyRecord): OfficialFacts {
  const registrationCountry = codeLabel(row.registreringsland);
  const organizationForm = codeLabel(row.organisationsform);
  const legalForm = codeLabel(row.juridiskForm);
  const dates = object(row.organisationsdatum);
  const deregistered = object(row.avregistreradOrganisation);
  const deregistrationReason = codeLabel(row.avregistreringsorsak);
  const postalContainer = object(row.postadressOrganisation);
  const postal = object(postalContainer?.postadress);

  return {
    registrationCountryCode: registrationCountry.code,
    registrationCountryLabel: registrationCountry.label,
    organizationFormCode: organizationForm.code,
    organizationFormLabel: organizationForm.label,
    legalFormCode: legalForm.code,
    legalFormLabel: legalForm.label,
    registrationDate: dateOnly(dates?.registreringsdatum),
    scbRegisteredDate: dateOnly(dates?.infortHosScb),
    deregistrationDate: timestamp(deregistered?.avregistreringsdatum),
    deregistrationReasonCode: deregistrationReason.code,
    deregistrationReasonLabel: deregistrationReason.label,
    advertisingBlocked: advertisingBlockedFromRecord(row),
    coAddress: text(postal?.coAdress),
    addressCountry: text(postal?.land),
    registeredNames: namesFromRecord(row),
    sniCodes: sniFromRecord(row),
    ongoingProcedures: proceduresFromRecord(row),
    dataProducers: dataProducersFromRecord(row),
    sourcePayloadHash: createHash("sha256").update(JSON.stringify(row)).digest("hex"),
  };
}

function takeCachedOfficialFacts(organizationNumber: string): OfficialFacts | null {
  const cachedRecord = takeCompleteBolagsverketOrganizationRecord(organizationNumber);
  if (!cachedRecord) return null;
  const verifiedRecord = resolveBolagsverketOrganizationRecord(cachedRecord, organizationNumber);
  return extractOfficialFacts(verifiedRecord);
}

function timeoutError(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  operation: string,
) {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (timeoutError(error)) {
      throw new Error(`${operation} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

async function oauthAccessToken() {
  const staticToken = process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN?.trim();
  if (staticToken) return staticToken;

  const tokenUrlValue = process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim();
  const clientId = process.env.BOLAGSVERKET_CLIENT_ID?.trim();
  const clientSecret = process.env.BOLAGSVERKET_CLIENT_SECRET?.trim();
  if (!tokenUrlValue || !clientId || !clientSecret) return "";

  const tokenUrl = requireBolagsverketHttpsUrl(tokenUrlValue, "COMPANY_DIRECTORY_TOKEN_URL").toString();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const scope = process.env.COMPANY_DIRECTORY_OAUTH_SCOPE?.trim();
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (scope) body.set("scope", scope);

  const response = await fetchWithTimeout(tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  }, 12_000, "Official facts OAuth");
  if (!response.ok) throw new Error(`Official facts OAuth failed (${response.status})`);
  const payload = object(await response.json());
  const token = text(payload?.access_token);
  if (!token) throw new Error("Official facts OAuth response did not contain access_token");
  return token;
}

function detailRequest(template: string, organizationNumber: string) {
  const normalized = organizationNumber.replace(/\D/g, "");
  const method = process.env.COMPANY_DIRECTORY_DETAIL_METHOD?.trim().toUpperCase() === "GET" ? "GET" : "POST";
  const rawUrl = template.replaceAll("{organizationNumber}", encodeURIComponent(normalized));
  const url = requireBolagsverketHttpsUrl(rawUrl, "COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE").toString();
  const bodyTemplate = process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE?.trim();
  const body = method === "POST"
    ? (bodyTemplate
      ? bodyTemplate.replaceAll("{organizationNumber}", normalized)
      : JSON.stringify({ identitetsbeteckning: normalized }))
    : undefined;
  return { method, url, body } as const;
}

async function fetchOfficialFacts(organizationNumber: string, token: string) {
  if (!isBolagsverketJuridicalOrganizationNumber(organizationNumber)) {
    throw new Error("Official facts lookup requires a Swedish juridical-person organization number");
  }

  const template = process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim();
  if (!template) throw new Error("Official detail endpoint is not configured");
  const request = detailRequest(template, organizationNumber);

  await waitForBolagsverketRequestSlot(process.env.COMPANY_DIRECTORY_PROVIDER || DEFAULT_BOLAGSVERKET_PROVIDER);
  const response = await fetchWithTimeout(request.url, {
    method: request.method,
    headers: {
      accept: "application/json",
      ...(request.method === "POST" ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-request-id": randomUUID(),
    },
    body: request.body,
    cache: "no-store",
  }, 15_000, "Official facts lookup");
  if (!response.ok) throw new Error(`Official facts lookup failed (${response.status})`);

  const payload = await response.json();
  const apiErrors = collectBolagsverketApiErrors(payload);
  if (apiErrors.length > 0) {
    const summary = formatBolagsverketApiErrors(apiErrors);
    const message = `Official facts lookup returned partial data: ${summary}`;
    if (isDeterministicBolagsverketOrganizationNotFound(apiErrors)) {
      throw new BolagsverketOrganizationNotFoundError(message);
    }
    throw new Error(message);
  }

  const row = resolveBolagsverketOrganizationRecord(payload, organizationNumber);
  return extractOfficialFacts(row);
}

async function saveOfficialFacts(profileId: string, facts: OfficialFacts) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const names = JSON.stringify(facts.registeredNames);
  const sni = JSON.stringify(facts.sniCodes);
  const procedures = JSON.stringify(facts.ongoingProcedures);
  const producers = JSON.stringify(facts.dataProducers);

  await sql`
    insert into company_directory_official_facts (
      profile_id, registration_country_code, registration_country_label,
      organization_form_code, organization_form_label, legal_form_code, legal_form_label,
      registration_date, scb_registered_date, deregistration_date,
      deregistration_reason_code, deregistration_reason_label, advertising_blocked,
      co_address, address_country, registered_names, sni_codes, ongoing_procedures,
      data_producers, source_payload_hash, last_synced_at, updated_at
    ) values (
      ${profileId}::uuid, ${facts.registrationCountryCode}, ${facts.registrationCountryLabel},
      ${facts.organizationFormCode}, ${facts.organizationFormLabel}, ${facts.legalFormCode}, ${facts.legalFormLabel},
      ${facts.registrationDate}::date, ${facts.scbRegisteredDate}::date, ${facts.deregistrationDate}::timestamptz,
      ${facts.deregistrationReasonCode}, ${facts.deregistrationReasonLabel}, ${facts.advertisingBlocked},
      ${facts.coAddress}, ${facts.addressCountry}, ${names}::jsonb, ${sni}::jsonb, ${procedures}::jsonb,
      ${producers}::jsonb, ${facts.sourcePayloadHash}, now(), now()
    )
    on conflict (profile_id) do update set
      registration_country_code = excluded.registration_country_code,
      registration_country_label = excluded.registration_country_label,
      organization_form_code = excluded.organization_form_code,
      organization_form_label = excluded.organization_form_label,
      legal_form_code = excluded.legal_form_code,
      legal_form_label = excluded.legal_form_label,
      registration_date = excluded.registration_date,
      scb_registered_date = excluded.scb_registered_date,
      deregistration_date = excluded.deregistration_date,
      deregistration_reason_code = excluded.deregistration_reason_code,
      deregistration_reason_label = excluded.deregistration_reason_label,
      advertising_blocked = excluded.advertising_blocked,
      co_address = excluded.co_address,
      address_country = excluded.address_country,
      registered_names = excluded.registered_names,
      sni_codes = excluded.sni_codes,
      ongoing_procedures = excluded.ongoing_procedures,
      data_producers = excluded.data_producers,
      source_payload_hash = excluded.source_payload_hash,
      last_synced_at = now(),
      updated_at = now()
  `;
}

function boundedLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(MAX_ENRICH_PER_RUN, Math.floor(parsed)));
}

export async function getCompanyDirectoryOfficialFactsBacklog() {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const rows = await sql`
    select count(*)::int as count
    from company_directory_profiles profile
    left join company_directory_official_facts facts on facts.profile_id = profile.id
    where profile.country_code = 'SE'
      and regexp_replace(profile.organization_number, '\\D', '', 'g') ~ '^[0-9]{2}[2-9][0-9]{7}$'
      and (
        facts.profile_id is null
        or (
          facts.last_synced_at < profile.last_synced_at
          and not (
            facts.advertising_blocked is null
            and lower(facts.data_producers->>'postadressOrganisation') = 'bolagsverket'
            and facts.last_synced_at < ${LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE}::timestamptz
          )
        )
        or (
          facts.advertising_blocked is null
          and lower(facts.data_producers->>'postadressOrganisation') = 'bolagsverket'
          and facts.last_synced_at < ${LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE}::timestamptz
          and greatest(facts.last_synced_at, facts.updated_at) < now() - interval '1 hour'
        )
      )
  `;

  return Number(rows[0]?.count ?? 0);
}

export async function enrichCompanyDirectoryOfficialFactsForProfile(profileId: string) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    throw new Error("A valid company profile ID is required");
  }

  const rows = await sql`
    select organization_number
    from company_directory_profiles
    where id = ${profileId}::uuid
      and country_code = 'SE'
    limit 1
  `;
  const organizationNumber = text(rows[0]?.organization_number).replace(/\D/g, "");
  if (!isBolagsverketJuridicalOrganizationNumber(organizationNumber)) {
    throw new Error("A Swedish juridical-person organization number is required");
  }

  const cachedFacts = takeCachedOfficialFacts(organizationNumber);
  if (cachedFacts) {
    await saveOfficialFacts(profileId, cachedFacts);
    return { profileId, organizationNumber, reusedVerifiedDetail: true };
  }

  const token = await oauthAccessToken();
  if (!token) throw new Error("Official facts enrichment requires Bolagsverket credentials");

  const facts = await fetchOfficialFacts(organizationNumber, token);
  await saveOfficialFacts(profileId, facts);

  return { profileId, organizationNumber, reusedVerifiedDetail: false };
}

export async function enrichCompanyDirectoryOfficialFacts(limit?: number) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const safeLimit = boundedLimit(limit);
  const token = await oauthAccessToken();
  if (!token) throw new Error("Official facts enrichment requires Bolagsverket credentials");

  const rows = await sql`
    select
      profile.id::text,
      profile.organization_number,
      (
        facts.profile_id is not null
        and facts.advertising_blocked is null
        and lower(facts.data_producers->>'postadressOrganisation') = 'bolagsverket'
        and facts.last_synced_at < ${LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE}::timestamptz
      ) as legacy_reklamsparr_repair
    from company_directory_profiles profile
    left join company_directory_official_facts facts on facts.profile_id = profile.id
    where profile.country_code = 'SE'
      and regexp_replace(profile.organization_number, '\\D', '', 'g') ~ '^[0-9]{2}[2-9][0-9]{7}$'
      and (
        facts.profile_id is null
        or (
          facts.last_synced_at < profile.last_synced_at
          and not (
            facts.advertising_blocked is null
            and lower(facts.data_producers->>'postadressOrganisation') = 'bolagsverket'
            and facts.last_synced_at < ${LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE}::timestamptz
          )
        )
        or (
          facts.advertising_blocked is null
          and lower(facts.data_producers->>'postadressOrganisation') = 'bolagsverket'
          and facts.last_synced_at < ${LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE}::timestamptz
          and greatest(facts.last_synced_at, facts.updated_at) < now() - interval '1 hour'
        )
      )
      and not exists (
        select 1
        from company_directory_discovery_queue queue
        where queue.state = 'failed'
          and (
            queue.profile_id = profile.id
            or (
              queue.country_code = profile.country_code
              and queue.organization_number = regexp_replace(profile.organization_number, '\\D', '', 'g')
            )
          )
      )
    order by
      case
        when facts.advertising_blocked is null
          and lower(facts.data_producers->>'postadressOrganisation') = 'bolagsverket'
          and facts.last_synced_at < ${LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE}::timestamptz
          and greatest(facts.last_synced_at, facts.updated_at) < now() - interval '1 hour'
        then 0
        else 1
      end,
      case
        when facts.advertising_blocked is null
          and lower(facts.data_producers->>'postadressOrganisation') = 'bolagsverket'
          and facts.last_synced_at < ${LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE}::timestamptz
        then greatest(facts.last_synced_at, facts.updated_at)
        else facts.last_synced_at
      end asc nulls first,
      profile.last_synced_at asc,
      profile.organization_number asc
    limit ${safeLimit}
  `;

  let processed = 0;
  let errors = 0;
  const errorSummary: string[] = [];

  for (const row of rows) {
    const profileId = text(row.id);
    const organizationNumber = text(row.organization_number).replace(/\D/g, "");
    try {
      if (row.legacy_reklamsparr_repair === true) {
        const claimed = await sql`
          update company_directory_official_facts
          set updated_at = now()
          where profile_id = ${profileId}::uuid
            and advertising_blocked is null
            and lower(data_producers->>'postadressOrganisation') = 'bolagsverket'
            and last_synced_at < ${LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE}::timestamptz
            and greatest(last_synced_at, updated_at) < now() - interval '1 hour'
          returning profile_id::text
        `;
        if (claimed.length === 0) continue;
      }

      const facts = await fetchOfficialFacts(organizationNumber, token);
      await saveOfficialFacts(profileId, facts);
      processed += 1;
    } catch (error) {
      errors += 1;
      if (errorSummary.length < 5) {
        errorSummary.push(`${organizationNumber}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  return {
    selected: rows.length,
    processed,
    errors,
    errorSummary: errorSummary.join(" | "),
  };
}
