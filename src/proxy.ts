import { NextRequest, NextResponse } from "next/server";

import { isEnglishPublicPath } from "./lib/public-locale";
import {
  isPlatformHost,
  isPrimeViewHost,
} from "./lib/public-site-domains";

const CHAT_ORIGIN = "https://chat.proffera.se";
const PROFFERA_TENANT = "proffera";
const PROFFERA_CLIENT_ID = "proffera";
const NOINDEX_VALUE = "noindex, nofollow";

function unauthorized(realm = "Proffera Admin", noindex = false) {
  const headers = new Headers({
    "WWW-Authenticate": `Basic realm="${realm}"`,
  });

  if (noindex) {
    headers.set("X-Robots-Tag", NOINDEX_VALUE);
  }

  return new Response("Authentication required", {
    status: 401,
    headers,
  });
}

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "X-Robots-Tag": NOINDEX_VALUE },
  });
}

function basicAuthPassword(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return "";
  }

  const decoded = atob(authHeader.slice(6));
  const separatorIndex = decoded.indexOf(":");

  return separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";
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

function shouldRequireAdminBasicAuth(pathname: string) {
  return pathname === "/api/outbox" || pathname === "/api/company-admin";
}

function allowDashboardWithNoIndex() {
  const response = NextResponse.next();
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

function requireAdminAuth(request: NextRequest) {
  const expectedCode = (process.env.ADMIN_ACCESS_CODE ?? "").trim();

  if (!expectedCode || basicAuthPassword(request) !== expectedCode) {
    return unauthorized();
  }

  return NextResponse.next();
}

async function resolveCustomDomainTarget(host: string | null) {
  const { resolvePublicCustomDomain } = await import("./lib/public-site-domain-routing");
  return resolvePublicCustomDomain(host);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host");

  // PrimeView keeps its bespoke public site while generic customer domains use
  // the workspace booking-site renderer below.
  if (isPrimeViewHost(host) && pathname === "/") {
    return NextResponse.rewrite(new URL("/demo/primeview", request.url));
  }

  // Load tenant/database routing only for a real custom-domain root request.
  // This keeps ordinary Proffera traffic and proxy unit tests independent from
  // server-only database modules.
  if (pathname === "/" && !isPlatformHost(host)) {
    const target = await resolveCustomDomainTarget(host);
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

  if (shouldRequireAdminBasicAuth(pathname)) {
    return requireAdminAuth(request);
  }

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
    "/admin/:path*",
    "/api/outbox",
    "/api/company-admin",
  ],
};
