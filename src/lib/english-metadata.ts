import type { Metadata } from "next";

type EnglishMetadataInput = {
  title: string;
  description: string;
  englishPath: string;
  swedishPath: string;
};

export function createEnglishMetadata({
  title,
  description,
  englishPath,
  swedishPath,
}: EnglishMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: englishPath,
      languages: {
        "sv-SE": swedishPath,
        en: englishPath,
      },
    },
    openGraph: {
      title: `${title} | Proffera`,
      description,
      url: englishPath,
      siteName: "Proffera",
      locale: "en_US",
      type: "website",
    },
  };
}
