import { EnglishLegalPage } from "@/components/marketing/english-legal-page";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Cookie policy",
  description: "Information about how Proffera uses cookies and similar technology for operation, security and optional analytics.",
  englishPath: "/en/cookies",
  swedishPath: "/cookies",
});

const sections = [
  { title: "1. What are cookies?", text: "Cookies are small text files that can be stored in a browser so a website can function, remember choices or measure usage." },
  { title: "2. Necessary cookies", text: "Proffera may use necessary cookies or similar technology for security, administrator access and technical operation. These are required for the service to work correctly." },
  { title: "3. Optional analytics", text: "When analytics configuration is present, Proffera offers optional, limited product analytics through PostHog. Analytics starts only after you explicitly choose to allow it. We do not use this analytics for advertising or marketing tracking." },
  { title: "4. Managing cookies and analytics", text: "You can change your analytics choice through Analytics settings in Proffera. You can also normally remove or block cookies and local storage in your browser settings. Some features may work less well if necessary storage is blocked." },
  { title: "5. Current status", text: "In addition to necessary storage, Proffera may, after explicit consent, use local storage for limited analytics. Analytics is restricted to page views, technical session identifiers, sanitized page paths and a coarse referral source. Query strings, URL fragments, form text and personal data are not sent to analytics." },
] as const;

export default function EnglishCookiesPage() {
  return <EnglishLegalPage title="Cookie policy" introduction="This page describes how Proffera uses cookies and similar technology for operation, security and optional analytics." sections={sections} notice="This English version is provided for convenience; the Swedish version prevails if there is a difference." />;
}
