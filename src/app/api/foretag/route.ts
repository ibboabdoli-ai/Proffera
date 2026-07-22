import { NextResponse } from "next/server";
import { storeCompanyRegistration } from "@/features/company/persistence";
import { companyRegistrationSchema } from "@/features/company/schema";
import { allowPublicSubmission } from "@/lib/public-form-protection";

export async function POST(request: Request) {
  const formData = await request.formData();
  const website = String(formData.get("website") ?? "").trim();

  if (website) {
    return NextResponse.redirect(new URL("/anslut-foretag/tack", request.url));
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
    const url = new URL("/anslut-foretag/registrera", request.url);
    url.searchParams.set("error", "Kontrollera att alla obligatoriska uppgifter är korrekt ifyllda.");
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
    const url = new URL("/anslut-foretag/registrera", request.url);
    url.searchParams.set("error", "För många försök. Vänta en stund och försök igen.");
    return NextResponse.redirect(url);
  }

  const result = await storeCompanyRegistration(parsed.data);

  if (!result.ok) {
    const url = new URL("/anslut-foretag/registrera", request.url);
    url.searchParams.set("error", result.message);
    return NextResponse.redirect(url);
  }

  const url = new URL("/anslut-foretag/tack", request.url);
  url.searchParams.set("ref", result.referenceId);
  return NextResponse.redirect(url);
}
