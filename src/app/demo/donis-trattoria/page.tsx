import type { Metadata } from "next";

import { DonisTrattoriaExperience } from "./demo-interactions";

const heroImage =
  "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/05/donis-pizzorny.jpg";

export const metadata: Metadata = {
  title: { absolute: "Doni’s Trattoria – website concept by Proffera" },
  description:
    "Tvåspråkigt restaurangkoncept för Doni’s Trattoria med digital meny, familjeberättelse, En smak av Europa, galleri och länkar till befintlig bokning och beställning.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Doni’s Trattoria – website concept by Proffera",
    description:
      "Digital meny, familjedriven berättelse, europeiska specialrätter, galleri och befintliga boknings- och beställningsflöden.",
    type: "website",
    url: "https://www.proffera.se/demo/donis-trattoria",
    images: [
      {
        url: heroImage,
        width: 1200,
        height: 900,
        alt: "Doni’s Trattoria – redesign concept",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Doni’s Trattoria – website concept by Proffera",
    description:
      "Ett tvåspråkigt restaurangkoncept med digital meny och enkel innehållshantering.",
    images: [heroImage],
  },
};

export default function DonisTrattoriaDemoPage() {
  return <DonisTrattoriaExperience />;
}
