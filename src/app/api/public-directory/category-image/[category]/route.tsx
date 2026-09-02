import { ImageResponse } from "next/og";

export const runtime = "edge";

const categories: Record<string, { label: string; detail: string }> = {
  stadning: { label: "Städning", detail: "Städning & lokalvård" },
  hemservice: { label: "Hemservice", detail: "Konsumenttjänster i hemmet" },
  flytt: { label: "Flytt", detail: "Flyttjänster" },
  elektriker: { label: "Elektriker", detail: "Elinstallationer" },
  vvs: { label: "VVS", detail: "Värme & sanitet" },
  maleri: { label: "Måleri", detail: "Måleriarbeten" },
  snickeri: { label: "Snickeri", detail: "Byggnadssnickeri" },
  tradgard: { label: "Trädgård", detail: "Skötsel av grönytor" },
};

const fallbackCategory = { label: "Tjänsteföretag", detail: "Proffera" };

function CategoryMark() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 92,
        height: 92,
        borderRadius: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,.14)",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          border: "8px solid rgba(255,255,255,.92)",
          borderRadius: 10,
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

export async function GET(_: Request, context: { params: Promise<{ category: string }> }) {
  const { category } = await context.params;
  const item = Object.hasOwn(categories, category) ? categories[category] : fallbackCategory;

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
          <CategoryMark />
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
