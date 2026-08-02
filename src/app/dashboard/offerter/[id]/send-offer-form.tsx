"use client";

import { Copy, ExternalLink, RotateCcw, Send } from "lucide-react";
import { useActionState, useState } from "react";

import {
  sendWorkspaceQuoteOfferAction,
  type SendWorkspaceQuoteOfferState,
} from "./actions";

const initialState: SendWorkspaceQuoteOfferState = { status: "idle" };

type SendOfferCopy = {
  send: string;
  resend: string;
  sending: string;
  delivered: string;
  deliveryFailed: string;
  open: string;
  copy: string;
  copied: string;
  expires: string;
  error: string;
  deliveryNotSent: string;
  deliveryPending: string;
  deliverySent: string;
  deliveryLastFailed: string;
};

type DeliveryStatus = "not_sent" | "pending" | "sent" | "failed";

function deliveryNotice(status: DeliveryStatus, copy: SendOfferCopy) {
  switch (status) {
    case "pending": return copy.deliveryPending;
    case "sent": return copy.deliverySent;
    case "failed": return copy.deliveryLastFailed;
    default: return copy.deliveryNotSent;
  }
}

export function SendOfferForm({
  quoteRequestId,
  offerId,
  locale,
  mode,
  deliveryStatus = "not_sent",
  copy,
}: {
  quoteRequestId: string;
  offerId: string;
  locale: "sv" | "en";
  mode: "initial" | "resend";
  deliveryStatus?: DeliveryStatus;
  copy: SendOfferCopy;
}) {
  const [state, formAction, isPending] = useActionState(sendWorkspaceQuoteOfferAction, initialState);
  const [copied, setCopied] = useState(false);
  const hasPublicLink = state.status === "delivered" || state.status === "delivery_failed";
  const publicUrl = hasPublicLink && typeof window !== "undefined"
    ? `${window.location.origin}${state.publicPath}`
    : hasPublicLink
      ? state.publicPath
      : "";
  const effectiveMode = state.status === "delivery_failed" ? "resend" : mode;

  async function copyPublicUrl() {
    if (!publicUrl || !navigator.clipboard) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
  }

  return (
    <div className="grid gap-3">
      {mode === "resend" && state.status === "idle" ? (
        <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${deliveryStatus === "failed" ? "bg-[#fff4f2] text-[#8a2b20]" : "bg-[#f1f6f1] text-[#315240]"}`}>
          {deliveryNotice(deliveryStatus, copy)}
        </p>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="quoteRequestId" value={quoteRequestId} />
        <input type="hidden" name="offerId" value={offerId} />
        <input type="hidden" name="mode" value={effectiveMode} />
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          disabled={isPending || state.status === "delivered"}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0f3020] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {effectiveMode === "resend" ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
          {isPending ? copy.sending : effectiveMode === "resend" ? copy.resend : copy.send}
        </button>
      </form>

      {state.status === "error" ? (
        <p className="rounded-xl bg-[#fff4f2] px-3 py-2 text-xs font-semibold text-[#8a2b20]" role="alert">{copy.error}</p>
      ) : null}

      {hasPublicLink ? (
        <div className={`grid gap-3 rounded-2xl border p-3 text-xs ${state.status === "delivered" ? "border-[#b9d8c0] bg-[#edf8ef] text-[#173e2b]" : "border-[#e6bbb5] bg-[#fff4f2] text-[#8a2b20]"}`}>
          <p className="font-bold" role={state.status === "delivery_failed" ? "alert" : undefined}>{state.status === "delivered" ? copy.delivered : copy.deliveryFailed}</p>
          <input aria-label={copy.open} readOnly value={publicUrl} className="min-h-10 rounded-lg border border-[#b9d8c0] bg-white px-3 font-mono text-[11px] text-[#173e2b]" />
          <div className="flex flex-wrap gap-2">
            <a href={state.publicPath} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#93bf9d] bg-white px-3 py-2 font-bold text-[#17452f]">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{copy.open}
            </a>
            <button type="button" onClick={copyPublicUrl} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#93bf9d] bg-white px-3 py-2 font-bold text-[#17452f]">
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />{copied ? copy.copied : copy.copy}
            </button>
          </div>
          <p>{copy.expires}: {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(state.expiresAt))}</p>
        </div>
      ) : null}
    </div>
  );
}
