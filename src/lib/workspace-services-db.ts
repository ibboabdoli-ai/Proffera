import "server-only";

import { neon } from "@neondatabase/serverless";

import { normalizeCompanyDirectoryServiceAreaRadius } from "@/lib/company-directory-service-area-policy";
import { resolveDatabaseUrl } from "@/lib/db/database-url";
import { isWorkspaceServicePriceType, type WorkspaceServicePriceType } from "@/lib/workspace-service-pricing";
import type { WorkspaceServiceConversionMode, WorkspaceServicePublicStatus } from "@/lib/workspace-service-policy";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString = resolveDatabaseUrl();

function getSqlClient() {
  if (!connectionString) return null;
  return neon(connectionString);
}

async function getActiveWorkspaceId() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok) throw new Error("A valid workspace membership is required for workspace services");
  return access.workspaceId;
}

function toText(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toPriceType(value: unknown): WorkspaceServicePriceType | null {
  return isWorkspaceServicePriceType(value) ? value : null;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
}

function toPublicStatus(value: unknown): WorkspaceServicePublicStatus {
  return value === "published" || value === "hidden" ? value : "draft";
}

function toConversionMode(value: unknown): WorkspaceServiceConversionMode {
  return value === "quote" || value === "book_or_quote" || value === "contact" ? value : "book";
}

export type DashboardWorkspaceService = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  priceLabel: string;
  priceType: WorkspaceServicePriceType | null;
  priceAmountMinor: number | null;
  basePriceSek: number | null;
  durationMinutes: number | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  serviceArea: string;
  serviceAreaRadiusKm: number | null;
  serviceAreaConfirmed: boolean;
  isActive: boolean;
  sortOrder: number;
  publicSlug: string;
  primaryDirectoryServiceSlug: string;
  publicStatus: WorkspaceServicePublicStatus;
  conversionMode: WorkspaceServiceConversionMode;
  coverImageUrl: string;
  seoTitle: string;
  seoDescription: string;
};

export type WriteDashboardWorkspaceServiceInput = {
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  priceLabel: string;
  priceType: WorkspaceServicePriceType;
  priceAmountMinor: number | null;
  basePriceSek: number | null;
  durationMinutes: number | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  serviceArea: string;
  serviceAreaRadiusKm?: number | null;
  serviceAreaConfirmed?: boolean;
  isActive: boolean;
  sortOrder: number;
  publicSlug: string;
  publicStatus: WorkspaceServicePublicStatus;
  conversionMode: WorkspaceServiceConversionMode;
  coverImageUrl: string;
  seoTitle: string;
  seoDescription: string;
};

export type UpdateDashboardWorkspaceServiceInput = WriteDashboardWorkspaceServiceInput & { id: string };

type SqlClient = NonNullable<ReturnType<typeof getSqlClient>>;

async function resolveUniquePublicSlug(sql: SqlClient, workspaceId: string, baseSlug: string, excludeId?: string) {
  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const suffixText = suffix === 1 ? "" : `-${suffix}`;
    const candidate = `${baseSlug.slice(0, 120 - suffixText.length).replace(/-+$/g, "")}${suffixText}`;
    const rows = excludeId
      ? await sql`select id from workspace_services where workspace_id = ${workspaceId} and public_slug = ${candidate} and id <> ${excludeId}::uuid limit 1`
      : await sql`select id from workspace_services where workspace_id = ${workspaceId} and public_slug = ${candidate} limit 1`;
    if (!rows[0]) return candidate;
  }
  throw new Error("Could not allocate a unique public service slug");
}

