import { ImageResponse } from "next/og";

import { primeViewSite } from "@/lib/primeview-seo";

export const alt = "PrimeView Window Care — Exterior cleaning in West and North London";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "linear-gradient(135deg, #020d26 0%, #061b45 54%, #0b2d6d 100%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "74px 84px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>
          PrimeView Window Care
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 960 }}>
          <div style={{ color: "#b8ceff", display: "flex", fontSize: 25, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            West &amp; North London
          </div>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>
            Window, gutter &amp; exterior cleaning
          </div>
          <div style={{ color: "#dbeafe", display: "flex", fontSize: 30, lineHeight: 1.35 }}>
            Professional care for homes and businesses.
          </div>
        </div>
        <div style={{ color: "#b8ceff", display: "flex", fontSize: 24, fontWeight: 600 }}>
          {primeViewSite.telephoneDisplay} · Free, no-obligation quotes
        </div>
      </div>
    ),
    size,
  );
}
