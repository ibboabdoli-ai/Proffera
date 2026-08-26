import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/lib/marketplace-guest-quote.ts"),
  "utf8",
);

describe("Marketplace advertising dispatch contract", () => {
  it("rechecks canonical reklamspärr immediately before provider delivery", () => {
    const officialFactsCheck = source.indexOf("from company_directory_official_facts facts");
    const explicitPermission = source.indexOf("facts.advertising_blocked is false", officialFactsCheck);
    const providerDelivery = source.indexOf("const delivery = await sendMarketplaceGuestInvitationEmail");

    expect(officialFactsCheck).toBeGreaterThan(-1);
    expect(explicitPermission).toBeGreaterThan(officialFactsCheck);
    expect(providerDelivery).toBeGreaterThan(explicitPermission);
  });

  it("keeps the reklamspärr check inside the atomic sending-to-pending dispatch claim", () => {
    expect(source).toMatch(
      /update marketplace_quote_invitations invitation[\s\S]*invitation\.status = 'sending'[\s\S]*invitation\.dispatch_token =[\s\S]*company_directory_official_facts facts[\s\S]*facts\.advertising_blocked is false[\s\S]*returning invitation\.id::text/,
    );
  });
});
