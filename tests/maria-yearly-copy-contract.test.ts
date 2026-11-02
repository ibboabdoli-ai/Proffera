import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Maria per-year copy and manual booking controls", () => {
  it("exposes per-year text and price fields plus existing booking actions", () => {
    const page = read("src/app/dashboard/maria/page.tsx");
    expect(page).toContain('name="trial_description"');
    expect(page).toContain('name="without_description"');
    expect(page).toContain('href="/dashboard/bokningar/blockera"');
    expect(page).toContain('href="/dashboard/bokningar"');
    expect(page).toContain('step="0.01"');
    expect(page).toContain('id="maria-year"');
    expect(page).toContain('const editHours = [5,6,0]');
    expect(page).toContain('id="tider"');
    expect(page).toContain('id="priser"');
  });
  it("scopes public copy to Maria services and does not expose customer data", () => {
    const api = read("src/app/api/makeup-by-maria/config/route.ts");
    expect(api).toContain("short_description");
    expect(api).toContain("trialDescription:");
    expect(api).toContain("withoutDescription:");
    expect(api).toContain("public_slug ~ '^maria-bridal-");
    expect(api).not.toContain("customer_email");
    expect(api).toContain("weekday in (0, 5, 6)");
    expect(api).toContain("no-store");
  });
  it("renders the Swedish copy without changing other-language translations", () => {
    const page = read("public/demo/makeup-by-maria-v2.html");
    expect(page).toContain('if(state.lang==="sv"&&state.year)');
    expect(page).toContain('textContent=details.trialDescription');
    expect(page).toContain('textContent=details.withoutDescription');
    expect(page).toContain('[0,5,6].includes(weekday)');
    expect(page).toContain('cache:"no-store"');
  });
  it("keeps writes scoped, logged and publication state intact", () => {
    const action = read("src/app/dashboard/maria/actions.ts");
    expect(action).toContain('access.workspaceSlug !== "makeup-by-maria"');
    expect(action).toContain("description=excluded.description");
    expect(action).toContain("short_description=excluded.short_description");
    expect(action).toContain("public_status=workspace_services.public_status");
  });
});
