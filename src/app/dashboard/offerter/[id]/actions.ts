"use server";

import {
  completeDashboardWorkspaceQuoteOfferEmailDelivery,
  prepareDashboardWorkspaceQuoteOfferEmailDelivery,
} from "@/lib/workspace-quote-offers-db";
import {
  publicWorkspaceQuoteOfferPath,
  publicWorkspaceQuoteOfferPdfPath,
} from "@/lib/workspace-quote-offer-public";
import {
  createPublicWorkspaceQuoteOfferPdf,
  publicWorkspaceQuoteOfferPdfFilename,
} from "@/lib/workspace-quote-offer-pdf";
import { sendWorkspaceQuoteOfferEmail } from "@/features/email/workspace-quote-offer-email";
import { siteConfig } from "@/lib/site";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SendWorkspaceQuoteOfferState =
  | { status: "idle" }
  | { status: "error" }
  | { status: "delivered"; publicPath: string; expiresAt: string }
  | { status: "delivery_failed"; publicPath: string; expiresAt: string };

export async function sendWorkspaceQuoteOfferAction(
  _previousState: SendWorkspaceQuoteOfferState,
  formData: FormData,
): Promise<SendWorkspaceQuoteOfferState> {
  const quoteRequestId = String(formData.get("quoteRequestId") ?? "");
  const offerId = String(formData.get("offerId") ?? "");
  const mode = formData.get("mode") === "resend" ? "resend" : "initial";
  const locale = formData.get("locale") === "en" ? "en" : "sv";

  if (!uuidPattern.test(quoteRequestId) || !uuidPattern.test(offerId)) {
    return { status: "error" };
  }

  try {
    const delivery = await prepareDashboardWorkspaceQuoteOfferEmailDelivery(quoteRequestId, offerId, mode);
    const publicPath = `${publicWorkspaceQuoteOfferPath(delivery.token)}${locale === "en" ? "?lang=en" : ""}`;
    const pdfPath = `${publicWorkspaceQuoteOfferPdfPath(delivery.token)}${locale === "en" ? "?lang=en" : ""}`;
    const emailResult = await (async () => {
      try {
        const pdfBytes = await createPublicWorkspaceQuoteOfferPdf({
          status: "sent",
          companyName: delivery.companyName,
          quoteReferenceId: delivery.quoteReferenceId,
          customerName: delivery.customerName,
          currency: delivery.currency,
          subtotalMinor: delivery.subtotalMinor,
          vatRateBasisPoints: delivery.vatRateBasisPoints,
          vatAmountMinor: delivery.vatAmountMinor,
          totalMinor: delivery.totalMinor,
          title: delivery.title,
          terms: delivery.terms,
          validUntil: delivery.validUntil,
          sentAt: delivery.sentAt,
          acceptedAt: "",
          rejectedAt: "",
        }, locale);
        return sendWorkspaceQuoteOfferEmail({
          customerName: delivery.customerName,
          customerEmail: delivery.customerEmail,
          companyName: delivery.companyName,
          quoteReferenceId: delivery.quoteReferenceId,
          title: delivery.title,
          currency: delivery.currency,
          totalMinor: delivery.totalMinor,
          validUntil: delivery.validUntil,
          offerUrl: new URL(publicPath, siteConfig.url).toString(),
          pdfUrl: new URL(pdfPath, siteConfig.url).toString(),
          pdfFilename: publicWorkspaceQuoteOfferPdfFilename(delivery.quoteReferenceId),
          pdfBytes,
          locale,
        });
      } catch {
        return { ok: false as const, code: "rendering" as const };
      }
    })();

    await completeDashboardWorkspaceQuoteOfferEmailDelivery(
      offerId,
      delivery.attempt,
      delivery.tokenHash,
      emailResult.ok
        ? { status: "sent", providerMessageId: emailResult.providerMessageId }
        : { status: "failed", failureCode: emailResult.code },
    );

    return {
      status: emailResult.ok ? "delivered" : "delivery_failed",
      publicPath,
      expiresAt: delivery.expiresAt,
    };
  } catch {
    return { status: "error" };
  }
}
