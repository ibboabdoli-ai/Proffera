import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, EyeOff, MessageSquareQuote, Star } from "lucide-react";

import { DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { primeViewWorkspaceSlug } from "@/features/primeview/review";
import { getDashboardWebsiteReviews, updateDashboardWebsiteReviewStatus } from "@/lib/website-reviews-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

const statusLabels = {
  pending: "Waiting for approval",
  approved: "Published",
  rejected: "Hidden",
} as const;

const statusStyles = {
  pending: "bg-[#fff7e5] text-[#805d14]",
  approved: "bg-[#e8f5eb] text-[#17452f]",
  rejected: "bg-[#f1f3f4] text-[#5b665f]",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(value));
}

async function moderateReviewAction(formData: FormData) {
  "use server";

  const reviewId = String(formData.get("review_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const status = decision === "approved" || decision === "rejected" ? decision : null;

  if (!status || !(await updateDashboardWebsiteReviewStatus(reviewId, status))) {
    redirect("/dashboard/omdomen?error=1");
  }

  redirect("/dashboard/omdomen?updated=1");
}

export default async function WebsiteReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; error?: string }>;
}) {
  const [access, query] = await Promise.all([getUserWorkspaceAccess(), searchParams ?? Promise.resolve(undefined)]);

  if (!access.ok || !canManageWorkspaceSettings(access) || access.workspaceSlug !== primeViewWorkspaceSlug) {
    redirect("/dashboard");
  }

  const reviews = await getDashboardWebsiteReviews();
  const pendingReviews = reviews.filter((review) => review.status === "pending");
  const publishedReviews = reviews.filter((review) => review.status === "approved");
  const hiddenReviews = reviews.filter((review) => review.status === "rejected");

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="PrimeView Window Care"
        title="Customer reviews"
        description="Review every customer submission before it appears on the PrimeView website. Publishing and hiding are limited to this workspace."
        icon={MessageSquareQuote}
      />

      {query?.updated === "1" ? <p className="rounded-2xl bg-[#eef8f1] p-4 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]" role="status">Review status updated.</p> : null}
      {query?.error === "1" ? <p className="rounded-2xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]" role="alert">The review could not be updated. Please try again.</p> : null}

      <DashboardMetricGrid
        items={[
          { label: "Waiting", value: String(pendingReviews.length), helper: "New reviews to approve", icon: Clock3, tone: "bg-[#fff7e5] text-[#805d14]" },
          { label: "Published", value: String(publishedReviews.length), helper: "Visible on PrimeView", icon: CheckCircle2, tone: "bg-[#e8f5eb] text-[#17452f]" },
          { label: "Hidden", value: String(hiddenReviews.length), helper: "Not visible on the site", icon: EyeOff, tone: "bg-[#f1f3f4] text-[#5b665f]" },
        ]}
      />

      <section className="rounded-[24px] border border-[#e0e5dd] bg-white shadow-sm">
        <div className="border-b border-[#e5e9e2] px-5 py-5 sm:px-6">
          <h2 className="text-lg font-bold tracking-tight text-[#17201a]">Review queue</h2>
          <p className="mt-1 text-sm leading-6 text-[#667168]">Approve genuine feedback, or hide anything inaccurate, private or unsuitable. Hidden reviews remain in this private queue and can be published again later.</p>
        </div>

        {reviews.length ? (
          <div className="grid gap-4 p-5 sm:p-6">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-[#e2e7df] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#17201a]">{review.reviewerName}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[review.status]}`}>{statusLabels[review.status]}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#5b665f]">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#a86f13]">{Array.from({ length: review.rating }, (_, index) => <Star key={index} className="size-4 fill-current" aria-hidden="true" />)}<span className="sr-only">{review.rating} out of 5 stars</span></span>
                      <span>{[review.service, review.area].filter(Boolean).join(" · ") || "Service not specified"}</span>
                      <span>· {formatDate(review.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {review.status !== "approved" ? (
                      <form action={moderateReviewAction}>
                        <input type="hidden" name="review_id" value={review.id} />
                        <button name="decision" value="approved" type="submit" className="min-h-10 rounded-xl bg-[#173e2b] px-4 text-sm font-bold text-white">Publish</button>
                      </form>
                    ) : null}
                    {review.status !== "rejected" ? (
                      <form action={moderateReviewAction}>
                        <input type="hidden" name="review_id" value={review.id} />
                        <button name="decision" value="rejected" type="submit" className="min-h-10 rounded-xl border border-[#d7dfd5] bg-white px-4 text-sm font-bold text-[#435047]">Hide</button>
                      </form>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#435047]">{review.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="m-5 rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] p-6 text-sm leading-6 text-[#667168] sm:m-6">No customer reviews have been submitted yet. New website reviews will appear here first for approval.</p>
        )}
      </section>
    </div>
  );
}
