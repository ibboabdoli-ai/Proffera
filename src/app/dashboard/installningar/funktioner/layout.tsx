import type { ReactNode } from "react";

import styles from "@/components/dashboard/workspace-setup-ux-2.module.css";

export default function FeatureSettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={styles.scope}>{children}</div>;
}
