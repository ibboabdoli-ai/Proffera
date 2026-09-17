import type { ReactNode } from "react";

import { DemoInteractions } from "./demo-interactions";
import { ReferenceMotion } from "./reference-motion";

export default function DonisTrattoriaDemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoInteractions />
      <ReferenceMotion />
      {children}
    </>
  );
}
