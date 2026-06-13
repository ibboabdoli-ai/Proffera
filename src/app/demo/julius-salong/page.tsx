import type { Metadata } from "next";
import { JuliusBookingDemo } from "@/components/salon/julius-booking-demo";

export const metadata: Metadata = {
  title: "Julius Salong demo",
  description: "Mobile-first demo av QR-bokning, tjänster, priser och bokningsflöde för Julius Salong i Södertälje.",
};

export default function JuliusSalonDemoPage() {
  return <JuliusBookingDemo />;
}
