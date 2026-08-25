import "server-only";

import { createHash } from "node:crypto";

import {
  resolveCompanyDirectoryCanonicalWorkplaceAddress,
  type DirectoryPublicAddress,
} from "./company-directory-scb-address";
import { normalizeSwedishCompanyIdentityName } from "./company-directory-company-name";
import {
  fetchScbCompanyRegistryEnrichment,
  type ScbCompanyRegistryEnrichment,
  type ScbCompanyRegistryTransport,
} from "./company-directory-scb-provider";
import { getSql } from "./db/server";

type ScbConflict = {
  field: "legal_name" | "sni_codes";
  code: "legal_name_mismatch" | "sni_no_overlap";
  bolagsverket: string | string[];
  scb: string | string[];
};

export type ScbComparisonSnapshot = {
  profileUpdatedToken: string;
  officialFactsLastSyncedToken: string;
};

export type CompanyDirectoryScbEnrichmentResult =
  | { status: "disabled" | "awaiting_access" | "ineligible"; saved: false; conflicts: ScbConflict[] }
  | { status: "saved"; saved: true; conflicts: ScbConflict[] };

export type CompanyDirectoryScbEnrichmentOptions = {
  allowWhenDisabledWithExplicitTransport?: boolean;
};

type ProfileLocationContext = {
  address: DirectoryPublicAddress;
  officialSource: string;
  sourceRecordId: string;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function observedValueHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
}

function legacyTextValueHash(value: unknown) {
  return createHash("sha256")
    .update(text(value))
    .digest("hex");
}

function legalNamesMatchOrScbIsClearlyTruncated(bolagsverket: unknown, scb: unknown) {
  const official = normalizeSwedishCompanyIdentityName(bolagsverket);
  const registry = normalizeSwedishCompanyIdentityName(scb);
  if (!official || !registry) return false;
  if (official === registry) return true;

  // SCB can return a visibly truncated long company name. Treat only a long,
  // exact normalized prefix as equivalent; shorter/other mismatches still fail closed.
  return registry.length >= 32
    && official.length > registry.length
    && official.startsWith(registry);
}

function normalizeSni(value: unknown) {
  return text(value).replace(/\D/g, "");
}

export function officialSniCodes(value: unknown) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === "string" || typeof item === "number") {
      const code = normalizeSni(item);
      if (code) result.push(code);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const code = normalizeSni(row.code ?? row.kod ?? row.sni ?? row.sniCode);
    if (code) result.push(code);
  }
  return [...new Set(result)];
}

export function scbComparisonSnapshotMatches(
  captured: ScbComparisonSnapshot,
  current: ScbComparisonSnapshot,
) {
  return captured.profileUpdatedToken === current.profileUpdatedToken
    && captured.officialFactsLastSyncedToken === current.officialFactsLastSyncedToken;
}

export function detectScbCompanyDirectoryConflicts(input: {
  bolagsverketLegalName: unknown;
  bolagsverketSniCodes: unknown;
  scb: ScbCompanyRegistryEnrichment;
}): ScbConflict[] {
  const conflicts: ScbConflict[] = [];
  const bolagsverketLegalName = text(input.bolagsverketLegalName);
  const scbLegalName = text(input.scb.legalName);

  if (
    bolagsverketLegalName
    && scbLegalName
    && !legalNamesMatchOrScbIsClearlyTruncated(bolagsverketLegalName, scbLegalName)
  ) {
    conflicts.push({
      field: "legal_name",
      code: "legal_name_mismatch",
      bolagsverket: bolagsverketLegalName,
      scb: scbLegalName,
    });
  }

  const bolagsverketSni = officialSniCodes(input.bolagsverketSniCodes);
  const scbSni = [...new Set(input.scb.sniCodes.map(normalizeSni).filter(Boolean))];
  if (
    bolagsverketSni.length > 0
    && scbSni.length > 0
    && !scbSni.some((code) => bolagsverketSni.includes(code))
  ) {
    conflicts.push({
      field: "sni_codes",
      code: "sni_no_overlap",
      bolagsverket: bolagsverketSni,
      scb: scbSni,
    });
  }

  return conflicts;
}

