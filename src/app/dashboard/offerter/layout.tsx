import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";
import styles from "@/components/dashboard/quotes-jobs-ux-2.module.css";

export default function OffersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DashboardModuleGuard featureKey="quote_management">
      <div className={styles.scope}>{children}</div>
    </DashboardModuleGuard>
  );
}
