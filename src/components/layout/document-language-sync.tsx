"use client";

import { useEffect } from "react";

export function DocumentLanguageSync({ locale }: { locale: "sv" | "en" }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