async function resolveExactPrimaryDirectoryServiceSlug(sql: SqlClient, workspaceId: string, candidateSlug: string | null) {
  const normalized = candidateSlug?.trim() ?? "";
  if (!normalized) return null;

  const rows = await sql`
    select relation.service_slug
    from company_directory_profiles profile
    join company_directory_profile_services relation
      on relation.profile_id = profile.id
     and relation.service_slug = ${normalized}
     and relation.is_active = true
     and relation.public_visible = true
    join company_directory_services directory_service
      on directory_service.slug = relation.service_slug
     and directory_service.is_active = true
    where profile.claimed_workspace_id::text = ${workspaceId}
      and profile.publication_status = 'claimed'
      and profile.is_active = true
      and profile.privacy_blocked = false
    limit 1
  `;

  return rows[0]?.service_slug ? String(rows[0].service_slug) : null;
}

function ownerServiceAreaMutationQuery(
  sql: SqlClient,
  workspaceId: string,
  directoryServiceSlug: string | null,
  input: WriteDashboardWorkspaceServiceInput,
) {
  const radiusKm = normalizeCompanyDirectoryServiceAreaRadius(input.serviceAreaRadiusKm);
  const confirmationRequested = Boolean(
    directoryServiceSlug
    && input.serviceAreaConfirmed === true
    && radiusKm !== null
    && input.serviceArea.trim()
    && input.isActive
    && input.publicStatus === "published",
  );

  return sql`
    with claimed_profile as (
      select profile.id
      from company_directory_profiles profile
      where profile.claimed_workspace_id::text = ${workspaceId}
        and profile.publication_status = 'claimed'
        and profile.is_active = true
        and profile.privacy_blocked = false
      limit 1
    ), eligible as (
      select profile.id
      from claimed_profile profile
      join company_directory_profile_services relation
        on relation.profile_id = profile.id
       and relation.service_slug = ${directoryServiceSlug}
       and relation.is_active = true
       and relation.public_visible = true
      join company_directory_services service
        on service.slug = relation.service_slug
       and service.is_active = true
      where ${confirmationRequested} = true
    ), removed_stale_owner_evidence as (
      delete from company_directory_service_areas area
      using claimed_profile profile
      where ${directoryServiceSlug}::text is not null
        and area.profile_id = profile.id
        and area.service_slug = ${directoryServiceSlug}
        and area.source_type = 'owner'
        and not exists (select 1 from eligible where eligible.id = profile.id)
      returning area.id
    )
    insert into company_directory_service_areas (
      profile_id, service_slug, radius_km, source_type, confidence, public_visible, confirmed_at, updated_at
    )
    select eligible.id, ${directoryServiceSlug}, ${radiusKm}, 'owner', 100, true, now(), now()
    from eligible
    where ${directoryServiceSlug}::text is not null
      and ${radiusKm}::numeric between 1 and 300
    on conflict (profile_id, service_slug) where service_slug is not null
    do update set
      radius_km = excluded.radius_km,
      confidence = 100,
      public_visible = true,
      confirmed_at = now(),
      updated_at = now()
    where company_directory_service_areas.source_type = 'owner'
  `;
}

function previousOwnerServiceAreaCleanupQuery(
  sql: SqlClient,
  workspaceId: string,
  previousDirectoryServiceSlug: string | null,
  directoryServiceSlug: string | null,
) {
  return sql`
    delete from company_directory_service_areas area
    using company_directory_profiles profile
    where ${previousDirectoryServiceSlug}::text is not null
      and ${directoryServiceSlug}::text is not null
      and ${previousDirectoryServiceSlug}::text <> ${directoryServiceSlug}::text
      and profile.claimed_workspace_id::text = ${workspaceId}
      and profile.publication_status = 'claimed'
      and area.profile_id = profile.id
      and area.service_slug = ${previousDirectoryServiceSlug}
      and area.source_type = 'owner'
  `;
}

