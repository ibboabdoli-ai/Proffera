import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";
export default function BookingsLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <DashboardModuleGuard moduleId="online_booking">{children}</DashboardModuleGuard>; }
