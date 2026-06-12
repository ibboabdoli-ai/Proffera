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

export const quoteRequestSchema = z.object({
  category: z.string().min(1, "Välj en kategori."),
  serviceType: z.string().min(1, "Välj tjänstetyp."),
  city: z.string().min(2, "Ange stad."),
  postalCode: z
    .string()
    .min(3, "Ange postnummer.")
    .regex(/^[0-9\s-]+$/, "Postnummer får bara innehålla siffror, mellanslag eller bindestreck."),
  description: z.string().min(20, "Beskriv uppdraget med minst 20 tecken."),
  preferredDate: z.string().min(1, "Välj ungefärlig tidpunkt."),
  contactName: z.string().min(2, "Ange namn."),
  contactEmail: z.string().email("Ange en giltig e-postadress."),
  contactPhone: z
    .string()
    .min(6, "Ange telefonnummer.")
    .regex(/^[0-9+\s-]+$/, "Telefonnummer får bara innehålla siffror, +, mellanslag eller bindestreck."),
  consentAccepted: z
    .boolean()
    .refine((value) => value, "Du måste godkänna att Proffera behandlar uppgifterna för att hantera förfrågan."),
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
