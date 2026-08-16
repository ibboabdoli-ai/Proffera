"use client";

import type { PublicLocale } from "@/lib/public-locale";
import { LocalizedQuoteRequestForm } from "./localized-quote-request-form";
import type { QuoteRequestPrefill } from "./schema";

export function QuoteRequestForm({
  locale = "sv",
  initialValues,
}: {
  locale?: PublicLocale;
  initialValues?: QuoteRequestPrefill;
}) {
  return <LocalizedQuoteRequestForm locale={locale} initialValues={initialValues} />;
}
