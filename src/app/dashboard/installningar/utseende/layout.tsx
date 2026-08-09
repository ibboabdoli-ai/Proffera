import type { ReactNode } from "react";

import "./appearance-builder-shell.css";

export default function AppearanceLayout({ children }: { children: ReactNode }) {
  return <div data-appearance-builder-page>{children}</div>;
}
