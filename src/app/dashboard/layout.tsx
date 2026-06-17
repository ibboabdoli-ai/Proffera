import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getServerSession } from "@/lib/auth-session";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Proffera SaaS dashboard preview for leads, customers, bookings and AI assistant.",
};

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  if (!session) {
    redirect("/logga-in");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
