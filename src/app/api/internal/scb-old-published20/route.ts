import { NextResponse } from "next/server";

import { fetchScbCompanyRegistryEnrichment } from "@/lib/company-directory-scb-provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BATCHES = [
  ["5563087898", "5563501534", "5563767564", "5563806545", "5563818490"],
  ["5565980660", "5566054150", "5566077516", "5566085675", "5566117312"],
  ["5561824201", "5562010727", "5565200713", "5569867574", "5590993142"],
  ["5567844674", "5568761075", "5569048712", "5569059644", "5560761891"],
] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const batch = Number(url.searchParams.get("batch") ?? "");
  if (!Number.isInteger(batch) || batch < 1 || batch > BATCHES.length) {
    return NextResponse.json(
      { ok: false, error: "batch must be 1-4" },
      { status: 400, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
    );
  }

  const results = [];
  for (const organizationNumber of BATCHES[batch - 1]) {
    try {
      const result = await fetchScbCompanyRegistryEnrichment(organizationNumber);
      results.push({ organizationNumber, ok: result.status === "ok", status: result.status, normalized: result.data });
    } catch (error) {
      results.push({
        organizationNumber,
        ok: false,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown SCB error",
      });
    }
    await sleep(2200);
  }

  const configured = results.some((result) => result.status !== "disabled" && result.status !== "awaiting_access");
  return NextResponse.json(
    { ok: true, configured, batch, results },
    { headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } },
  );
}
