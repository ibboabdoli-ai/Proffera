import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MariaBookingReferenceCopy } from "./maria-booking-reference-copy";

describe("Maria copyable Swish booking reference", () => {
  it("renders a real Swedish copy button for the short payment message", () => {
    const html = renderToStaticMarkup(
      createElement(MariaBookingReferenceCopy, {
        reference: "MBM-EB95CE",
        isEnglish: false,
      }),
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Kopiera bokningsnummer"');
    expect(html).toContain(">Kopiera</button>");
  });

  it("labels the Swish business number separately from the booking reference", () => {
    const html = renderToStaticMarkup(
      createElement(MariaBookingReferenceCopy, {
        reference: "1235818653",
        isEnglish: false,
        kind: "swish",
      }),
    );
    expect(html).toContain('aria-label="Kopiera Swish-nummer"');
    expect(html).toContain(">Kopiera</button>");
  });

  it("labels both copy actions in Arabic when requested", () => {
    for (const kind of ["booking", "swish"] as const) {
      const html = renderToStaticMarkup(
        createElement(MariaBookingReferenceCopy, { reference: "MBM-EB95CE", isEnglish: false, language: "ar", kind }),
      );
      expect(html).toContain(kind === "swish" ? 'aria-label="نسخ رقم Swish"' : 'aria-label="نسخ رقم الحجز"');
      expect(html).toContain(">نسخ</button>");
    }
  });

  it("labels the copy action in English when the dashboard uses English", () => {
    const html = renderToStaticMarkup(
      createElement(MariaBookingReferenceCopy, {
        reference: "MBM-EB95CE",
        isEnglish: true,
      }),
    );
    expect(html).toContain('aria-label="Copy booking number"');
    expect(html).toContain(">Copy</button>");
  });
});
