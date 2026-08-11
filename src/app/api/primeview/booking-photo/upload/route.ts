import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { allowPublicSubmission } from "@/lib/public-form-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS_PER_SESSION = 5;

function parseSessionId(clientPayload: string | null | undefined) {
  try {
    const parsed = JSON.parse(clientPayload ?? "{}") as { sessionId?: unknown };
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : "";
    return SESSION_ID.test(sessionId) ? sessionId : "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Photo upload is temporarily unavailable." }, { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const sessionId = parseSessionId(clientPayload);
        if (!sessionId || !pathname.startsWith(`primeview-booking/${sessionId}/`) || pathname.includes("..")) {
          throw new Error("Invalid photo upload session.");
        }

        const [ipAllowed, sessionAllowed] = await Promise.all([
          allowPublicSubmission({
            scope: "primeview_booking_photo_ip",
            requestHeaders: request.headers,
            maxAttempts: 10,
            windowSeconds: 15 * 60,
          }),
          allowPublicSubmission({
            scope: "primeview_booking_photo_session",
            requestHeaders: request.headers,
            identity: sessionId,
            maxAttempts: MAX_PHOTOS_PER_SESSION,
            windowSeconds: 15 * 60,
          }),
        ]);
        if (!ipAllowed || !sessionAllowed) {
          throw new Error(`A maximum of ${MAX_PHOTOS_PER_SESSION} photos can be uploaded for this booking.`);
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ sessionId }),
        };
      },
      onUploadCompleted: async () => undefined,
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("PrimeView booking photo upload failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Photo upload failed." },
      { status: 400 },
    );
  }
}
