from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one target, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# Allow the explicitly supported Unknown floor count and avoid a duplicate legacy floor row.
replace_once(
    "src/app/primeview-booking/page.tsx",
    '    if (!pricingInput.cleaningScope || !pricingInput.frequency || !pricingInput.floors || totalWindows < 1) redirect(bookingUrl("error=invalid"));',
    '    if (!pricingInput.cleaningScope || !pricingInput.frequency || !pricingInput.floorCount || totalWindows < 1) redirect(bookingUrl("error=invalid"));',
)
replace_once(
    "src/app/primeview-booking/page.tsx",
    '    pricingInput.floors && `Floors: ${pricingInput.floors}`,\n',
    "",
)

# Keep the existing large/bay outside rates, while applying the user's new standard-window £3/£3/£5.50 rule.
replace_once(
    "src/features/primeview/pricing.ts",
    '    const both = input.cleaningScope === "Inside & outside";\n    const lines: PrimeViewPricingLine[] = [];\n    const standardRate = both ? 5.5 : 3;\n    const largeRate = both ? 7.5 : 5;\n    const bayRate = both ? 9.5 : 7;',
    '    const insideOnly = input.cleaningScope === "Inside only";\n    const both = input.cleaningScope === "Inside & outside";\n    const lines: PrimeViewPricingLine[] = [];\n    const standardRate = both ? 5.5 : 3;\n    const largeRate = insideOnly ? 3 : both ? 7.5 : 6;\n    const bayRate = insideOnly ? 3 : both ? 9 : 8;',
)

replace_once(
    "tests/primeview-precision-pricing.test.ts",
    '  it("uses consistent large and bay premiums for inside + outside", () => {\n    const result = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Inside & outside", standardWindows: 10, largeWindows: 2, bayWindows: 2, frequency: "One-off", access: "Normal", condition: "Normal", floorCount: "2" });\n    expect(result.kind).toBe("price");\n    if (result.kind === "price") {\n      expect(result.lines.some((line) => line.label.includes("2 large windows × £7.5"))).toBe(true);\n      expect(result.lines.some((line) => line.label.includes("2 very large / bay windows × £9.5"))).toBe(true);\n    }\n  });',
    '  it("preserves large and bay outside rates while discounting inside + outside", () => {\n    const outside = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Outside only", largeWindows: 2, bayWindows: 2, frequency: "One-off", access: "Normal", condition: "Normal", floorCount: "2" });\n    const inside = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Inside only", largeWindows: 2, bayWindows: 2, frequency: "One-off", access: "Normal", condition: "Normal", floorCount: "2" });\n    const both = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Inside & outside", standardWindows: 10, largeWindows: 2, bayWindows: 2, frequency: "One-off", access: "Normal", condition: "Normal", floorCount: "2" });\n    expect(outside.kind).toBe("price");\n    expect(inside.kind).toBe("price");\n    expect(both.kind).toBe("price");\n    if (outside.kind === "price") {\n      expect(outside.lines.some((line) => line.label.includes("2 large windows × £6"))).toBe(true);\n      expect(outside.lines.some((line) => line.label.includes("2 very large / bay windows × £8"))).toBe(true);\n    }\n    if (inside.kind === "price") {\n      expect(inside.lines.some((line) => line.label.includes("2 large windows × £3"))).toBe(true);\n      expect(inside.lines.some((line) => line.label.includes("2 very large / bay windows × £3"))).toBe(true);\n    }\n    if (both.kind === "price") {\n      expect(both.lines.some((line) => line.label.includes("2 large windows × £7.5"))).toBe(true);\n      expect(both.lines.some((line) => line.label.includes("2 very large / bay windows × £9"))).toBe(true);\n    }\n  });',
)

# Clarify the three access concepts in the customer UI.
replace_once(
    "src/app/primeview-booking/primeview-precision-booking-form.tsx",
    '<label className={labelClass}>Hard-access windows<input name="hard_access_windows"',
    '<label className={labelClass}>Windows needing difficult access<input name="hard_access_windows"',
)
replace_once(
    "src/app/primeview-booking/primeview-precision-booking-form.tsx",
    '<label className={labelClass}>Window access<select name="window_access"',
    '<label className={labelClass}>Window access type<select name="window_access"',
)
replace_once(
    "src/app/primeview-booking/primeview-precision-booking-form.tsx",
    '<label className={labelClass}>Access<select name="access"',
    '<label className={labelClass}>Overall property access<select name="access"',
)

# A logged-in PrimeView manager may read a private image only when it belongs to this booking.
photo_route = Path("src/app/api/primeview/booking-photo/route.ts")
text = photo_route.read_text()
old = '''export async function GET(request: Request) {
  const pathname = new URL(request.url).searchParams.get("pathname")?.trim() ?? "";
  if (!pathname.startsWith("primeview-booking/") || pathname.includes("..") || pathname.length > 800) return notFound();
'''
new = '''export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const pathname = searchParams.get("pathname")?.trim() ?? "";
  const bookingId = searchParams.get("bookingId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(bookingId) || !pathname.startsWith("primeview-booking/") || pathname.includes("..") || pathname.length > 800) return notFound();
'''
if text.count(old) != 1:
    raise RuntimeError("photo route request target not found exactly once")
text = text.replace(old, new, 1)
old = '''  if (!rows[0]) return notFound();

  try {
'''
new = '''  if (!rows[0]) return notFound();

  const bookingRows = await sql`
    select id
    from bookings
    where id::text = ${bookingId}
      and workspace_id = ${access.workspaceId}
      and position(${`Photo: ${pathname}`} in coalesce(notes, '')) > 0
    limit 1
  `;
  if (!bookingRows[0]) return notFound();

  try {
'''
if text.count(old) != 1:
    raise RuntimeError("photo route ownership target not found exactly once")
photo_route.write_text(text.replace(old, new, 1))

replace_once(
    "src/app/dashboard/bokningar/[id]/page.tsx",
    'const src = `/api/primeview/booking-photo?pathname=${encodeURIComponent(pathname)}`;',
    'const src = `/api/primeview/booking-photo?bookingId=${encodeURIComponent(booking.id)}&pathname=${encodeURIComponent(pathname)}`;',
)

print("Final PrimeView booking QA corrections applied")
