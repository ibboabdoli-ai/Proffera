import type { PublicLocale } from "@/lib/public-locale";

import { quoteFormCopy } from "./form-copy";
import styles from "./quote-request-marketplace.module.css";
import type { SmartQuoteAnswers, SmartQuoteQuestion } from "./smart-quote-questions";

export function QuoteSmartDetailsStep({
  locale,
  questions,
  answers,
  errors,
  onChange,
}: {
  locale: PublicLocale;
  questions: SmartQuoteQuestion[];
  answers: SmartQuoteAnswers;
  errors: Record<string, string>;
  onChange: (questionId: string, value: string) => void;
}) {
  const t = quoteFormCopy[locale];

  return (
    <div className={styles.stack}>
      <div>
        <h2 className={styles.sectionTitle}>{t.detailsTitle}</h2>
        <p className={styles.help}>{t.detailsLead}</p>
      </div>

      {questions.map((question) => {
        const value = answers[question.id] ?? "";
        const error = errors[question.id];

        return (
          <fieldset key={question.id} className={styles.fieldset}>
            <legend className={styles.legend}>
              {question.label}{question.required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}
            </legend>
            {question.help ? <p className={styles.help}>{question.help}</p> : null}

            {question.type === "single" ? (
              <div className={styles.optionGrid}>
                {(question.options ?? []).map((option) => {
                  const selected = value === option.value;
                  return (
                    <label key={option.value} className={`${styles.option} ${selected ? styles.optionSelected : ""}`}>
                      <input
                        type="radio"
                        name={`smart-${question.id}`}
                        value={option.value}
                        checked={selected}
                        onChange={(event) => onChange(question.id, event.target.value)}
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className={styles.inlineField}>
                <input
                  type={question.type === "number" ? "number" : "text"}
                  min={question.type === "number" ? 0 : undefined}
                  inputMode={question.type === "number" ? "decimal" : undefined}
                  value={value}
                  placeholder={question.placeholder}
                  onChange={(event) => onChange(question.id, event.target.value)}
                  className={styles.input}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `smart-${question.id}-error` : undefined}
                />
                {question.suffix ? <span className={styles.suffix}>{question.suffix}</span> : null}
              </div>
            )}

            {error ? <p id={`smart-${question.id}-error`} className={styles.errorText}>{error}</p> : null}
          </fieldset>
        );
      })}
    </div>
  );
}
