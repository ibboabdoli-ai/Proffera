import { getPublicWorkspaceQuoteOffer } from "@/lib/workspace-quote-offers-db";
import {
  createPublicWorkspaceQuoteOfferPdf,
  publicWorkspaceQuoteOfferPdfFilename,
} from "@/lib/workspace-quote-offer-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localeFrom(request: Request) {
  return new URL(request.url).searchParams.get("lang") === "en" ? "en" : "sv";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const offer = await getPublicWorkspaceQuoteOffer(token);

  if (!offer) {
    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const locale = localeFrom(request);
  const pdf = await createPublicWorkspaceQuoteOfferPdf(offer, locale);
  const filename = publicWorkspaceQuoteOfferPdfFilename(offer.quoteReferenceId);
  const body = new Uint8Array(pdf.byteLength);
  body.set(pdf);

  return new Response(body.buffer, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
