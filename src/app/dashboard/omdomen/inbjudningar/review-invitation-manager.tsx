"use client";

import { useState } from "react";
import { Check, Copy, Link2, LoaderCircle, RotateCw } from "lucide-react";

import type { ReviewInvitationCandidate } from "@/features/reviews/verified-review";

type ReviewInvitationManagerProps = {
  candidates: ReviewInvitationCandidate[];
  isEnglish: boolean;
};

type CreatedInvitation = {
  bookingId: string;
  bookingTitle: string;
  customerName: string | null;
  customerEmail: string | null;
  expiresAt: string;
  reviewUrl: string;
};

function formatDate(value: string | null, isEnglish: boolean) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function ReviewInvitationManager({
  candidates,
  isEnglish,
}: ReviewInvitationManagerProps) {
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function issue(bookingId: string) {
    if (pendingBookingId) return;
    setPendingBookingId(bookingId);
    setCreated(null);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/dashboard/review-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const result = (await response.json().catch(() => null)) as
        | (CreatedInvitation & { error?: never })
        | { error?: string }
        | null;

      if (!response.ok || !result || !("reviewUrl" in result)) {
        throw new Error(
          result && "error" in result && result.error
            ? result.error
            : isEnglish
              ? "The invitation could not be created."
              : "Inbjudan kunde inte skapas.",
        );
      }

      setCreated(result);
    } catch (issueError) {
      setError(
        issueError instanceof Error
          ? issueError.message
          : isEnglish
            ? "The invitation could not be created."
            : "Inbjudan kunde inte skapas.",
      );
    } finally {
      setPendingBookingId(null);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.reviewUrl);
      setCopied(true);
    } catch {
      setError(
        isEnglish
          ? "Copying failed. Select and copy the link manually."
          : "Kopieringen misslyckades. Markera och kopiera länken manuellt.",
      );
    }
  }

  return (
    <div className="grid gap-5">
      {created ? (
        <section className="rounded-2xl border border-[#bcdcc5] bg-[#eef8f1] p-5 text-[#17452f]">
          <p className="text-sm font-black uppercase tracking-[0.13em]">
            {isEnglish ? "Copy this link now" : "Kopiera länken nu"}
          </p>
          <p className="mt-2 text-sm leading-6">
            {isEnglish
              ? "The raw token is shown only in this response and is not stored in the database."
              : "Den råa token visas bara i detta svar och lagras inte i databasen."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={created.reviewUrl}
              className="min-w-0 flex-1 rounded-xl border border-[#bcdcc5] bg-white px-3 py-2 text-sm text-[#173e2b]"
              aria-label={isEnglish ? "Review link" : "Omdömeslänk"}
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-4 text-sm font-bold text-white"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied
                ? isEnglish
                  ? "Copied"
                  : "Kopierad"
                : isEnglish
                  ? "Copy link"
                  : "Kopiera länk"}
            </button>
          </div>
          <p className="mt-3 text-xs">
            {isEnglish ? "Expires:" : "Gäller till:"}{" "}
            {formatDate(created.expiresAt, isEnglish)}
          </p>
        </section>
      ) : null}

      {error ? (
        <p
          className="rounded-2xl border border-[#f4c7ba] bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {candidates.length ? (
        <div className="overflow-x-auto rounded-2xl border border-[#e0e5dd] bg-white">
          <table className="min-w-full divide-y divide-[#e5e9e2] text-sm">
            <thead className="bg-[#f7f9f6] text-left text-xs uppercase tracking-wide text-[#667168]">
              <tr>
                <th className="px-4 py-3">{isEnglish ? "Booking" : "Bokning"}</th>
                <th className="px-4 py-3">{isEnglish ? "Customer" : "Kund"}</th>
                <th className="px-4 py-3">{isEnglish ? "Invitation" : "Inbjudan"}</th>
                <th className="px-4 py-3">{isEnglish ? "Action" : "Åtgärd"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0eb]">
              {candidates.map((candidate) => {
                const used = candidate.invitationStatus === "used";
                const reissue = ["pending", "expired", "revoked"].includes(
                  candidate.invitationStatus,
                );
                const isPending = pendingBookingId === candidate.bookingId;

                return (
                  <tr key={candidate.bookingId}>
                    <td className="px-4 py-4">
                      <p className="font-bold text-[#17201a]">{candidate.title}</p>
                      <p className="mt-1 text-xs text-[#667168]">
                        {candidate.service}
                        {candidate.area ? ` · ${candidate.area}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-[#667168]">
                        {formatDate(candidate.startsAt, isEnglish)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-[#435047]">
                      <p>{candidate.customerName ?? "—"}</p>
                      <p className="mt-1 text-xs text-[#667168]">
                        {candidate.customerEmail ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-[#f1f3f4] px-2.5 py-1 text-xs font-bold text-[#5b665f]">
                        {candidate.invitationStatus}
                      </span>
                      {candidate.invitationExpiresAt ? (
                        <p className="mt-2 text-xs text-[#667168]">
                          {formatDate(candidate.invitationExpiresAt, isEnglish)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        disabled={used || Boolean(pendingBookingId)}
                        onClick={() => issue(candidate.bookingId)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPending ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : reissue ? (
                          <RotateCw className="size-4" />
                        ) : (
                          <Link2 className="size-4" />
                        )}
                        {used
                          ? isEnglish
                            ? "Already used"
                            : "Redan använd"
                          : reissue
                            ? isEnglish
                              ? "Create new link"
                              : "Skapa ny länk"
                            : isEnglish
                              ? "Create link"
                              : "Skapa länk"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] p-6 text-sm leading-6 text-[#667168]">
          {isEnglish
            ? "No completed bookings are available for a review invitation."
            : "Det finns inga slutförda bokningar som kan få en omdömesinbjudan."}
        </p>
      )}
    </div>
  );
}
