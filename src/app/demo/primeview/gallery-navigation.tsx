"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

type NavigationTarget = {
  element: HTMLElement;
  mobile: boolean;
};

export function PrimeViewGalleryNavigation() {
  const pathname = usePathname();
  const [targets, setTargets] = useState<NavigationTarget[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const desktop = document.querySelector<HTMLElement>('nav[aria-label="Main navigation"]');
      const mobile = document.querySelector<HTMLElement>('nav[aria-label="Mobile navigation"]');

      setTargets([
        ...(desktop ? [{ element: desktop, mobile: false }] : []),
        ...(mobile ? [{ element: mobile, mobile: true }] : []),
      ]);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const isGalleryPage = pathname === "/gallery" || pathname.endsWith("/gallery");
  if (isGalleryPage) return null;

  const galleryHref = pathname.startsWith("/demo/primeview") ? "/demo/primeview/gallery" : "/gallery";

  return (
    <>
      {targets.map(({ element, mobile }, index) =>
        createPortal(
          <a
            href={galleryHref}
            className={mobile ? undefined : "transition hover:text-white motion-reduce:transition-none"}
          >
            Gallery
          </a>,
          element,
          `primeview-gallery-link-${index}`,
        ),
      )}
    </>
  );
}
