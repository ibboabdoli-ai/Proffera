import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, EyeOff, MessageSquareQuote, Star } from "lucide-react";

import { DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { primeViewWorkspaceSlug } from "@/features/primeview/review";
import { getDashboardWebsiteReviews, updateDashboardWebsiteReviewStatus } from "@/lib/website-reviews-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

const statusStyles = {
  pending: "bg-[#fff7e5] text-[#805d14]",
  approved: "bg-[#e8f5eb] text-[#17452f]",
  rejected: "bg-[#f1f3f4] text-[#5b665f]",
} as const;

function localizedHref(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

function formatDate(value: string, isEnglish: boolean) {
  return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(value));
}

async function moderateReviewAction(formData: FormData) {
  "use server";
  const reviewId = String(formData.get("review_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const isEnglish = String(formData.get("lang") ?? "") === "en";
  const status = decision === "approved" || decision === "rejected" ? decision : null;
  if (!status || !(await updateDashboardWebsiteReviewStatus(reviewId, status))) redirect(localizedHref("/dashboard/omdomen?error=1", isEnglish));
  redirect(localizedHref("/dashboard/omdomen?updated=1", isEnglish));
}

type ReviewsPageProps = { searchParams?: Promise<{ updated?: string | string[]; error?: string | string[]; lang?: string | string[] }> };

export default async function WebsiteReviewsPage({ searchParams }: ReviewsPageProps) {
  const [access, query] = await Promise.all([getUserWorkspaceAccess(), searchParams ?? Promise.resolve(undefined)]);
  const value = (key: "updated" | "error" | "lang") => { const current = query?.[key]; return Array.isArray(current) ? current[0] : current; };
  const isEnglish = value("lang") === "en";
  if (!access.ok || !canManageWorkspaceSettings(access) || access.workspaceSlug !== primeViewWorkspaceSlug) redirect(localizedHref("/dashboard", isEnglish));

  const reviews = await getDashboardWebsiteReviews();
  const pendingReviews = reviews.filter((review) => review.status === "pending");
  const publishedReviews = reviews.filter((review) => review.status === "approved");
  const hiddenReviews = reviews.filter((review) => review.status === "rejected");
  const statusLabels = isEnglish ? { pending: "Waiting for approval", approved: "Published", rejected: "Hidden" } : { pending: "Väntar på godkännande", approved: "Publicerad", rejected: "Dold" };

  return <div className="grid gap-6">
    <DashboardPageHeader eyebrow="PrimeView Window Care" title={isEnglish ? "Customer reviews" : "Kundomdömen"} description={isEnglish ? "Review every customer submission before it appears on the PrimeView website. Publishing and hiding are limited to this workspace." : "Granska varje kundomdöme innan det visas på PrimeViews webbplats. Publicering och döljning är begränsade till denna arbetsyta."} icon={MessageSquareQuote} />

    {value("updated") === "1" ? <p className="rounded-2xl bg-[#eef8f1] p-4 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]" role="status">{isEnglish ? "Review status updated." : "Omdömets status uppdaterades."}</p> : null}
    {value("error") === "1" ? <p className="rounded-2xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]" role="alert">{isEnglish ? "The review could not be updated. Please try again." : "Omdömet kunde inte uppdateras. Försök igen."}</p> : null}

    <DashboardMetricGrid items={[
      { label: isEnglish ? "Waiting" : "Väntar", value: String(pendingReviews.length), helper: isEnglish ? "New reviews to approve" : "Nya omdömen att godkänna", icon: Clock3, tone: "bg-[#fff7e5] text-[#805d14]" },
      { label: isEnglish ? "Published" : "Publicerade", value: String(publishedReviews.length), helper: isEnglish ? "Visible on PrimeView" : "Synliga på PrimeView", icon: CheckCircle2, tone: "bg-[#e8f5eb] text-[#17452f]" },
      { label: isEnglish ? "Hidden" : "Dolda", value: String(hiddenReviews.length), helper: isEnglish ? "Not visible on the site" : "Inte synliga på webbplatsen", icon: EyeOff, tone: "bg-[#f1f3f4] text-[#5b665f]" },
    ]} />

    <section className="rounded-[24px] border border-[#e0e5dd] bg-white shadow-sm">
      <div className="border-b border-[#e5e9e2] px-5 py-5 sm:px-6"><h2 className="text-lg font-bold tracking-tight text-[#17201a]">{isEnglish ? "Review queue" : "Granskningskö"}</h2><p className="mt-1 text-sm leading-6 text-[#667168]">{isEnglish ? "Approve genuine feedback, or hide anything inaccurate, private or unsuitable. Hidden reviews remain in this private queue and can be published again later." : "Godkänn äkta feedback eller dölj innehåll som är felaktigt, privat eller olämpligt. Dolda omdömen ligger kvar i den privata kön och kan publiceras senare."}</p></div>

      {reviews.length ? <div className="grid gap-4 p-5 sm:p-6">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-[#e2e7df] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#17201a]">{review.reviewerName}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[review.status]}`}>{statusLabels[review.status]}</span></div><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#5b665f]"><span className="inline-flex items-center gap-1 font-semibold text-[#a86f13]">{Array.from({ length: review.rating }, (_, index) => <Star key={index} className="size-4 fill-current" aria-hidden="true" />)}<span className="sr-only">{review.rating} {isEnglish ? "out of 5 stars" : "av 5 stjärnor"}</span></span><span>{[review.service, review.area].filter(Boolean).join(" · ") || (isEnglish ? "Service not specified" : "Tjänst inte angiven")}</span><span>· {formatDate(review.createdAt, isEnglish)}</span></div></div>
          <div className="flex flex-wrap gap-2">{review.status !== "approved" ? <form action={moderateReviewAction}><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><input type="hidden" name="review_id" value={review.id}/><button name="decision" value="approved" type="submit" className="min-h-10 rounded-xl bg-[#173e2b] px-4 text-sm font-bold text-white">{isEnglish ? "Publish" : "Publicera"}</button></form> : null}{review.status !== "rejected" ? <form action={moderateReviewAction}><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><input type="hidden" name="review_id" value={review.id}/><button name="decision" value="rejected" type="submit" className="min-h-10 rounded-xl border border-[#d7dfd5] bg-white px-4 text-sm font-bold text-[#435047]">{isEnglish ? "Hide" : "Dölj"}</button></form> : null}</div>
        </div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#435047]">{review.message}</p>
      </article>)}</div> : <p className="m-5 rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] p-6 text-sm leading-6 text-[#667168] sm:m-6">{isEnglish ? "No customer reviews have been submitted yet. New website reviews will appear here first for approval." : "Inga kundomdömen har skickats in ännu. Nya webbplatsomdömen visas först här för godkännande."}</p>}
    </section>
  </div>;
}
