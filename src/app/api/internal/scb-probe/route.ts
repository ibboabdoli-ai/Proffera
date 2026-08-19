import { NextResponse } from "next/server";

import {
  fetchScbCompanyRegistryHelpExamplesFromEnv,
  probeScbCompanyRegistryMetadataFromEnv,
} from "@/lib/company-directory-scb-transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function codeSamples(html: string) {
  const samples: string[] = [];
  const pattern = /<(?:pre|code)[^>]*>([\s\S]*?)<\/(?:pre|code)>/gi;
  for (const match of html.matchAll(pattern)) {
    const decoded = decodeHtml(match[1] ?? "");
    if (!decoded || (!decoded.includes("{") && !decoded.includes("["))) continue;
    if (samples.includes(decoded)) continue;
    samples.push(decoded.slice(0, 12_000));
    if (samples.length >= 12) break;
  }
  return samples;
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const [metadata, examples] = await Promise.all([
      probeScbCompanyRegistryMetadataFromEnv(),
      fetchScbCompanyRegistryHelpExamplesFromEnv(),
    ]);

    if (metadata.status !== "ok" || examples.status !== "ok") {
      return NextResponse.json({
        ok: false,
        configured: false,
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      metadata: {
        companyVariables: metadata.companyVariables,
        workplaceVariables: metadata.workplaceVariables,
        companyCategories: metadata.companyCategories,
        workplaceCategories: metadata.workplaceCategories,
      },
      helpExamples: {
        company: codeSamples(examples.companyExampleHtml),
        workplace: codeSamples(examples.workplaceExampleHtml),
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : "SCB probe failed",
    }, { status: 502 });
  }
}
