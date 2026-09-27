export type RestaurantImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif";

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export async function detectRestaurantImageMime(
  blob: Blob,
): Promise<RestaurantImageMime | null> {
  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }

  if (bytes.length >= 16 && ascii(bytes, 4, 4) === "ftyp") {
    for (let offset = 8; offset + 4 <= bytes.length; offset += 4) {
      const brand = ascii(bytes, offset, 4);
      if (brand === "avif" || brand === "avis") return "image/avif";
    }
  }

  return null;
}
