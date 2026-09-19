import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function between(content: string, start: string, end: string) {
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Expected source markers: ${start} -> ${end}`);
  return content.slice(startIndex, endIndex);
}

describe("dashboard workflow human-designed UX contract", () => {
  it("keeps quote and job detail workflows intact while using the workspace system", () => {
    const quote = source("src/app/dashboard/offerter/[id]/page.tsx");
    const job = source("src/app/dashboard/uppdrag/[id]/page.tsx");

    expect(quote).toContain("validateWorkspaceQuoteOfferDraft");
    expect(quote).toContain("createDashboardWorkspaceQuoteOfferDraft");
    expect(quote).toContain("transitionDashboardWorkspaceQuoteRequest");
    expect(quote).toContain("bg-brand-deep");
    expect(quote).toContain("border-line");

    expect(job).toContain("assignDashboardWorkspaceServiceJob");
    expect(job).toContain("transitionDashboardWorkspaceServiceJob");
    expect(job).toContain("addDashboardWorkspaceServiceJobNote");
    expect(job).toContain('name="evidence"');
    expect(job).toContain('name="staffId"');
    expect(job).toContain("bg-brand-deep");
    expect(job).toContain('aria-label={text.notes}');
    expect(job).toContain('aria-label={text.assignment}');
    const evidenceControl = between(job, 'name="evidence"', "</label>");
    const noteControl = between(job, 'name="body"', '<button type="submit"');
    const assignmentControl = between(job, 'name="staffId"', '<button type="submit"');
    expect(evidenceControl).toContain("px-3 py-2 text-base sm:text-sm");
    expect(noteControl).toContain("px-3 py-2 text-base sm:text-sm");
    expect(assignmentControl).toContain("px-3 text-base sm:text-sm");
    expect(job).toContain("rounded-control border border-line bg-surface-subtle p-3 text-sm");
    expect(job).not.toContain("rounded-control bg-surface/10 p-3 text-sm");
  });

  it("keeps booking creation, detail, reschedule and blocking safeguards", () => {
    const create = source("src/app/dashboard/bokningar/ny/page.tsx");
    const detail = source("src/app/dashboard/bokningar/[id]/page.tsx");
    const blocks = source("src/app/dashboard/bokningar/blockera/page.tsx");

    expect(create).toContain("BookingTimeConflictError");
    expect(create).toContain("createDashboardBooking");
    expect(create).toContain("serviceTaxonomy");
    expect(detail).toContain("updateDashboardBookingStatus");
    expect(detail).toContain("rescheduleDashboardBooking");
    expect(detail).toContain("sendBookingStatusEmail");
    expect(detail).toContain("sendBookingCustomerSms");
    expect(detail).toContain("DashboardActionFeedback");
    expect(detail).toContain('text-[#bcd5ff]');
    expect(detail).toContain("rounded-card border border-line bg-surface-subtle p-4");
    expect(detail).not.toContain("rounded-card bg-surface/10 p-4");
    expect(blocks).toContain("createDashboardAvailabilityBlock");
    expect(blocks).toContain("createDashboardRecurringAvailabilityBlocks");
    expect(blocks).toContain("deleteDashboardAvailabilityBlock");

    for (const page of [create, detail, blocks]) {
      expect(page).toContain("border-line");
      expect(page).toContain("bg-brand-deep");
    }
  });

  it("keeps staff planning, assignments and verified review invitation boundaries", () => {
    const planning = source("src/app/dashboard/personal/tider/page.tsx");
    const assignments = source("src/app/dashboard/personal/bokningar/page.tsx");
    const invitations = source("src/app/dashboard/omdomen/inbjudningar/page.tsx");

    expect(planning).toContain("createStaffSchedule");
    expect(planning).toContain("createStaffTimeOff");
    expect(planning).toContain("deleteStaffPlanningEntry");
    expect(assignments).toContain("assignStaffToBooking");
    expect(assignments).toContain('name="booking_id"');
    expect(assignments).toContain('name="staff_id"');
    expect(invitations).toContain("getReviewInvitationDashboardContext");
    expect(invitations).toContain("listReviewInvitationCandidates");
    expect(invitations).toContain("bg-[#f6f9ff]");
  });

  it("aligns settings sub-pages without changing entitlement, domain, reminder or Stripe boundaries", () => {
    const features = source("src/app/dashboard/installningar/funktioner/page.tsx");
    const appearance = source("src/app/dashboard/installningar/utseende/page.tsx");
    const business = source("src/app/dashboard/installningar/foretagssida/page.tsx");
    const reminders = source("src/app/dashboard/installningar/paminnelser/page.tsx");
    const payments = source("src/app/dashboard/installningar/betalningar/page.tsx");

    expect(features).toContain("setWorkspaceFeatureEnabled");
    expect(features).toContain("startWorkspaceFeatureTrial");
    expect(appearance).toContain("ensureVercelCustomDomain");
    expect(appearance).toContain("removeVercelCustomDomain");
    expect(appearance).toContain("DashboardPageHeader");
    expect(appearance).toContain("DashboardActionFeedback");
    expect(business).toContain('hasWorkspaceFeature("website_builder")');
    expect(business).toContain("DashboardPageHeader");
    expect(reminders).toContain("updateBookingReminderSettings");
    expect(reminders).toContain("getRecentReminderDeliveries");
    expect(payments).toContain('hasWorkspaceFeature("payments")');
    expect(payments).toContain('action="/api/stripe/connect/onboard"');

    for (const page of [features, appearance, business, reminders, payments]) {
      expect(page).toContain("bg-surface");
    }
  });

  it("aligns customer detail, offer editing, attachments, invitations, and settings cards", () => {
    const customer = source("src/app/dashboard/kunder/[id]/page.tsx");
    const offerEditor = source("src/app/dashboard/offerter/[id]/offer/[offerId]/page.tsx");
    const attachments = source("src/app/dashboard/uppdrag/[id]/attachment-manager.tsx");
    const invitationManager = source("src/app/dashboard/omdomen/inbjudningar/review-invitation-manager.tsx");
    const security = source("src/app/dashboard/installningar/account-security-card.tsx");
    const members = source("src/app/dashboard/installningar/workspace-members-card.tsx");
    const billing = source("src/app/dashboard/installningar/workspace-billing-card.tsx");
    const services = source("src/app/dashboard/installningar/services-read-only.tsx");

    expect(customer).toContain("createCustomerNoteAction");
    expect(customer).toContain("rounded-panel border border-line bg-surface");
    expect(offerEditor).toContain("updateDashboardWorkspaceQuoteOfferDraft");
    expect(offerEditor).toContain('name="expectedUpdatedAt"');
    expect(attachments).toContain('action="/api/dashboard/service-jobs/attachments"');
    expect(invitationManager).toContain('fetch("/api/dashboard/review-invitations"');
    expect(security).toContain('fetch("/api/auth/change-password"');
    expect(members).toContain("addWorkspaceMemberAction");
    expect(billing).toContain('fetch("/api/stripe/checkout"');
    expect(services).toContain("createWorkspaceServiceAction");
    expect(services).toContain("updateWorkspaceServiceAction");
  });

  it("aligns onboarding and public-experience configuration chrome without changing ownership or domain safety", () => {
    const onboarding = source("src/app/dashboard/onboarding/page.tsx");
    const addCompany = source("src/app/dashboard/marknadsplats/lagg-till-foretag/page.tsx");
    const locations = source("src/app/dashboard/installningar/foretagssida/platser/page.tsx");
    const galleryLayout = source("src/app/dashboard/galleri/layout.tsx");
    const bookingBuilder = source("src/app/dashboard/installningar/utseende/booking-page-builder.tsx");
    const themeEditor = source("src/app/dashboard/installningar/utseende/theme-content-editor.tsx");

    expect(onboarding).toContain("seedWorkspaceServicesForIndustry");
    expect(onboarding).toContain("updateWorkspaceOnboarding");
    expect(onboarding).toContain("DashboardPageHeader");

    expect(addCompany).toContain("onboardOwnerCompanyByOrganizationNumber");
    expect(addCompany).toContain("ownerOnboardingErrorRedirect");
    expect(addCompany).toContain("DashboardPageHeader");

    expect(locations).toContain("listOwnerBusinessProfileLocations");
    expect(locations).toContain("createLocationAction");
    expect(locations).toContain("updateLocationAction");
    expect(locations).toContain("deactivateLocationAction");
    expect(locations).toContain("DashboardPageHeader");

    expect(galleryLayout).toContain('featureKey="media_gallery"');
    expect(bookingBuilder).toContain("data-booking-page-builder");
    expect(bookingBuilder).toContain("data-booking-builder-preview");
    expect(bookingBuilder).toContain("bg-brand-deep");
    expect(bookingBuilder).toContain("aria-pressed={tab === key}");
    expect(bookingBuilder).toContain("aria-pressed={device === value}");
    expect(themeEditor).toContain("data-theme-content-editor");
    expect(themeEditor).toContain("bg-brand-deep");
    expect(themeEditor).toContain("savedPreviewImageUrl");
    expect(themeEditor).toContain("src={savedPreviewImageUrl}");
    expect(themeEditor).not.toMatch(/src=\{[^}]*draft\.heroImageUrl[^}]*\}/);

    const customer = source("src/app/dashboard/kunder/[id]/page.tsx");
    const marketplace = source("src/app/dashboard/marknadsplats/page.tsx");
    const invitationManager = source("src/app/dashboard/omdomen/inbjudningar/review-invitation-manager.tsx");
    const aiAssistant = source("src/app/dashboard/ai-assistent/page.tsx");
    const settingsOverview = source("src/app/dashboard/installningar/page.tsx");

    expect(customer).not.toContain("text-white/60");
    expect(customer).not.toContain("text-white/75");
    expect(marketplace).toContain("text-base sm:text-sm");
    expect(invitationManager).toContain("text-base text-brand-deep sm:text-sm");
    const accessBranch = between(aiAssistant, "if (!access.ok) {", "if (!eligible) {");
    const eligibilityBranch = between(aiAssistant, "if (!eligible) {", "if (!bridgeConfigured) {");
    const bridgeBranch = between(aiAssistant, "if (!bridgeConfigured) {", "if (active) {");
    const activeBranch = between(aiAssistant, "if (active) {", 'statusLabel: isEnglish ? "Ready to activate"');
    const readyBranch = between(aiAssistant, 'statusLabel: isEnglish ? "Ready to activate"', "})();");

    expect(accessBranch).toContain('"Select a workspace"');
    expect(accessBranch).toContain('"Välj en workspace"');
    expect(accessBranch).toContain('"AI Chat is managed per workspace and requires an active sign-in."');
    expect(accessBranch).toContain('"AI Chat hanteras per workspace och kräver en aktiv inloggning."');

    expect(eligibilityBranch).toContain('"Included in Professional"');
    expect(eligibilityBranch).toContain('"Ingår i Professional"');
    expect(eligibilityBranch).toContain('"When Professional is active, a dedicated tenant, inbox and installation code are created for your workspace."');
    expect(eligibilityBranch).toContain('"När Professional är aktiv skapas en egen tenant, inkorg och installationskod för din workspace."');

    expect(bridgeBranch).toContain('"AI Chat is being prepared"');
    expect(bridgeBranch).toContain('"AI Chat förbereds"');
    expect(bridgeBranch).toContain('"The connection to the AI Chat service is not configured in this environment yet."');
    expect(bridgeBranch).toContain('"Kopplingen till AI Chat-tjänsten är inte konfigurerad i den här miljön ännu."');

    expect(activeBranch).toContain('"Active"');
    expect(activeBranch).toContain('"Aktiv"');
    expect(activeBranch).toContain('"AI Chat is connected to your workspace and appears automatically on your public booking page."');
    expect(activeBranch).toContain('"AI Chat är kopplad till din workspace och visas automatiskt på din publika bokningssida."');

    expect(readyBranch).toContain('"Ready to activate"');
    expect(readyBranch).toContain('"Redo att aktiveras"');
    expect(readyBranch).toContain('"We create a separate tenant and secure account for your workspace. After activation, your own inbox opens."');
    expect(readyBranch).toContain('"Vi skapar en separat tenant och ett säkert konto för din workspace. Efter aktivering öppnas din egen inkorg."');
    expect(settingsOverview).toContain('"Company profile"');
    expect(settingsOverview).toContain('"Ready to configure"');
  });
});
