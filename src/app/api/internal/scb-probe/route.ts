import { NextResponse } from "next/server";

import {
  normalizeScbCompanyRegistryPayload,
} from "@/lib/company-directory-scb-provider";
import {
  createScbCompanyRegistryTransportFromEnv,
  fetchScbCompanyRegistryHelpExamplesFromEnv,
  probeScbCompanyRegistryMetadataFromEnv,
} from "@/lib/company-directory-scb-transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

// Three existing Proffera directory profiles selected read-only from Södertälje.
// The temporary probe never accepts arbitrary organisation numbers from callers.
const PILOT_ORGANIZATION_NUMBERS = [
  "5590026307",
  "5590016860",
  "5569672982",
] as const;

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

function visibleHelpText(html: string) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(?:p|div|tr|li|h[1-6]|table|section|article)>/gi, "\n")
      .replace(/<(?:br|hr)\s*\/?>/gi, "\n"),
  )
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 40_000);
}

function payloadShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      first: value.length > 0 ? payloadShape(value[0]) : null,
    };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      type: "object",
      keys: Object.keys(record),
      nested: Object.fromEntries(
        Object.entries(record)
          .filter(([, nested]) => Array.isArray(nested) || (nested && typeof nested === "object"))
          .slice(0, 12)
          .map(([key, nested]) => [key, payloadShape(nested)]),
      ),
    };
  }
  return { type: typeof value };
}

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

async function runPilot() {
  const transport = createScbCompanyRegistryTransportFromEnv();
  if (!transport) {
    return {
      ok: false,
      configured: false,
      results: [],
    };
  }

  const results = [];
  for (const organizationNumber of PILOT_ORGANIZATION_NUMBERS) {
    try {
      const companyPayload = await transport.fetchCompany(organizationNumber);
      const workplacePayload = await transport.fetchWorkplaces(organizationNumber);
      try {
        const normalized = normalizeScbCompanyRegistryPayload(
          companyPayload,
          workplacePayload,
          organizationNumber,
        );
        results.push({
          organizationNumber,
          ok: true,
          normalized,
        });
      } catch (error) {
        results.push({
          organizationNumber,
          ok: false,
          normalizationError: error instanceof Error ? error.message : "SCB normalization failed",
          companyShape: payloadShape(companyPayload),
          workplaceShape: payloadShape(workplacePayload),
        });
      }
    } catch (error) {
      results.push({
        organizationNumber,
        ok: false,
        requestError: error instanceof Error ? error.message : "SCB request failed",
      });
    }
  }

  return {
    ok: results.every((result) => result.ok),
    configured: true,
    results,
  };
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, {
      status: 404,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const url = new URL(request.url);
    if (url.searchParams.get("pilot") === "1") {
      return json(await runPilot());
    }

    const [metadata, examples] = await Promise.all([
      probeScbCompanyRegistryMetadataFromEnv(),
      fetchScbCompanyRegistryHelpExamplesFromEnv(),
    ]);

    if (metadata.status !== "ok" || examples.status !== "ok") {
      return json({
        ok: false,
        configured: false,
      }, 503);
    }

    return json({
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
        companyText: visibleHelpText(examples.companyExampleHtml),
        workplaceText: visibleHelpText(examples.workplaceExampleHtml),
      },
    });
  } catch (error) {
    return json({
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : "SCB probe failed",
    }, 502);
  }
}
