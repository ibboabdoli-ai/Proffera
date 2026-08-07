import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { validateServiceJobAttachment } from "@/lib/service-job-attachment-policy";
import {
  createDashboardServiceJobAttachment,
  getDashboardServiceJobAttachmentUrl,
} from "@/lib/workspace-service-job-attachments-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";

function jobRedirect(request: Request, jobId: string, state: string, lang: string) {
  const query = new URLSearchParams({ state });
  if (lang === "en") query.set("lang", "en");
  return NextResponse.redirect(new URL(`/dashboard/uppdrag/${encodeURIComponent(jobId)}?${query}`, request.url), 303);
}

export async function GET(request: Request) {
  try {
    const attachmentId = new URL(request.url).searchParams.get("id") ?? "";
    const storageUrl = await getDashboardServiceJobAttachmentUrl(attachmentId);
    if (!storageUrl) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    return NextResponse.redirect(storageUrl, 302);
  } catch {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }
}

export async function POST(request: Request) {
  let uploadedUrl = "";
  let jobId = "";
  let lang = "";

  try {
    const access = await getUserWorkspaceAccess();
    if (!access.ok || !canManageWorkspaceSettings(access)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    jobId = String(formData.get("jobId") ?? "");
    lang = String(formData.get("lang") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File)) return jobRedirect(request, jobId, "attachment_invalid", lang);

    const validation = validateServiceJobAttachment({ name: file.name, type: file.type, size: file.size });
    if (!validation.ok) return jobRedirect(request, jobId, `attachment_${validation.code}`, lang);

    const hasBlobCredentials = Boolean(
      process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
    );
    if (!hasBlobCredentials) return jobRedirect(request, jobId, "attachment_storage", lang);

    const pathname = `service-jobs/${access.workspaceSlug}/${jobId}/${crypto.randomUUID()}-${validation.safeFileName}`;
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    });
    uploadedUrl = blob.url;

    await createDashboardServiceJobAttachment({
      jobId,
      fileName: validation.safeFileName,
      storageKey: blob.url,
      contentType: file.type,
      byteSize: file.size,
    });

    return jobRedirect(request, jobId, "attachment_added", lang);
  } catch (error) {
    if (uploadedUrl) {
      try {
        await del(uploadedUrl);
      } catch (cleanupError) {
        console.warn("Failed to clean up orphaned service job attachment", cleanupError);
      }
    }
    console.error("Failed to upload service job attachment", error);
    return jobId
      ? jobRedirect(request, jobId, "attachment_error", lang)
      : NextResponse.json({ error: "Attachment upload failed" }, { status: 500 });
  }
}
