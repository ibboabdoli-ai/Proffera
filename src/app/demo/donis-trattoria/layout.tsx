import type { ReactNode } from "react";

import { DemoInteractions } from "./demo-interactions";

export default function DonisTrattoriaDemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoInteractions />
      {children}
    </>
  );
}
