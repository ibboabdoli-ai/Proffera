export type BookingAppearance = "light" | "dark";

const fixedThemeAppearance: Record<string, BookingAppearance | undefined> = {
  premium: "dark",
  restaurant: "dark",
  minimal: "light",
};

export function normalizeBookingThemeAppearance(themeKey: string, appearance: BookingAppearance): BookingAppearance {
  return fixedThemeAppearance[themeKey] ?? appearance;
}

export function bookingThemeAppearanceIsFixed(themeKey: string) {
  return Boolean(fixedThemeAppearance[themeKey]);
}

function relativeLuminance(hex: string) {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((part) => Number.parseInt(part, 16) / 255);
  const [r, g, b] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableBookingTextColor(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "#ffffff";

  const background = `#${value}`;
  const preferredDark = "#17201a";
  const white = "#ffffff";
  if (contrastRatio(background, preferredDark) >= 4.5) return preferredDark;
  if (contrastRatio(background, white) >= 4.5) return white;
  return "#000000";
}
