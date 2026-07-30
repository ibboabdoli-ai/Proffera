import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Booking, leads and CRM for service businesses",
    template: "%s | Proffera",
  },
  description: "Proffera helps service businesses in Sweden manage leads, bookings and customers in one clear workflow.",
};

export default function EnglishLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
