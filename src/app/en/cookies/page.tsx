import { EnglishLegalPage } from "@/components/marketing/english-legal-page";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Cookie policy",
  description: "Information about how Proffera uses cookies and similar technology for operation and security.",
  englishPath: "/en/cookies",
  swedishPath: "/cookies",
});

const sections = [
  { title: "1. What are cookies?", text: "Cookies are small text files that can be stored in a browser so a website can function, remember choices or measure usage." },
  { title: "2. Necessary cookies", text: "Proffera may use necessary cookies or similar technology for security, administrator access and technical operation. These are required for the service to work correctly." },
  { title: "3. Analytics and marketing", text: "If analytics tools or marketing cookies are introduced in the future, the cookie information will be updated and consent handled where required." },
  { title: "4. Managing cookies", text: "You can normally remove or block cookies in your browser settings. Some features may work less well if necessary cookies are blocked." },
  { title: "5. Current status", text: "Proffera currently uses only necessary cookies or similar technology for security, login and operation. If analytics or external tracking tools are introduced, this page will be updated and consent handled where required." },
] as const;

export default function EnglishCookiesPage() {
  return <EnglishLegalPage title="Cookie policy" introduction="This page describes how Proffera uses cookies and similar technology for operation and security." sections={sections} notice="This English version is provided for convenience; the Swedish version prevails if there is a difference." />;
}
