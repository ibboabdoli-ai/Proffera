import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Proffera Admin"',
    },
  });
}

export function middleware(request: NextRequest) {
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
  matcher: ["/admin/:path*", "/api/outbox", "/api/company-admin"],
};
