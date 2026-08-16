import type { ReactNode } from "react";

import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";
import styles from "@/components/dashboard/secondary-workspace-ux-2.module.css";

export default function BookingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <DashboardModuleGuard moduleId="online_booking">
      <div className={styles.scope}>{children}</div>
    </DashboardModuleGuard>
  );
}
