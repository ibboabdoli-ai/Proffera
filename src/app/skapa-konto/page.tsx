import type { Metadata } from "next";

import { SignupPage } from "@/components/signup/signup-page";
import { isCheckoutPlanKey } from "@/lib/billing-plans";

export const metadata: Metadata = {
  title: "Prova Proffera gratis i 14 dagar",
  description: "Skapa ett Proffera-konto och starta en riktig 14-dagars provperiod med en egen arbetsyta för företaget.",
  robots: { index: true, follow: true },
};

type SignupRouteProps = {
  searchParams?: Promise<{ plan?: string | string[] }>;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CreateAccountPage({ searchParams }: SignupRouteProps) {
  const params = searchParams ? await searchParams : undefined;
  const planValue = first(params?.plan);
  const initialPlan = isCheckoutPlanKey(planValue) ? planValue : "starter";

  return <SignupPage locale="sv" initialPlan={initialPlan} />;
}
