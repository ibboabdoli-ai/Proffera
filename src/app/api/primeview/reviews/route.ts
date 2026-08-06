import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Reviews are accepted only through a secure customer link issued after a completed service.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
