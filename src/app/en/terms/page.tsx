import { EnglishLegalPage } from "@/components/marketing/english-legal-page";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Terms of service",
  description: "Terms for using Proffera and its booking, lead and customer-workflow services.",
  englishPath: "/en/terms",
  swedishPath: "/villkor",
});

const sections = [
  { title: "1. About the service", text: "Proffera is a digital platform for Swedish service businesses. The service includes the modules expressly enabled for a customer's workspace, such as lead management, bookings, customer management, email notifications and administrative workflows." },
  { title: "2. Use of the service", text: "Users must provide accurate information and may not use the service for spam, fraud, unlawful content or attempts to bypass security features." },
  { title: "3. Business registration", text: "Businesses that join are responsible for keeping their business name, organisation number, contact person, services and service areas accurate and up to date." },
  { title: "4. Leads and enquiries", text: "Proffera may help receive and forward leads or quote enquiries. Proffera does not guarantee that every lead will result in a job, booking or revenue." },
  { title: "5. Email and communication", text: "The platform may send email notifications to businesses or administrators. Users are responsible for maintaining accurate contact details and handling received enquiries professionally." },
  { title: "6. Pricing and subscriptions", text: "The price, selected plan, billing period and applicable taxes are shown before a subscription is confirmed. Payments and subscription management are handled through Stripe when that functionality is enabled for the workspace. Cancellation and changes are managed in the Stripe portal and apply according to the confirmed billing period." },
  { title: "7. Availability and changes", text: "Proffera may update or change the service. Planned or separate modules are not part of a customer's active service until they have been expressly enabled. Service interruptions can occur, but we work to limit their impact." },
  { title: "8. Limitation of liability", text: "Proffera is not responsible for indirect loss, lost business, inaccurate information supplied by users or agreements made between a customer and a business outside the platform." },
  { title: "9. Contact and questions", text: "Questions about these terms or the active service can be sent to leads@proffera.se." },
] as const;

export default function EnglishTermsPage() {
  return <EnglishLegalPage title="Terms of service" introduction="These terms describe the general use of Proffera as a digital platform for leads, bookings and business workflows." sections={sections} />;
}
