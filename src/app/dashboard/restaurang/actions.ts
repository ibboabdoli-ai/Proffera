"use server";

import { publishRestaurantDraft, saveRestaurantDraft } from "@/lib/restaurant-site-db";

export async function saveDraft(value: unknown, revision: number) {
  return saveRestaurantDraft(value, revision);
}

export async function publishDraft(revision: number) {
  return publishRestaurantDraft(revision);
}
