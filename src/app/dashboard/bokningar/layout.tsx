import type { ReactNode } from "react";

import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";
import { isMariaProductionExistingBookingLifecycleAuthorized } from "@/lib/maria-production-activation-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import styles from "@/components/dashboard/secondary-workspace-ux-2.module.css";

export default async function BookingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  const access = await getUserWorkspaceAccess();
  const existingMariaManager = access.ok
    && access.workspaceSlug === "makeup-by-maria"
    && canManageWorkspaceSettings(access)
    && isMariaProductionExistingBookingLifecycleAuthorized();

  const content = <div className={styles.scope}>{children}</div>;
  // Paid entitlement gates new intake, NOT an authorized owner's access to
  // existing Maria bookings and previously agreed customer obligations.
  if (existingMariaManager) return content;
  return <DashboardModuleGuard moduleId="online_booking">{content}</DashboardModuleGuard>;
}
