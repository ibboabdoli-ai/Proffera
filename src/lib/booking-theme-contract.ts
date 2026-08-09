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

export function readableBookingTextColor(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "#ffffff";

  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 150 ? "#17201a" : "#ffffff";
}
