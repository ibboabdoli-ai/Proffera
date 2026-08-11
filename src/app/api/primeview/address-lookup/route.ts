import { NextResponse } from "next/server";

import { allowPublicSubmission } from "@/lib/public-form-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

type GetAddressSuggestion = {
  address?: unknown;
  id?: unknown;
};

type GetAddressResponse = {
  suggestions?: GetAddressSuggestion[];
  message?: string;
};

function normalizePostcode(value: string) {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return value.toUpperCase().trim();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export async function GET(request: Request) {
  const apiKey = process.env.GETADDRESS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Address lookup is temporarily unavailable. Enter the address manually." },
      { status: 503 },
    );
  }

  const postcode = normalizePostcode(new URL(request.url).searchParams.get("postcode") ?? "");
  if (!UK_POSTCODE.test(postcode)) {
    return NextResponse.json({ error: "Enter a valid UK postcode." }, { status: 400 });
  }

  const allowed = await allowPublicSubmission({
    scope: "primeview_address_lookup",
    requestHeaders: request.headers,
    identity: postcode,
    maxAttempts: 20,
    windowSeconds: 15 * 60,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many address lookups. Please try again shortly." }, { status: 429 });
  }

  const params = new URLSearchParams({
    "api-key": apiKey,
    all: "true",
    "show-postcode": "false",
    template: "{formatted_address}",
  });
  const url = `https://api.getAddress.io/autocomplete/${encodeURIComponent(postcode)}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await response.json().catch(() => ({}))) as GetAddressResponse;

    if (!response.ok) {
      console.error("PrimeView postcode lookup failed", response.status, data.message ?? "Unknown getAddress error");
      return NextResponse.json(
        { error: response.status === 404 ? "No addresses were found for that postcode." : "Address lookup is temporarily unavailable. Enter the address manually." },
        { status: response.status === 404 ? 404 : 502 },
      );
    }

    const seen = new Set<string>();
    const addresses = (Array.isArray(data.suggestions) ? data.suggestions : [])
      .map((item) => typeof item.address === "string" ? item.address.trim() : "")
      .filter((address) => {
        if (!address || seen.has(address)) return false;
        seen.add(address);
        return true;
      })
      .slice(0, 60);

    return NextResponse.json({ postcode, addresses });
  } catch (error) {
    console.error("PrimeView postcode lookup request failed", error);
    return NextResponse.json(
      { error: "Address lookup is temporarily unavailable. Enter the address manually." },
      { status: 502 },
    );
  }
}
