"use client";

import { useEffect } from "react";

const REVEAL_EASING = "cubic-bezier(.22,1,.36,1)";

export function ReferenceMotion() {
  useEffect(() => {
    if (window.location.pathname !== "/demo/donis-trattoria") return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const cleanups: Array<() => void> = [];
    const observed: HTMLElement[] = [];

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          element.dataset.revealed = "true";
          element.style.opacity = "1";
          element.style.transform = "translate3d(0,0,0)";
          element.style.clipPath = "inset(0 0 0 0)";
          revealObserver.unobserve(element);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    const addReveal = (
      element: HTMLElement,
      options: {
        transform?: string;
        clipPath?: string;
        delay?: number;
        duration?: number;
      } = {},
    ) => {
      element.style.opacity = options.clipPath ? "0.94" : "0";
      element.style.transform = options.transform ?? "translate3d(0,28px,0)";
      element.style.clipPath = options.clipPath ?? "inset(0 0 0 0)";
      element.style.transition = [
        `opacity ${options.duration ?? 820}ms ${REVEAL_EASING} ${options.delay ?? 0}ms`,
        `transform ${options.duration ?? 820}ms ${REVEAL_EASING} ${options.delay ?? 0}ms`,
        `clip-path ${options.duration ?? 920}ms ${REVEAL_EASING} ${options.delay ?? 0}ms`,
      ].join(", ");
      element.style.willChange = "opacity, transform, clip-path";
      observed.push(element);
      revealObserver.observe(element);
    };

    const about = document.querySelector<HTMLElement>("#om > div");
    if (about) addReveal(about, { transform: "translate3d(0,34px,0)", duration: 900 });

    const imageCards = Array.from(document.querySelectorAll<HTMLAnchorElement>("main a")).filter(
      (element) => Boolean(element.querySelector("img")),
    );
    imageCards.forEach((card, index) => {
      addReveal(card, {
        clipPath: index % 2 === 0 ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)",
        transform: "translate3d(0,0,0)",
        duration: 980,
        delay: index * 70,
      });
    });

    const menuItems = Array.from(document.querySelectorAll<HTMLElement>("#meny article"));
    menuItems.forEach((item, index) => {
      addReveal(item, {
        transform: `translate3d(${index % 2 === 0 ? -26 : 26}px,18px,0)`,
        delay: (index % 3) * 70,
      });
    });

    const galleryItems = Array.from(document.querySelectorAll<HTMLElement>("#galleri figure"));
    galleryItems.forEach((item, index) => {
      addReveal(item, {
        transform: "translate3d(0,38px,0)",
        delay: Math.min(index * 85, 340),
        duration: 900,
      });
    });

    const contact = document.querySelector<HTMLElement>("#kontakt > div");
    if (contact) addReveal(contact, { transform: "translate3d(0,32px,0)", duration: 900 });

    const heroImage = document.querySelector<HTMLImageElement>("#top img");
    if (heroImage) {
      heroImage.style.opacity = "0";
      heroImage.style.transform = "scale(1.08)";
      heroImage.style.transition = `opacity 900ms ${REVEAL_EASING}, transform 1500ms ${REVEAL_EASING}`;
      requestAnimationFrame(() => {
        heroImage.style.opacity = "1";
        heroImage.style.transform = "scale(1.04)";
      });
    }

    const parallaxImages = [
      heroImage,
      ...imageCards.map((card) => card.querySelector<HTMLImageElement>("img")),
    ].filter((image): image is HTMLImageElement => Boolean(image));

    parallaxImages.forEach((image) => {
      image.style.willChange = "transform";
      image.style.transformOrigin = "center center";
    });

    let raf = 0;
    const updateParallax = () => {
      raf = 0;
      parallaxImages.forEach((image, index) => {
        const rect = image.parentElement?.getBoundingClientRect();
        if (!rect) return;
        if (rect.bottom < -120 || rect.top > window.innerHeight + 120) return;

        const viewportCenter = window.innerHeight / 2;
        const elementCenter = rect.top + rect.height / 2;
        const distance = elementCenter - viewportCenter;
        const strength = index === 0 ? 0.055 : 0.035;
        const shift = Math.max(-34, Math.min(34, -distance * strength));
        const scale = index === 0 ? 1.055 : 1.075;
        image.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0) scale(${scale})`;
      });
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(updateParallax);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateParallax();

    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    });

    cleanups.push(() => revealObserver.disconnect());

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      observed.forEach((element) => {
        element.style.removeProperty("opacity");
        element.style.removeProperty("transform");
        element.style.removeProperty("clip-path");
        element.style.removeProperty("transition");
        element.style.removeProperty("will-change");
      });
      parallaxImages.forEach((image) => {
        image.style.removeProperty("transform");
        image.style.removeProperty("transform-origin");
        image.style.removeProperty("will-change");
      });
    };
  }, []);

  return null;
}
