import Link from "next/link";
import { redirect } from "next/navigation";

import authStyles from "@/components/auth/auth-marketplace.module.css";
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
    <div className={authStyles.page} lang={locale === "sv" ? "sv" : "en"}>
      <section className={authStyles.shell}>
        <div className={authStyles.split}>
          <div>
            <p className={authStyles.eyebrow}>{text.badge}</p>
            <h1 className={authStyles.title}>{text.title}</h1>
            <p className={authStyles.lead}>{text.intro}</p>

            <ul className={authStyles.trustList}>
              {text.points.map((point) => (
                <li key={point} className={authStyles.trustItem}>
                  <span className={authStyles.trustMark}>✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className={authStyles.linkRow}>
              <Link href={demoHref} className={authStyles.textLink}>{text.demo}</Link>
            </div>
          </div>

          <SignupForm locale={locale} initialPlan={initialPlan} sessionUser={sessionUser} />
        </div>
      </section>
    </div>
  );
}
