import type { PublicLocale } from "@/lib/public-locale";

export type SmartQuoteAnswers = Record<string, string>;

type LocalizedText = Record<PublicLocale, string>;

type SmartQuoteOption = {
  value: string;
  label: LocalizedText;
};

export type SmartQuoteQuestion = {
  id: string;
  label: LocalizedText;
  hint?: LocalizedText;
  options: readonly SmartQuoteOption[];
};

function option(value: string, sv: string, en: string): SmartQuoteOption {
  return { value, label: { sv, en } };
}

const propertyQuestion: SmartQuoteQuestion = {
  id: "property",
  label: { sv: "Vilken typ av objekt gäller jobbet?", en: "What type of property is the job for?" },
  options: [
    option("apartment", "Lägenhet", "Apartment"),
    option("villa", "Villa / radhus", "House / townhouse"),
    option("commercial", "Företag / lokal", "Business / commercial property"),
    option("other", "Annat", "Other"),
  ],
};

const genericQuestions: readonly SmartQuoteQuestion[] = [
  propertyQuestion,
  {
    id: "scope",
    label: { sv: "Hur stort är uppdraget?", en: "How large is the job?" },
    options: [
      option("small", "Mindre jobb", "Small job"),
      option("medium", "Medelstort jobb", "Medium-sized job"),
      option("large", "Större jobb", "Large job"),
      option("unknown", "Vet inte ännu", "Not sure yet"),
    ],
  },
  {
    id: "access",
    label: { sv: "Är platsen lätt att komma åt?", en: "Is the work area easy to access?" },
    options: [
      option("easy", "Ja", "Yes"),
      option("limited", "Begränsad åtkomst", "Limited access"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
];

const cleaningQuestions: readonly SmartQuoteQuestion[] = [
  propertyQuestion,
  {
    id: "size",
    label: { sv: "Ungefär hur stor yta ska städas?", en: "Approximately how large is the area to clean?" },
    options: [
      option("0-49", "Under 50 m²", "Under 50 m²"),
      option("50-99", "50–99 m²", "50–99 m²"),
      option("100-149", "100–149 m²", "100–149 m²"),
      option("150+", "150 m² eller mer", "150 m² or more"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
  {
    id: "frequency",
    label: { sv: "Hur ofta behövs tjänsten?", en: "How often is the service needed?" },
    options: [
      option("once", "En gång", "One time"),
      option("weekly", "Varje vecka", "Weekly"),
      option("biweekly", "Varannan vecka", "Every other week"),
      option("monthly", "Varje månad", "Monthly"),
      option("unknown", "Vet inte ännu", "Not sure yet"),
    ],
  },
];

const moveOutCleaningQuestions: readonly SmartQuoteQuestion[] = [
  propertyQuestion,
  {
    id: "size",
    label: { sv: "Hur stor är bostaden/lokalen?", en: "How large is the property?" },
    options: [
      option("0-49", "Under 50 m²", "Under 50 m²"),
      option("50-99", "50–99 m²", "50–99 m²"),
      option("100-149", "100–149 m²", "100–149 m²"),
      option("150+", "150 m² eller mer", "150 m² or more"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
  {
    id: "condition",
    label: { sv: "Hur är skicket inför städningen?", en: "What is the condition before cleaning?" },
    options: [
      option("normal", "Normalt", "Normal"),
      option("heavy", "Behöver extra städning", "Needs extra cleaning"),
      option("renovation", "Efter renovering", "After renovation"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
];

const plumbingQuestions: readonly SmartQuoteQuestion[] = [
  propertyQuestion,
  {
    id: "urgency",
    label: { sv: "Hur brådskande är jobbet?", en: "How urgent is the job?" },
    options: [
      option("emergency", "Akut / så snart som möjligt", "Urgent / as soon as possible"),
      option("days", "Inom några dagar", "Within a few days"),
      option("weeks", "Inom några veckor", "Within a few weeks"),
      option("flexible", "Flexibelt", "Flexible"),
    ],
  },
  {
    id: "waterStatus",
    label: { sv: "Är vatten eller avlopp fortfarande användbart?", en: "Can the water or drain still be used?" },
    options: [
      option("yes", "Ja", "Yes"),
      option("partly", "Delvis", "Partly"),
      option("no", "Nej", "No"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
];

const leakQuestions: readonly SmartQuoteQuestion[] = [
  propertyQuestion,
  {
    id: "leakActive",
    label: { sv: "Pågår läckan just nu?", en: "Is the leak active right now?" },
    options: [
      option("yes", "Ja", "Yes"),
      option("intermittent", "Ibland", "Intermittently"),
      option("no", "Nej", "No"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
  {
    id: "shutoff",
    label: { sv: "Kan du stänga av vattnet?", en: "Can you shut off the water?" },
    options: [
      option("yes", "Ja", "Yes"),
      option("no", "Nej", "No"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
];

const electricianQuestions: readonly SmartQuoteQuestion[] = [
  propertyQuestion,
  {
    id: "electricalScope",
    label: { sv: "Vad gäller eljobbet främst?", en: "What does the electrical job mainly involve?" },
    options: [
      option("new", "Ny installation", "New installation"),
      option("repair", "Felsökning / reparation", "Troubleshooting / repair"),
      option("upgrade", "Byte / uppgradering", "Replacement / upgrade"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
  {
    id: "powerStatus",
    label: { sv: "Finns el på platsen nu?", en: "Is power currently available at the property?" },
    options: [
      option("yes", "Ja", "Yes"),
      option("partial", "Delvis", "Partly"),
      option("no", "Nej", "No"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
];

const evChargerQuestions: readonly SmartQuoteQuestion[] = [
  {
    id: "parking",
    label: { sv: "Var ska laddboxen sitta?", en: "Where will the EV charger be installed?" },
    options: [
      option("garage", "Garage", "Garage"),
      option("driveway", "Uppfart / carport", "Driveway / carport"),
      option("shared", "Gemensam parkering", "Shared parking"),
      option("other", "Annat", "Other"),
    ],
  },
  {
    id: "distance",
    label: { sv: "Ungefärligt avstånd till elcentralen?", en: "Approximate distance to the electrical panel?" },
    options: [
      option("0-5", "0–5 meter", "0–5 metres"),
      option("6-15", "6–15 meter", "6–15 metres"),
      option("16+", "Mer än 15 meter", "More than 15 metres"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
  {
    id: "chargerOwned",
    label: { sv: "Har du redan köpt laddbox?", en: "Have you already bought the charger?" },
    options: [
      option("yes", "Ja", "Yes"),
      option("no", "Nej, vill ha hjälp att välja", "No, I want help choosing"),
      option("unsure", "Inte bestämt", "Not decided"),
    ],
  },
];

const paintingQuestions: readonly SmartQuoteQuestion[] = [
  propertyQuestion,
  {
    id: "paintScope",
    label: { sv: "Vad ska målas eller tapetseras?", en: "What needs painting or wallpapering?" },
    options: [
      option("one-room", "Ett rum / mindre yta", "One room / small area"),
      option("several", "Flera rum", "Several rooms"),
      option("whole", "Hela bostaden/lokalen", "Entire property"),
      option("exterior", "Utomhus", "Exterior"),
    ],
  },
  {
    id: "prep",
    label: { sv: "Behöver underlaget förarbete?", en: "Does the surface need preparation?" },
    options: [
      option("little", "Lite / inget", "Little / none"),
      option("some", "Spackling eller mindre reparationer", "Filling or minor repairs"),
      option("much", "Mycket förarbete", "Extensive preparation"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
];

const buildingQuestions: readonly SmartQuoteQuestion[] = [
  propertyQuestion,
  {
    id: "projectSize",
    label: { sv: "Hur omfattande är arbetet?", en: "How extensive is the work?" },
    options: [
      option("small", "Mindre reparation / montering", "Minor repair / installation"),
      option("room", "Ett rum / avgränsad del", "One room / defined area"),
      option("several", "Flera rum / större del", "Several rooms / larger area"),
      option("unknown", "Vet inte ännu", "Not sure yet"),
    ],
  },
  {
    id: "materials",
    label: { sv: "Finns material redan?", en: "Are the materials already available?" },
    options: [
      option("yes", "Ja", "Yes"),
      option("partial", "Delvis", "Partly"),
      option("no", "Nej, behöver hjälp med material", "No, I need help with materials"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
];

const gardeningQuestions: readonly SmartQuoteQuestion[] = [
  {
    id: "gardenSize",
    label: { sv: "Ungefär hur stor är ytan?", en: "Approximately how large is the area?" },
    options: [
      option("small", "Liten, under 200 m²", "Small, under 200 m²"),
      option("medium", "200–600 m²", "200–600 m²"),
      option("large", "Över 600 m²", "Over 600 m²"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
  {
    id: "gardenAccess",
    label: { sv: "Kan företag komma in med utrustning?", en: "Can the company access the area with equipment?" },
    options: [
      option("easy", "Ja, enkel åtkomst", "Yes, easy access"),
      option("limited", "Begränsad åtkomst", "Limited access"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
  {
    id: "waste",
    label: { sv: "Ska trädgårdsavfall tas med?", en: "Should garden waste be removed?" },
    options: [
      option("yes", "Ja", "Yes"),
      option("no", "Nej", "No"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
];

const movingQuestions: readonly SmartQuoteQuestion[] = [
  propertyQuestion,
  {
    id: "rooms",
    label: { sv: "Hur stort bohag ska flyttas?", en: "How large is the move?" },
    options: [
      option("1", "1 rum", "1 room"),
      option("2-3", "2–3 rum", "2–3 rooms"),
      option("4+", "4 rum eller fler", "4 rooms or more"),
      option("partial", "Del av bohag / enstaka saker", "Partial move / a few items"),
    ],
  },
  {
    id: "stairs",
    label: { sv: "Finns hiss eller trappor som påverkar flytten?", en: "Are there lifts or stairs that affect the move?" },
    options: [
      option("lift", "Hiss finns", "Lift available"),
      option("stairs", "Trappor, ingen hiss", "Stairs, no lift"),
      option("ground", "Markplan", "Ground floor"),
      option("mixed", "Olika på adresserna", "Different at the addresses"),
    ],
  },
];

const homeServiceQuestions: readonly SmartQuoteQuestion[] = [
  propertyQuestion,
  {
    id: "frequency",
    label: { sv: "Är hjälpen återkommande?", en: "Is the help recurring?" },
    options: [
      option("once", "En gång", "One time"),
      option("weekly", "Varje vecka", "Weekly"),
      option("monthly", "Några gånger per månad", "A few times per month"),
      option("unknown", "Vet inte ännu", "Not sure yet"),
    ],
  },
  {
    id: "scope",
    label: { sv: "Hur mycket hjälp behövs per tillfälle?", en: "How much help is needed per visit?" },
    options: [
      option("1-2h", "1–2 timmar", "1–2 hours"),
      option("half-day", "Halvdag", "Half day"),
      option("full-day", "Heldag", "Full day"),
      option("unknown", "Vet inte", "Not sure"),
    ],
  },
];

export function getSmartQuoteQuestions(category: string, serviceType: string): readonly SmartQuoteQuestion[] {
  if (serviceType === "Laddbox") return evChargerQuestions;
  if (serviceType === "Vattenläcka") return leakQuestions;
  if (category === "Flyttstädning") return moveOutCleaningQuestions;
  if (category === "Flytthjälp") return movingQuestions;
  if (["Städning", "Hemstädning", "Kontorsstädning", "Fönsterputs", "Byggstädning"].includes(category)) return cleaningQuestions;
  if (category === "VVS") return plumbingQuestions;
  if (category === "Elektriker") return electricianQuestions;
  if (category === "Måleri") return paintingQuestions;
  if (["Snickeri", "Renovering"].includes(category)) return buildingQuestions;
  if (category === "Trädgård") return gardeningQuestions;
  if (category === "Hemservice") return homeServiceQuestions;
  return genericQuestions;
}

export function smartQuoteQuestionLabel(question: SmartQuoteQuestion, locale: PublicLocale) {
  return question.label[locale];
}

export function smartQuoteAnswerLabel(question: SmartQuoteQuestion, answer: string, locale: PublicLocale) {
  return question.options.find((candidate) => candidate.value === answer)?.label[locale] ?? answer;
}

export function buildSmartQuoteDescription({
  locale,
  category,
  serviceType,
  answers,
  description,
}: {
  locale: PublicLocale;
  category: string;
  serviceType: string;
  answers: SmartQuoteAnswers;
  description: string;
}) {
  const questions = getSmartQuoteQuestions(category, serviceType);
  const detailLines = questions
    .map((question) => {
      const answer = answers[question.id];
      return answer ? `- ${smartQuoteQuestionLabel(question, locale)} ${smartQuoteAnswerLabel(question, answer, locale)}` : null;
    })
    .filter((line): line is string => Boolean(line));

  const detailsTitle = locale === "sv" ? "Proffera-detaljer" : "Proffera details";
  const noteTitle = locale === "sv" ? "Kundens beskrivning" : "Customer description";
  const details = detailLines.length > 0 ? `${detailsTitle}:\n${detailLines.join("\n")}` : "";
  const note = description.trim() ? `${noteTitle}:\n${description.trim()}` : "";
  return [details, note].filter(Boolean).join("\n\n").slice(0, 2_000);
}
