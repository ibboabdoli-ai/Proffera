import type { Metadata } from "next";

type LocalizedMetadataInput = {
  title: string;
  description: string;
  englishPath: string;
  swedishPath: string;
};

function localizedAlternates({ englishPath, swedishPath }: Pick<LocalizedMetadataInput, "englishPath" | "swedishPath">) {
  return {
    languages: {
      "sv-SE": swedishPath,
      en: englishPath,
    },
  };
}

export function createEnglishMetadata({
  title,
  description,
  englishPath,
  swedishPath,
}: LocalizedMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: englishPath,
      ...localizedAlternates({ englishPath, swedishPath }),
    },
    openGraph: {
      title: `${title} | Proffera`,
      description,
      url: englishPath,
      siteName: "Proffera",
      locale: "en_US",
      type: "website",
      images: ["/og"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Proffera`,
      description,
      images: ["/og"],
    },
  };
}

export function createSwedishMetadata({
  title,
  description,
  englishPath,
  swedishPath,
}: LocalizedMetadataInput): Metadata {
  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: swedishPath,
      ...localizedAlternates({ englishPath, swedishPath }),
    },
    openGraph: {
      title,
      description,
      url: swedishPath,
      siteName: "Proffera",
      locale: "sv_SE",
      type: "website",
      images: ["/og"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og"],
    },
  };
}
