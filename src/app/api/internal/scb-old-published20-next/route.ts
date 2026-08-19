import { NextResponse } from "next/server";

import { fetchScbCompanyRegistryEnrichment } from "@/lib/company-directory-scb-provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BATCHES = [
  ["5567795975", "5567750434", "5567771000", "5566608732", "5562306919"],
  ["5562359942", "5562579283", "5562660646", "5563113231", "5563115707"],
  ["5563360071", "5563554392", "5563890887", "5563915312", "5564090230"],
  ["5564103280", "5564208337", "5564212545", "5564255841", "5564414786"],
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
