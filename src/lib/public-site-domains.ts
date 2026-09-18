const primeViewHosts = new Set([
  "primeviewwindowcare.co.uk",
  "www.primeviewwindowcare.co.uk",
]);

const platformHosts = new Set([
  "proffera.se",
  "www.proffera.se",
  "chat.proffera.se",
  "localhost",
  "127.0.0.1",
  "::1",
]);

const productionAnalyticsHosts = new Set([
  "proffera.se",
  "www.proffera.se",
  "chat.proffera.se",
]);

const hostnameLabel = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export type AnalyticsEnvironment = "production" | "preview";

export function hostnameFromHostHeader(host: string | null | undefined) {
  const value = (host ?? "").trim().toLowerCase();
  if (!value) return "";

  if (value.startsWith("[")) {
    const closingBracket = value.indexOf("]");
    return closingBracket > 0 ? value.slice(1, closingBracket) : value;
  }

  return value.split(":", 1)[0].replace(/\.$/, "");
}

export function isPrimeViewHost(host: string | null | undefined) {
  return primeViewHosts.has(hostnameFromHostHeader(host));
}

export function isPlatformHost(host: string | null | undefined) {
  const hostname = hostnameFromHostHeader(host);
  return platformHosts.has(hostname) || hostname.endsWith(".vercel.app");
}

const primeViewPublicRouteFamilies = [
  "/services",
  "/areas",
  "/boka/primeview",
] as const;

const primeViewExactPublicRoutes = new Set([
  "/",
  "/booking",
  "/gallery",
  "/privacy",
]);

const sharedCustomerRouteFamilies = [
  "/boka",
  "/mina-bokningar",
  "/offert",
  "/review",
  "/gallery",
  "/galleri",
] as const;

function matchesRouteFamily(pathname: string, family: string) {
  return pathname === family || pathname.startsWith(`${family}/`);
}

function isPrimeViewPublicRoute(pathname: string) {
  return primeViewExactPublicRoutes.has(pathname)
    || primeViewPublicRouteFamilies.some((family) => matchesRouteFamily(pathname, family));
}

function isSharedCustomerRoute(pathname: string) {
  return sharedCustomerRouteFamilies.some((family) => matchesRouteFamily(pathname, family));
}

/**
 * Central host-aware namespace policy for public page routes.
 *
 * Platform hosts remain the default application surface but explicitly reject
 * PrimeView-only public paths. Customer domains are fail-closed: PrimeView
 * exposes only its bespoke public namespace plus shared customer lifecycle
 * links, while generic custom domains expose only their root, clean service
 * paths and the same shared customer lifecycle links.
 *
 * API and static-asset matching is handled separately by the proxy matcher.
 */
export function isPublicPageRouteAllowedForHost(
  host: string | null | undefined,
  pathname: string,
) {
  const path = pathname || "/";

  if (isPlatformHost(host)) {
    return path !== "/primeview-booking" && !isPrimeViewPublicRoute(path);
  }

  if (isPrimeViewHost(host)) {
    if (path === "/primeview-booking") return false;
    return isPrimeViewPublicRoute(path) || isSharedCustomerRoute(path);
  }

  if (path === "/primeview-booking" || isPrimeViewPublicRoute(path)) return false;
  return path === "/"
    || matchesRouteFamily(path, "/tjanster")
    || isSharedCustomerRoute(path);
}

export function isAnalyticsPlatformHost(
  host: string | null | undefined,
  environment: AnalyticsEnvironment | null,
) {
  const hostname = hostnameFromHostHeader(host);
  if (!hostname || !environment) return false;

  if (environment === "production") {
    return productionAnalyticsHosts.has(hostname);
  }

  return hostname.endsWith(".vercel.app");
}

export function normalizeCustomDomainInput(input: string | null | undefined) {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (url.username || url.password || url.port || url.search || url.hash) return "";
    if (url.pathname && url.pathname !== "/") return "";

    const hostname = hostnameFromHostHeader(url.hostname);
    if (!hostname || hostname.length > 253 || !hostname.includes(".")) return "";
    if (isPlatformHost(hostname)) return "";
    if (isPrimeViewHost(hostname)) return hostname;

    const labels = hostname.split(".");
    if (labels.some((label) => !hostnameLabel.test(label))) return "";
    if (labels.every((label) => /^\d+$/.test(label))) return "";
    return hostname;
  } catch {
    return "";
  }
}
