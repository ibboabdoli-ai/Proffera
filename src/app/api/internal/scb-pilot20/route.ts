import { NextResponse } from "next/server";

import { normalizeScbCompanyRegistryPayload } from "@/lib/company-directory-scb-provider";
import { createScbCompanyRegistryTransportFromEnv } from "@/lib/company-directory-scb-transport";

export const dynamic = "force-dynamic";

const PILOT_BATCHES = [
  ["5592330699", "5592316326", "5592303555", "5592223522", "5592218084"],
  ["5592170327", "5592166424", "5592098908", "5592080781", "5592016538"],
  ["5592003890", "5591996839", "5591967061", "5591953723", "5591740682"],
  ["5591681589", "5591645022", "5591627871", "5591573885", "5591534325"],
] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  const transport = createScbCompanyRegistryTransportFromEnv();
  if (!transport) {
    return NextResponse.json({ ok: false, configured: false, results: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const batchIndex = Number(url.searchParams.get("batch") ?? "") - 1;
  const batch = PILOT_BATCHES[batchIndex];
  if (!batch) {
    return NextResponse.json({ ok: false, error: "invalid_batch" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const results = [];
  for (const organizationNumber of batch) {
    try {
      const companyPayload = await transport.fetchCompany(organizationNumber);
      await sleep(1100);
      const workplacePayload = await transport.fetchWorkplaces(organizationNumber);
      await sleep(1100);
      const normalized = normalizeScbCompanyRegistryPayload(companyPayload, workplacePayload, organizationNumber);
      results.push({ organizationNumber, ok: true, normalized });
    } catch (error) {
      results.push({
        organizationNumber,
        ok: false,
        error: error instanceof Error ? error.message : "SCB lookup failed",
      });
    }
  }

  return NextResponse.json(
    { ok: results.every((result) => result.ok), configured: true, batch: batchIndex + 1, results },
    { headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } },
  );
}
