import { SignupPage } from "@/components/signup/signup-page";
import { isCheckoutPlanKey } from "@/lib/billing-plans";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Start a 14-day free Proffera trial",
  description: "Create a Proffera account and start a real 14-day trial with a dedicated workspace for your business.",
  englishPath: "/en/create-account",
  swedishPath: "/skapa-konto",
});

type SignupRouteProps = {
  searchParams?: Promise<{ plan?: string | string[] }>;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EnglishCreateAccountPage({ searchParams }: SignupRouteProps) {
  const params = searchParams ? await searchParams : undefined;
  const planValue = first(params?.plan);
  const initialPlan = isCheckoutPlanKey(planValue) ? planValue : "starter";

  return <SignupPage locale="en" initialPlan={initialPlan} />;
}
