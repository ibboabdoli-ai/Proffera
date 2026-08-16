import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Public experience UX 2.0", () => {
  it("scopes the dedicated presentation layer across gallery, business website and reminders", () => {
    const css = source("src/components/dashboard/public-experience-ux-2.module.css");
    const galleryLayout = source("src/app/dashboard/galleri/layout.tsx");
    const websiteLayout = source("src/app/dashboard/installningar/foretagssida/layout.tsx");
    const reminderLayout = source("src/app/dashboard/installningar/paminnelser/layout.tsx");

    expect(css).toContain("var(--pf-brand)");
    expect(css).toContain("var(--pf-surface)");
    expect(css).toContain("var(--pf-line)");
    expect(css).toContain("var(--pf-radius-control)");
    expect(css).toContain("prefers-reduced-motion");
    expect(galleryLayout).toContain('featureKey="media_gallery"');
    expect(galleryLayout).toContain("styles.scope");
    expect(websiteLayout).toContain("styles.scope");
    expect(reminderLayout).toContain("styles.scope");
  });

  it("preserves gallery permissions, upload validation and publication actions", () => {
    const gallery = source("src/app/dashboard/galleri/page.tsx");
    const upload = source("src/app/api/dashboard/gallery/upload/route.ts");

    expect(gallery).toContain("canManageWorkspaceSettings(access)");
    expect(gallery).toContain('action="/api/dashboard/gallery/upload"');
    expect(gallery).toContain('"publish" | "hide" | "delete"');
    expect(gallery).toContain("updateGalleryItem(id, action)");
    expect(upload).toContain("canManageWorkspaceSettings(access)");
    expect(upload).toContain("const maxUploadBytes = 4 * 1024 * 1024");
    expect(upload).toContain('new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])');
    expect(upload).toContain('new Set(["video/mp4", "video/webm", "video/quicktime"])');
    expect(upload).toContain("createGalleryItem");
  });

  it("preserves business website mode, entitlements and workspace-scoped persistence", () => {
    const website = source("src/app/dashboard/installningar/foretagssida/page.tsx");

    expect(website).toContain("canManageWorkspaceSettings(access)");
    expect(website).toContain('hasWorkspaceFeature("website_builder")');
    expect(website).toContain('hasWorkspaceFeature("custom_domain")');
    expect(website).toContain('public_home_mode = ${publicHomeMode}');
    expect(website).toContain("where workspace_id = ${access.workspaceId}::uuid");
    expect(website).toContain('publicHomeMode === "website"');
    expect(website).toContain("Domänkopplingen ändras inte");
  });

  it("preserves reminder policy fields, permissions and delivery history", () => {
    const reminders = source("src/app/dashboard/installningar/paminnelser/page.tsx");

    expect(reminders).toContain("canManageWorkspaceSettings(access)");
    expect(reminders).toContain("updateBookingReminderSettings");
    expect(reminders).toContain("getRecentReminderDeliveries");
    expect(reminders).toContain('formData.get("isEnabled") === "on"');
    expect(reminders).toContain('formData.get("emailEnabled") === "on"');
    expect(reminders).toContain('formData.get("smsEnabled") === "on"');
    expect(reminders).toContain('formData.get("customerRescheduleEnabled") === "on"');
    expect(reminders).toContain('formData.get("customerCancelEnabled") === "on"');
    expect(reminders).toContain('formData.get("companyConfirmationRequired") === "on"');
    expect(reminders).toContain('formData.get("noShowEnabled") === "on"');
    expect(reminders).toContain('formData.get("autoCompleteEnabled") === "on"');
  });
});
