import type { PublicLocale } from "@/lib/public-locale";

export type SmartQuoteQuestionType = "single" | "number" | "text";
export type SmartQuoteAnswers = Record<string, string>;

export type SmartQuoteQuestion = {
  id: string;
  type: SmartQuoteQuestionType;
  required: boolean;
  label: string;
  help?: string;
  placeholder?: string;
  suffix?: string;
  options?: Array<{ value: string; label: string }>;
};

type LocalizedText = { sv: string; en: string };
type QuestionDefinition = {
  id: string;
  type: SmartQuoteQuestionType;
  required?: boolean;
  label: LocalizedText;
  help?: LocalizedText;
  placeholder?: LocalizedText;
  suffix?: LocalizedText;
  options?: Array<{ value: string; label: LocalizedText }>;
};

const propertyQuestion: QuestionDefinition = {
  id: "propertyType",
  type: "single",
  required: true,
  label: { sv: "Vilken typ av plats gäller jobbet?", en: "What type of property is the job for?" },
  options: [
    { value: "apartment", label: { sv: "Lägenhet", en: "Apartment" } },
    { value: "house", label: { sv: "Villa / hus", en: "House" } },
    { value: "commercial", label: { sv: "Företag / lokal", en: "Business / commercial premises" } },
    { value: "brf", label: { sv: "BRF / fastighet", en: "Housing association / property" } },
    { value: "other", label: { sv: "Annat", en: "Other" } },
  ],
};

const areaQuestion: QuestionDefinition = {
  id: "areaSqm",
  type: "number",
  required: true,
  label: { sv: "Ungefär hur stor yta gäller det?", en: "Approximately how large is the area?" },
  placeholder: { sv: "Till exempel 85", en: "For example 85" },
  suffix: { sv: "m²", en: "m²" },
};

const urgencyQuestion: QuestionDefinition = {
  id: "urgency",
  type: "single",
  required: true,
  label: { sv: "Hur brådskande är jobbet?", en: "How urgent is the job?" },
  options: [
    { value: "emergency", label: { sv: "Akut / så snart som möjligt", en: "Urgent / as soon as possible" } },
    { value: "week", label: { sv: "Inom en vecka", en: "Within a week" } },
    { value: "month", label: { sv: "Inom en månad", en: "Within a month" } },
    { value: "flexible", label: { sv: "Flexibelt", en: "Flexible" } },
  ],
};

const yesNoOptions = [
  { value: "yes", label: { sv: "Ja", en: "Yes" } },
  { value: "no", label: { sv: "Nej", en: "No" } },
  { value: "unknown", label: { sv: "Vet inte", en: "Not sure" } },
] satisfies QuestionDefinition["options"];

const cleaningFrequency: QuestionDefinition = {
  id: "frequency",
  type: "single",
  required: true,
  label: { sv: "Hur ofta vill du ha hjälp?", en: "How often do you need the service?" },
  options: [
    { value: "once", label: { sv: "En gång", en: "One time" } },
    { value: "weekly", label: { sv: "Varje vecka", en: "Weekly" } },
    { value: "biweekly", label: { sv: "Varannan vecka", en: "Every two weeks" } },
    { value: "monthly", label: { sv: "Varje månad", en: "Monthly" } },
    { value: "other", label: { sv: "Annat upplägg", en: "Other schedule" } },
  ],
};

