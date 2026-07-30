import type { ReactNode } from "react";

import { PrimeViewGalleryNavigation } from "./gallery-navigation";

export default function PrimeViewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PrimeViewGalleryNavigation />
    </>
  );
}
