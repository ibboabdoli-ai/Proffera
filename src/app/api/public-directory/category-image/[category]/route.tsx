import { ImageResponse } from "next/og";

export const runtime = "edge";

const categories: Record<string, { label: string; icon: string; detail: string }> = {
  stadning: { label: "Städning", icon: "✦", detail: "Städning & lokalvård" },
  flytt: { label: "Flytt", icon: "↗", detail: "Flyttjänster" },
  elektriker: { label: "Elektriker", icon: "⚡", detail: "Elinstallationer" },
  vvs: { label: "VVS", icon: "◌", detail: "Värme & sanitet" },
  maleri: { label: "Måleri", icon: "◒", detail: "Måleriarbeten" },
  snickeri: { label: "Snickeri", icon: "◇", detail: "Byggnadssnickeri" },
  tradgard: { label: "Trädgård", icon: "❋", detail: "Skötsel av grönytor" },
};

export async function GET(_: Request, context: { params: Promise<{ category: string }> }) {
  const { category } = await context.params;
  const item = categories[category] ?? { label: "Tjänsteföretag", icon: "P", detail: "Proffera" };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          color: "#ffffff",
          background: "linear-gradient(135deg, #173e2b 0%, #245f43 55%, #111b15 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "0.02em" }}>Proffera</div>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,.14)",
              fontSize: 50,
            }}
          >
            {item.icon}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, opacity: 0.72, marginBottom: 14 }}>Illustrationsbild</div>
          <div style={{ fontSize: 74, lineHeight: 1, fontWeight: 900 }}>{item.label}</div>
          <div style={{ fontSize: 30, opacity: 0.8, marginTop: 18 }}>{item.detail}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 720,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
      },
    },
  );
}
