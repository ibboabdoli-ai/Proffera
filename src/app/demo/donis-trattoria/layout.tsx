import type { ReactNode } from "react";

import { ReferenceMotion } from "./reference-motion";

export default function DonisTrattoriaDemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ReferenceMotion />
      {children}
    </>
  );
}
