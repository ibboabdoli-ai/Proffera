import type { ReactNode } from "react";

import DirectoryLowConfidenceRefreshButton from "./DirectoryLowConfidenceRefreshButton";

export default function DirectoryAdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50 w-[min(30rem,calc(100vw-2rem))]">
        <DirectoryLowConfidenceRefreshButton />
      </div>
    </>
  );
}
