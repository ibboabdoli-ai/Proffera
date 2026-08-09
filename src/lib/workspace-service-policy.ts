export type WorkspaceServicePublicStatus = "draft" | "published" | "hidden";
export type WorkspaceServiceConversionMode = "book" | "quote" | "book_or_quote" | "contact";

export type WorkspaceServiceValidationError =
  | "name"
  | "description"
  | "short_description"
  | "category"
  | "price"
  | "base_price"
  | "duration"
  | "area"
  | "sort"
  | "public_slug"
  | "public_status"
  | "conversion"
  | "cover_image"
  | "seo";

export type WorkspaceServiceDraft = {
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  priceLabel: string;
  basePriceSek: string;
  durationMinutes: string;
  bufferBeforeMinutes: string;
  bufferAfterMinutes: string;
  minimumNoticeMinutes: string;
  maximumAdvanceDays: string;
  serviceArea: string;
  isActive: boolean;
  sortOrder: string;
  publicSlug: string;
  publicStatus: string;
  conversionMode: string;
  coverImageUrl: string;
  seoTitle: string;
  seoDescription: string;
};

export type NormalizedWorkspaceService = {
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
  coverImageUrl: string;
  seoTitle: string;
  seoDescription: string;
};

export type WorkspaceServiceValidationResult =
  | { ok: true; value: NormalizedWorkspaceService }
  | { ok: false; error: WorkspaceServiceValidationError };

const PUBLIC_STATUSES = new Set<WorkspaceServicePublicStatus>(["draft", "published", "hidden"]);
const CONVERSION_MODES = new Set<WorkspaceServiceConversionMode>(["book", "quote", "book_or_quote", "contact"]);

function optionalInteger(raw: string, min: number, max: number) {
  if (!raw) return { ok: true as const, value: null };
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max
    ? { ok: true as const, value }
    : { ok: false as const };
}

function integerWithDefault(raw: string, min: number, max: number, fallback: number) {
  if (!raw) return { ok: true as const, value: fallback };
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max
    ? { ok: true as const, value }
    : { ok: false as const };
}

function requiredInteger(raw: string, min: number, max: number) {
  const value = Number(raw);
  return raw && Number.isInteger(value) && value >= min && value <= max
    ? { ok: true as const, value }
    : { ok: false as const };
}

function isSafePublicImageUrl(value: string) {
  if (!value) return true;
  if (value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function normalizeWorkspaceServicePublicSlug(raw: string, fallbackName = "") {
  const source = raw.trim() || fallbackName.trim();
  let slug = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");

  if (!slug) slug = "tjanst";
  if (slug.length < 2) slug = `${slug}-tjanst`.slice(0, 120);
  return slug;
}

export function isWorkspaceServicePublicStatus(value: unknown): value is WorkspaceServicePublicStatus {
  return typeof value === "string" && PUBLIC_STATUSES.has(value as WorkspaceServicePublicStatus);
}

export function isWorkspaceServiceConversionMode(value: unknown): value is WorkspaceServiceConversionMode {
  return typeof value === "string" && CONVERSION_MODES.has(value as WorkspaceServiceConversionMode);
}

export function validateWorkspaceServiceDraft(draft: WorkspaceServiceDraft): WorkspaceServiceValidationResult {
  const name = draft.name.trim();
  const description = draft.description.trim();
  const shortDescription = draft.shortDescription.trim();
  const category = draft.category.trim();
  const priceLabel = draft.priceLabel.trim();
  const serviceArea = draft.serviceArea.trim();
  const coverImageUrl = draft.coverImageUrl.trim();
  const seoTitle = draft.seoTitle.trim();
  const seoDescription = draft.seoDescription.trim();

  if (!name || name.length > 140) return { ok: false, error: "name" };
  if (description.length > 500) return { ok: false, error: "description" };
  if (shortDescription.length > 280) return { ok: false, error: "short_description" };
  if (category.length > 120) return { ok: false, error: "category" };
  if (priceLabel.length > 120) return { ok: false, error: "price" };
  if (serviceArea.length > 240) return { ok: false, error: "area" };
  if (!isSafePublicImageUrl(coverImageUrl)) return { ok: false, error: "cover_image" };
  if (seoTitle.length > 180 || seoDescription.length > 320) return { ok: false, error: "seo" };

  const basePriceSek = optionalInteger(draft.basePriceSek.trim(), 0, 9_999_999);
  if (!basePriceSek.ok) return { ok: false, error: "base_price" };

  const durationMinutes = optionalInteger(draft.durationMinutes.trim(), 1, 1440);
  if (!durationMinutes.ok) return { ok: false, error: "duration" };

  const bufferBeforeMinutes = integerWithDefault(draft.bufferBeforeMinutes.trim(), 0, 1440, 0);
  const bufferAfterMinutes = integerWithDefault(draft.bufferAfterMinutes.trim(), 0, 1440, 0);
  const minimumNoticeMinutes = integerWithDefault(draft.minimumNoticeMinutes.trim(), 0, 525_600, 0);
  const maximumAdvanceDays = integerWithDefault(draft.maximumAdvanceDays.trim(), 1, 730, 365);
  if (!bufferBeforeMinutes.ok || !bufferAfterMinutes.ok || !minimumNoticeMinutes.ok || !maximumAdvanceDays.ok) {
    return { ok: false, error: "duration" };
  }

  const sortOrder = requiredInteger(draft.sortOrder.trim(), 0, 9999);
  if (!sortOrder.ok) return { ok: false, error: "sort" };

  if (!isWorkspaceServicePublicStatus(draft.publicStatus)) return { ok: false, error: "public_status" };
  if (!isWorkspaceServiceConversionMode(draft.conversionMode)) return { ok: false, error: "conversion" };

  const publicSlug = normalizeWorkspaceServicePublicSlug(draft.publicSlug, name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicSlug) || publicSlug.length > 120) {
    return { ok: false, error: "public_slug" };
  }

  if (
    draft.publicStatus === "published"
    && (draft.conversionMode === "book" || draft.conversionMode === "book_or_quote")
    && (!durationMinutes.value || durationMinutes.value <= 0)
  ) {
    return { ok: false, error: "duration" };
  }

  return {
    ok: true,
    value: {
      name,
      description,
      shortDescription,
      category,
      priceLabel,
      basePriceSek: basePriceSek.value,
      durationMinutes: durationMinutes.value,
      bufferBeforeMinutes: bufferBeforeMinutes.value,
      bufferAfterMinutes: bufferAfterMinutes.value,
      minimumNoticeMinutes: minimumNoticeMinutes.value,
      maximumAdvanceDays: maximumAdvanceDays.value,
      serviceArea,
      isActive: draft.isActive,
      sortOrder: sortOrder.value,
      publicSlug,
      publicStatus: draft.publicStatus,
      conversionMode: draft.conversionMode,
      coverImageUrl,
      seoTitle,
      seoDescription,
    },
  };
}

export function isWorkspaceServiceReadyForBooking(service: NormalizedWorkspaceService) {
  return service.isActive && service.durationMinutes !== null && service.durationMinutes > 0;
}

export function isWorkspaceServiceReadyForQuote(service: NormalizedWorkspaceService) {
  return service.isActive && service.name.length > 0;
}
