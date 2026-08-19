import { createHash } from "node:crypto";
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
const headers = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" };

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const batch = Number(url.searchParams.get("batch") ?? "");
  if (!Number.isInteger(batch) || batch < 1 || batch > BATCHES.length) {
    return NextResponse.json({ ok: false, error: "batch must be 1-4" }, { status: 400, headers });
  }

  const results = [];
  for (const organizationNumber of BATCHES[batch - 1]) {
    try {
      const result = await fetchScbCompanyRegistryEnrichment(organizationNumber);
      if (result.status !== "ok") {
        results.push({ organizationNumber, ok: false, status: result.status });
      } else {
        const sourcePayloadHash = createHash("sha256")
          .update(JSON.stringify(result.data))
          .digest("hex");

        if (organizationNumber === "5564103280") {
          results.push({
            organizationNumber,
            ok: true,
            status: "ok",
            sourcePayloadHash,
            normalized: {
              organizationNumber: result.data.organizationNumber,
              legalName: result.data.legalName,
              phone: result.data.phone,
              email: result.data.email,
              postalAddress: result.data.postalAddress,
              municipality: result.data.municipality,
              sniCodes: result.data.sniCodes,
              workplaceCount: result.data.workplaces.length,
              source: result.data.source,
              provenance: result.data.provenance,
            },
          });
        } else {
          results.push({
            organizationNumber,
            ok: true,
            status: "ok",
            sourcePayloadHash,
            normalized: result.data,
          });
        }
      }
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
  return NextResponse.json({ ok: true, configured, batch, results }, { headers });
}
