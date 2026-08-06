import { NextResponse } from "next/server";
import { storeCompanyRegistration } from "@/features/company/persistence";
import { companyRegistrationSchema } from "@/features/company/schema";
import { allowPublicSubmission } from "@/lib/public-form-protection";

type RegistrationLocale = "sv" | "en";

function registrationPaths(locale: RegistrationLocale) {
  return locale === "en"
    ? { register: "/en/join-business/register", thanks: "/en/join-business/thank-you" }
    : { register: "/anslut-foretag/registrera", thanks: "/anslut-foretag/tack" };
}

function registrationError(locale: RegistrationLocale, kind: "validation" | "rate-limit" | "storage") {
  if (locale === "en") {
    if (kind === "validation") return "Please check that all required information is filled in correctly.";
    if (kind === "rate-limit") return "Too many attempts. Please wait a moment and try again.";
    return "We could not save your business request. Please try again or contact us.";
  }

  if (kind === "validation") return "Kontrollera att alla obligatoriska uppgifter är korrekt ifyllda.";
  if (kind === "rate-limit") return "För många försök. Vänta en stund och försök igen.";
  return "Företagsansökan kunde inte sparas. Kontrollera att databastabellen finns.";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const website = String(formData.get("website") ?? "").trim();
  const locale: RegistrationLocale = formData.get("locale") === "en" ? "en" : "sv";
  const paths = registrationPaths(locale);

  if (website) {
    return NextResponse.redirect(new URL(paths.thanks, request.url));
  }

  const parsed = companyRegistrationSchema.safeParse({
    companyName: String(formData.get("companyName") ?? ""),
    organizationNumber: String(formData.get("organizationNumber") ?? ""),
    contactPerson: String(formData.get("contactPerson") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    city: String(formData.get("city") ?? ""),
    serviceAreas: String(formData.get("serviceAreas") ?? ""),
    services: String(formData.get("services") ?? ""),
    description: String(formData.get("description") ?? ""),
    consentAccepted: formData.get("consentAccepted") === "on",
  });

  if (!parsed.success) {
    const url = new URL(paths.register, request.url);
    const firstIssue = parsed.error.issues[0];
    const message = firstIssue?.message || registrationError(locale, "validation");
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  }

  const allowed = await allowPublicSubmission({
    scope: "company_demo",
    requestHeaders: request.headers,
    identity: `${parsed.data.email}:${parsed.data.organizationNumber}`,
    maxAttempts: 3,
    windowSeconds: 15 * 60,
  });

  if (!allowed) {
    const url = new URL(paths.register, request.url);
    url.searchParams.set("error", registrationError(locale, "rate-limit"));
    return NextResponse.redirect(url);
  }

  const result = await storeCompanyRegistration(parsed.data);

  if (!result.ok) {
    const url = new URL(paths.register, request.url);
    url.searchParams.set("error", locale === "en" ? registrationError(locale, "storage") : result.message);
    return NextResponse.redirect(url);
  }

  const url = new URL(paths.thanks, request.url);
  url.searchParams.set("ref", result.referenceId);
  return NextResponse.redirect(url);
}
