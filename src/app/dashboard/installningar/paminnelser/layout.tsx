import type { ReactNode } from "react";

import styles from "@/components/dashboard/public-experience-ux-2.module.css";

export default function ReminderSettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={styles.scope}>{children}</div>;
}
