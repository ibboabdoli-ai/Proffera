import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { createGalleryItem } from "@/lib/website-gallery-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const allowedVideoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const displayStyles = new Set(["grid", "masonry", "slider", "hero", "video"]);

export async function POST(request: Request) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  }

  const isImage = allowedImageTypes.has(file.type);
  const isVideo = allowedVideoTypes.has(file.type);
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }

  const maxBytes = isImage ? 8 * 1024 * 1024 : 40 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: isImage ? "Images must be under 8 MB." : "Videos must be under 40 MB." }, { status: 400 });
  }

  const requestedStyle = String(formData.get("display_style") ?? "grid");
  const displayStyle = displayStyles.has(requestedStyle) ? requestedStyle : isVideo ? "video" : "grid";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
  const pathname = `gallery/${access.workspaceSlug}/${crypto.randomUUID()}-${safeName}`;
  const blob = await put(pathname, file, { access: "public", addRandomSuffix: false, contentType: file.type });

  const saved = await createGalleryItem({
    mediaType: isVideo ? "video" : "image",
    publicUrl: blob.url,
    storageKey: pathname,
    title: String(formData.get("title") ?? "").trim() || null,
    caption: String(formData.get("caption") ?? "").trim() || null,
    altText: String(formData.get("alt_text") ?? "").trim() || (isVideo ? "PrimeView project video" : "PrimeView completed work"),
    displayStyle: displayStyle as "grid" | "masonry" | "slider" | "hero" | "video",
    mimeType: file.type,
    bytes: file.size,
  });

  if (!saved) return NextResponse.json({ error: "Could not save media metadata." }, { status: 503 });
  return NextResponse.redirect(new URL("/dashboard/galleri?uploaded=1", request.url), 303);
}