import type { PublicLocale } from "@/lib/public-locale";
import type { QuoteRequestErrors, QuoteRequestField, QuoteRequestInput } from "./schema";

export type QuoteFormStepProps = {
  locale: PublicLocale;
  data: QuoteRequestInput;
  errors: QuoteRequestErrors;
  update: <Field extends QuoteRequestField>(field: Field, value: QuoteRequestInput[Field]) => void;
};
