import { revalidateTag } from "next/cache";

export const PUBLISHED_DIRECTORY_LOCATION_SUGGESTIONS_TAG = "published-directory-location-suggestions";

export function expirePublishedDirectoryLocationSuggestions() {
  try {
    revalidateTag(PUBLISHED_DIRECTORY_LOCATION_SUGGESTIONS_TAG, { expire: 0 });
  } catch (error) {
    console.error("Failed to expire public directory location suggestions", error);
  }
}
