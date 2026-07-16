import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Proffera Kundportal",
    short_name: "Proffera",
    description: "Kundportal för bokningar, leads och kundrelationer.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f7f4",
    theme_color: "#17452f",
    icons: [
      {
        src: "/brand/proffera-app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
