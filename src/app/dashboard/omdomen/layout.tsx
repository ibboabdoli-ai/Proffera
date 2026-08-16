import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";
import styles from "@/components/dashboard/secondary-workspace-ux-2.module.css";

export default function ReviewsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DashboardModuleGuard featureKey="verified_reviews">
      <div className={styles.scope}>{children}</div>
    </DashboardModuleGuard>
  );
}
