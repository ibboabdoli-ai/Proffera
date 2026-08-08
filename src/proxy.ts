import { NextRequest, NextResponse } from "next/server";

import { isEnglishPublicPath } from "./lib/public-locale";
import { resolvePublicCustomDomain } from "./lib/public-site-domain-routing";
import {
  isPlatformHost,
  isPrimeViewHost,
} from "./lib/public-site-domains";

const CHAT_ORIGIN = "https://chat.proffera.se";
const PROFFERA_TENANT = "proffera";
const PROFFERA_CLIENT_ID = "proffera";
const NOINDEX_VALUE = "noindex, nofollow";
const ADMIN_PATH_HEADER = "x-proffera-admin-path";

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "X-Robots-Tag": NOINDEX_VALUE },
  });
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

function allowDashboardWithNoIndex() {
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", NOINDEX_VALUE);
  return response;
}

function allowAdminWithPath(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ADMIN_PATH_HEADER, request.nextUrl.pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("X-Robots-Tag", NOINDEX_VALUE);
  return response;
}

function allowPublicPath(request: NextRequest) {
  if (!isEnglishPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-proffera-locale", "en");

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host");

  // PrimeView keeps its bespoke public site while generic customer domains use
  // the workspace booking-site renderer below.
  if (isPrimeViewHost(host) && pathname === "/") {
    return NextResponse.rewrite(new URL("/demo/primeview", request.url));
  }

  // Any custom domain already attached to this Vercel project resolves from the
  // workspace database. Unknown custom hosts fail closed instead of showing the
  // Proffera marketing homepage under somebody else's domain.
  if (pathname === "/" && !isPlatformHost(host)) {
    const target = await resolvePublicCustomDomain(host);
    if (!target) return notFound();

    const url = request.nextUrl.clone();
    url.pathname = `/boka/${encodeURIComponent(target.bookingSlug)}`;
    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith("/app/")) {
    return NextResponse.redirect(chatUrl(pathname, search));
  }

  if (pathname === "/api/widget-config") {
    return NextResponse.redirect(widgetConfigUrl(search));
  }

  if (isDashboardPath(pathname)) {
    return allowDashboardWithNoIndex();
  }

  if (isAdminPath(pathname)) {
    return allowAdminWithPath(request);
  }

  // Internal admin mutation routes authenticate with Better Auth / Platform
  // Admin RBAC inside the route itself. They intentionally do not use a shared
  // Basic Auth secret at the proxy boundary.
  return allowPublicPath(request);
}

export const config = {
  matcher: [
    "/",
    "/en",
    "/en/:path*",
    "/app/:path*",
    "/api/widget-config",
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
