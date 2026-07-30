import { z } from "zod";

export const primeViewServiceNames = [
  "Window Cleaning",
  "Fascia & Soffit Cleaning",
  "Conservatory Roof Cleaning",
  "Gutter Cleaning",
  "Driveway & Patio Cleaning",
  "Solar Panel Cleaning",
] as const;

export const primeViewQuoteRecipient = {
  name: "PrimeView Window Care",
  email: "am@primeviewlondon.co.uk",
} as const;

export const primeViewQuoteSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(160),
  phone: z.string().trim().min(5, "Please enter a valid phone number.").max(80),
  email: z.string().trim().email("Please enter a valid email address.").max(180),
  postcode: z.string().trim().min(3, "Please enter your postcode.").max(16),
  service: z.enum(primeViewServiceNames),
  message: z.string().trim().min(2, "Please add a short message.").max(2_000),
  website: z.string().trim().max(200).optional().default(""),
  formStartedAt: z.coerce.number().finite(),
});

export type PrimeViewQuote = z.infer<typeof primeViewQuoteSchema>;
