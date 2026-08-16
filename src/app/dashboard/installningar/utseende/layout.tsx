import type { ReactNode } from "react";

import styles from "@/components/dashboard/workspace-setup-ux-2.module.css";

import "./appearance-builder-shell.css";
import "./salon-builder-preview.css";

export default function AppearanceLayout({ children }: { children: ReactNode }) {
  return <div className={styles.scope} data-appearance-builder-page>{children}</div>;
}
