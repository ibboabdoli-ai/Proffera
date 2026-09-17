import { primeViewAdditionalAreaPages } from "@/lib/primeview-additional-area-pages";
import { primeViewAreaPages as primeViewCoreAreaPages } from "@/lib/primeview-seo-pages";

export const primeViewIndexableAreaPages = primeViewCoreAreaPages;
export const primeViewTemplatedAreaPages = primeViewAdditionalAreaPages;

export const primeViewAreaPages = [
  ...primeViewIndexableAreaPages,
  ...primeViewTemplatedAreaPages,
] as const;

const primeViewIndexableAreaSlugs = new Set<string>(
  primeViewIndexableAreaPages.map(({ slug }) => slug),
);

export function isPrimeViewIndexableAreaSlug(slug: string) {
  return primeViewIndexableAreaSlugs.has(slug);
}
