import type { ReactNode } from "react";

import styles from "@/components/dashboard/quotes-jobs-ux-2.module.css";

export default function ServiceJobsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={styles.scope}>{children}</div>;
}
