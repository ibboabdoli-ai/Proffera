"use client";

import type { PublicLocale } from "@/lib/public-locale";
import { LocalizedQuoteRequestForm } from "./localized-quote-request-form";
import type { QuoteRequestPrefill } from "./schema";

export function QuoteRequestForm({
  locale = "sv",
  initialValues,
  alternateLocaleHref,
  alternateLocaleLabel,
}: {
  locale?: PublicLocale;
  initialValues?: QuoteRequestPrefill;
  alternateLocaleHref?: string;
  alternateLocaleLabel?: string;
}) {
  return <LocalizedQuoteRequestForm
    locale={locale}
    initialValues={initialValues}
    alternateLocaleHref={alternateLocaleHref}
    alternateLocaleLabel={alternateLocaleLabel}
  />;
}
