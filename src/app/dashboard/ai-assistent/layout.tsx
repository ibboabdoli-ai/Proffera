import type { ReactNode } from "react";

import styles from "@/components/dashboard/secondary-workspace-ux-2.module.css";

export default function AiAssistantLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={styles.scope}>{children}</div>;
}
