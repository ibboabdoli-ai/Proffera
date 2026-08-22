import Link from "next/link";

import { requireAdminArea } from "@/lib/admin-authorization";
import { listMarketplaceReviewModerationItems } from "@/lib/marketplace-review-moderation";

export const dynamic = "force-dynamic";

export default async function MarketplaceReviewsAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string | string[] }>;
}) {
  await requireAdminArea("quote_admin");
  const query = await (searchParams ?? Promise.resolve(undefined));
  const statusValue = Array.isArray(query?.status) ? query?.status[0] : query?.status;
  const reviews = await listMarketplaceReviewModerationItems();
  const pending = reviews.filter((review) => review.status === "pending");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Marketplace</p>
            <h1 className="mt-2 text-3xl font-black">Verifierade omdömen</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Endast omdömen kopplade till ett verkligt slutfört Marketplace-jobb visas här. Godkända omdömen påverkar företagets verifierade reputation.</p>
          </div>
          <Link href="/admin/marketplace" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Till Marketplace</Link>
        </div>

        {statusValue ? <p className="mt-6 rounded-xl bg-white px-4 py-3 text-sm font-semibold shadow-sm ring-1 ring-slate-200">Status: {statusValue}</p> : null}

        <section className="mt-7 grid gap-5">
          {pending.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-slate-600 shadow-sm ring-1 ring-slate-200">Inga väntande Marketplace-omdömen.</div>
          ) : pending.map((review) => (
            <article key={review.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-black">{review.companyName}</p>
                  <p className="mt-1 text-sm text-slate-600">{review.service}{review.area ? ` · ${review.area}` : ""}</p>
                </div>
                <div className="rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-800">{review.rating}/5</div>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="font-bold">{review.reviewerName}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.message}</p>
              </div>

              <form action="/api/admin/marketplace/reviews" method="post" className="mt-5 grid gap-3">
                <input type="hidden" name="reviewId" value={review.id} />
                <label className="grid gap-2 text-sm font-bold">Moderationsanteckning<textarea name="reason" maxLength={1000} rows={2} className="rounded-xl border border-slate-300 p-3 font-normal" /></label>
                <div className="flex flex-wrap gap-3">
                  <button name="decision" value="approved" className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white" type="submit">Godkänn verifierat omdöme</button>
                  <button name="decision" value="rejected" className="rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white" type="submit">Avvisa</button>
                </div>
              </form>
            </article>
          ))}
        </section>

        {reviews.some((review) => review.status !== "pending") ? (
          <section className="mt-10">
            <h2 className="text-xl font-black">Senast modererade</h2>
            <div className="mt-4 grid gap-3">
              {reviews.filter((review) => review.status !== "pending").slice(0, 20).map((review) => (
                <div key={review.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
                  <span><strong>{review.companyName}</strong> · {review.rating}/5 · {review.reviewerName}</span>
                  <span className={review.status === "approved" ? "font-bold text-emerald-700" : "font-bold text-red-700"}>{review.status}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
