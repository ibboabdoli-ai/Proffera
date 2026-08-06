import { z } from "zod";

export const verifiedReviewTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/);

export const verifiedReviewSubmissionSchema = z.object({
  reviewerName: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  message: z.string().trim().min(10).max(1_000),
  consent: z.literal(true),
  website: z.string().max(0),
  formStartedAt: z.coerce.number().int().positive(),
});

export type VerifiedReviewSubmission = z.infer<typeof verifiedReviewSubmissionSchema>;

export type ReviewInvitationCandidate = {
  bookingId: string;
  title: string;
  service: string;
  area: string | null;
  startsAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  invitationStatus: "none" | "pending" | "expired" | "used" | "revoked";
  invitationExpiresAt: string | null;
};

export type ReviewWorkspaceBrand = {
  companyName: string;
  timeZone: string;
  language: "sv" | "en";
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  homeUrl: string | null;
};
