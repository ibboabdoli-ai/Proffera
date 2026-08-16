import { z } from "zod";

import type { PublicLocale } from "@/lib/public-locale";
import { quoteServiceTypesByCategory } from "@/lib/service-catalog";

export const serviceTypesByCategory = quoteServiceTypesByCategory;

export type QuoteCategory = keyof typeof serviceTypesByCategory;

const validationCopy = {
  sv: {
    category: "Välj en kategori.", serviceTypeRequired: "Välj tjänstetyp.", serviceTypeLong: "Tjänstetypen är för lång.",
    cityRequired: "Ange stad.", cityLong: "Orten är för lång.", postalRequired: "Ange postnummer.", postalLong: "Postnumret är för långt.",
    postalFormat: "Postnummer får bara innehålla siffror, mellanslag eller bindestreck.", descriptionShort: "Beskriv uppdraget med minst 20 tecken.", descriptionLong: "Beskrivningen är för lång.",
    dateRequired: "Välj ungefärlig tidpunkt.", dateLong: "Tidpunkten är för lång.", nameRequired: "Ange namn.", nameLong: "Namnet är för långt.",
    emailInvalid: "Ange en giltig e-postadress.", emailLong: "E-postadressen är för lång.", phoneRequired: "Ange telefonnummer.", phoneLong: "Telefonnumret är för långt.",
    phoneFormat: "Telefonnummer får bara innehålla siffror, +, mellanslag eller bindestreck.", consent: "Du måste godkänna att Proffera behandlar uppgifterna för att hantera förfrågan.",
    serviceCategory: "Välj en tjänstetyp som hör till kategorin.",
  },
  en: {
    category: "Choose a category.", serviceTypeRequired: "Choose a service type.", serviceTypeLong: "The service type is too long.",
    cityRequired: "Enter a city.", cityLong: "The city name is too long.", postalRequired: "Enter a postal code.", postalLong: "The postal code is too long.",
    postalFormat: "The postal code may only contain numbers, spaces or hyphens.", descriptionShort: "Describe the job using at least 20 characters.", descriptionLong: "The description is too long.",
    dateRequired: "Choose an approximate time.", dateLong: "The preferred time is too long.", nameRequired: "Enter a name.", nameLong: "The name is too long.",
    emailInvalid: "Enter a valid email address.", emailLong: "The email address is too long.", phoneRequired: "Enter a phone number.", phoneLong: "The phone number is too long.",
    phoneFormat: "The phone number may only contain numbers, +, spaces or hyphens.", consent: "You must allow Proffera to process your details in order to handle the request.",
    serviceCategory: "Choose a service type that belongs to the selected category.",
  },
} as const;

export function isServiceCategory(value: string): value is QuoteCategory {
  return Object.hasOwn(serviceTypesByCategory, value);
}

export function createQuoteRequestSchema(locale: PublicLocale = "sv") {
  const copy = validationCopy[locale];

  return z.object({
    category: z.string().trim().refine((value: string): boolean => isServiceCategory(value), copy.category),
    serviceType: z.string().trim().min(1, copy.serviceTypeRequired).max(120, copy.serviceTypeLong),
    city: z.string().trim().min(2, copy.cityRequired).max(120, copy.cityLong),
    postalCode: z.string().trim().min(3, copy.postalRequired).max(16, copy.postalLong).regex(/^[0-9\s-]+$/, copy.postalFormat),
    description: z.string().trim().min(20, copy.descriptionShort).max(2_000, copy.descriptionLong),
    preferredDate: z.string().trim().min(1, copy.dateRequired).max(80, copy.dateLong),
    contactName: z.string().trim().min(2, copy.nameRequired).max(120, copy.nameLong),
    contactEmail: z.string().trim().email(copy.emailInvalid).max(180, copy.emailLong),
    contactPhone: z.string().trim().min(6, copy.phoneRequired).max(40, copy.phoneLong).regex(/^[0-9+\s-]+$/, copy.phoneFormat),
    consentAccepted: z.boolean().refine((value) => value, copy.consent),
  }).superRefine((input, context) => {
    const availableServiceTypes = isServiceCategory(input.category)
      ? serviceTypesByCategory[input.category]
      : null;

    if (availableServiceTypes && !(availableServiceTypes as readonly string[]).includes(input.serviceType)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["serviceType"], message: copy.serviceCategory });
    }
  });
}

export const quoteRequestSchema = createQuoteRequestSchema("sv");
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
export type QuoteRequestField = keyof QuoteRequestInput;
export type QuoteRequestErrors = Partial<Record<QuoteRequestField | "form", string>>;
export type QuoteRequestPrefill = Partial<Pick<QuoteRequestInput, "category" | "serviceType" | "city">>;

export const initialQuoteRequest: QuoteRequestInput = {
  category: "", serviceType: "", city: "", postalCode: "", description: "", preferredDate: "",
  contactName: "", contactEmail: "", contactPhone: "", consentAccepted: false,
};

export function sanitizeQuoteRequestPrefill(input?: QuoteRequestPrefill): Pick<QuoteRequestInput, "category" | "serviceType" | "city"> {
  const requestedCategory = typeof input?.category === "string" ? input.category.trim() : "";
  const category = isServiceCategory(requestedCategory) ? requestedCategory : "";
  const requestedServiceType = typeof input?.serviceType === "string" ? input.serviceType.trim() : "";
  const availableServiceTypes = category ? serviceTypesByCategory[category] as readonly string[] : [];
  const serviceType = requestedServiceType && availableServiceTypes.includes(requestedServiceType) ? requestedServiceType : "";
  const city = typeof input?.city === "string" ? input.city.trim().slice(0, 120) : "";

  return { category, serviceType, city };
}