async function saveScbEnrichment(
  profileId: string,
  data: ScbCompanyRegistryEnrichment,
  conflicts: ScbConflict[],
  comparisonSnapshot: ScbComparisonSnapshot,
  profileLocation: ProfileLocationContext,
) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const postalAddress = JSON.stringify(data.postalAddress);
  const sniCodes = JSON.stringify(data.sniCodes);
  const workplaces = JSON.stringify(data.workplaces);
  const provenance = JSON.stringify({
    ...data.provenance,
    comparisonSnapshot,
  });
  const conflictPayload = JSON.stringify(conflicts);
  const sourcePayloadHash = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");

  await sql`
    insert into company_directory_scb_enrichment (
      profile_id, organization_number, observed_company_name,
      phone, email, postal_address, municipality, sni_codes,
      workplaces, provenance, conflicts, source_payload_hash,
      last_synced_at, updated_at
    ) values (
      ${profileId}::uuid, ${data.organizationNumber}, ${text(data.legalName)},
      ${text(data.phone)}, ${text(data.email)}, ${postalAddress}::jsonb,
      ${text(data.municipality)}, ${sniCodes}::jsonb, ${workplaces}::jsonb,
      ${provenance}::jsonb, ${conflictPayload}::jsonb, ${sourcePayloadHash},
      now(), now()
    )
    on conflict (profile_id) do update set
      organization_number = excluded.organization_number,
      observed_company_name = excluded.observed_company_name,
      phone = excluded.phone,
      email = excluded.email,
      postal_address = excluded.postal_address,
      municipality = excluded.municipality,
      sni_codes = excluded.sni_codes,
      workplaces = excluded.workplaces,
      provenance = excluded.provenance,
      conflicts = excluded.conflicts,
      source_payload_hash = excluded.source_payload_hash,
      last_synced_at = now(),
      updated_at = now()
  `;

  // Keep conflicting SCB evidence for review/audit, but never project physical
  // location fields into the profile when identity/category evidence conflicts.
  if (conflicts.length > 0) return;

  const resolution = resolveCompanyDirectoryCanonicalWorkplaceAddress(
    profileLocation.address,
    data.workplaces,
  );
  if (resolution.status !== "resolved") return;

  const selectedWorkplace = data.workplaces[resolution.sourceIndex];
  const sourceRecordId = text(selectedWorkplace?.cfarNumber) || data.organizationNumber;
  const canonical = resolution.address;
  const current = profileLocation.address;

  const currentSources = [
    {
      fieldName: "addressLine1",
      currentValue: text(current.addressLine1),
      observedHash: observedValueHash(text(current.addressLine1)),
      legacyHash: legacyTextValueHash(current.addressLine1),
    },
    {
      fieldName: "postalCode",
      currentValue: text(current.postalCode),
      observedHash: observedValueHash(text(current.postalCode)),
      legacyHash: legacyTextValueHash(current.postalCode),
    },
    {
      fieldName: "city",
      currentValue: text(current.city),
      observedHash: observedValueHash(text(current.city)),
      legacyHash: legacyTextValueHash(current.city),
    },
    {
      fieldName: "municipality",
      currentValue: text(current.municipality),
      observedHash: observedValueHash(text(current.municipality)),
      legacyHash: legacyTextValueHash(current.municipality),
    },
  ];
  const currentSourcesJson = JSON.stringify(currentSources);
  const projectedSourcesJson = JSON.stringify([
    { fieldName: "addressLine1", valueHash: observedValueHash(canonical.addressLine1) },
    { fieldName: "postalCode", valueHash: observedValueHash(canonical.postalCode) },
    { fieldName: "city", valueHash: observedValueHash(canonical.city) },
    { fieldName: "municipality", valueHash: observedValueHash(canonical.municipality) },
  ]);

  // Physical location is one semantic bundle. Project all four fields or none.
  // Existing non-empty values are replaceable only while matching provenance
  // proves that an automated official/SCB source still owns the current value.
  // A current profile.updated_at token is also required so a concurrent human or
  // claim-related edit wins. The projection intentionally does not change that
  // token because the just-saved SCB comparison snapshot is bound to it.
  await sql`
    with location_values as (
      select *
      from jsonb_to_recordset(${currentSourcesJson}::jsonb) as value(
        "fieldName" text,
        "currentValue" text,
        "observedHash" text,
        "legacyHash" text
      )
    ), ownership as (
      select bool_and(
        value."currentValue" = ''
        or exists (
          select 1
          from company_directory_field_sources existing_source
          where existing_source.profile_id = ${profileId}::uuid
            and existing_source.field_name = value."fieldName"
            and (
              (
                existing_source.source_name = ${profileLocation.officialSource}
                and existing_source.source_record_id = ${profileLocation.sourceRecordId}
                and existing_source.value_hash = value."observedHash"
              )
              or (
                existing_source.source_name = 'scb_foretagsregistret'
                and existing_source.source_record_id = ${data.organizationNumber}
                and existing_source.value_hash in (value."observedHash", value."legacyHash")
              )
              or (
                existing_source.source_name = 'scb_foretagsregistret:workplace'
                and existing_source.value_hash in (value."observedHash", value."legacyHash")
              )
            )
        )
      ) as can_project
      from location_values value
    ), projected as (
      update company_directory_profiles profile
      set address_line1 = ${canonical.addressLine1},
          postal_code = ${canonical.postalCode},
          city = ${canonical.city},
          municipality = ${canonical.municipality}
      where profile.id = ${profileId}::uuid
        and profile.claimed_workspace_id is null
        and profile.updated_at::text = ${comparisonSnapshot.profileUpdatedToken}
        and profile.address_line1 = ${text(current.addressLine1)}
        and profile.postal_code = ${text(current.postalCode)}
        and profile.city = ${text(current.city)}
        and profile.municipality = ${text(current.municipality)}
        and coalesce((select can_project from ownership), false)
      returning profile.id
    )
    insert into company_directory_field_sources (
      profile_id, field_name, source_name, source_record_id,
      source_url, value_hash, confidence, observed_at
    )
    select
      projected.id,
      source."fieldName",
      'scb_foretagsregistret:workplace',
      ${sourceRecordId},
      '',
      source."valueHash",
      100,
      now()
    from projected
    cross join jsonb_to_recordset(${projectedSourcesJson}::jsonb) as source(
      "fieldName" text,
      "valueHash" text
    )
    on conflict (profile_id, field_name, source_name, value_hash) do update set
      source_record_id = excluded.source_record_id,
      confidence = excluded.confidence,
      observed_at = now()
  `;
}

