import { NextResponse } from "next/server";
import { storeCompanyRegistration } from "@/features/company/persistence";
import type { CompanyRegistrationInput } from "@/features/company/schema";

export async function POST(request: Request) {
  const formData = await request.formData();

  const input: CompanyRegistrationInput = {
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
  };

  const result = await storeCompanyRegistration(input);

  if (!result.ok) {
    const url = new URL("/anslut-foretag", request.url);
    url.searchParams.set("error", result.message);
    return NextResponse.redirect(url);
  }

  const url = new URL("/anslut-foretag/tack", request.url);
  url.searchParams.set("ref", result.referenceId);
  return NextResponse.redirect(url);
}
