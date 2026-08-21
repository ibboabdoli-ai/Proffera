import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `preview-e2e-${suffix}@example.com`;
  const password = `Preview-${randomUUID()}-A1!`;

  try {
    const auth = getAuth();
    const signUp = await auth.api.signUpEmail({
      body: {
        name: "Proffera Preview E2E",
        email,
        password,
      },
      headers: request.headers,
    });
    const signIn = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: request.headers,
      returnHeaders: true,
    });

    const signUpOk = signUp.user.email === email;
    const signInOk = signIn.response.user.email === email;
    const sessionCookieIssued = signIn.headers.getSetCookie().length > 0;
    const ready = signUpOk && signInOk && sessionCookieIssued;

    return NextResponse.json(
      {
        ready,
        signUpOk,
        signInOk,
        sessionCookieIssued,
        testUserId: signUp.user.id,
        testUserEmail: email,
      },
      {
        status: ready ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  } catch (error) {
    console.error("Preview Better Auth self-test failed", error);
    return NextResponse.json(
      {
        ready: false,
        signUpOk: false,
        signInOk: false,
        sessionCookieIssued: false,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  }
}
