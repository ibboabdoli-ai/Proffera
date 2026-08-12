import { NextResponse } from "next/server";

import { allowPublicSubmission } from "@/lib/public-form-protection";

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

type IdealAddress = {
  line_1?: string;
  line_2?: string;
  line_3?: string;
  post_town?: string;
  postcode?: string;
  uprn?: string;
};

type IdealResponse = {
  code?: number;
  message?: string;
  result?: IdealAddress[];
  suggestions?: string[];
};

function normalizePostcode(value: string) {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

function cleanPart(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatAddress(row: IdealAddress, fallbackPostcode: string) {
  const postcode = normalizePostcode(cleanPart(row.postcode) || fallbackPostcode);
  const parts = [row.line_1, row.line_2, row.line_3, row.post_town, postcode]
    .map(cleanPart)
    .filter(Boolean);
  const unique = parts.filter((part, index) => index === 0 || part.toLowerCase() !== parts[index - 1]?.toLowerCase());
  return { address: unique.join(", "), postcode, uprn: cleanPart(row.uprn) };
}

export async function GET(request: Request) {
  const rawPostcode = new URL(request.url).searchParams.get("postcode")?.trim() ?? "";
  if (!UK_POSTCODE.test(rawPostcode)) {
    return NextResponse.json({ error: "Enter a valid UK postcode." }, { status: 400 });
  }

  const apiKey = process.env.IDEAL_POSTCODES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Address lookup is not configured." }, { status: 503 });
  }

  const allowed = await allowPublicSubmission({
    scope: "primeview_address_lookup",
    requestHeaders: request.headers,
    maxAttempts: 30,
    windowSeconds: 60 * 60,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many address lookups. Please enter the address manually." }, { status: 429 });
  }

  const postcode = normalizePostcode(rawPostcode);
  const providerUrl = `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?page=0`;

  try {
    const providerResponse = await fetch(providerUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `api_key="${apiKey.replaceAll('"', "")}"`,
      },
      cache: "no-store",
    });
    const data = (await providerResponse.json().catch(() => ({}))) as IdealResponse;

    if (providerResponse.status === 404 || data.code === 4040) {
      return NextResponse.json(
        { error: "Postcode not found.", suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 5) : [] },
        { status: 404 },
      );
    }

    if (!providerResponse.ok || (data.code && data.code !== 2000)) {
      console.error("PrimeView Ideal Postcodes lookup failed", {
        status: providerResponse.status,
        code: data.code,
      });
      return NextResponse.json({ error: "Address lookup is temporarily unavailable." }, { status: 502 });
    }

    const seen = new Set<string>();
    const addresses = (Array.isArray(data.result) ? data.result : [])
      .map((row) => formatAddress(row, postcode))
      .filter((row) => {
        const key = row.address.toLowerCase();
        if (!row.address || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return NextResponse.json(
      { postcode, addresses, count: addresses.length },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    console.error("PrimeView Ideal Postcodes lookup request failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Address lookup is temporarily unavailable." }, { status: 502 });
  }
}
