import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Reviews can only be submitted through a secure invitation sent after a completed service.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
