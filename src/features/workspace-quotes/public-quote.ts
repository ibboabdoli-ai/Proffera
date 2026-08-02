import { z } from "zod";

export const publicWorkspaceQuoteSchema = z.object({
  serviceId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(80).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  postalCode: z.string().trim().max(24).optional().default(""),
  description: z.string().trim().min(10).max(4_000),
  preferredDate: z.string().trim().max(80).optional().default(""),
  website: z.string().trim().max(200).optional().default(""),
  formStartedAt: z.coerce.number().finite(),
});

export type PublicWorkspaceQuoteInput = z.infer<typeof publicWorkspaceQuoteSchema>;

export function isPlausiblePublicQuoteTiming(formStartedAt: number, now = Date.now()) {
  const elapsed = now - formStartedAt;
  return elapsed >= 2_500 && elapsed <= 24 * 60 * 60 * 1_000;
}
