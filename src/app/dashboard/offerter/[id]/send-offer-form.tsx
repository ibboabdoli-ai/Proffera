"use client";

import { Copy, ExternalLink, Send } from "lucide-react";
import { useActionState, useState } from "react";

import {
  sendWorkspaceQuoteOfferAction,
  type SendWorkspaceQuoteOfferState,
} from "./actions";

const initialState: SendWorkspaceQuoteOfferState = { status: "idle" };

type Copy = {
  send: string;
  sending: string;
  sent: string;
  open: string;
  copy: string;
  copied: string;
  expires: string;
  error: string;
};

export function SendOfferForm({
  quoteRequestId,
  offerId,
  locale,
  copy,
}: {
  quoteRequestId: string;
  offerId: string;
  locale: "sv" | "en";
  copy: Copy;
}) {
  const [state, formAction, isPending] = useActionState(sendWorkspaceQuoteOfferAction, initialState);
  const [copied, setCopied] = useState(false);
  const publicUrl = state.status === "sent" && typeof window !== "undefined"
    ? `${window.location.origin}${state.publicPath}`
    : state.status === "sent"
      ? state.publicPath
      : "";

  async function copyPublicUrl() {
    if (!publicUrl || !navigator.clipboard) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
  }

  return (
    <div className="grid gap-3">
      <form action={formAction}>
        <input type="hidden" name="quoteRequestId" value={quoteRequestId} />
        <input type="hidden" name="offerId" value={offerId} />
        <button
          type="submit"
          disabled={isPending || state.status === "sent"}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0f3020] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {isPending ? copy.sending : copy.send}
        </button>
      </form>

      {state.status === "error" ? (
        <p className="rounded-xl bg-[#fff4f2] px-3 py-2 text-xs font-semibold text-[#8a2b20]" role="alert">{copy.error}</p>
      ) : null}

      {state.status === "sent" ? (
        <div className="grid gap-3 rounded-2xl border border-[#b9d8c0] bg-[#edf8ef] p-3 text-xs text-[#173e2b]">
          <p className="font-bold">{copy.sent}</p>
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