export async function enrichCompanyDirectoryScbForProfile(
  profileId: string,
  transport?: ScbCompanyRegistryTransport,
  options: CompanyDirectoryScbEnrichmentOptions = {},
): Promise<CompanyDirectoryScbEnrichmentResult> {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    throw new Error("A valid company profile ID is required");
  }

  const rows = await sql`
    select
      profile.organization_number,
      profile.organization_kind,
      profile.legal_name,
      profile.address_line1,
      profile.postal_code,
      profile.city,
      profile.municipality,
      profile.official_source,
      profile.source_record_id,
      profile.updated_at::text as profile_updated_token,
      facts.sni_codes,
      facts.last_synced_at::text as facts_last_synced_token
    from company_directory_profiles profile
    left join company_directory_official_facts facts on facts.profile_id = profile.id
    where profile.id = ${profileId}::uuid
      and profile.country_code = 'SE'
    limit 1
  `;

  if (!rows.length) {
    return { status: "ineligible", saved: false, conflicts: [] };
  }

  const organizationKind = text(rows[0]?.organization_kind);
  const organizationNumber = text(rows[0]?.organization_number).replace(/\D/g, "");
  if (organizationKind !== "juridical_person" || organizationNumber.length !== 10) {
    return { status: "ineligible", saved: false, conflicts: [] };
  }

  const fetched = options.allowWhenDisabledWithExplicitTransport
    ? await fetchScbCompanyRegistryEnrichment(organizationNumber, transport, {
      allowWhenDisabledWithExplicitTransport: true,
    })
    : await fetchScbCompanyRegistryEnrichment(organizationNumber, transport);
  if (fetched.status !== "ok") {
    return { status: fetched.status, saved: false, conflicts: [] };
  }

  const conflicts = detectScbCompanyDirectoryConflicts({
    bolagsverketLegalName: rows[0]?.legal_name,
    bolagsverketSniCodes: rows[0]?.sni_codes,
    scb: fetched.data,
  });
  const comparisonSnapshot: ScbComparisonSnapshot = {
    profileUpdatedToken: text(rows[0]?.profile_updated_token),
    officialFactsLastSyncedToken: text(rows[0]?.facts_last_synced_token),
  };

  await saveScbEnrichment(
    profileId,
    fetched.data,
    conflicts,
    comparisonSnapshot,
    {
      address: {
        addressLine1: text(rows[0]?.address_line1),
        postalCode: text(rows[0]?.postal_code),
        city: text(rows[0]?.city),
        municipality: text(rows[0]?.municipality),
      },
      officialSource: text(rows[0]?.official_source),
      sourceRecordId: text(rows[0]?.source_record_id),
    },
  );
  return { status: "saved", saved: true, conflicts };
}