export async function getDashboardWorkspaceServices(): Promise<DashboardWorkspaceService[]> {
  const sql = getSqlClient();
  if (!sql) return [];

  try {
    const workspaceId = await getActiveWorkspaceId();
    const rows = await sql`
      select
        service.id, service.workspace_id, service.name, service.description, service.short_description, service.category, service.price_label,
        service.price_type, service.price_amount_minor, service.base_price_sek, service.duration_minutes,
        service.buffer_before_minutes, service.buffer_after_minutes, service.minimum_notice_minutes, service.maximum_advance_days,
        service.service_area, service.is_active, service.sort_order, service.public_slug, service.primary_directory_service_slug,
        service.public_status, service.conversion_mode, service.cover_image_url, service.seo_title, service.seo_description,
        confirmed_area.radius_km::float8 as service_area_radius_km,
        (confirmed_area.confirmed_at is not null) as service_area_confirmed
      from workspace_services service
      left join lateral (
        select profile.id
        from company_directory_profiles profile
        where profile.claimed_workspace_id::text = service.workspace_id
          and profile.publication_status = 'claimed'
          and profile.is_active = true
          and profile.privacy_blocked = false
        limit 1
      ) claimed_profile on true
      left join lateral (
        select area.radius_km, area.confirmed_at
        from company_directory_service_areas area
        where area.profile_id = claimed_profile.id
          and (
            area.service_slug = coalesce(service.primary_directory_service_slug, service.public_slug)
            or area.service_slug is null
          )
          and area.public_visible = true
          and area.confirmed_at is not null
          and area.radius_km between 1 and 300
        order by case when area.service_slug = coalesce(service.primary_directory_service_slug, service.public_slug) then 0 else 1 end
        limit 1
      ) confirmed_area on true
      where service.workspace_id = ${workspaceId}
      order by service.sort_order asc, service.name asc
    `;

    return rows.map((row) => ({
      id: toText(row.id),
      workspaceId: toText(row.workspace_id),
      name: toText(row.name),
      description: toText(row.description),
      shortDescription: toText(row.short_description),
      category: toText(row.category),
      priceLabel: toText(row.price_label),
      priceType: toPriceType(row.price_type),
      priceAmountMinor: toNumber(row.price_amount_minor),
      basePriceSek: toNumber(row.base_price_sek),
      durationMinutes: toNumber(row.duration_minutes),
      bufferBeforeMinutes: toNumber(row.buffer_before_minutes) ?? 0,
      bufferAfterMinutes: toNumber(row.buffer_after_minutes) ?? 0,
      minimumNoticeMinutes: toNumber(row.minimum_notice_minutes) ?? 0,
      maximumAdvanceDays: toNumber(row.maximum_advance_days) ?? 365,
      serviceArea: toText(row.service_area),
      serviceAreaRadiusKm: toNumber(row.service_area_radius_km),
      serviceAreaConfirmed: toBoolean(row.service_area_confirmed),
      isActive: toBoolean(row.is_active, true),
      sortOrder: toNumber(row.sort_order) ?? 100,
      publicSlug: toText(row.public_slug),
      primaryDirectoryServiceSlug: toText(row.primary_directory_service_slug),
      publicStatus: toPublicStatus(row.public_status),
      conversionMode: toConversionMode(row.conversion_mode),
      coverImageUrl: toText(row.cover_image_url),
      seoTitle: toText(row.seo_title),
      seoDescription: toText(row.seo_description),
    }));
  } catch (error) {
    console.error("Failed to read workspace services", error);
    return [];
  }
}

