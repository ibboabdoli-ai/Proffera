import type { ReactNode } from "react";

import DirectoryLowConfidenceRefreshButton from "./DirectoryLowConfidenceRefreshButton";

export default function DirectoryAdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="mx-4 mb-6 lg:fixed lg:bottom-4 lg:right-4 lg:z-50 lg:mx-0 lg:mb-0 lg:w-[min(30rem,calc(100vw-2rem))]">
        <DirectoryLowConfidenceRefreshButton />
      </div>
    </>
  );
}