function definitionsFor(category: string, serviceType: string): QuestionDefinition[] {
  if (category === "Elektriker") {
    if (serviceType === "Laddbox") {
      return [
        propertyQuestion,
        {
          id: "parkingType",
          type: "single",
          required: true,
          label: { sv: "Var ska bilen stå vid laddning?", en: "Where will the car be parked while charging?" },
          options: [
            { value: "garage", label: { sv: "Garage", en: "Garage" } },
            { value: "driveway", label: { sv: "Uppfart", en: "Driveway" } },
            { value: "parking", label: { sv: "Parkeringsplats", en: "Parking space" } },
            { value: "other", label: { sv: "Annat", en: "Other" } },
          ],
        },
        {
          id: "cableDistance",
          type: "number",
          required: true,
          label: { sv: "Ungefärligt avstånd från elcentral till laddplats", en: "Approximate distance from the electrical panel to the charging point" },
          placeholder: { sv: "Till exempel 12", en: "For example 12" },
          suffix: { sv: "meter", en: "metres" },
        },
        {
          id: "panelKnown",
          type: "single",
          required: true,
          label: { sv: "Vet du om det finns ledig plats i elcentralen?", en: "Do you know if there is spare capacity in the electrical panel?" },
          options: yesNoOptions,
        },
      ];
    }
    return [propertyQuestion, urgencyQuestion, {
      id: "powerAvailable",
      type: "single",
      required: true,
      label: { sv: "Finns el på platsen nu?", en: "Is electrical power currently available at the property?" },
      options: yesNoOptions,
    }];
  }

  if (category === "VVS") {
    return [propertyQuestion, urgencyQuestion, {
      id: "waterShutoff",
      type: "single",
      required: true,
      label: { sv: "Vet du var huvudavstängningen för vattnet finns?", en: "Do you know where the main water shut-off is?" },
      options: yesNoOptions,
    }];
  }

  if (category === "Flytthjälp") {
    return [
      propertyQuestion,
      {
        id: "rooms",
        type: "number",
        required: true,
        label: { sv: "Hur många rum ska flyttas?", en: "How many rooms are being moved?" },
        placeholder: { sv: "Till exempel 3", en: "For example 3" },
      },
      {
        id: "floor",
        type: "number",
        required: true,
        label: { sv: "Vilken våning flyttar du från?", en: "Which floor are you moving from?" },
        placeholder: { sv: "0 för markplan", en: "0 for ground floor" },
      },
      {
        id: "elevator",
        type: "single",
        required: true,
        label: { sv: "Finns hiss?", en: "Is there a lift/elevator?" },
        options: yesNoOptions,
      },
      {
        id: "destination",
        type: "text",
        required: true,
        label: { sv: "Vart ska flytten gå?", en: "Where are you moving to?" },
        placeholder: { sv: "Ort eller postnummer", en: "City or postal code" },
      },
      {
        id: "packingHelp",
        type: "single",
        required: true,
        label: { sv: "Behöver du hjälp med packning?", en: "Do you need packing help?" },
        options: yesNoOptions,
      },
    ];
  }

  if (category === "Flyttstädning") {
    return [propertyQuestion, areaQuestion, {
      id: "furnished",
      type: "single",
      required: true,
      label: { sv: "Är bostaden möblerad när städningen ska göras?", en: "Will the property be furnished when it is cleaned?" },
      options: yesNoOptions,
    }, {
      id: "balcony",
      type: "single",
      required: true,
      label: { sv: "Finns balkong eller inglasad uteplats som ska ingå?", en: "Should a balcony or enclosed patio be included?" },
      options: yesNoOptions,
    }];
  }

  if (["Städning", "Hemstädning"].includes(category)) {
    return [propertyQuestion, areaQuestion, cleaningFrequency, {
      id: "pets",
      type: "single",
      required: true,
      label: { sv: "Finns husdjur i bostaden?", en: "Are there pets in the home?" },
      options: yesNoOptions,
    }];
  }

  if (category === "Kontorsstädning") {
    return [propertyQuestion, areaQuestion, cleaningFrequency, {
      id: "workstations",
      type: "number",
      required: false,
      label: { sv: "Ungefär hur många arbetsplatser finns?", en: "Approximately how many workstations are there?" },
      placeholder: { sv: "Till exempel 20", en: "For example 20" },
    }];
  }

  if (category === "Fönsterputs") {
    return [propertyQuestion, {
      id: "windowCount",
      type: "number",
      required: true,
      label: { sv: "Ungefär hur många fönster ska putsas?", en: "Approximately how many windows need cleaning?" },
      placeholder: { sv: "Till exempel 12", en: "For example 12" },
    }, {
      id: "difficultAccess",
      type: "single",
      required: true,
      label: { sv: "Finns fönster som kräver stege eller särskild åtkomst?", en: "Are any windows difficult to access or likely to require a ladder?" },
      options: yesNoOptions,
    }];
  }

  if (category === "Byggstädning") {
    return [propertyQuestion, areaQuestion, {
      id: "constructionStage",
      type: "single",
      required: true,
      label: { sv: "Vilket skede gäller städningen?", en: "What stage is the cleaning for?" },
      options: [
        { value: "during", label: { sv: "Under byggarbete", en: "During construction" } },
        { value: "final", label: { sv: "Slutstädning", en: "Final clean" } },
        { value: "rough", label: { sv: "Grovstädning", en: "Rough clean" } },
      ],
    }];
  }

  if (category === "Måleri") {
    return [propertyQuestion, {
      id: "paintScope",
      type: "single",
      required: true,
      label: { sv: "Var ska det målas?", en: "Where is the painting needed?" },
      options: [
        { value: "interior", label: { sv: "Inomhus", en: "Interior" } },
        { value: "exterior", label: { sv: "Utomhus", en: "Exterior" } },
        { value: "both", label: { sv: "Både inne och ute", en: "Both interior and exterior" } },
      ],
    }, areaQuestion, {
      id: "prepNeeded",
      type: "single",
      required: true,
      label: { sv: "Behövs förarbete som spackling eller slipning?", en: "Is preparation such as filling or sanding needed?" },
      options: yesNoOptions,
    }];
  }

  if (["Snickeri", "Renovering"].includes(category)) {
    return [propertyQuestion, {
      id: "projectSize",
      type: "text",
      required: true,
      label: { sv: "Beskriv ungefärlig storlek eller omfattning", en: "Describe the approximate size or scope" },
      placeholder: { sv: "Till exempel 12 m vägg, ett rum eller 25 m²", en: "For example 12 m wall, one room or 25 m²" },
    }, {
      id: "materialsReady",
      type: "single",
      required: true,
      label: { sv: "Finns material redan inköpt?", en: "Have the materials already been purchased?" },
      options: yesNoOptions,
    }];
  }

  if (category === "Trädgård") {
    return [areaQuestion, {
      id: "gardenScope",
      type: "text",
      required: true,
      label: { sv: "Vad behöver göras i trädgården?", en: "What needs to be done in the garden?" },
      placeholder: { sv: "Till exempel häck 20 m, gräsklippning och ogräs", en: "For example 20 m hedge, lawn mowing and weeding" },
    }, {
      id: "wasteRemoval",
      type: "single",
      required: true,
      label: { sv: "Ska företaget ta med trädgårdsavfallet?", en: "Should the company remove the garden waste?" },
      options: yesNoOptions,
    }];
  }

  if (category === "Hemservice") {
    return [propertyQuestion, cleaningFrequency];
  }

  return [propertyQuestion, {
    id: "scopeHint",
    type: "text",
    required: true,
    label: { sv: "Vad är viktigast för företaget att veta om omfattningen?", en: "What is the most important detail about the scope?" },
    placeholder: { sv: "Kort uppskattning av mängd, storlek eller förutsättningar", en: "A short estimate of quantity, size or conditions" },
  }];
}

