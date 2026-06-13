export type ServiceItem = {
  name: string;
  slug: string;
  description: string;
  intentExamples: string[];
};

export type ServiceCategory = {
  name: string;
  slug: string;
  positioning: string;
  services: ServiceItem[];
};

export const serviceTaxonomy: ServiceCategory[] = [
  {
    name: "Städning & lokalvård",
    slug: "stadning-lokalvard",
    positioning: "Basmarknaden för Proffera: återkommande service, offertförfrågningar och bokningsflöden.",
    services: [
      {
        name: "Hemstädning",
        slug: "hemstadning",
        description: "Återkommande eller engångsstädning för privatkunder.",
        intentExamples: ["boka hemstädning", "pris hemstädning", "städhjälp hemma"],
      },
      {
        name: "Kontorsstädning",
        slug: "kontorsstadning",
        description: "Lokalvård för kontor, butiker och små företag.",
        intentExamples: ["kontorsstädning offert", "städfirma företag", "lokalvård kontor"],
      },
      {
        name: "Flyttstädning",
        slug: "flyttstadning",
        description: "Städning inför flytt med tydlig offert och tidsbokning.",
        intentExamples: ["boka flyttstädning", "flyttstädning pris", "städning vid flytt"],
      },
      {
        name: "Fönsterputs",
        slug: "fonsterputs",
        description: "Fönsterputs för privatkunder, bostadsrättsföreningar och företag.",
        intentExamples: ["fönsterputs södertälje", "boka fönsterputs", "pris fönsterputs"],
      },
    ],
  },
  {
    name: "Flytt & hemservice",
    slug: "flytt-hemservice",
    positioning: "Närliggande tjänster där bokning, uppföljning och offertflöden är centrala.",
    services: [
      {
        name: "Flytthjälp",
        slug: "flytthjalp",
        description: "Hjälp med flytt, bärhjälp och enklare logistik.",
        intentExamples: ["flytthjälp", "bärhjälp", "flyttfirma offert"],
      },
      {
        name: "Bortforsling",
        slug: "bortforsling",
        description: "Bortforsling av möbler, skräp och grovavfall.",
        intentExamples: ["bortforsling möbler", "hämta skräp", "grovavfall hjälp"],
      },
      {
        name: "Handyman",
        slug: "handyman",
        description: "Små reparationer, montering och praktisk hjälp i hemmet.",
        intentExamples: ["handyman", "montering möbler", "hjälp hemma"],
      },
      {
        name: "Trädgårdshjälp",
        slug: "tradgardshjalp",
        description: "Gräsklippning, enklare trädgårdsarbete och säsongsservice.",
        intentExamples: ["trädgårdshjälp", "gräsklippning", "trädgårdsservice"],
      },
    ],
  },
  {
    name: "Skönhet & hälsa",
    slug: "skonhet-halsa",
    positioning: "Tjänster som ofta behöver onlinebokning, kundregister, påminnelser och återbesök.",
    services: [
      {
        name: "Frisör",
        slug: "frisor",
        description: "Klippning, färgning och återkommande salongsbokningar.",
        intentExamples: ["boka frisör", "klippning", "hårfärgning"],
      },
      {
        name: "Massage",
        slug: "massage",
        description: "Behandlingar med tidsbokning, journalnoteringar och uppföljning.",
        intentExamples: ["boka massage", "massage tid", "friskvård massage"],
      },
      {
        name: "Naglar",
        slug: "naglar",
        description: "Nagelvård, återbesök och kundhistorik.",
        intentExamples: ["boka naglar", "manikyr", "nagelsalong"],
      },
      {
        name: "Fransar & bryn",
        slug: "fransar-bryn",
        description: "Skönhetsbehandlingar med återkommande bokningar.",
        intentExamples: ["fransar", "bryn", "boka fransförlängning"],
      },
      {
        name: "Hudvård",
        slug: "hudvard",
        description: "Behandlingar där kundhistorik och återbesök är viktiga.",
        intentExamples: ["hudvård", "ansiktsbehandling", "boka hudterapeut"],
      },
    ],
  },
  {
    name: "Träning & friskvård",
    slug: "traning-friskvard",
    positioning: "Bokningsintensiva tjänster med abonnemang, återbesök och kunddialog.",
    services: [
      {
        name: "Personlig tränare",
        slug: "personlig-tranare",
        description: "PT-pass, konsultationer och träningsuppföljning.",
        intentExamples: ["personlig tränare", "boka PT", "träningshjälp"],
      },
      {
        name: "Yoga",
        slug: "yoga",
        description: "Klasser, grupper och återkommande bokningar.",
        intentExamples: ["boka yoga", "yogaklass", "yoga studio"],
      },
      {
        name: "Naprapat",
        slug: "naprapat",
        description: "Behandlingar med journalbehov och återbesök.",
        intentExamples: ["boka naprapat", "ryggbehandling", "smärta behandling"],
      },
      {
        name: "Fotvård",
        slug: "fotvard",
        description: "Behandlingar och regelbundna kundbesök.",
        intentExamples: ["fotvård", "boka fotvård", "medicinsk fotvård"],
      },
    ],
  },
  {
    name: "Företagstjänster",
    slug: "foretagstjanster",
    positioning: "B2B-tjänster där CRM, offertstatus och uppföljning skapar värde.",
    services: [
      {
        name: "Facility service",
        slug: "facility-service",
        description: "Återkommande service för lokaler och arbetsplatser.",
        intentExamples: ["facility service", "kontorsservice", "serviceavtal"],
      },
      {
        name: "Bemanning",
        slug: "bemanning",
        description: "Förfrågningar, uppföljning och kunddialog för bemanningstjänster.",
        intentExamples: ["bemanning", "personal hjälp", "bemanningsförfrågan"],
      },
      {
        name: "Eventservice",
        slug: "eventservice",
        description: "Service, personal och planering kring event.",
        intentExamples: ["eventservice", "eventpersonal", "hjälp med event"],
      },
      {
        name: "Konsultation",
        slug: "konsultation",
        description: "Bokningsbara möten, rådgivning och uppföljning.",
        intentExamples: ["boka konsultation", "rådgivning", "företagsmöte"],
      },
    ],
  },
] as const;

export const primaryServiceCategorySlug = "stadning-lokalvard";

export function getAllServiceSlugs() {
  return serviceTaxonomy.flatMap((category) => category.services.map((service) => service.slug));
}
