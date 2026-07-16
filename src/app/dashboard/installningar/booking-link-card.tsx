"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

type BookingLinkCardProps = {
  url: string;
};

export function BookingLinkCard({ url }: BookingLinkCardProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [copyLabel, setCopyLabel] = useState("Kopiera länk");

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#173e2b", light: "#ffffff" },
    })
      .then(setQrCodeUrl)
      .catch(() => setQrCodeUrl(""));
  }, [url]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyLabel("Länken är kopierad");
      window.setTimeout(() => setCopyLabel("Kopiera länk"), 2000);
    } catch {
      setCopyLabel("Kunde inte kopiera");
    }
  }

  function downloadQrCode() {
    if (!qrCodeUrl) return;
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = "proffera-bokning-qr.png";
    link.click();
  }

  return (
    <section className="rounded-xl border border-[#c9e6d0] bg-[#eef8f0] p-4 text-sm text-[#17452f]" aria-label="Publicerad bokningslänk och QR-kod">
      <p className="font-bold">Din publicerade bokningslänk</p>
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 block break-all font-semibold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#17452f]">
        {url}
      </a>
      <p className="mt-2 text-xs leading-5 text-[#466352]">Dela länken direkt eller använd QR-koden på skyltar, visitkort och sociala medier.</p>

      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-[#c9e6d0] bg-white p-4 sm:flex-row sm:items-center">
        {qrCodeUrl ? <Image src={qrCodeUrl} width={160} height={160} unoptimized alt={`QR-kod för ${url}`} className="h-40 w-40 rounded-lg border border-[#e4e9e2]" /> : <div className="h-40 w-40 rounded-lg bg-[#f7f9f6]" aria-hidden="true" />}
        <div className="grid gap-2">
          <button type="button" onClick={copyLink} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#173e2b] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2">
            {copyLabel}
          </button>
          <button type="button" onClick={downloadQrCode} disabled={!qrCodeUrl} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cfdbd1] bg-white px-4 py-2 text-sm font-bold text-[#17452f] transition hover:bg-[#f1f5f2] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2">
            Hämta QR-kod
          </button>
        </div>
      </div>
    </section>
  );
}
