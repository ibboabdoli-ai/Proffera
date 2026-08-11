"use client";

import { useMemo, useState } from "react";

const API_PATH = "/api/admin/foretag/directory/test-scan";

type ScanRow = {
  ok: boolean;
  organizationNumber: string;
  legalName?: string;
  legalForm?: string;
  city?: string;
  municipality?: string;
  sniCode?: string;
  sniLabel?: string;
  isActive?: boolean;
  score?: number;
  publicationStatus?: "inactive" | "blocked" | "review" | "ready";
  reasons?: string[];
  category?: string;
  error?: string;
};

type BatchResponse = {
  offset: number;
  nextOffset: number | null;
  total: number;
  results: ScanRow[];
  error?: string;
};

export default function DirectoryTestAutoScan({ enabled }: { enabled: boolean }) {
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(46);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    const valid = rows.filter((row) => row.ok);
    return {
      ready: valid.filter((row) => row.publicationStatus === "ready"),
      pilot: valid.filter((row) => {
        const location = `${row.city ?? ""} ${row.municipality ?? ""}`.toLocaleLowerCase("sv-SE");
        return location.includes("stockholm") || location.includes("södertälje");
      }),
      supported: valid.filter((row) => Boolean(row.category)),
      errors: rows.filter((row) => !row.ok),
    };
  }, [rows]);

  async function runScan() {
    if (!enabled || running) return;
    setRunning(true);
    setRows([]);
    setCompleted(0);
    setError("");

    let offset: number | null = 0;
    try {
      while (offset !== null) {
        const response = await fetch(`${API_PATH}?offset=${offset}`, {
          method: "GET",
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        const payload = await response.json() as BatchResponse;
        if (!response.ok) throw new Error(payload.error || `Källtest misslyckades (${response.status})`);

        setTotal(payload.total);
        setRows((current) => [...current, ...payload.results]);
        setCompleted(Math.min(payload.offset + payload.results.length, payload.total));
        offset = payload.nextOffset;

        if (offset !== null) await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Automatiskt Källtest misslyckades");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#cbd9ce] bg-[#f7fbf8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Automatisk genomgång</p>
          <h3 className="mt-2 text-xl font-black text-[#17201a]">Skanna alla officiella TEST-bolag</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#667169]">
            Kör TEST-listan i små batcher om fem. Inget sparas i databasen och Production är blockerad.
          </p>
        </div>
        <button
          type="button"
          onClick={runScan}
          disabled={!enabled || running}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#17452f] px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-[#8f9992]"
        >
          {running ? `Skannar ${completed}/${total}…` : "Skanna alla automatiskt"}
        </button>
      </div>

      {running || completed > 0 ? (
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-[#dfe8e1]">
            <div className="h-full bg-[#17452f] transition-all" style={{ width: `${total ? Math.round((completed / total) * 100) : 0}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold text-[#637067]">{completed} av {total} testade</p>
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-xl bg-[#fff0ed] p-4 text-sm font-bold text-[#8b3024]">{error}</p> : null}

      {rows.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs font-bold text-[#748078]">READY</p><p className="mt-1 text-2xl font-black">{summary.ready.length}</p></div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs font-bold text-[#748078]">PILOT-OMRÅDE</p><p className="mt-1 text-2xl font-black">{summary.pilot.length}</p></div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs font-bold text-[#748078]">STÖDD SNI</p><p className="mt-1 text-2xl font-black">{summary.supported.length}</p></div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs font-bold text-[#748078]">API-FEL</p><p className="mt-1 text-2xl font-black">{summary.errors.length}</p></div>
        </div>
      ) : null}

      {summary.ready.length ? (
        <div className="mt-6">
          <h4 className="font-black text-[#17452f]">Ready-kandidater</h4>
          <div className="mt-3 grid gap-3">
            {summary.ready.map((row) => (
              <div key={row.organizationNumber} className="rounded-xl border border-[#bdd7c4] bg-white p-4">
                <p className="font-black text-[#17201a]">{row.legalName || row.organizationNumber}</p>
                <p className="mt-1 text-sm text-[#657068]">{row.city || "Ort saknas"} · {row.category || "Kategori saknas"} · {row.sniCode || "SNI saknas"}</p>
                <p className="mt-1 text-xs font-bold text-[#17452f]">Org.nr {row.organizationNumber} · {row.score ?? 0}/100</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!running && rows.length && !summary.ready.length ? (
        <p className="mt-6 rounded-xl bg-white p-4 text-sm text-[#5f6b63] ring-1 ring-black/5">
          Ingen TEST-post blev <strong>ready</strong>. Då kan vi använda sammanställningen ovan för att välja närmaste säkra pilotfall eller justera TEST-strategin utan att gissa organisationsnummer.
        </p>
      ) : null}
    </section>
  );
}
