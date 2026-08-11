import { getGalleryMediaBase64, getGalleryMediaMetadata } from "@/lib/website-gallery-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not found", { status: 404 });
}

function cacheHeaders(
  status: "draft" | "published" | "hidden",
  etag: string,
): Record<string, string> {
  if (status !== "published") {
    return {
      "Cache-Control": "private, no-store",
      ETag: etag,
    };
  }
  return {
    "Cache-Control": "public, max-age=31536000, immutable",
    "CDN-Cache-Control": "public, s-maxage=31536000, stale-while-revalidate=86400",
    "Vercel-CDN-Cache-Control": "public, s-maxage=31536000, stale-while-revalidate=86400",
    ETag: etag,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await getGalleryMediaMetadata(id);
  if (!media) return notFound();

  if (media.status !== "published") {
    const access = await getUserWorkspaceAccess();
    if (
      !access.ok ||
      !canManageWorkspaceSettings(access) ||
      access.workspaceId !== media.workspaceId
    ) {
      return notFound();
    }
  }

  const etag = `"gallery-${id}-${media.bytes}"`;
  const commonCacheHeaders = cacheHeaders(media.status, etag);
  if (media.status === "published" && request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: commonCacheHeaders,
    });
  }

  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/i.exec(range.trim());
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: {
          ...commonCacheHeaders,
          "Content-Range": `bytes */${media.bytes}`,
        },
      });
    }

    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : media.bytes - 1;
    const end = Math.min(requestedEnd, media.bytes - 1);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= media.bytes) {
      return new Response(null, {
        status: 416,
        headers: {
          ...commonCacheHeaders,
          "Content-Range": `bytes */${media.bytes}`,
        },
      });
    }

    const length = end - start + 1;
    const mediaBase64 = await getGalleryMediaBase64(id, start, length);
    if (!mediaBase64) return notFound();
    const chunk = Buffer.from(mediaBase64, "base64");

    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...commonCacheHeaders,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${media.bytes}`,
        "Content-Type": media.mimeType,
      },
    });
  }

  const mediaBase64 = await getGalleryMediaBase64(id);
  if (!mediaBase64) return notFound();
  const buffer = Buffer.from(mediaBase64, "base64");

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      ...commonCacheHeaders,
      "Accept-Ranges": "bytes",
      "Content-Length": String(buffer.length),
      "Content-Type": media.mimeType,
    },
  });
}
