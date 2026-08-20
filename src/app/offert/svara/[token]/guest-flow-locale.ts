export type GuestFlowLocale = "sv" | "en";

export function guestFlowLocaleFrom(value: string | string[] | undefined): GuestFlowLocale {
  return Array.isArray(value) ? (value[0] === "en" ? "en" : "sv") : value === "en" ? "en" : "sv";
}

function withGuestQuery(path: string, locale: GuestFlowLocale, status?: string) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (locale === "en") query.set("lang", "en");
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function guestQuoteHref(token: string, locale: GuestFlowLocale, status?: string) {
  return withGuestQuery(`/offert/svara/${encodeURIComponent(token)}`, locale, status);
}

export function guestOptOutHref(token: string, locale: GuestFlowLocale, status?: string) {
  return withGuestQuery(`/offert/svara/${encodeURIComponent(token)}/avregistrera`, locale, status);
}

export function guestClaimHref(slug: string, locale: GuestFlowLocale) {
  const encodedSlug = encodeURIComponent(slug);
  return locale === "en" ? `/en/companies/claim/${encodedSlug}` : `/foretag/claim/${encodedSlug}`;
}
