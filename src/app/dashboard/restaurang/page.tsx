import { redirect } from "next/navigation";

import { getRestaurantAdmin } from "@/lib/restaurant-site-db";
import { getDashboardGalleryItems } from "@/lib/website-gallery-db";
import {
  canManageWorkspaceSettings,
  getUserWorkspaceAccess,
} from "@/lib/workspace-access";
import { RestaurantEditor } from "./restaurant-editor";

export const dynamic = "force-dynamic";

export default async function RestaurantAdminPage() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");
  const site = await getRestaurantAdmin();
  if (!site) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold">Restaurang</h1>
        <p className="mt-4">
          Ingen restaurangwebbplats är kopplad till den här arbetsytan. Kontakta
          Proffera för att koppla ägarens arbetsyta.
        </p>
      </main>
    );
  }
  const images = (await getDashboardGalleryItems()).filter(
    (item) => item.mediaType === "image",
  );
  return (
    <RestaurantEditor
      initial={site}
      images={images.map(({ id, publicUrl, altText }) => ({
        id,
        url: publicUrl,
        alt: altText,
      }))}
    />
  );
}
