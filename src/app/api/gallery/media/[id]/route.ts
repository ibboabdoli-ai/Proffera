import { getGalleryMedia } from "@/lib/website-gallery-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not found", { status: 404 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await getGalleryMedia(id);
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

  const buffer = Buffer.from(media.mediaBase64, "base64");
  const cacheControl = media.status === "published" ? "public, max-age=31536000, immutable" : "private, no-store";
  const range = request.headers.get("range");

  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/i.exec(range.trim());
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${buffer.length}` },
      });
    }

    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : buffer.length - 1;
    const end = Math.min(requestedEnd, buffer.length - 1);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= buffer.length) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${buffer.length}` },
      });
    }

    const chunk = buffer.subarray(start, end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": cacheControl,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
        "Content-Type": media.mimeType,
      },
    });
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
      "Content-Length": String(buffer.length),
      "Content-Type": media.mimeType,
    },
  });
}
