export function GET() {
  return Response.json({
    name: "Proffera Kalender",
    short_name: "Kalender",
    description: "Bokningskalender för Proffera.",
    start_url: "/dashboard/kalender",
    scope: "/dashboard/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f4",
    theme_color: "#173e2b",
    icons: [
      {
        src: "/brand/proffera-calendar-app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  }, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
}
