export function GET() {
  return Response.json({
    name: "Julius Salong",
    short_name: "Julius",
    description: "Boka tid hos Julius Salong i Södertälje.",
    start_url: "/boka/julius-salong",
    scope: "/boka/julius-salong",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f4",
    theme_color: "#173e2b",
    icons: [
      {
        src: "/brand/julius-salong-app-icon.svg",
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
