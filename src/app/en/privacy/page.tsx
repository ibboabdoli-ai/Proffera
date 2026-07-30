import { EnglishLegalPage } from "@/components/marketing/english-legal-page";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Privacy policy",
  description: "How Proffera handles personal data in connection with leads, bookings, business registration and communication.",
  englishPath: "/en/privacy",
  swedishPath: "/integritetspolicy",
});

const sections = [
  { title: "1. Data controller", text: "The operator of Proffera is responsible for how personal data is processed in the service. For questions about personal data or to exercise your rights, contact leads@proffera.se." },
  { title: "2. Personal data we may process", text: "We may process names, email addresses, phone numbers, business names, organisation numbers, city, service area, service category, messages, quote enquiries, booking information and technical information needed for operation and security." },
  { title: "3. Why we process data", text: "Data is used to receive enquiries, manage bookings and business registrations, send email notifications, provide the customer portal, improve the service and protect the platform from abuse." },
  { title: "4. Legal basis", text: "Processing may be based on a contract or steps before a contract, legitimate interest for operation and security, consent where required, and legal obligations where applicable." },
  { title: "5. Sharing with third parties", text: "Personal data may be shared with technical suppliers needed for operations, database, hosting and email delivery. Proffera does not sell personal data to third parties." },
  { title: "6. Retention", text: "Data is kept only for as long as it is needed for its purpose, for example to manage leads, delivery logs, support, security and accounting or contract-related obligations." },
  { title: "7. Your rights", text: "You can request information about personal data being processed, request correction, deletion or restriction, or object to certain processing. Contact Proffera at leads@proffera.se." },
  { title: "8. Security", text: "Administrative areas are protected by access controls. Environment variables and API keys must not be publicly exposed. The operating environment is managed with the least access necessary." },
  { title: "9. Updates", text: "This policy may be updated as Proffera develops or personal-data processing changes. The latest version is published on this page." },
] as const;

export default function EnglishPrivacyPage() {
  return <EnglishLegalPage title="Privacy policy" introduction="This policy describes how Proffera processes personal data in connection with leads, bookings, business registrations and communication." sections={sections} />;
}
