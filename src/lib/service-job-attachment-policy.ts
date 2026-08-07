export const serviceJobAttachmentMaxBytes = 4 * 1024 * 1024;

export const serviceJobAttachmentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type ServiceJobAttachmentValidation =
  | { ok: true; safeFileName: string }
  | { ok: false; code: "missing" | "type" | "size" | "name" };

export function sanitizeServiceJobAttachmentName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/-+\./g, ".")
    .replace(/-+$/g, "")
    .toLowerCase()
    .slice(0, 180);
}

export function validateServiceJobAttachment(input: {
  name: string;
  type: string;
  size: number;
}): ServiceJobAttachmentValidation {
  if (!input.name.trim() || input.size <= 0) return { ok: false, code: "missing" };
  if (!serviceJobAttachmentTypes.has(input.type)) return { ok: false, code: "type" };
  if (input.size > serviceJobAttachmentMaxBytes) return { ok: false, code: "size" };

  const safeFileName = sanitizeServiceJobAttachmentName(input.name);
  if (!safeFileName || safeFileName.length > 180) return { ok: false, code: "name" };

  return { ok: true, safeFileName };
}
