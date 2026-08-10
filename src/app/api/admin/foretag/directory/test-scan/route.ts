import { NextResponse } from "next/server";

import { BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS } from "@/lib/company-directory-bolagsverket-testdata";
import { previewCompanyDirectorySource } from "@/lib/company-directory-source-preview-admin";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 5;

function safeOffset(raw: string | null) {
  const parsed = Number.parseInt(raw ?? "0", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.length);
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "TEST scan is disabled in Production" }, { status: 404 });
  }

  const url = new URL(request.url);
  const offset = safeOffset(url.searchParams.get("offset"));
  const organizationNumbers = BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.slice(offset, offset + BATCH_SIZE);

  if (!organizationNumbers.length) {
    return NextResponse.json({
      offset,
      nextOffset: null,
      total: BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.length,
      results: [],
    });
  }

  try {
    const preview = await previewCompanyDirectorySource(organizationNumbers.length, [...organizationNumbers]);
    const nextOffset = offset + organizationNumbers.length < BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.length
      ? offset + organizationNumbers.length
      : null;

    return NextResponse.json({
      offset,
      nextOffset,
      total: BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.length,
      provider: preview.provider,
      results: preview.results.map((result) => result.ok ? {
        ok: true as const,
        organizationNumber: result.candidate.organizationNumber,
        legalName: result.candidate.legalName,
        legalForm: result.candidate.legalForm,
        city: result.candidate.city,
        municipality: result.candidate.municipality,
        sniCode: result.candidate.primarySniCode,
        sniLabel: result.candidate.primarySniLabel,
        isActive: result.candidate.isActive,
        score: result.assessment.score,
        publicationStatus: result.assessment.publicationStatus,
        reasons: result.assessment.reasons,
        category: result.assessment.category?.categoryLabel ?? "",
      } : {
        ok: false as const,
        organizationNumber: result.organizationNumber,
        error: result.error,
      }),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Automatiskt Källtest misslyckades",
    }, { status: 500 });
  }
}
