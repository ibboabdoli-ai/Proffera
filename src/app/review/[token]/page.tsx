import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Clock3, ShieldCheck } from "lucide-react";

import { primeViewSite } from "@/lib/primeview-seo";
import { getVerifiedReviewInvitation } from "@/lib/verified-review-invitations";
import { VerifiedReviewForm } from "./verified-review-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verified customer review | PrimeView Window Care",
  robots: { index: false, follow: false },
};

type ReviewPageProps = {
  params: Promise<{ token: string }>;
};

const stateContent = {
  invalid: {
    title: "This review link is invalid",
    text: "Check that the full link was copied correctly, or contact PrimeView for a new invitation.",
  },
  expired: {
    title: "This review link has expired",
    text: "Contact PrimeView if you still want to leave a verified customer review.",
  },
  used: {
    title: "This review has already been submitted",
    text: "Each completed booking can create one verified customer review.",
  },
  revoked: {
    title: "This review link is no longer active",
    text: "Contact PrimeView if you need a new invitation.",
  },
  unavailable: {
    title: "This booking is not available for review",
    text: "Verified review links are only available after a completed service.",
  },
} as const;

export default async function VerifiedReviewPage({ params }: ReviewPageProps) {
  const { token } = await params;
  const invitation = await getVerifiedReviewInvitation(token);

  return (
    <main className="min-h-screen bg-[#eef3fb] px-4 py-10 text-[#071b42] sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-center">
          <Link href={primeViewSite.canonicalUrl} aria-label="PrimeView Window Care home">
            <Image
              src="/brand/primeview-window-care-logo.jpeg"
              alt="PrimeView Window Care"
              width={1242}
              height={1173}
              priority
              className="size-24 rounded-2xl border border-white object-cover shadow-xl"
            />
          </Link>
        </div>

        <section className="rounded-[28px] border border-[#cbd9ef] bg-white p-6 shadow-[0_24px_60px_rgba(16,37,80,.14)] sm:p-9">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.15em] text-[#315997]">
            <BadgeCheck className="size-5" aria-hidden="true" />
            Verified customer review
          </div>

          {invitation.state === "valid" ? (
            <>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                How did {invitation.companyName} do?
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-600">
                This secure link is connected to your completed booking. It can be
                used once and expires on{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeZone: "Europe/London",
                }).format(new Date(invitation.expiresAt))}
                .
              </p>
              <div className="mt-7">
                <VerifiedReviewForm
                  token={token}
                  customerName={invitation.customerName}
                  service={invitation.service}
                  area={invitation.area}
                />
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                {stateContent[invitation.state].title}
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-600">
                {stateContent[invitation.state].text}
              </p>
              <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-[#dbe5f6] bg-[#f6f9ff] p-5 text-sm leading-6 text-[#29436f]">
                <p className="flex items-center gap-2 font-bold">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                  Review invitations never ask for payment or account passwords.
                </p>
                <p className="flex items-center gap-2">
                  <Clock3 className="size-5" aria-hidden="true" />
                  Need help? Contact PrimeView through its official website.
                </p>
              </div>
              <Link
                href={primeViewSite.canonicalUrl}
                className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0a3c8f] px-5 py-3 text-sm font-black !text-white"
              >
                Visit PrimeView Window Care
              </Link>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
