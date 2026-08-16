export const marketingIndustrySlugs = [
  "frisorer",
  "stadforetag",
  "hantverkare",
  "serviceforetag",
] as const;

export type MarketingIndustrySlug = (typeof marketingIndustrySlugs)[number];

type IndustryPage = {
  slug: MarketingIndustrySlug;
  navLabel: string;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  fitTitle: string;
  fitPoints: string[];
  flowTitle: string;
  flow: Array<{ title: string; text: string }>;
  featuresTitle: string;
  features: Array<{ title: string; text: string }>;
  serviceLinks: Array<{ label: string; href: string }>;
  faq: Array<{ question: string; answer: string }>;
};

export const marketingIndustryPages: Record<MarketingIndustrySlug, IndustryPage> = {
  frisorer: {
    slug: "frisorer",
    navLabel: "Frisörer",
    title: "Bokningssystem för frisörer och salonger | Proffera",
    description: "Onlinebokning för frisörer och salonger med tjänster, lediga tider, kundhistorik, påminnelser och ett tydligt flöde från bokning till uppföljning.",
    eyebrow: "Proffera för frisörer",
    heading: "Bokningssystem för frisörer som vill samla kundresan på ett ställe",
    intro: "Låt kunden välja behandling och ledig tid online. Bokningen fortsätter sedan in i kundhistorik, kalender och uppföljning så att salongen slipper hålla samma information i flera separata listor.",
    fitTitle: "När Proffera passar en frisörsalong",
    fitPoints: [
      "Kunder ska kunna boka behandlingar och tider online utan att ringa salongen.",
      "Flera tjänster och bokningsbara tider behöver hållas ihop med kundhistoriken.",
      "Ombokning, avbokning och påminnelser ska minska manuell administration runt varje besök.",
      "Efter ett slutfört jobb ska kunden kunna följas upp i samma arbetsyta.",
    ],
    flowTitle: "Från behandling till återkommande kund",
    flow: [
      { title: "1. Visa tjänster", text: "Publicera klippning, behandlingar, konsultationer eller andra bokningsbara tjänster." },
      { title: "2. Boka tid", text: "Kunden väljer tjänst, datum och en tillgänglig tid i onlinebokningen." },
      { title: "3. Behåll historiken", text: "Bokningen kopplas till kunden så att tidigare och kommande tider kan följas i samma system." },
      { title: "4. Följ upp", text: "Efter besöket kan arbetet fortsätta med omdömen, analys och nästa kundkontakt." },
    ],
    featuresTitle: "Delar som är relevanta för salong och frisör",
    features: [
      { title: "Onlinebokning", text: "Ge kunden en tydlig väg från vald behandling till bokad tid." },
      { title: "Kalender och personal", text: "Håll bokningsbara tider och det operativa schemat nära samma kundflöde." },
      { title: "Kund-CRM", text: "Samla kontaktuppgifter, bokningshistorik och relevanta aktiviteter per kund." },
      { title: "Kundportal och påminnelser", text: "Självservice för bokningar och automatiserade påminnelseflöden minskar onödig manuell kontakt." },
    ],
    serviceLinks: [
      { label: "Bokningssystem", href: "/tjanster/bokningssystem" },
      { label: "CRM", href: "/tjanster/crm" },
      { label: "Leadhantering", href: "/tjanster/leadhantering" },
    ],
    faq: [
      { question: "Kan kunder boka frisörtider online?", answer: "Ja. Proffera har onlinebokning där kunden kan välja tjänst, datum och en tillgänglig tid." },
      { question: "Kan en salong samla kundhistoriken i samma system?", answer: "Ja. Kund-CRM och bokningshistorik är delar av samma arbetsyta så att återkommande kunder inte behöver hanteras i separata listor." },
      { question: "Passar Proffera bara frisörer?", answer: "Nej. Plattformen är byggd för tjänsteföretag generellt, men frisörer är ett tydligt exempel där onlinebokning och kundhistorik är centrala." },
    ],
  },
  stadforetag: {
    slug: "stadforetag",
    navLabel: "Städföretag",
    title: "Bokningssystem för städföretag | Proffera",
    description: "Bokning, offertförfrågningar, kund-CRM och uppföljning för städföretag som hanterar både enkla bokningar och jobb som behöver bedömas först.",
    eyebrow: "Proffera för städföretag",
    heading: "Bokningssystem för städföretag med både bokning och offert i samma kundflöde",
    intro: "Hemstädning, fönsterputs och andra tydliga tjänster kan börja i bokning. Flyttstädning eller större uppdrag kan i stället börja med en offertförfrågan. Båda vägarna fortsätter in i samma kund-CRM och arbetsyta.",
    fitTitle: "När Proffera passar ett städföretag",
    fitPoints: [
      "Vissa tjänster ska kunna bokas direkt medan andra behöver bedömas innan pris eller upplägg bestäms.",
      "Nya förfrågningar och befintliga kunder ska samlas på ett ställe för uppföljning.",
      "Bokningar, offerter och uppdrag behöver behålla kopplingen till rätt kund och tjänst.",
      "Kunden ska kunna få en tydlig digital väg in utan att allt måste gå via telefon eller fri text i mejl.",
    ],
    flowTitle: "Två vägar in – samma kund efteråt",
    flow: [
      { title: "1. Visa tjänsten", text: "Publicera exempelvis hemstädning, flyttstädning, fönsterputs eller kontorsstädning." },
      { title: "2. Boka eller fråga", text: "Låt enkla tjänster gå till bokning och större eller mer varierande jobb till offertförfrågan." },
      { title: "3. Samla kunden", text: "Bokningen eller förfrågan fortsätter med kunduppgifter och historik i samma arbetsyta." },
      { title: "4. Driv jobbet vidare", text: "Fortsätt med uppdrag, status, uppföljning och omdömen utan att börja om i ett annat system." },
    ],
    featuresTitle: "Delar som är relevanta för städverksamhet",
    features: [
      { title: "Onlinebokning", text: "För tjänster där kunden kan välja tjänst, datum och ledig tid direkt." },
      { title: "Offertförfrågningar", text: "För jobb där kunden behöver beskriva behov, plats eller önskat datum innan nästa steg." },
      { title: "Kund-CRM", text: "Behåll kontaktuppgifter, historik och återkommande kundrelationer i samma system." },
      { title: "Uppdrag och uppföljning", text: "Låt bokningar och accepterade offerter fortsätta som jobb med tydligare status och kundkoppling." },
    ],
    serviceLinks: [
      { label: "Bokningssystem", href: "/tjanster/bokningssystem" },
      { label: "Offertsystem", href: "/tjanster/offertsystem" },
      { label: "CRM", href: "/tjanster/crm" },
    ],
    faq: [
      { question: "Kan ett städföretag använda både bokning och offert?", answer: "Ja. Proffera låter olika tjänster använda olika nästa steg. En tjänst kan gå till bokning medan en annan går till offertförfrågan." },
      { question: "Kan återkommande kunder hållas ihop i CRM?", answer: "Ja. Kunduppgifter och bokningshistorik kan samlas i samma kundvy och återkommande bokningar med samma e-post kan återanvända befintlig kund." },
      { question: "Har Proffera fakturering eller RUT-beräkning?", answer: "Den här sidan lovar inte fakturering eller RUT-beräkning. Fokus i nuvarande Proffera-flöde är bokning, offert, CRM, uppdrag och uppföljning." },
    ],
  },
  hantverkare: {
    slug: "hantverkare",
    navLabel: "Hantverkare",
    title: "Offertsystem och CRM för hantverkare | Proffera",
    description: "Samla offertförfrågningar, kunduppgifter, tjänster och uppdrag i ett tydligt flöde för hantverkare och lokala serviceföretag.",
    eyebrow: "Proffera för hantverkare",
    heading: "Offertsystem för hantverkare – från kundens behov till ett tydligt uppdrag",
    intro: "Många hantverksjobb kan inte bokas som en standardtid med ett fast upplägg. Kunden behöver först beskriva behovet. Proffera låter förfrågan behålla kopplingen till tjänsten och kunden när arbetet fortsätter mot offert och uppdrag.",
    fitTitle: "När Proffera passar en hantverksverksamhet",
    fitPoints: [
      "Kunden behöver beskriva ett jobb innan företaget kan avgöra nästa steg.",
      "Förfrågningar ska vara strukturerade och kopplade till rätt tjänst i stället för att försvinna i en mejltråd.",
      "Kunduppgifter, offertstatus och kommande uppdrag behöver hänga ihop.",
      "Mindre bokningsbara servicebesök och större offertjobb ska kunna finnas i samma plattform.",
    ],
    flowTitle: "Från förfrågan till jobb",
    flow: [
      { title: "1. Kunden väljer tjänst", text: "Den publika tjänsten ger kunden rätt väg vidare i stället för ett generiskt kontaktformulär." },
      { title: "2. Behovet beskrivs", text: "Offertförfrågan kan innehålla kontaktuppgifter, ort, postnummer, beskrivning och önskat datum." },
      { title: "3. Offerten följs", text: "Förfrågan kan fortsätta i offertflödet utan att tappa kopplingen till kunden och tjänsten." },
      { title: "4. Jobbet fortsätter", text: "En accepterad offert kan gå vidare som uppdrag med status och historik kvar i samma arbetsyta." },
    ],
    featuresTitle: "Delar som är relevanta för hantverkare",
    features: [
      { title: "Strukturerade offertförfrågningar", text: "Samla det grundläggande behovet digitalt innan företaget bedömer omfattning och nästa steg." },
      { title: "Offertflöde", text: "Följ vägen från inkommande behov till skickad och accepterad offert." },
      { title: "Kund-CRM", text: "Behåll kunduppgifter och relevant historik nära offert och uppdrag." },
      { title: "Uppdrag", text: "Låt accepterade offerter och bokningar fortsätta som servicejobb utan att tappa kundkopplingen." },
    ],
    serviceLinks: [
      { label: "Offertsystem", href: "/tjanster/offertsystem" },
      { label: "CRM", href: "/tjanster/crm" },
      { label: "Leadhantering", href: "/tjanster/leadhantering" },
    ],
    faq: [
      { question: "Kan kunden beskriva jobbet innan offert?", answer: "Ja. Det publika offertflödet stödjer bland annat namn, e-post, telefon, ort, postnummer, beskrivning och önskat datum samt koppling till tjänst när den finns." },
      { question: "Kan en accepterad offert fortsätta som ett uppdrag?", answer: "Ja. Det publika funktionsflödet i Proffera är byggt för att bokningar och accepterade offerter ska kunna fortsätta som servicejobb med kundkopplingen kvar." },
      { question: "Måste alla tjänster använda offert?", answer: "Nej. Mindre eller tidsbaserade tjänster kan använda bokning medan större jobb använder offertförfrågan." },
    ],
  },
  serviceforetag: {
    slug: "serviceforetag",
    navLabel: "Serviceföretag",
    title: "CRM, bokning och offerter för serviceföretag | Proffera",
    description: "Proffera för serviceföretag som behöver samla leads, bokningar, offerter, kundhistorik och uppdrag i ett sammanhängande kundflöde.",
    eyebrow: "Proffera för serviceföretag",
    heading: "CRM och kundflöde för serviceföretag som hanterar flera typer av uppdrag",
    intro: "Ett lokalt serviceföretag kan ha bokningsbara besök, jobb som behöver offert och kunder som börjar med en kontaktförfrågan. Proffera låter varje tjänst använda rätt väg in men samlar fortsatt arbete i samma kund-CRM.",
    fitTitle: "När Proffera passar ett serviceföretag",
    fitPoints: [
      "Företaget erbjuder flera tjänster som inte alltid har samma sätt att beställas.",
      "Leads, bokningar och offertförfrågningar behöver följas upp utan separata kundlistor.",
      "Kundhistorik och jobbstatus ska vara tillgängliga i samma arbetsyta.",
      "Den publika företagssidan ska kunna leda kunden till bokning, offert eller kontakt beroende på tjänst.",
    ],
    flowTitle: "Ett gemensamt flöde för olika servicejobb",
    flow: [
      { title: "1. Visa tjänster", text: "Gör det tydligt vilka tjänster företaget erbjuder och vilket nästa steg som passar varje tjänst." },
      { title: "2. Ta emot kunden", text: "Kunden bokar, skickar offertförfrågan eller kontaktar företaget beroende på tjänstens upplägg." },
      { title: "3. Samla relationen", text: "Kunduppgifter och relevanta aktiviteter fortsätter i CRM i stället för att splittras mellan olika inkorgar." },
      { title: "4. Följ upp jobbet", text: "Fortsätt med uppdrag, status, omdömen och analys när jobbet går vidare eller avslutas." },
    ],
    featuresTitle: "Delar som är relevanta för serviceföretag",
    features: [
      { title: "Leadhantering", text: "Samla nya kundmöjligheter från publika kontaktvägar för fortsatt uppföljning." },
      { title: "Bokning och offert", text: "Låt varje tjänst styra om kunden ska boka direkt eller beskriva behovet först." },
      { title: "Kund-CRM", text: "Samla kunduppgifter, historik och aktiviteter i en gemensam vy." },
      { title: "Företagssida och analys", text: "Visa tjänster publikt och följ besök och klick vidare mot bokning, offert eller kontakt." },
    ],
    serviceLinks: [
      { label: "CRM", href: "/tjanster/crm" },
      { label: "Bokningssystem", href: "/tjanster/bokningssystem" },
      { label: "Offertsystem", href: "/tjanster/offertsystem" },
    ],
    faq: [
      { question: "Vad menas med serviceföretag här?", answer: "Det är en bred grupp lokala och professionella tjänsteföretag som arbetar med exempelvis servicebesök, underhåll, installation, konsultation eller andra kunduppdrag." },
      { question: "Kan olika tjänster ha olika nästa steg?", answer: "Ja. En tjänst kan gå till onlinebokning, en annan till offertförfrågan och en tredje till kontakt, medan kundrelationen fortsätter i samma arbetsyta." },
      { question: "Är CRM separat från bokning och offert?", answer: "Nej. Poängen med Proffera är att den publika kundresan och det fortsatta kundarbetet ska kunna hänga ihop i samma system." },
    ],
  },
};

export function isMarketingIndustrySlug(value: string): value is MarketingIndustrySlug {
  return marketingIndustrySlugs.includes(value as MarketingIndustrySlug);
}
