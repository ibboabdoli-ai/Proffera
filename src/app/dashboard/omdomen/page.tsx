import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  EyeOff,
  Link2,
  MessageSquareQuote,
  MessageSquareReply,
  PencilLine,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

import {
  DashboardMetricGrid,
  DashboardPageHeader,
} from "@/components/dashboard/dashboard-page-ui";
import {
  deleteDashboardWebsiteReview,
  getDashboardWebsiteReviews,
  updateDashboardWebsiteReview,
  updateDashboardWebsiteReviewPresentation,
  updateDashboardWebsiteReviewStatus,
} from "@/lib/website-reviews-db";
import { getReviewInvitationDashboardContext } from "@/lib/verified-review-invitations";
import {
  canManageWorkspaceSettings,
  getUserWorkspaceAccess,
} from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

const statusStyles = {
  pending: "bg-[#fff7e5] text-[#805d14]",
  approved: "bg-[#e8f5eb] text-[#17452f]",
  rejected: "bg-[#f1f3f4] text-[#5b665f]",
} as const;

function localizedHref(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

function formatDate(value: string, isEnglish: boolean, timeZone: string) {
  return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", {
    dateStyle: "medium",
    timeZone,
  }).format(new Date(value));
}

async function moderateReviewAction(formData: FormData) {
  "use server";
  const reviewId = String(formData.get("review_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const isEnglish = String(formData.get("lang") ?? "") === "en";
  const status = decision === "approved" || decision === "rejected" ? decision : null;

  if (!status || !(await updateDashboardWebsiteReviewStatus(reviewId, status))) {
    redirect(localizedHref("/dashboard/omdomen?error=1", isEnglish));
  }
  redirect(localizedHref("/dashboard/omdomen?updated=1", isEnglish));
}

async function editReviewAction(formData: FormData) {
  "use server";
  const reviewId = String(formData.get("review_id") ?? "");
  const isEnglish = String(formData.get("lang") ?? "") === "en";
  const updated = await updateDashboardWebsiteReview(reviewId, {
    reviewerName: formData.get("reviewer_name"),
    rating: formData.get("rating"),
    service: formData.get("service"),
    area: formData.get("area"),
    message: formData.get("message"),
  });

  if (!updated) {
    redirect(localizedHref("/dashboard/omdomen?error=1", isEnglish));
  }
  redirect(localizedHref("/dashboard/omdomen?updated=1", isEnglish));
}

async function presentationReviewAction(formData: FormData) {
  "use server";
  const reviewId = String(formData.get("review_id") ?? "");
  const isEnglish = String(formData.get("lang") ?? "") === "en";
  const updated = await updateDashboardWebsiteReviewPresentation(reviewId, {
    ownerReply: formData.get("owner_reply"),
    isFeatured: formData.get("is_featured") === "true",
  });

  if (!updated) {
    redirect(localizedHref("/dashboard/omdomen?error=1", isEnglish));
  }
  redirect(localizedHref("/dashboard/omdomen?updated=1", isEnglish));
}

async function deleteReviewAction(formData: FormData) {
  "use server";
  const reviewId = String(formData.get("review_id") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim().toUpperCase();
  const isEnglish = String(formData.get("lang") ?? "") === "en";

  if (confirmation !== "DELETE" || !(await deleteDashboardWebsiteReview(reviewId))) {
    redirect(localizedHref("/dashboard/omdomen?error=1", isEnglish));
  }
  redirect(localizedHref("/dashboard/omdomen?deleted=1", isEnglish));
}

type ReviewsPageProps = {
  searchParams?: Promise<{
    updated?: string | string[];
    deleted?: string | string[];
    error?: string | string[];
    lang?: string | string[];
  }>;
};

export default async function WebsiteReviewsPage({ searchParams }: ReviewsPageProps) {
  const [access, query] = await Promise.all([
    getUserWorkspaceAccess(),
    searchParams ?? Promise.resolve(undefined),
  ]);
  const value = (key: "updated" | "deleted" | "error" | "lang") => {
    const current = query?.[key];
    return Array.isArray(current) ? current[0] : current;
  };
  const isEnglish = value("lang") === "en";

  if (!access.ok || !canManageWorkspaceSettings(access)) {
    redirect(localizedHref("/dashboard", isEnglish));
  }

  const [reviews, context] = await Promise.all([
    getDashboardWebsiteReviews(),
    getReviewInvitationDashboardContext(),
  ]);
  if (!context) redirect(localizedHref("/dashboard", isEnglish));

  const pendingReviews = reviews.filter((review) => review.status === "pending");
  const publishedReviews = reviews.filter(
    (review) => review.status === "approved" && review.isVerified,
  );
  const hiddenReviews = reviews.filter((review) => review.status === "rejected");
  const featuredReviews = publishedReviews.filter((review) => review.isFeatured);
  const statusLabels = isEnglish
    ? { pending: "Waiting for approval", approved: "Approved", rejected: "Hidden" }
    : { pending: "Väntar på godkännande", approved: "Godkänd", rejected: "Dold" };

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow={context.companyName}
        title={isEnglish ? "Customer reviews" : "Kundomdömen"}
        description={
          isEnglish
            ? "Issue secure invitations after completed bookings and moderate verified feedback before publication."
            : "Skapa säkra inbjudningar efter slutförda bokningar och granska verifierad feedback före publicering."
        }
        icon={MessageSquareQuote}
      />

      <div className="flex flex-wrap gap-3">
        <Link
          href={localizedHref("/dashboard/omdomen/inbjudningar", isEnglish)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-4 text-sm font-bold text-white"
        >
          <Link2 className="size-4" aria-hidden="true" />
          {isEnglish ? "Review invitations" : "Omdömesinbjudningar"}
        </Link>
      </div>

      {value("updated") === "1" ? (
        <p className="rounded-2xl bg-[#eef8f1] p-4 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]" role="status">
          {isEnglish ? "Review updated." : "Omdömet uppdaterades."}
        </p>
      ) : null}
      {value("deleted") === "1" ? (
        <p className="rounded-2xl bg-[#eef8f1] p-4 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]" role="status">
          {isEnglish ? "Review permanently deleted." : "Omdömet raderades permanent."}
        </p>
      ) : null}
      {value("error") === "1" ? (
        <p className="rounded-2xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]" role="alert">
          {isEnglish ? "The review could not be updated." : "Omdömet kunde inte uppdateras."}
        </p>
      ) : null}

      <DashboardMetricGrid
        items={[
          {
            label: isEnglish ? "Waiting" : "Väntar",
            value: String(pendingReviews.length),
            helper: isEnglish ? "Reviews to moderate" : "Omdömen att granska",
            icon: Clock3,
            tone: "bg-[#fff7e5] text-[#805d14]",
          },
          {
            label: isEnglish ? "Published verified" : "Publicerade verifierade",
            value: String(publishedReviews.length),
            helper: isEnglish ? "Eligible for public display" : "Kan visas offentligt",
            icon: CheckCircle2,
            tone: "bg-[#e8f5eb] text-[#17452f]",
          },
          {
            label: isEnglish ? "Featured" : "Utvalda",
            value: String(featuredReviews.length),
            helper: isEnglish ? "Shown first on the website" : "Visas först på webbplatsen",
            icon: Sparkles,
            tone: "bg-[#fff7e5] text-[#805d14]",
          },
          {
            label: isEnglish ? "Hidden" : "Dolda",
            value: String(hiddenReviews.length),
            helper: isEnglish ? "Not visible publicly" : "Visas inte offentligt",
            icon: EyeOff,
            tone: "bg-[#f1f3f4] text-[#5b665f]",
          },
        ]}
      />

      <section className="rounded-[24px] border border-[#e0e5dd] bg-white shadow-sm">
        <div className="border-b border-[#e5e9e2] px-5 py-5 sm:px-6">
          <h2 className="text-lg font-bold tracking-tight text-[#17201a]">
            {isEnglish ? "Review queue" : "Granskningskö"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#667168]">
            {isEnglish
              ? "Only approved verified reviews can appear publicly. Add an owner reply and feature the strongest reviews after publication."
              : "Endast godkända verifierade omdömen kan visas offentligt. Lägg till företagets svar och markera de starkaste omdömena som utvalda efter publicering."}
          </p>
        </div>

        {reviews.length ? (
          <div className="grid gap-4 p-5 sm:p-6">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-[#e2e7df] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#17201a]">{review.reviewerName}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[review.status]}`}>
                        {statusLabels[review.status]}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${review.isVerified ? "bg-[#e8f5eb] text-[#17452f]" : "bg-[#fff3e8] text-[#8a4d13]"}`}>
                        {review.isVerified ? <BadgeCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
                        {review.isVerified
                          ? isEnglish
                            ? "Verified booking"
                            : "Verifierad bokning"
                          : isEnglish
                            ? "Legacy unverified"
                            : "Äldre overifierad"}
                      </span>
                      {review.isFeatured ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7e5] px-2.5 py-1 text-xs font-bold text-[#805d14]">
                          <Sparkles className="size-3.5" aria-hidden="true" />
                          {isEnglish ? "Featured" : "Utvald"}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#5b665f]">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#a86f13]">
                        {Array.from({ length: review.rating }, (_, index) => (
                          <Star key={index} className="size-4 fill-current" aria-hidden="true" />
                        ))}
                      </span>
                      <span>
                        {[review.service, review.area].filter(Boolean).join(" · ") ||
                          (isEnglish ? "Service not specified" : "Tjänst inte angiven")}
                      </span>
                      <span>· {formatDate(review.createdAt, isEnglish, context.timeZone)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {review.status !== "approved" ? (
                      <form action={moderateReviewAction}>
                        <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
                        <input type="hidden" name="review_id" value={review.id} />
                        <button name="decision" value="approved" type="submit" className="min-h-10 rounded-xl bg-[#173e2b] px-4 text-sm font-bold text-white">
                          {review.isVerified
                            ? isEnglish
                              ? "Publish"
                              : "Publicera"
                            : isEnglish
                              ? "Approve privately"
                              : "Godkänn privat"}
                        </button>
                      </form>
                    ) : null}
                    {review.status !== "rejected" ? (
                      <form action={moderateReviewAction}>
                        <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
                        <input type="hidden" name="review_id" value={review.id} />
                        <button name="decision" value="rejected" type="submit" className="min-h-10 rounded-xl border border-[#d7dfd5] bg-white px-4 text-sm font-bold text-[#435047]">
                          {isEnglish ? "Hide" : "Dölj"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#435047]">
                  {review.message}
                </p>

                {review.ownerReply ? (
                  <div className="mt-4 rounded-2xl border border-[#d5e7da] bg-[#f1f8f3] p-4">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#17452f]">
                      <MessageSquareReply className="size-4" aria-hidden="true" />
                      {isEnglish ? "Owner reply" : "Företagets svar"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#36423a]">{review.ownerReply}</p>
                  </div>
                ) : null}

                {review.status === "approved" && review.isVerified ? (
                  <details className="mt-4 rounded-2xl border border-[#d5e7da] bg-[#f7faf7] open:bg-white">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold text-[#17452f]">
                      <MessageSquareReply className="size-4" aria-hidden="true" />
                      {isEnglish ? "Owner reply & featured" : "Företagets svar & utvald"}
                    </summary>
                    <form action={presentationReviewAction} className="grid gap-4 border-t border-[#d5e7da] p-4">
                      <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
                      <input type="hidden" name="review_id" value={review.id} />
                      <label className="grid gap-1.5 text-sm font-semibold text-[#36423a]">
                        {isEnglish ? "Public owner reply" : "Offentligt svar från företaget"}
                        <textarea
                          name="owner_reply"
                          defaultValue={review.ownerReply ?? ""}
                          maxLength={1_000}
                          rows={4}
                          placeholder={isEnglish ? "Thank the customer or respond to their feedback..." : "Tacka kunden eller svara på feedbacken..."}
                          className="rounded-xl border border-[#cfd8cd] bg-white px-3 py-2 font-normal leading-6"
                        />
                      </label>
                      <label className="flex items-start gap-3 rounded-xl border border-[#e2e7df] bg-[#f7f9f6] p-4 text-sm leading-6 text-[#435047]">
                        <input
                          name="is_featured"
                          value="true"
                          type="checkbox"
                          defaultChecked={review.isFeatured}
                          className="mt-1 size-4 shrink-0"
                        />
                        <span>
                          <strong className="block text-[#17201a]">{isEnglish ? "Feature this review" : "Markera som utvalt omdöme"}</strong>
                          {isEnglish ? "Featured reviews are shown first on the public website." : "Utvalda omdömen visas först på den offentliga webbplatsen."}
                        </span>
                      </label>
                      <div>
                        <button type="submit" className="min-h-11 rounded-xl bg-[#173e2b] px-4 text-sm font-bold text-white">
                          {isEnglish ? "Save reply & display" : "Spara svar & visning"}
                        </button>
                      </div>
                    </form>
                  </details>
                ) : null}

                <details className="mt-3 rounded-2xl border border-[#e2e7df] bg-[#f7f9f6] open:bg-white">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold text-[#435047]">
                    <PencilLine className="size-4" aria-hidden="true" />
                    {isEnglish ? "Edit review" : "Redigera omdöme"}
                  </summary>
                  <form action={editReviewAction} className="grid gap-4 border-t border-[#e2e7df] p-4">
                    <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
                    <input type="hidden" name="review_id" value={review.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-sm font-semibold text-[#36423a]">
                        {isEnglish ? "Customer display name" : "Kundens visningsnamn"}
                        <input
                          name="reviewer_name"
                          defaultValue={review.reviewerName}
                          required
                          minLength={2}
                          maxLength={80}
                          className="min-h-11 rounded-xl border border-[#cfd8cd] bg-white px-3 font-normal"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-[#36423a]">
                        {isEnglish ? "Rating" : "Betyg"}
                        <select
                          name="rating"
                          defaultValue={String(review.rating)}
                          className="min-h-11 rounded-xl border border-[#cfd8cd] bg-white px-3 font-normal"
                        >
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={rating} value={rating}>
                              {rating} / 5
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-[#36423a]">
                        {isEnglish ? "Service" : "Tjänst"}
                        <input
                          name="service"
                          defaultValue={review.service ?? ""}
                          maxLength={120}
                          className="min-h-11 rounded-xl border border-[#cfd8cd] bg-white px-3 font-normal"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-[#36423a]">
                        {isEnglish ? "Area" : "Område"}
                        <input
                          name="area"
                          defaultValue={review.area ?? ""}
                          maxLength={120}
                          className="min-h-11 rounded-xl border border-[#cfd8cd] bg-white px-3 font-normal"
                        />
                      </label>
                    </div>
                    <label className="grid gap-1.5 text-sm font-semibold text-[#36423a]">
                      {isEnglish ? "Review text" : "Omdömestext"}
                      <textarea
                        name="message"
                        defaultValue={review.message}
                        required
                        minLength={10}
                        maxLength={1_000}
                        rows={5}
                        className="rounded-xl border border-[#cfd8cd] bg-white px-3 py-2 font-normal leading-6"
                      />
                    </label>
                    <div>
                      <button type="submit" className="min-h-11 rounded-xl bg-[#173e2b] px-4 text-sm font-bold text-white">
                        {isEnglish ? "Save changes" : "Spara ändringar"}
                      </button>
                    </div>
                  </form>
                </details>

                <details className="mt-3 rounded-2xl border border-[#f0c9bf] bg-[#fff8f6] open:bg-white">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold text-[#8f2f1b]">
                    <Trash2 className="size-4" aria-hidden="true" />
                    {isEnglish ? "Permanently delete review" : "Radera omdömet permanent"}
                  </summary>
                  <form action={deleteReviewAction} className="grid gap-4 border-t border-[#f0c9bf] p-4">
                    <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
                    <input type="hidden" name="review_id" value={review.id} />
                    <p className="text-sm leading-6 text-[#6f3b30]">
                      {isEnglish
                        ? "This cannot be undone. Type DELETE to confirm. The action is recorded in the audit log."
                        : "Detta går inte att ångra. Skriv DELETE för att bekräfta. Åtgärden registreras i auditloggen."}
                    </p>
                    <label className="grid max-w-sm gap-1.5 text-sm font-semibold text-[#6f3b30]">
                      {isEnglish ? "Confirmation" : "Bekräftelse"}
                      <input
                        name="confirmation"
                        required
                        pattern="DELETE"
                        autoComplete="off"
                        placeholder="DELETE"
                        className="min-h-11 rounded-xl border border-[#dcae9f] bg-white px-3 font-normal uppercase"
                      />
                    </label>
                    <div>
                      <button type="submit" className="min-h-11 rounded-xl bg-[#9f2f1d] px-4 text-sm font-bold text-white">
                        {isEnglish ? "Delete permanently" : "Radera permanent"}
                      </button>
                    </div>
                  </form>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <p className="m-5 rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] p-6 text-sm leading-6 text-[#667168] sm:m-6">
            {isEnglish
              ? "No customer reviews have been submitted yet."
              : "Inga kundomdömen har skickats in ännu."}
          </p>
        )}
      </section>
    </div>
  );
}
