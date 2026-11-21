const photos = {
  stadning: "/images/service-categories/stadning.webp",
  hemservice: "/images/service-categories/hemservice.webp",
  flytt: "/images/service-categories/flytt.webp",
  elektriker: "/images/service-categories/elektriker.webp",
  vvs: "/images/service-categories/vvs.webp",
  maleri: "/images/service-categories/maleri.webp",
  snickeri: "/images/service-categories/snickeri.webp",
  tradgard: "/images/service-categories/tradgard.webp",
  frisor: "/images/service-categories/frisor.webp",
} as const;

export function serviceCategoryPhoto(category?: string | null, service?: string | null): string | null {
  const value = `${category ?? ""} ${service ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/frisor|hairdresser|salon/.test(value)) return photos.frisor;
  if (/stad|lokalvard|rengor|fonsterputs|clean/.test(value)) return photos.stadning;
  if (/flytt|moving|relocation/.test(value)) return photos.flytt;
  if (/elektr|elinstallation|laddbox|elcentral/.test(value)) return photos.elektriker;
  if (/vvs|rorlagg|plumb|avlopp|varmepump/.test(value)) return photos.vvs;
  if (/maleri|malning|paint/.test(value)) return photos.maleri;
  if (/snicker|carpent|woodwork/.test(value)) return photos.snickeri;
  if (/tradgard|garden|landscap/.test(value)) return photos.tradgard;
  if (/hemservice|handyman|home.service/.test(value)) return photos.hemservice;
  return null;
}
