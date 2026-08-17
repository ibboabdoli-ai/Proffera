import { describe, expect, it } from "vitest";

import {
  buildSmartQuoteDescription,
  getSmartQuoteAnswerSummary,
  getSmartQuoteQuestions,
  validateSmartQuoteAnswers,
} from "./smart-quote-questions";

describe("smart quote questions", () => {
  it("asks Laddbox-specific questions", () => {
    const questions = getSmartQuoteQuestions("Elektriker", "Laddbox", "sv");

    expect(questions.map((question) => question.id)).toEqual([
      "propertyType",
      "parkingType",
      "cableDistance",
      "panelKnown",
    ]);
  });

  it("asks moving-cleaning questions about the property and scope", () => {
    const questions = getSmartQuoteQuestions("Flyttstädning", "Villa", "sv");

    expect(questions.map((question) => question.id)).toEqual([
      "propertyType",
      "areaSqm",
      "furnished",
      "balcony",
    ]);
  });

  it("localizes question and option labels in English", () => {
    const questions = getSmartQuoteQuestions("Elektriker", "Laddbox", "en");
    const parking = questions.find((question) => question.id === "parkingType");

    expect(questions[0]?.label).toBe("What type of property is the job for?");
    expect(parking?.options?.map((option) => option.label)).toContain("Driveway");
  });

  it("requires answers for required smart questions", () => {
    const questions = getSmartQuoteQuestions("VVS", "Vattenläcka", "sv");
    const errors = validateSmartQuoteAnswers(questions, {}, "sv");

    expect(errors.propertyType).toBe("Svara på frågan.");
    expect(errors.urgency).toBe("Svara på frågan.");
    expect(errors.waterShutoff).toBe("Svara på frågan.");
  });

  it("rejects invalid numeric answers", () => {
    const questions = getSmartQuoteQuestions("Flyttstädning", "Villa", "en");
    const errors = validateSmartQuoteAnswers(questions, {
      propertyType: "house",
      areaSqm: "-5",
      furnished: "no",
      balcony: "yes",
    }, "en");

    expect(errors.areaSqm).toBe("Enter a valid number.");
  });

  it("builds a provider-readable description from structured answers and free text", () => {
    const description = buildSmartQuoteDescription("Elektriker", "Laddbox", "sv", {
      propertyType: "house",
      parkingType: "driveway",
      cableDistance: "12",
      panelKnown: "unknown",
    }, "Jag vill installera laddaren på garageväggen.");

    expect(description).toContain("Strukturerade uppgifter:");
    expect(description).toContain("Uppfart");
    expect(description).toContain("12 meter");
    expect(description).toContain("Kundens beskrivning:");
    expect(description).toContain("garageväggen");
  });

  it("returns structured answer summaries for the review step", () => {
    const summary = getSmartQuoteAnswerSummary("Flyttstädning", "Villa", "sv", {
      propertyType: "house",
      areaSqm: "100",
      furnished: "no",
      balcony: "yes",
    });

    expect(summary).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "areaSqm", value: "100 m²" }),
      expect.objectContaining({ id: "balcony", value: "Ja" }),
    ]));
  });
});
