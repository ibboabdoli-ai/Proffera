import "server-only";

import { createHash } from "node:crypto";

import {
  resolveCompanyDirectoryPublicAddressResolution,
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

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
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
  profileAddress: DirectoryPublicAddress,
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

  // Keep conflicting SCB evidence for review/audit, but never project location
  // fields into the profile when the cross-source identity/category check failed.
  if (conflicts.length > 0) return;

  const resolution = resolveCompanyDirectoryPublicAddressResolution(profileAddress, data.workplaces);
  if (resolution.source !== "scb_workplace" || resolution.sourceIndex === null) return;

  const municipality = text(resolution.address.municipality);
  if (!municipality) return;

  const selectedWorkplace = data.workplaces[resolution.sourceIndex];
  const sourceRecordId = text(selectedWorkplace?.cfarNumber) || data.organizationNumber;
  const existingMunicipality = text(profileAddress.municipality);
  const existingMunicipalityValueHash = createHash("sha256")
    .update(existingMunicipality)
    .digest("hex");
  const municipalityValueHash = createHash("sha256")
    .update(municipality)
    .digest("hex");

  // Company-level SCB municipality is a registered-seat attribute, not the
  // workplace's physical municipality. Project only the municipality from the
  // same unambiguous workplace visiting address used by the public resolver.
  // Existing non-SCB/manual values and claimed Workspace-owned profiles are
  // preserved. Values created by the older company-level projection are repaired
  // only when their provenance hash still matches the current profile value, so
  // later human/claimed edits win.
  //
  // The projection intentionally does not change profile.updated_at. That token
  // belongs to the comparison snapshot captured before the SCB request; changing
  // it here would immediately make the just-saved SCB snapshot look stale.
  await sql`
    with projected as (
      update company_directory_profiles profile
      set municipality = ${municipality}
      where profile.id = ${profileId}::uuid
        and profile.claimed_workspace_id is null
        and (
          nullif(trim(profile.municipality), '') is null
          or (
            trim(profile.municipality) = ${existingMunicipality}
            and exists (
              select 1
              from company_directory_field_sources existing_source
              where existing_source.profile_id = profile.id
                and existing_source.field_name = 'municipality'
                and existing_source.source_name = 'scb_foretagsregistret'
                and existing_source.source_record_id = ${data.organizationNumber}
                and existing_source.value_hash = ${existingMunicipalityValueHash}
            )
          )
        )
      returning profile.id
    )
    insert into company_directory_field_sources (
      profile_id, field_name, source_name, source_record_id,
      source_url, value_hash, confidence, observed_at
    )
    select
      projected.id, 'municipality', 'scb_foretagsregistret:workplace', ${sourceRecordId},
      '', ${municipalityValueHash}, 100, now()
    from projected
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
      addressLine1: text(rows[0]?.address_line1),
      postalCode: text(rows[0]?.postal_code),
      city: text(rows[0]?.city),
      municipality: text(rows[0]?.municipality),
    },
  );
  return { status: "saved", saved: true, conflicts };
}
