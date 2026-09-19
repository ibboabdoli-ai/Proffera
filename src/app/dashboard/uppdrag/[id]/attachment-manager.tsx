"use client";

import { ExternalLink, Paperclip, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";

import type { DashboardServiceJobAttachment } from "@/lib/workspace-service-job-attachments-db";

function formatBytes(value: number | null) {
  if (value === null) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function ServiceJobAttachmentManager({
  jobId,
  attachments,
  canManage,
}: {
  jobId: string;
  attachments: DashboardServiceJobAttachment[];
  canManage: boolean;
}) {
  const searchParams = useSearchParams();
  const isEnglish = searchParams.get("lang") === "en";
  const state = searchParams.get("state") ?? "";
  const copy = isEnglish
    ? {
        title: "Files",
        intro: "Add photos or a PDF to the job. Files are isolated to the active workspace.",
        choose: "Choose file",
        upload: "Upload file",
        hint: "PDF, JPG, PNG or WebP · max 4 MB",
        empty: "No files have been uploaded yet.",
        open: "Open",
        added: "The file was uploaded.",
        error: "The file could not be uploaded. Check the type, size and storage configuration.",
      }
    : {
        title: "Filhantering",
        intro: "Lägg till foton eller PDF till uppdraget. Filerna isoleras till aktiv arbetsyta.",
        choose: "Välj fil",
        upload: "Ladda upp fil",
        hint: "PDF, JPG, PNG eller WebP · max 4 MB",
        empty: "Inga filer har laddats upp ännu.",
        open: "Öppna",
        added: "Filen laddades upp.",
        error: "Filen kunde inte laddas upp. Kontrollera filtyp, storlek och lagringskonfiguration.",
      };
  const hasAttachmentState = state.startsWith("attachment_");
  const success = state === "attachment_added";

  return (
    <section className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6" aria-label={copy.title}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand"><Paperclip className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-bold text-ink">{copy.title}</h2><p className="mt-1 text-sm leading-6 text-ink-muted">{copy.intro}</p></div>
      </div>

      {hasAttachmentState ? <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${success ? "border border-[#cfe8d6] bg-[#eaf8f2] text-[#087754]" : "border border-[#f4c7ba] bg-[#fff5f2] text-danger"}`}>{success ? copy.added : copy.error}</p> : null}

      {canManage ? (
        <form action="/api/dashboard/service-jobs/attachments" method="post" encType="multipart/form-data" className="mt-5 grid gap-3 rounded-control border border-line bg-surface-subtle p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
          <label className="grid gap-2 text-sm font-semibold text-ink"><span>{copy.choose}</span><input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full rounded-control border border-line bg-surface px-3 py-2 text-sm" /><span className="text-xs font-normal text-ink-muted">{copy.hint}</span></label>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand-deep px-5 py-2.5 text-sm font-bold text-white"><Upload className="h-4 w-4" />{copy.upload}</button>
        </form>
      ) : null}

      <div className="mt-5 grid gap-2">
        {attachments.length ? attachments.map((attachment) => (
          <a key={attachment.id} href={`/api/dashboard/service-jobs/attachments?id=${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface-subtle px-4 py-3 text-sm transition hover:border-line-strong hover:bg-surface">
            <span className="min-w-0"><span className="block truncate font-semibold text-ink">{attachment.fileName}</span><span className="mt-1 block text-xs text-ink-muted">{[attachment.contentType, formatBytes(attachment.byteSize)].filter(Boolean).join(" · ")}</span></span>
            <span className="inline-flex shrink-0 items-center gap-1 font-bold text-brand">{copy.open}<ExternalLink className="h-4 w-4" /></span>
          </a>
        )) : <p className="text-sm text-ink-muted">{copy.empty}</p>}
      </div>
    </section>
  );
}
