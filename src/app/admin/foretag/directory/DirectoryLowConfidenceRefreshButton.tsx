"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { refreshLowConfidenceDirectoryBatchAction } from "./actions";

type Progress = {
  refreshed: number;
  published: number;
  stillBelow95: number;
  blockedBySafety: number;
  deferred: number;
  errors: number;
  remaining: number;
  errorSummary: string;
};

const EMPTY_PROGRESS: Progress = {
  refreshed: 0,
  published: 0,
  stillBelow95: 0,
  blockedBySafety: 0,
  deferred: 0,
  errors: 0,
  remaining: 0,
  errorSummary: "",
};

export default function DirectoryLowConfidenceRefreshButton({ initialCount }: { initialCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress>({ ...EMPTY_PROGRESS, remaining: initialCount ?? 0 });
  const [finished, setFinished] = useState(false);

  if (pathname !== "/admin/foretag/directory") return null;

  async function refreshAll() {
    if (running || initialCount === 0) return;

    setRunning(true);
    setFinished(false);
    let scanStartedAt: string | undefined;
    let totals: Progress = { ...EMPTY_PROGRESS, remaining: initialCount ?? 0 };

    try {
      for (let batch = 0; batch < 100; batch += 1) {
        const result = await refreshLowConfidenceDirectoryBatchAction(scanStartedAt);
        scanStartedAt = result.scanStartedAt;
        totals = {
          refreshed: totals.refreshed + result.refreshed,
          published: totals.published + result.published,
          stillBelow95: totals.stillBelow95 + result.stillBelow95,
          blockedBySafety: totals.blockedBySafety + result.blockedBySafety,
          deferred: totals.deferred + result.deferred,
          errors: totals.errors + result.errors,
          remaining: result.remaining,
          errorSummary: result.errorSummary || totals.errorSummary,
        };
        setProgress(totals);
        router.refresh();

        if (result.errors > 0 || result.completed || result.selected === 0) {
          setFinished(result.completed && result.errors === 0);
          break;
        }
      }
    } catch {
      totals = {
        ...totals,
        errors: totals.errors + 1,
        errorSummary: "Körningen avbröts. Inga profiler publiceras utan att säkerhetskontrollen godkänner dem.",
      };
      setProgress(totals);
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="rounded-2xl border border-[#d6e2d8] bg-[#f1f7f2] p-5 shadow-lg shadow-black/5">
      <div className="flex flex-col gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-[#17452f]">
            <ShieldCheck className="h-5 w-5" /> Säker uppdatering under 95%
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#526057]">
            Hämtar nya Official Facts för Ready-profiler under 95%, räknar om kategorisäkerheten och publicerar endast om den befintliga säkerhetskontrollen efter uppdateringen ger minst 95% och inga spärrar finns.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={running || initialCount === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17452f] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123724] disabled:cursor-not-allowed disabled:bg-[#9aa59e] focus:outline-none focus:ring-4 focus:ring-[#17452f]/20"
        >
          <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running
            ? `Uppdaterar · ${progress.remaining} kvar`
            : initialCount === undefined
              ? "Uppdatera profiler under 95%"
              : `Uppdatera under 95% (${initialCount})`}
        </button>
      </div>

      {(running || progress.refreshed > 0 || progress.errors > 0) ? (
        <div className="mt-4 grid gap-2 text-xs font-bold text-[#526057] sm:grid-cols-2" role="status" aria-live="polite">
          <span>Uppdaterade: {progress.refreshed}</span>
          <span>Publicerade: {progress.published}</span>
          <span>Fortfarande &lt;95: {progress.stillBelow95}</span>
          <span>Säkerhet stoppade: {progress.blockedBySafety}</span>
          <span>Övrigt väntar: {progress.deferred}</span>
          <span>Kvar: {progress.remaining}</span>
        </div>
      ) : null}

      {finished ? (
        <p className="mt-3 text-sm font-black text-[#17452f]">Klart. Alla profiler som ingick i den här manuella körningen har kontrollerats.</p>
      ) : null}

      {progress.errors > 0 ? (
        <p className="mt-3 text-sm font-bold text-[#8a2b20]">Körningen stoppades säkert efter ett fel. {progress.errorSummary}</p>
      ) : null}
    </div>
  );
}
