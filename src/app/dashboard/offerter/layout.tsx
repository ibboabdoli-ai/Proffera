import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";

export default function OffersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardModuleGuard featureKey="quote_management">{children}</DashboardModuleGuard>;
}
