import { primeViewAdditionalAreaPages } from "@/lib/primeview-additional-area-pages";
import { primeViewAreaPages as primeViewCoreAreaPages } from "@/lib/primeview-seo-pages";

export const primeViewAreaPages = [
  ...primeViewCoreAreaPages,
  ...primeViewAdditionalAreaPages,
] as const;
