import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Company Directory admin list", () => {
  it("filters and paginates profiles in PostgreSQL instead of loading the full directory", () => {
    const pageCode = source("src/app/admin/foretag/directory/page.tsx");
    const adminCode = source("src/lib/company-directory-admin.ts");

    expect(pageCode).toContain("const PAGE_SIZE = 50");
    expect(pageCode).toContain('{ value: "published", label: "Publicerade" }');
    expect(pageCode).toContain('{ value: "ready", label: "Ready" }');
    expect(pageCode).toContain('{ value: "review", label: "Review" }');
    expect(pageCode).toContain('{ value: "inactive", label: "Inaktiva" }');
    expect(pageCode).toContain("getCompanyDirectoryAdminSnapshot({");
    expect(pageCode).toContain("status: currentStatus");
    expect(pageCode).toContain("query: searchQuery");
    expect(pageCode).toContain("pageSize: PAGE_SIZE");

    expect(adminCode).toContain("select count(*)::int as count");
    expect(adminCode).toContain("${status}::text = 'all'");
    expect(adminCode).toContain("${query}::text = ''");
    expect(adminCode).toContain("${categorySlug}::text <> ''");
    expect(adminCode).toContain("p.publication_status = ${status}");
    expect(adminCode).toContain("p.updated_at desc,\n        p.id");
    expect(adminCode).toContain("limit ${pageSize}");
    expect(adminCode).toContain("offset ${offset}");
  });

  it("keeps search, server-side pagination and direct access to published profiles", () => {
    const pageCode = source("src/app/admin/foretag/directory/page.tsx");
    const adminCode = source("src/lib/company-directory-admin.ts");

    expect(pageCode).toContain('aria-label="Sök företag, stad, kategori eller SNI"');
    expect(pageCode).toContain('placeholder="Sök företag, stad, kategori eller SNI"');
    expect(pageCode).toContain("categoryLabels[profile.categorySlug] || profile.categorySlug || \"–\"");
    expect(pageCode).toContain("profile.sniCode");
    expect(pageCode).toContain("profile.city");
    expect(pageCode).toContain("page: page - 1");
    expect(pageCode).toContain("page: page + 1");
    expect(pageCode).toContain('href={`/foretag/listad/${encodeURIComponent(profile.slug)}`}');

    expect(adminCode).toContain("if (normalized.length < 3) return \"\"");
    expect(adminCode).toContain("coalesce(p.display_name, '') ilike ${queryPattern}");
    expect(adminCode).toContain("coalesce(p.city, '') ilike ${queryPattern}");
    expect(adminCode).toContain("coalesce(p.primary_sni_code, '') ilike ${queryPattern}");
  });

  it("submits and restores the active list context after an admin publication", () => {
    const pageCode = source("src/app/admin/foretag/directory/page.tsx");
    const actionCode = source("src/app/admin/foretag/directory/actions.ts");

    expect(pageCode).toContain('name="returnStatus" value={currentStatus}');
    expect(pageCode).toContain('name="returnQuery" value={searchQuery}');
    expect(pageCode).toContain('name="returnPage" value={page}');
    expect(actionCode).toContain('formText(formData, "returnStatus", 20)');
    expect(actionCode).toContain('formText(formData, "returnQuery", 120)');
    expect(actionCode).toContain('formText(formData, "returnPage", 8)');
    expect(actionCode).toContain('params.set("status", returnStatus)');
    expect(actionCode).toContain('params.set("q", returnQuery)');
    expect(actionCode).toContain('params.set("page", String(returnPage))');
    expect(actionCode).not.toContain('requestHeaders.get("referer")');
  });

  it("shows concrete SCB and Review-recovery reasons instead of only a generic non-Ready status", () => {
    const pageCode = source("src/app/admin/foretag/directory/page.tsx");
    const adminCode = source("src/lib/company-directory-admin.ts");

    expect(adminCode).toContain("scb_snapshot_fresh");
    expect(adminCode).toContain('publishSafetyReasons.push("scb_evidence_stale")');
    expect(adminCode).toContain('publishSafetyReasons.push("scb_conflict")');
    expect(adminCode).toContain('publishSafetyReasons.push("review_recovery_eligible")');
    expect(pageCode).toContain('scb_evidence_stale: "SCB-underlaget är inte aktuellt för profilen"');
    expect(pageCode).toContain('scb_conflict: "SCB-data motsäger profilens officiella uppgifter"');
    expect(pageCode).toContain('review_recovery_eligible: "Klar för säker återgång till Ready vid nästa revalidation"');
  });
});
