export function restaurantSnapshotReferencesMedia(
  value: unknown,
  mediaId: string,
): boolean {
  if (!value || typeof value !== "object" || !mediaId) return false;
  const site = value as {
    media?: {
      hero?: { id?: unknown } | null;
      owner?: { id?: unknown } | null;
      family?: { id?: unknown } | null;
      gallery?: Array<{ id?: unknown }>;
    };
    dishes?: Array<{ image?: { id?: unknown } | null }>;
  };

  if (
    site.media?.hero?.id === mediaId ||
    site.media?.owner?.id === mediaId ||
    site.media?.family?.id === mediaId
  ) {
    return true;
  }

  if (site.media?.gallery?.some((item) => item?.id === mediaId)) {
    return true;
  }

  return Boolean(
    site.dishes?.some((dish) => dish?.image?.id === mediaId),
  );
}
