export type QuoteRequestStatus =
  | "draft"
  | "submitted"
  | "pending_review"
  | "approved"
  | "matched"
  | "answered"
  | "booked"
  | "completed"
  | "cancelled"
  | "rejected";

export type CompanyStatus = "pending" | "verified" | "rejected" | "paused" | "suspended";

export type LeadMatchStatus = "new" | "viewed" | "responded" | "declined" | "expired";
