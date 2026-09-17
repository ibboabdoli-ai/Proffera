type ClaimNextValue = string | string[] | undefined;

const CLAIM_ROUTE_PATTERN = /^\/(?:foretag\/claim|en\/companies\/claim)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_BASE_URL = "https://proffera.invalid";

function singleValue(value: ClaimNextValue) {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : null;
  return value ?? null;
}

export function resolveSafeClaimLoginNext(value: ClaimNextValue) {
  const candidate = singleValue(value);
  if (!candidate || candidate !== candidate.trim()) return null;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("#")) return null;

  let url: URL;
  try {
    url = new URL(candidate, SAFE_BASE_URL);
  } catch {
    return null;
  }

  if (url.origin !== SAFE_BASE_URL) return null;
  if (`${url.pathname}${url.search}` !== candidate) return null;
  if (!CLAIM_ROUTE_PATTERN.test(url.pathname)) return null;

  const entries = [...url.searchParams.entries()];
  if (entries.length === 0) return url.pathname;

  const isSwedishClaimRoute = url.pathname.startsWith("/foretag/claim/");
  if (!isSwedishClaimRoute) return null;
  if (entries.length !== 1 || entries[0][0] !== "lang" || entries[0][1] !== "en") return null;

  return `${url.pathname}?lang=en`;
}