export async function createDashboardWorkspaceService(input: WriteDashboardWorkspaceServiceInput) {
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for workspace service create");

  const workspaceId = await getActiveWorkspaceId();
  const publicSlug = await resolveUniquePublicSlug(sql, workspaceId, input.publicSlug);
  const primaryDirectoryServiceSlug = await resolveExactPrimaryDirectoryServiceSlug(sql, workspaceId, publicSlug);
  const [rows] = await sql.transaction([
    sql`
      insert into workspace_services (
        workspace_id, name, description, short_description, category, price_label, price_type, price_amount_minor,
        base_price_sek, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes,
        maximum_advance_days, service_area, is_active, sort_order, public_slug, primary_directory_service_slug, public_status,
        conversion_mode, cover_image_url, seo_title, seo_description
      ) values (
        ${workspaceId}, ${input.name}, ${input.description}, ${input.shortDescription}, ${input.category}, ${input.priceLabel},
        ${input.priceType}, ${input.priceAmountMinor}, ${input.basePriceSek}, ${input.durationMinutes}, ${input.bufferBeforeMinutes},
        ${input.bufferAfterMinutes}, ${input.minimumNoticeMinutes}, ${input.maximumAdvanceDays}, ${input.serviceArea},
        ${input.isActive}, ${input.sortOrder}, ${publicSlug}, ${primaryDirectoryServiceSlug}, ${input.publicStatus}, ${input.conversionMode},
        ${input.coverImageUrl}, ${input.seoTitle}, ${input.seoDescription}
      )
      returning id
    `,
    ownerServiceAreaMutationQuery(sql, workspaceId, primaryDirectoryServiceSlug, input),
  ]);
  if (!rows?.[0]) throw new Error("Workspace service was not created");
}

export async function updateDashboardWorkspaceService(input: UpdateDashboardWorkspaceServiceInput) {
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for workspace service update");

  const workspaceId = await getActiveWorkspaceId();
  const previousRows = await sql`
    select public_slug, primary_directory_service_slug
    from workspace_services
    where id = ${input.id}::uuid
      and workspace_id = ${workspaceId}
    limit 1
  `;
  const previousPublicSlug = previousRows[0]?.public_slug ? String(previousRows[0].public_slug) : null;
  const storedPrimaryDirectoryServiceSlug = previousRows[0]?.primary_directory_service_slug
    ? String(previousRows[0].primary_directory_service_slug)
    : null;
  const recoveredLegacyPrimaryDirectoryServiceSlug = storedPrimaryDirectoryServiceSlug
    ?? await resolveExactPrimaryDirectoryServiceSlug(sql, workspaceId, previousPublicSlug);
  const publicSlug = await resolveUniquePublicSlug(sql, workspaceId, input.publicSlug, input.id);
  const primaryDirectoryServiceSlug = recoveredLegacyPrimaryDirectoryServiceSlug
    ?? await resolveExactPrimaryDirectoryServiceSlug(sql, workspaceId, publicSlug);
  const [rows] = await sql.transaction([
    sql`
      update workspace_services
      set
        name = ${input.name}, description = ${input.description}, short_description = ${input.shortDescription},
        category = ${input.category}, price_label = ${input.priceLabel}, price_type = ${input.priceType},
        price_amount_minor = ${input.priceAmountMinor}, base_price_sek = ${input.basePriceSek},
        duration_minutes = ${input.durationMinutes}, buffer_before_minutes = ${input.bufferBeforeMinutes},
        buffer_after_minutes = ${input.bufferAfterMinutes}, minimum_notice_minutes = ${input.minimumNoticeMinutes},
        maximum_advance_days = ${input.maximumAdvanceDays}, service_area = ${input.serviceArea},
        is_active = ${input.isActive}, sort_order = ${input.sortOrder}, public_slug = ${publicSlug},
        primary_directory_service_slug = ${primaryDirectoryServiceSlug},
        public_status = ${input.publicStatus}, conversion_mode = ${input.conversionMode}, cover_image_url = ${input.coverImageUrl},
        seo_title = ${input.seoTitle}, seo_description = ${input.seoDescription}, updated_at = now()
      where id = ${input.id}::uuid
        and workspace_id = ${workspaceId}
      returning id
    `,
    previousOwnerServiceAreaCleanupQuery(
      sql,
      workspaceId,
      recoveredLegacyPrimaryDirectoryServiceSlug,
      primaryDirectoryServiceSlug,
    ),
    ownerServiceAreaMutationQuery(sql, workspaceId, primaryDirectoryServiceSlug, input),
  ]);
  if (!rows?.[0]) throw new Error("Workspace service was not found for the active workspace");
}
