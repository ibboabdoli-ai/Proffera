import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";
export default function CustomersLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <DashboardModuleGuard moduleId="customer_crm">{children}</DashboardModuleGuard>; }
