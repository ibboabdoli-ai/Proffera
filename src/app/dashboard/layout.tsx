import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Proffera SaaS dashboard preview for leads, customers, bookings and AI assistant.",
};

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