function localizeQuestion(definition: QuestionDefinition, locale: PublicLocale): SmartQuoteQuestion {
  return {
    id: definition.id,
    type: definition.type,
    required: definition.required ?? false,
    label: definition.label[locale],
    help: definition.help?.[locale],
    placeholder: definition.placeholder?.[locale],
    suffix: definition.suffix?.[locale],
    options: definition.options?.map((option) => ({ value: option.value, label: option.label[locale] })),
  };
}

export function getSmartQuoteQuestions(category: string, serviceType: string, locale: PublicLocale): SmartQuoteQuestion[] {
  if (!category || !serviceType) return [];
  return definitionsFor(category, serviceType).map((definition) => localizeQuestion(definition, locale));
}

export function validateSmartQuoteAnswers(questions: SmartQuoteQuestion[], answers: SmartQuoteAnswers, locale: PublicLocale) {
  const errors: Record<string, string> = {};
  const requiredMessage = locale === "en" ? "Please answer this question." : "Svara på frågan.";

  for (const question of questions) {
    const value = String(answers[question.id] ?? "").trim();
    if (question.required && !value) {
      errors[question.id] = requiredMessage;
      continue;
    }
    if (question.type === "number" && value) {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) {
        errors[question.id] = locale === "en" ? "Enter a valid number." : "Ange ett giltigt tal.";
      }
    }
  }

  return errors;
}

function answerLabel(question: SmartQuoteQuestion, rawValue: string) {
  const option = question.options?.find((item) => item.value === rawValue);
  if (option) return option.label;
  return question.suffix ? `${rawValue} ${question.suffix}` : rawValue;
}

export function getSmartQuoteAnswerSummary(
  category: string,
  serviceType: string,
  locale: PublicLocale,
  answers: SmartQuoteAnswers,
) {
  return getSmartQuoteQuestions(category, serviceType, locale)
    .map((question) => ({
      id: question.id,
      label: question.label,
      value: answerLabel(question, String(answers[question.id] ?? "").trim()),
    }))
    .filter((item) => item.value);
}

export function buildSmartQuoteDescription(
  category: string,
  serviceType: string,
  locale: PublicLocale,
  answers: SmartQuoteAnswers,
  customerDescription: string,
) {
  const summary = getSmartQuoteAnswerSummary(category, serviceType, locale, answers);
  const detailsHeading = locale === "en" ? "Structured job details" : "Strukturerade uppgifter";
  const descriptionHeading = locale === "en" ? "Customer description" : "Kundens beskrivning";
  const details = summary.map((item) => `- ${item.label}: ${item.value}`).join("\n");
  const description = customerDescription.trim();

  if (!details) return description;
  return `${detailsHeading}:\n${details}\n\n${descriptionHeading}:\n${description}`;
}
