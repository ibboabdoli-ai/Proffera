import { z } from "zod";

export const primeViewWorkspaceSlug = "primeview-window-care";

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => value || null);

export const primeViewReviewSchema = z.object({
  reviewerName: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  service: optionalText(120),
  area: optionalText(120),
  message: z.string().trim().min(10).max(1_000),
  consent: z.literal(true),
  website: z.string().max(0),
  formStartedAt: z.coerce.number().int().positive(),
});

export type PrimeViewReview = z.infer<typeof primeViewReviewSchema>;
