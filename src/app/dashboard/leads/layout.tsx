import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";
export default function LeadsLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <DashboardModuleGuard moduleId="customer_crm">{children}</DashboardModuleGuard>; }
