import { NextRequest, NextResponse } from "next/server";

const CHAT_ORIGIN = "https://chat.proffera.se";
const PROFFERA_TENANT = "proffera";

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Proffera Admin"',
    },
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

function dashboardRedirectUrl(pathname: string) {
  if (pathname === "/dashboard/installningar") {
    return chatUrl("/app/settings");
  }

  return chatUrl("/app/inbox");
}

function shouldRequireAdminAuth(pathname: string) {
  return pathname.startsWith("/admin/") || pathname === "/api/outbox" || pathname === "/api/company-admin";
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/logga-in") {
    return NextResponse.redirect(chatUrl("/app/inbox"));
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return NextResponse.redirect(dashboardRedirectUrl(pathname));
  }

  if (pathname === "/api/widget-config") {
    return NextResponse.redirect(chatUrl(pathname, search));
  }

  if (pathname.startsWith("/app/")) {
    return NextResponse.redirect(chatUrl(pathname, search));
  }

  if (!shouldRequireAdminAuth(pathname)) {
    return NextResponse.next();
  }

  const adminCode = process.env.ADMIN_ACCESS_CODE;

  if (!adminCode) {
    return unauthorized();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorized();
  }

  const decoded = atob(authHeader.slice(6));
  const separatorIndex = decoded.indexOf(":");
  const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";

  if (password !== adminCode) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/logga-in",
    "/dashboard/:path*",
    "/app/:path*",
    "/api/widget-config",
    "/admin/:path*",
    "/api/outbox",
    "/api/company-admin",
  ],
};
