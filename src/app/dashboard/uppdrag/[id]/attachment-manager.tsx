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
    <section className="mb-6 rounded-[24px] border border-[#dfe6df] bg-white p-5 shadow-sm sm:p-6" aria-label={copy.title}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f2ec] text-[#17452f]"><Paperclip className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-bold text-[#17201a]">{copy.title}</h2><p className="mt-1 text-sm leading-6 text-[#667168]">{copy.intro}</p></div>
      </div>

      {hasAttachmentState ? <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${success ? "bg-[#eef8f1] text-[#17452f] ring-1 ring-[#cfe8d6]" : "bg-[#fff5f2] text-[#8f2f1b] ring-1 ring-[#f4c7ba]"}`}>{success ? copy.added : copy.error}</p> : null}

      {canManage ? (
        <form action="/api/dashboard/service-jobs/attachments" method="post" encType="multipart/form-data" className="mt-5 grid gap-3 rounded-xl bg-[#f7f9f6] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]"><span>{copy.choose}</span><input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full rounded-xl border border-[#cfd8cf] bg-white px-3 py-2 text-sm" /><span className="text-xs font-normal text-[#778179]">{copy.hint}</span></label>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-5 py-2.5 text-sm font-bold text-white"><Upload className="h-4 w-4" />{copy.upload}</button>
        </form>
      ) : null}

      <div className="mt-5 grid gap-2">
        {attachments.length ? attachments.map((attachment) => (
          <a key={attachment.id} href={`/api/dashboard/service-jobs/attachments?id=${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e8e1] bg-[#fbfcfa] px-4 py-3 text-sm transition hover:border-[#bfcdbf] hover:bg-white">
            <span className="min-w-0"><span className="block truncate font-semibold text-[#17201a]">{attachment.fileName}</span><span className="mt-1 block text-xs text-[#778179]">{[attachment.contentType, formatBytes(attachment.byteSize)].filter(Boolean).join(" · ")}</span></span>
            <span className="inline-flex shrink-0 items-center gap-1 font-bold text-[#17452f]">{copy.open}<ExternalLink className="h-4 w-4" /></span>
          </a>
        )) : <p className="text-sm text-[#667168]">{copy.empty}</p>}
      </div>
    </section>
  );
}
