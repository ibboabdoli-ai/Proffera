import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";

export default function ReviewsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardModuleGuard featureKey="verified_reviews" moduleName="Verifierade omdömen">{children}</DashboardModuleGuard>;
}
