import { NextRequest, NextResponse } from "next/server";

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

function shouldRequireAdminAuth(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/api/outbox" || pathname === "/api/company-admin";
}

function allowDashboardWithNoIndex() {
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", NOINDEX_VALUE);
  return response;
}

function requireAdminAuth(request: NextRequest) {
  const expectedCode = (process.env.ADMIN_ACCESS_CODE ?? "").trim();

  if (!expectedCode || basicAuthPassword(request) !== expectedCode) {
    return unauthorized();
  }

  return NextResponse.next();
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/app/")) {
    return NextResponse.redirect(chatUrl(pathname, search));
  }

  if (pathname === "/api/widget-config") {
    return NextResponse.redirect(widgetConfigUrl(search));
  }

  if (isDashboardPath(pathname)) {
    return allowDashboardWithNoIndex();
  }

  if (shouldRequireAdminAuth(pathname)) {
    return requireAdminAuth(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app/:path*",
    "/api/widget-config",
    "/dashboard",
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/outbox",
    "/api/company-admin",
  ],
};
