import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(process.cwd(), "public/demo/makeup-by-maria-v2.html"), "utf8");

function completionHelperSource() {
  const start = html.indexOf("function renderNoOtpCompletion(){");
  const end = html.indexOf("const liveBookingCopy={", start);
  if (start < 0 || end < 0) throw Error("No-OTP completion helper not found");
  return html.slice(start, end);
}

describe("Maria temporary no-OTP request receipt language handling", () => {
  it("rerenders submitted request copy and home link on every language change", () => {
    const view = {
      bookingCompleteTitle: { textContent: "" },
      bookingCompleteText: { textContent: "" },
      bookingCompleteAgain: { textContent: "", href: "" },
    };
    const state = { lang: "sv" };
    const copy = {
      sv: { title: "Förfrågan skickad", text: "Svensk text" },
      en: { title: "Request received", text: "English text" },
      ar: { title: "تم إرسال الطلب", text: "نص عربي" },
    };
    const context = {
      state,
      noOtpBookingCopy: copy,
      bookingCompleteCopy: {
        sv: { again: "Gör en ny bokning" },
        en: { again: "Make another booking" },
        ar: { again: "إرسال طلب جديد" },
      },
      $: (id: keyof typeof view) => view[id],
      mariaPublicHomeUrl: (lang: string) => "/?lang=" + lang,
    };
    const render = runInNewContext(
      completionHelperSource() + "\nrenderNoOtpCompletion",
      context, { timeout: 1500 },
    ) as () => void;

    for (const lang of ["sv", "en", "ar"] as const) {
      state.lang = lang;
      render();
      expect(view.bookingCompleteTitle.textContent).toBe(copy[lang].title);
      expect(view.bookingCompleteText.textContent).toBe(copy[lang].text);
      expect(view.bookingCompleteAgain.href).toBe("/?lang=" + lang);
    }
  });

  it("uses the same helper in translate and upon a successful request", () => {
    const translate = html.split("function translate(){")[1]?.split("function showStep(step){")[0];
    const submission = html.split('if(response.ok&&data?.ok===true&&data.requestReceived===true){')[1]
      ?.split('if(response.ok&&data.ok&&typeof data.verificationUrl==="string"')[0];
    expect(translate).toContain("if(temporaryRequestSubmitted)renderNoOtpCompletion();");
    expect(submission).toContain("renderNoOtpCompletion();");
    expect(submission).not.toContain('window.location.assign(data.verificationUrl)');
  });
});
