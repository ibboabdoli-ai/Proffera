import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { detectRestaurantImageMime } from "@/lib/restaurant-image-type";
import { getRestaurantAdmin } from "@/lib/restaurant-site-db";
import { createGalleryItem } from "@/lib/website-gallery-db";
import {
  canManageWorkspaceSettings,
  getUserWorkspaceAccess,
} from "@/lib/workspace-access";

export const runtime = "nodejs";

async function cleanupUploadedBlob(url: string) {
  if (!url) return;
  try {
    await del(url);
  } catch (error) {
    console.warn("Failed to clean up orphaned restaurant image", error);
  }
}

export async function POST(request: Request) {
  const access = await getUserWorkspaceAccess();
  if (
    !access.ok ||
    !canManageWorkspaceSettings(access) ||
    !(await getRestaurantAdmin())
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const data = await request.formData();
  const file = data.get("file");
  const alt = String(data.get("alt") ?? "").trim();
  if (
    !(file instanceof File) ||
    !file.size ||
    file.size > 4 * 1024 * 1024 ||
    !alt ||
    alt.length > 180
  ) {
    return NextResponse.json(
      { error: "Välj en bild under 4 MB och skriv en bildbeskrivning." },
      { status: 400 },
    );
  }
  const detectedMime = await detectRestaurantImageMime(file);
  if (!detectedMime) {
    return NextResponse.json(
      { error: "Välj en riktig JPEG-, PNG-, WebP- eller AVIF-bild." },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const name = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
  const key = `gallery/${access.workspaceSlug}/${id}-${name}`;
  let uploadedUrl = "";
  try {
    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: detectedMime,
    });
    uploadedUrl = blob.url;
    const saved = await createGalleryItem({
      id,
      mediaType: "image",
      publicUrl: blob.url,
      storageKey: key,
      title: null,
      caption: null,
      altText: alt,
      displayStyle: "grid",
      mimeType: detectedMime,
      bytes: file.size,
    });
    if (!saved) {
      await cleanupUploadedBlob(uploadedUrl);
      return NextResponse.json(
        { error: "Bilden kunde inte sparas." },
        { status: 500 },
      );
    }
    return NextResponse.json({ id, url: blob.url, alt });
  } catch (error) {
    await cleanupUploadedBlob(uploadedUrl);
    console.error("Restaurant image upload failed", error);
    return NextResponse.json(
      { error: "Uppladdningen misslyckades." },
      { status: 500 },
    );
  }
}
