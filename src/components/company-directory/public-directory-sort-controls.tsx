import Link from "next/link";

import { directoryCopy } from "@/components/company-directory/public-directory-copy";
import type { DirectorySearchSort } from "@/lib/company-directory-public-search";
import type { PublicLocale } from "@/lib/public-locale";

import styles from "./public-directory-marketplace.module.css";

function sortHref(baseHref: string, sort: DirectorySearchSort) {
  const url = new URL(baseHref, "https://proffera.invalid");
  if (sort === "recommended") url.searchParams.delete("sort");
  else url.searchParams.set("sort", sort);
  url.searchParams.delete("page");
  return `${url.pathname}${url.search}`;
}

export function PublicDirectorySortControls({
  locale,
  sort,
  nearbyActive,
  baseHref,
}: {
  locale: PublicLocale;
  sort: DirectorySearchSort;
  nearbyActive: boolean;
  baseHref: string;
}) {
  const t = directoryCopy[locale];
  const options: Array<{ value: DirectorySearchSort; label: string }> = [
    { value: "recommended", label: t.sortRecommended },
    ...(nearbyActive ? [{ value: "nearest" as const, label: t.sortNearest }] : []),
    { value: "name", label: t.sortName },
  ];

  return (
    <nav aria-label={t.sortBy} className={styles.sortNav}>
      <span className={styles.sortLabel}>{t.sortBy}</span>
      {options.map((option) => {
        const active = option.value === sort;
        return (
          <Link
            key={option.value}
            data-search-sort={option.value}
            aria-current={active ? "page" : undefined}
            href={sortHref(baseHref, option.value)}
            className={active ? styles.sortActive : styles.sortLink}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
