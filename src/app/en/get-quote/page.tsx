import { QuoteRequestForm } from "@/features/quote-request/quote-request-form";
import styles from "@/features/quote-request/quote-request-marketplace.module.css";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Get quotes",
  description: "Describe your job and get matched with suitable companies through Proffera.",
  englishPath: "/en/get-quote",
  swedishPath: "/fa-offert",
});

type QuotePageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    service?: string | string[];
    city?: string | string[];
  }>;
};

function queryValue(value: string | string[] | undefined, maxLength = 120) {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim().slice(0, maxLength) : "";
}

export default async function EnglishQuotePage({ searchParams }: QuotePageProps) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const initialValues = {
    category: queryValue(params?.category),
    serviceType: queryValue(params?.service),
    city: queryValue(params?.city),
  };

  return (
    <main className={styles.page}>
      <section className={styles.pageShell}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Get quotes</p>
          <h1 className={styles.title}>Describe your job step by step.</h1>
          <p className={styles.lead}>
            Add the service, location and what you need help with. Proffera uses the details to match your request with suitable businesses.
          </p>
          <div className={styles.trustRow}>
            <span><i className={styles.trustDot}>✓</i>Free to send a request</span>
            <span><i className={styles.trustDot}>✓</i>Your details are used for matching</span>
            <span><i className={styles.trustDot}>✓</i>Compare before you choose</span>
          </div>
        </div>

        <div className={styles.formWrap}>
          <QuoteRequestForm
            locale="en"
            initialValues={initialValues}
            alternateLocaleHref="/fa-offert?resume=1"
            alternateLocaleLabel="SV Svenska"
          />
        </div>
      </section>
    </main>
  );
}
