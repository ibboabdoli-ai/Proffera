import "server-only";

import { neon } from "@neondatabase/serverless";

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
  isActive: boolean;
  sortOrder: number;
  publicSlug: string;
  publicStatus: WorkspaceServicePublicStatus;
  conversionMode: WorkspaceServiceConversionMode;
  seoTitle: string;
  seoDescription: string;
};

export type WriteDashboardWorkspaceServiceInput = {
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  priceLabel: string;
  basePriceSek: number | null;
  durationMinutes: number | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  serviceArea: string;
  isActive: boolean;
  sortOrder: number;
  publicSlug: string;
  publicStatus: WorkspaceServicePublicStatus;
  conversionMode: WorkspaceServiceConversionMode;
  seoTitle: string;
  seoDescription: string;
};

export type UpdateDashboardWorkspaceServiceInput = WriteDashboardWorkspaceServiceInput & { id: string };

type SqlClient = ReturnType<typeof neon>;

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

export async function getDashboardWorkspaceServices(): Promise<DashboardWorkspaceService[]> {
  const sql = getSqlClient();
  if (!sql) return [];

  try {
    const workspaceId = await getActiveWorkspaceId();
    const rows = await sql`
      select
        id, workspace_id, name, description, short_description, category, price_label,
        price_type, price_amount_minor, base_price_sek, duration_minutes,
        buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, maximum_advance_days,
        service_area, is_active, sort_order, public_slug, public_status, conversion_mode,
        seo_title, seo_description
      from workspace_services
      where workspace_id = ${workspaceId}
      order by sort_order asc, name asc
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
      isActive: toBoolean(row.is_active, true),
      sortOrder: toNumber(row.sort_order) ?? 100,
      publicSlug: toText(row.public_slug),
      publicStatus: toPublicStatus(row.public_status),
      conversionMode: toConversionMode(row.conversion_mode),
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
  const rows = await sql`
    insert into workspace_services (
      workspace_id, name, description, short_description, category, price_label, base_price_sek,
      duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes,
      maximum_advance_days, service_area, is_active, sort_order, public_slug, public_status,
      conversion_mode, seo_title, seo_description
    ) values (
      ${workspaceId}, ${input.name}, ${input.description}, ${input.shortDescription}, ${input.category}, ${input.priceLabel},
      ${input.basePriceSek}, ${input.durationMinutes}, ${input.bufferBeforeMinutes}, ${input.bufferAfterMinutes},
      ${input.minimumNoticeMinutes}, ${input.maximumAdvanceDays}, ${input.serviceArea}, ${input.isActive}, ${input.sortOrder},
      ${publicSlug}, ${input.publicStatus}, ${input.conversionMode}, ${input.seoTitle}, ${input.seoDescription}
    )
    returning id
  `;
  if (!rows[0]) throw new Error("Workspace service was not created");
}

export async function updateDashboardWorkspaceService(input: UpdateDashboardWorkspaceServiceInput) {
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for workspace service update");

  const workspaceId = await getActiveWorkspaceId();
  const publicSlug = await resolveUniquePublicSlug(sql, workspaceId, input.publicSlug, input.id);
  const rows = await sql`
    update workspace_services
    set
      name = ${input.name}, description = ${input.description}, short_description = ${input.shortDescription},
      category = ${input.category}, price_label = ${input.priceLabel}, base_price_sek = ${input.basePriceSek},
      duration_minutes = ${input.durationMinutes}, buffer_before_minutes = ${input.bufferBeforeMinutes},
      buffer_after_minutes = ${input.bufferAfterMinutes}, minimum_notice_minutes = ${input.minimumNoticeMinutes},
      maximum_advance_days = ${input.maximumAdvanceDays}, service_area = ${input.serviceArea},
      is_active = ${input.isActive}, sort_order = ${input.sortOrder}, public_slug = ${publicSlug},
      public_status = ${input.publicStatus}, conversion_mode = ${input.conversionMode}, seo_title = ${input.seoTitle},
      seo_description = ${input.seoDescription}, updated_at = now()
    where id = ${input.id}::uuid
      and workspace_id = ${workspaceId}
    returning id
  `;
  if (!rows[0]) throw new Error("Workspace service was not found for the active workspace");
}
