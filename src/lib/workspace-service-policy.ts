export type WorkspaceServiceValidationError =
  | "name"
  | "description"
  | "category"
  | "price"
  | "base_price"
  | "duration"
  | "area"
  | "sort";

export type WorkspaceServiceDraft = {
  name: string;
  description: string;
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
};

export type NormalizedWorkspaceService = {
  name: string;
  description: string;
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
};

export type WorkspaceServiceValidationResult =
  | { ok: true; value: NormalizedWorkspaceService }
  | { ok: false; error: WorkspaceServiceValidationError };

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

export function validateWorkspaceServiceDraft(draft: WorkspaceServiceDraft): WorkspaceServiceValidationResult {
  const name = draft.name.trim();
  const description = draft.description.trim();
  const category = draft.category.trim();
  const priceLabel = draft.priceLabel.trim();
  const serviceArea = draft.serviceArea.trim();

  if (!name || name.length > 140) return { ok: false, error: "name" };
  if (description.length > 500) return { ok: false, error: "description" };
  if (category.length > 120) return { ok: false, error: "category" };
  if (priceLabel.length > 120) return { ok: false, error: "price" };
  if (serviceArea.length > 240) return { ok: false, error: "area" };

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

  return {
    ok: true,
    value: {
      name,
      description,
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
    },
  };
}

export function isWorkspaceServiceReadyForBooking(service: NormalizedWorkspaceService) {
  return service.isActive && service.durationMinutes !== null && service.durationMinutes > 0;
}

export function isWorkspaceServiceReadyForQuote(service: NormalizedWorkspaceService) {
  return service.isActive && service.name.length > 0;
}
