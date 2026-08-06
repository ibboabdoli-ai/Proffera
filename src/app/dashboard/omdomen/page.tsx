import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  EyeOff,
  Link2,
  MessageSquareQuote,
  ShieldAlert,
  Star,
} from "lucide-react";

import {
  DashboardMetricGrid,
  DashboardPageHeader,
} from "@/components/dashboard/dashboard-page-ui";
import {
  getDashboardWebsiteReviews,
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

type ReviewsPageProps = {
  searchParams?: Promise<{
    updated?: string | string[];
    error?: string | string[];
    lang?: string | string[];
  }>;
};

export default async function WebsiteReviewsPage({ searchParams }: ReviewsPageProps) {
  const [access, query] = await Promise.all([
    getUserWorkspaceAccess(),
    searchParams ?? Promise.resolve(undefined),
  ]);
  const value = (key: "updated" | "error" | "lang") => {
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
          {isEnglish ? "Review status updated." : "Omdömets status uppdaterades."}
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
              ? "Only approved reviews carrying the verified badge can appear publicly. Older unverified records remain private even when approved."
              : "Endast godkända omdömen med verifieringsmärke kan visas offentligt. Äldre overifierade poster förblir privata även om de godkänns."}
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
