import type { RestaurantSite } from "./restaurant-site-schema";

export function projectPublicRestaurantSite(
  site: RestaurantSite,
): RestaurantSite {
  const categories = site.categories.filter((category) => !category.hidden);
  const visibleCategoryIds = new Set(categories.map((category) => category.id));
  const dishes = site.dishes.filter(
    (dish) =>
      visibleCategoryIds.has(dish.categoryId) &&
      !dish.hidden &&
      !dish.archived,
  );

  // A gallery item reused as any dish image stays out of the public gallery,
  // including when that dish is hidden or archived, so unpublished menu media
  // is not exposed through a different public surface.
  const dishImageIds = new Set(
    site.dishes
      .map((dish) => dish.image?.id)
      .filter((id): id is string => Boolean(id)),
  );

  return {
    ...site,
    categories,
    dishes,
    media: {
      ...site.media,
      gallery: site.media.gallery.filter((item) => !dishImageIds.has(item.id)),
    },
  };
}
