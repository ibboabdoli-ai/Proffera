import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { createGalleryItem } from "@/lib/website-gallery-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const allowedVideoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const displayStyles = new Set(["grid", "masonry", "slider", "hero", "video"]);
const maxUploadBytes = 4 * 1024 * 1024;

function redirectToGallery(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/dashboard/galleri?${status}`, request.url), 303);
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
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

    if (file.size > maxUploadBytes) {
      return NextResponse.json({ error: "Files must be under 4 MB." }, { status: 400 });
    }

    const requestedStyle = String(formData.get("display_style") ?? "grid");
    const displayStyle = displayStyles.has(requestedStyle) ? requestedStyle : isVideo ? "video" : "grid";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
    const id = crypto.randomUUID();
    const pathname = `gallery/${access.workspaceSlug}/${id}-${safeName}`;

    let blob;
    try {
      blob = await put(pathname, file, {
        access: "public",
        addRandomSuffix: false,
        contentType: file.type,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Gallery Blob upload failed; database fallback is disabled to protect Neon transfer quota",
          route: "/api/dashboard/gallery/upload",
          workspace: access.workspaceSlug,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        }),
      );
      return redirectToGallery(request, "error=storage");
    }

    const saved = await createGalleryItem({
      id,
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

    if (!saved) return redirectToGallery(request, "error=save");

    console.log(
      JSON.stringify({
        level: "info",
        message: "Gallery media uploaded",
        route: "/api/dashboard/gallery/upload",
        workspace: access.workspaceSlug,
        storage: "blob",
        bytes: file.size,
        durationMs: Date.now() - startedAt,
      }),
    );

    return redirectToGallery(request, "uploaded=1");
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Gallery upload failed",
        route: "/api/dashboard/gallery/upload",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      }),
    );
    return redirectToGallery(request, "error=upload");
  }
}
