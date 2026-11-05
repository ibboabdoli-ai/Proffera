/** Maria-only, locale-safe year editor input. No payments or side effects. */
export const MARIA_MAX_PRICE_SEK = 250_000;
export const MARIA_MAX_DESCRIPTION_LENGTH = 280;

export function readMariaYearPrice(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("INVALID_PRICE");
  const raw = value.trim();
  if (raw === "") return null;
  const parsed = /^(0|[1-9][0-9]{0,5})(?:[.,]([0-9]{1,2}))?$/.exec(raw);
  if (!parsed) throw new Error("INVALID_PRICE");
  const minor = Number(parsed[1]) * 100 + Number((parsed[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > MARIA_MAX_PRICE_SEK * 100) {
    throw new Error("INVALID_PRICE");
  }
  return minor / 100;
}

export function readMariaYearDescription(value: FormDataEntryValue | null, fallback: string): string {
  if (value === null) return fallback;
  if (typeof value !== "string") throw new Error("INVALID_DESCRIPTION");
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (text.length > MARIA_MAX_DESCRIPTION_LENGTH
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw new Error("INVALID_DESCRIPTION");
  }
  return text || fallback;
}
