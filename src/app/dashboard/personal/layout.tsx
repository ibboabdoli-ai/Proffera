import type { ReactNode } from "react";

import styles from "@/components/dashboard/calendar-staff-ux-2.module.css";

export default function StaffLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={styles.scope}>{children}</div>;
}
