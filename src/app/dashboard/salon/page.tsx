import type { Metadata } from "next";
import { SalonDashboardDemo } from "@/components/salon/salon-dashboard-demo";

export const metadata: Metadata = {
  title: "Salon dashboard demo",
  description: "Dashboard-demo för salong med bokningar, tjänster, personal och öppettider.",
};

export default function SalonDashboardPage() {
  return <SalonDashboardDemo />;
}
