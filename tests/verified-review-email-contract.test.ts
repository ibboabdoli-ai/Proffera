import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Verified review email delivery contracts", () => {
  it("only triggers automatic delivery after a real completed status transition", () => {
    const code = source("src/lib/dashboard-booking-status.ts");

    expect(code).toContain('if (changed && status === "completed")');
    expect(code).toContain("notification?.customerEmail");
    expect(code).toContain("deliverVerifiedReviewInvitation(bookingId)");
    expect(code.indexOf('if (changed && status === "completed")')).toBeGreaterThan(
      code.indexOf("const changed ="),
    );
  });

  it("supports explicit email delivery and manual token rotation from the dashboard", () => {
    const route = source("src/app/api/dashboard/review-invitations/route.ts");
    const manager = source(
      "src/app/dashboard/omdomen/inbjudningar/review-invitation-manager.tsx",
    );

    expect(route).toContain('delivery: z.enum(["link", "email"])');
    expect(route).toContain("deliverVerifiedReviewInvitation");
    expect(manager).toContain('issue(candidate.bookingId, "email")');
    expect(manager).toContain("Send new email");
    expect(manager).toContain("Skicka nytt mejl");
  });

  it("builds manual and emailed review links from configured origins only", () => {
    const route = source("src/app/api/dashboard/review-invitations/route.ts");
    const delivery = source("src/lib/verified-review-email-delivery.ts");

    expect(route).toContain("buildVerifiedReviewUrl(result.token)");
    expect(route).not.toContain("new URL(request.url)");
    expect(route).not.toContain("origin: new URL(request.url).origin");
    expect(delivery).toContain("resolveReviewInvitationOrigin()");
    expect(delivery).not.toContain("options?: { origin?: string }");
    expect(delivery).not.toContain("normalizeOrigin(origin)");
  });

  it("keeps raw tokens out of delivery audits", () => {
    const code = source("src/lib/verified-review-email-delivery.ts");
    const auditPayload = code.slice(
      code.indexOf("JSON.stringify({"),
      code.indexOf("})}::jsonb"),
    );

    expect(auditPayload).toContain("booking_id");
    expect(auditPayload).toContain("provider_id");
    expect(auditPayload).not.toContain("token");
    expect(code).toContain('"website_review.invitation_email_sent"');
    expect(code).toContain('"website_review.invitation_email_failed"');
  });
});
