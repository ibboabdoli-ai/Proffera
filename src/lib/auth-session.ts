import "server-only";

import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";

export async function hasBetterAuthSessionCookie() {
  const requestHeaders = await headers();
  const request = new Request("https://www.proffera.se", {
    headers: requestHeaders,
  });

  return Boolean(getSessionCookie(request));
}

export async function getServerSession() {
  return getAuth().api.getSession({
    headers: await headers(),
  });
}
