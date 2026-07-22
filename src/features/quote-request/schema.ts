import { z } from "zod";

export const serviceTypesByCategory = {
  "Hemstädning": ["Engångsstädning", "Återkommande städning", "Storstädning"],
  "Flyttstädning": ["Lägenhet", "Villa", "Kontor"],
  "Kontorsstädning": ["Litet kontor", "Medelstort kontor", "Större lokal"],
  "Fönsterputs": ["Lägenhet", "Villa", "Lokal"],
  "Byggstädning": ["Efter renovering", "Efter nyproduktion", "Grovstädning"],
  "Trädgård": ["Gräsklippning", "Häckklippning", "Trädgårdsskötsel"],
  "Flytthjälp": ["Bärhjälp", "Flytt med transport", "Packhjälp"],
  "Renovering": ["Målning", "Golv", "Mindre renovering"],
} as const;

function isServiceCategory(value: string) {
  return Object.hasOwn(serviceTypesByCategory, value);
}

export const quoteRequestSchema = z.object({
  category: z
    .string()
    .trim()
    .refine(isServiceCategory, "Välj en kategori."),
  serviceType: z.string().trim().min(1, "Välj tjänstetyp.").max(120, "Tjänstetypen är för lång."),
  city: z.string().trim().min(2, "Ange stad.").max(120, "Orten är för lång."),
  postalCode: z
    .string()
    .trim()
    .min(3, "Ange postnummer.")
    .max(16, "Postnumret är för långt.")
    .regex(/^[0-9\s-]+$/, "Postnummer får bara innehålla siffror, mellanslag eller bindestreck."),
  description: z.string().trim().min(20, "Beskriv uppdraget med minst 20 tecken.").max(2_000, "Beskrivningen är för lång."),
  preferredDate: z.string().trim().min(1, "Välj ungefärlig tidpunkt.").max(80, "Tidpunkten är för lång."),
  contactName: z.string().trim().min(2, "Ange namn.").max(120, "Namnet är för långt."),
  contactEmail: z.string().trim().email("Ange en giltig e-postadress.").max(180, "E-postadressen är för lång."),
  contactPhone: z
    .string()
    .trim()
    .min(6, "Ange telefonnummer.")
    .max(40, "Telefonnumret är för långt.")
    .regex(/^[0-9+\s-]+$/, "Telefonnummer får bara innehålla siffror, +, mellanslag eller bindestreck."),
  consentAccepted: z
    .boolean()
    .refine((value) => value, "Du måste godkänna att Proffera behandlar uppgifterna för att hantera förfrågan."),
}).superRefine((input, context) => {
  const availableServiceTypes = isServiceCategory(input.category)
    ? serviceTypesByCategory[input.category as keyof typeof serviceTypesByCategory]
    : null;

  if (availableServiceTypes && !availableServiceTypes.includes(input.serviceType as never)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["serviceType"],
      message: "Välj en tjänstetyp som hör till kategorin.",
    });
  }
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

export type QuoteRequestField = keyof QuoteRequestInput;

export type QuoteRequestErrors = Partial<Record<QuoteRequestField | "form", string>>;

export const initialQuoteRequest: QuoteRequestInput = {
  category: "",
  serviceType: "",
  city: "",
  postalCode: "",
  description: "",
  preferredDate: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  consentAccepted: false,
};
