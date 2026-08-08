import Link from "next/link";
import { redirect } from "next/navigation";

import { SignupForm } from "@/components/signup/signup-form";
import type { CheckoutPlanKey } from "@/lib/billing-plans";
import { getServerSession } from "@/lib/auth-session";
import { getSql } from "@/lib/db/server";

type SignupLocale = "sv" | "en";

type SignupPageProps = {
  locale: SignupLocale;
  initialPlan: CheckoutPlanKey;
};

const copy = {
  sv: {
    badge: "14 dagar gratis",
    title: "Kom igång med Proffera på några minuter.",
    intro: "Skapa konto och företagets arbetsyta direkt. Proffera förbereder grundinställningar, funktioner, bokningstider och onboarding automatiskt.",
    points: [
      "Ingen betalning krävs för att starta",
      "Full tillgång under den aktiva provperioden",
      "Ingen bindningstid",
    ],
    demo: "Vill du prata med oss först? Boka demo",
  },
  en: {
    badge: "14-day free trial",
    title: "Get started with Proffera in a few minutes.",
    intro: "Create your account and company workspace directly. Proffera prepares core settings, features, booking hours and onboarding automatically.",
    points: [
      "No payment required to start",
      "Full access during the active trial",
      "No commitment",
    ],
    demo: "Want to talk first? Book a demo",
  },
} as const;

export async function SignupPage({ locale, initialPlan }: SignupPageProps) {
  const text = copy[locale];
  const session = await getServerSession();
  const sql = getSql();
  let sessionUser: { name: string; email: string } | null = null;

  if (session?.user?.id && session.user.email) {
    if (sql) {
      const memberships = await sql`
        select workspace_id
        from workspace_memberships
        where user_id = ${session.user.id}
        limit 1
      `;
      if (memberships[0]?.workspace_id) {
        redirect("/dashboard");
      }
    }

    sessionUser = {
      name: String(session.user.name ?? ""),
      email: String(session.user.email),
    };
  }

  const demoHref = locale === "en" ? "/en/demo" : "/demo";

  return (
    <div className="relative overflow-hidden bg-[#f7f7f4]">
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_12%_0%,rgba(139,195,157,0.28),transparent_35%),linear-gradient(180deg,#fff_0%,#f7f7f4_100%)]" />
      <section className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
        <div>
          <p className="inline-flex rounded-full border border-[#cfe0d3] bg-white px-4 py-2 text-sm font-semibold text-[#17452f] shadow-sm">{text.badge}</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-[#17201a] sm:text-5xl">{text.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5b665f]">{text.intro}</p>
          <ul className="mt-7 grid gap-3 text-sm font-medium text-[#344139]">
            {text.points.map((point) => <li key={point} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e7f1eb] text-xs font-bold text-[#17452f]">✓</span>{point}</li>)}
          </ul>
          <Link href={demoHref} className="mt-8 inline-flex text-sm font-semibold text-[#17452f] hover:underline">{text.demo}</Link>
        </div>

        <SignupForm locale={locale} initialPlan={initialPlan} sessionUser={sessionUser} />
      </section>
    </div>
  );
}
