import { NextRequest, NextResponse } from "next/server";

import { resolveAdminArea } from "./lib/admin-navigation";
import { resolvePublicRequestLocale } from "./lib/public-locale";
import { resolvePublicCustomDomain } from "./lib/public-site-domain-routing";
import {
  isPlatformHost,
  isPrimeViewHost,
  isPublicPageRouteAllowedForHost,
} from "./lib/public-site-domains";

const CHAT_ORIGIN = "https://chat.proffera.se";
const PROFFERA_TENANT = "proffera";
const PROFFERA_CLIENT_ID = "proffera";
const NOINDEX_VALUE = "noindex, nofollow";
const ADMIN_PATH_HEADER = "x-proffera-admin-path";
const REQUEST_ID_HEADER = "x-proffera-request-id";
const PUBLIC_SERVICE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function notFound(requestId?: string) {
  const headers = new Headers({ "X-Robots-Tag": NOINDEX_VALUE });
  if (requestId) headers.set(REQUEST_ID_HEADER, requestId);
  return new Response("Not found", {
    status: 404,
    headers,
  });
}

function decodePublicServiceSlug(pathname: string) {
  try {
    return decodeURIComponent(pathname.slice("/tjanster/".length)).trim().toLowerCase();
  } catch {
    return "";
  }
}

function chatUrl(pathname: string, search = "") {
  const url = new URL(pathname, CHAT_ORIGIN);
  const params = new URLSearchParams(search);

  for (const [key, value] of params.entries()) {
    url.searchParams.set(key, value);
  }

  if (!url.searchParams.has("tenant")) {
    url.searchParams.set("tenant", PROFFERA_TENANT);
  }

  return url;
}

function widgetConfigUrl(search = "") {
  const url = new URL("/api/widget-config", CHAT_ORIGIN);
  const params = new URLSearchParams(search);

  for (const [key, value] of params.entries()) {
    url.searchParams.set(key, value);
  }

  if (!url.searchParams.has("clientId")) {
    url.searchParams.set("clientId", PROFFERA_CLIENT_ID);
  }

  return url;
}

function isDashboardPath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function resolveRequestId(request: NextRequest) {
  const incoming = String(request.headers.get(REQUEST_ID_HEADER) ?? "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incoming)) {
    return incoming.toLowerCase();
  }
  return globalThis.crypto.randomUUID();
}

function requestHeadersWithRequestId(request: NextRequest, requestId: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  return requestHeaders;
}

function withResponseRequestId<T extends Response>(response: T, requestId: string) {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

function rewriteWithRequestId(request: NextRequest, destination: URL, requestId: string) {
  return withResponseRequestId(
    NextResponse.rewrite(destination, {
      request: { headers: requestHeadersWithRequestId(request, requestId) },
    }),
    requestId,
  );
}

function redirectWithRequestId(destination: URL, requestId: string) {
  return withResponseRequestId(NextResponse.redirect(destination), requestId);
}

function allowDashboardWithNoIndex(request: NextRequest, requestId: string) {
  const response = NextResponse.next({
    request: { headers: requestHeadersWithRequestId(request, requestId) },
  });
  response.headers.set("X-Robots-Tag", NOINDEX_VALUE);
  return withResponseRequestId(response, requestId);
}

function allowAdminWithPath(request: NextRequest, requestId: string) {
  const requestHeaders = requestHeadersWithRequestId(request, requestId);
  requestHeaders.set(ADMIN_PATH_HEADER, request.nextUrl.pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("X-Robots-Tag", NOINDEX_VALUE);
  return withResponseRequestId(response, requestId);
}

function allowPublicPath(request: NextRequest, requestId: string) {
  const requestHeaders = requestHeadersWithRequestId(request, requestId);
  requestHeaders.delete("x-proffera-locale");

  const locale = resolvePublicRequestLocale(
    request.nextUrl.pathname,
    request.nextUrl.searchParams.get("lang"),
  );
  if (locale === "en") requestHeaders.set("x-proffera-locale", "en");

  return withResponseRequestId(NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  }), requestId);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const requestId = resolveRequestId(request);

  if (!isPublicPageRouteAllowedForHost(host, pathname)) {
    return notFound(requestId);
  }

  // PrimeView keeps its bespoke public site while generic customer domains use
  // the workspace-selected public destination below.
  if (isPrimeViewHost(host) && pathname === "/") {
    return rewriteWithRequestId(request, new URL("/demo/primeview", request.url), requestId);
  }

  // Keep the customer on primeviewwindowcare.co.uk/booking while serving the
  // dedicated precision-pricing booking experience internally.
  if (isPrimeViewHost(host) && pathname === "/booking") {
    const url = request.nextUrl.clone();
    url.pathname = "/primeview-booking";
    return rewriteWithRequestId(request, url, requestId);
  }

  // Existing workspaces remain booking-first by default. A workspace can opt in
  // to its public business site without changing or reattaching the domain.
  if (pathname === "/" && !isPlatformHost(host)) {
    const target = await resolvePublicCustomDomain(host);
    if (!target) return notFound(requestId);

    const url = request.nextUrl.clone();
    url.pathname = target.publicHomeMode === "website"
      ? `/foretag/${encodeURIComponent(target.workspaceSlug)}`
      : `/boka/${encodeURIComponent(target.bookingSlug)}`;
    return rewriteWithRequestId(request, url, requestId);
  }

  // Website-mode custom domains expose clean service URLs while the internal
  // tenant route remains workspace-scoped. Platform /tjanster routes are not changed.
  if (!isPlatformHost(host) && !isPrimeViewHost(host) && (pathname === "/tjanster" || pathname.startsWith("/tjanster/"))) {
    const target = await resolvePublicCustomDomain(host);
    if (!target || target.publicHomeMode !== "website") return notFound(requestId);

    if (pathname === "/tjanster") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.hash = "tjanster";
      return redirectWithRequestId(url, requestId);
    }

    const serviceSlug = decodePublicServiceSlug(pathname);
    if (!PUBLIC_SERVICE_SLUG.test(serviceSlug)) return notFound(requestId);

    const url = request.nextUrl.clone();
    url.pathname = `/foretag/${encodeURIComponent(target.workspaceSlug)}/tjanster/${encodeURIComponent(serviceSlug)}`;
    return rewriteWithRequestId(request, url, requestId);
  }

  if (pathname.startsWith("/app/")) {
    return redirectWithRequestId(chatUrl(pathname, search), requestId);
  }

  if (pathname === "/api/widget-config") {
    return redirectWithRequestId(widgetConfigUrl(search), requestId);
  }

  if (isDashboardPath(pathname)) {
    return allowDashboardWithNoIndex(request, requestId);
  }

  if (isAdminPath(pathname)) {
    // The proxy runs for every matched request, including App Router RSC/client
    // navigations where a shared layout may be reused. Keep the layout check as
    // defense in depth, but reject unmapped Admin route families here first.
    if (!resolveAdminArea(pathname)) return notFound(requestId);
    return allowAdminWithPath(request, requestId);
  }

  // Internal admin mutation routes authenticate with Better Auth / Platform
  // Admin RBAC inside the route itself. They intentionally do not use a shared
  // Basic Auth secret at the proxy boundary.
  return allowPublicPath(request, requestId);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/widget-config",
  ],
};