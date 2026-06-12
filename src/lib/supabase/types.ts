export type QuoteRequestRow = {
  id: string;
  category: string;
  service_type: string;
  city: string;
  postal_code: string;
  description: string;
  preferred_date: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  consent_accepted: boolean;
  status: "draft" | "submitted" | "pending_review" | "approved" | "matched" | "answered" | "booked" | "completed" | "cancelled" | "rejected";
  reference_id: string;
  created_at: string;
  updated_at: string;
};

export type QuoteRequestInsert = Omit<QuoteRequestRow, "id" | "created_at" | "updated_at">;

export type Database = {
  public: {
    Tables: {
      quote_requests: {
        Row: QuoteRequestRow;
        Insert: QuoteRequestInsert;
        Update: Partial<QuoteRequestInsert>;
      };
    };
  };
};
