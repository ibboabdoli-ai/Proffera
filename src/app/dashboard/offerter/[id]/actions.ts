"use server";

import {
  sendDashboardWorkspaceQuoteOffer,
} from "@/lib/workspace-quote-offers-db";
import { publicWorkspaceQuoteOfferPath } from "@/lib/workspace-quote-offer-public";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SendWorkspaceQuoteOfferState =
  | { status: "idle" }
  | { status: "error" }
  | { status: "sent"; publicPath: string; expiresAt: string };

export async function sendWorkspaceQuoteOfferAction(
  _previousState: SendWorkspaceQuoteOfferState,
  formData: FormData,
): Promise<SendWorkspaceQuoteOfferState> {
  const quoteRequestId = String(formData.get("quoteRequestId") ?? "");
  const offerId = String(formData.get("offerId") ?? "");

  if (!uuidPattern.test(quoteRequestId) || !uuidPattern.test(offerId)) {
    return { status: "error" };
  }

  try {
    const delivery = await sendDashboardWorkspaceQuoteOffer(quoteRequestId, offerId);

    return {
      status: "sent",
      publicPath: publicWorkspaceQuoteOfferPath(delivery.token),
      expiresAt: delivery.expiresAt,
    };
  } catch {
    return { status: "error" };
  }
}
