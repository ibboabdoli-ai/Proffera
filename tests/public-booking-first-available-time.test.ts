import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Public booking first available time UX", () => {
  it("moves the default booking form to the first available day after service selection", () => {
    const code = source("src/app/boka/[slug]/booking-request-form.tsx");

    expect(code).toContain("function chooseDefaultService(id: string)");
    expect(code).toContain("const first = firstAvailability.get(id)");
    expect(code).toContain("setDate(first?.date ?? today)");
    expect(code).toContain("onChange={(e) => chooseDefaultService(e.target.value)}");
    expect(code).toContain('select name="service_id"');
  });

  it("does not present an unexplained empty time selector on a closed or full day", () => {
    const code = source("src/app/boka/[slug]/booking-request-form.tsx");

    expect(code).toContain("selectedService && !times.length ? t.noTimesDay : t.chooseTime");
    expect(code).toContain("t.nearestAvailable");
    expect(code).toContain("disabled={!selectedService || !times.length}");
    expect(code).toContain('data-booking-form="default"');
  });
});
