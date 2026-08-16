export const marketingServiceSlugs = [
  "bokningssystem",
  "crm",
  "offertsystem",
  "leadhantering",
] as const;

export type MarketingServiceSlug = (typeof marketingServiceSlugs)[number];

type ServicePage = {
  slug: MarketingServiceSlug;
  navLabel: string;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  problemTitle: string;
  problems: string[];
  flowTitle: string;
  flow: Array<{ title: string; text: string }>;
  featuresTitle: string;
  features: Array<{ title: string; text: string }>;
  audienceTitle: string;
  audience: string;
  faq: Array<{ question: string; answer: string }>;
};

export const marketingServicePages: Record<MarketingServiceSlug, ServicePage> = {
  bokningssystem: {
    slug: "bokningssystem",
    navLabel: "Bokningssystem",
    title: "Bokningssystem för små tjänsteföretag | Proffera",
    description: "Ta emot onlinebokningar, samla kundhistorik och minska manuell administration med Profferas bokningssystem för svenska tjänsteföretag.",
    eyebrow: "Bokningssystem",
    heading: "Onlinebokning som fortsätter in i kundhistorik och uppdrag",
    intro: "Proffera är byggt för tjänsteföretag som vill låta kunden boka själv utan att skapa ett separat administrativt spår. Tjänst, bokning och kund följer samma arbetsflöde vidare i systemet.",
    problemTitle: "Mindre tid på bokningsadministration",
    problems: [
      "Kunder kan välja tjänst, datum och en ledig tid online i stället för att boka fram och tillbaka via telefon eller meddelanden.",
      "Återkommande bokningar kan kopplas till samma kund så att historiken inte splittras i onödiga dubbletter.",
      "Bokningspåminnelser och kundens självservice minskar manuella uppföljningar kring tider och ändringar.",
    ],
    flowTitle: "Så hänger bokningen ihop i Proffera",
    flow: [
      { title: "1. Publicera tjänsten", text: "Visa vad kunden kan boka och ge tjänsten en tydlig väg vidare till onlinebokningen." },
      { title: "2. Kunden väljer tid", text: "Kunden väljer tjänst, datum och en tillgänglig tid i den publika bokningen." },
      { title: "3. Kunden samlas i CRM", text: "Bokningen behåller kopplingen till kunden och tjänsten så att historiken kan följas i arbetsytan." },
      { title: "4. Följ upp jobbet", text: "Bokningen kan fortsätta in i det operativa arbetet och kundens fortsatta historik." },
    ],
    featuresTitle: "Det viktigaste i bokningsflödet",
    features: [
      { title: "Onlinebokning", text: "Publik bokning där kunden själv väljer tjänst och ledig tid." },
      { title: "Kalender och personal", text: "Planera bokningsbara tider och få en tydligare bild av det operativa schemat." },
      { title: "Kundportal", text: "Låt kunden hantera bokningar via självservice när flödet tillåter det." },
      { title: "Påminnelser", text: "Automatiserade bokningspåminnelser minskar behovet av manuell kontakt." },
    ],
    audienceTitle: "För företag där tid är en del av tjänsten",
    audience: "Passar exempelvis salonger, konsulter och lokala serviceföretag som arbetar med bokningsbara tider och vill koppla bokningen till resten av kundresan.",
    faq: [
      { question: "Kan kunder boka online själva?", answer: "Ja. Kunden kan välja tjänst, datum och en ledig tid via den publika bokningen." },
      { question: "Hänger bokningar ihop med CRM?", answer: "Ja. Proffera är byggt för att behålla kopplingen mellan tjänst, bokning och kund så att historiken kan följas vidare." },
      { question: "Finns det en gratis provperiod?", answer: "Ja. Starter och Professional kan provas gratis i 14 dagar utan betalning vid start." },
    ],
  },
  crm: {
    slug: "crm",
    navLabel: "CRM",
    title: "CRM för små tjänsteföretag | Proffera",
    description: "Samla kunder, bokningshistorik, leads och uppföljning i ett enkelt CRM för svenska småföretag och tjänsteföretag.",
    eyebrow: "Kund-CRM",
    heading: "Ett CRM som börjar där kundkontakten faktiskt uppstår",
    intro: "I Proffera behöver kunden inte först läggas in manuellt i ett separat CRM. Bokningar och kundförfrågningar kan fortsätta in i samma kundbild så att historik och nästa steg blir lättare att följa.",
    problemTitle: "Slipp kundinformation i flera parallella listor",
    problems: [
      "Samla kunduppgifter och relevant historik på ett ställe i stället för i inkorg, kalkylblad och separata anteckningar.",
      "Behåll kopplingen mellan kunden och den tjänst som kunden bokade eller frågade om.",
      "Minska onödiga kunddubbletter när samma e-post återkommer i nya bokningar.",
    ],
    flowTitle: "Från första kontakt till kundhistorik",
    flow: [
      { title: "1. Kunden tar kontakt", text: "Kontakten kan börja genom bokning, offertförfrågan eller företagets publika kundyta." },
      { title: "2. Kundbilden byggs", text: "Kunduppgifter och relevanta aktiviteter samlas i samma arbetsyta." },
      { title: "3. Historiken följer med", text: "Bokningar och andra kundhändelser kan följas utan att relationen tappas mellan olika system." },
      { title: "4. Nästa steg blir tydligare", text: "Fortsätt med uppdrag, offert eller uppföljning utifrån kundens faktiska ärende." },
    ],
    featuresTitle: "CRM-funktioner för vardagen",
    features: [
      { title: "Kundregister", text: "Samla kunduppgifter och relevant historik i en gemensam vy." },
      { title: "Bokningshistorik", text: "Se tidigare bokningar och behåll relationen mellan kund och tjänst." },
      { title: "Dublettskydd", text: "Återanvänd befintlig kund vid återkommande bokningar med samma e-post när det är möjligt." },
      { title: "Kundportal", text: "Ge kunden självservice för bokningar utan att skapa ett separat kundsystem." },
    ],
    audienceTitle: "För små team som behöver ordning utan enterprise-komplexitet",
    audience: "Passar tjänsteföretag som får kunder från flera flöden men vill hålla kundrelationen och historiken samlad i samma system som bokning och uppföljning.",
    faq: [
      { question: "Vad är CRM i Proffera?", answer: "Det är den samlade kundbilden där kunduppgifter och relevant historik kan följas tillsammans med flöden som bokning och uppföljning." },
      { question: "Kan Proffera minska dubbletter i kundregistret?", answer: "Ja. Återkommande bokningar med samma e-post kan återanvända en befintlig kund i stället för att skapa onödiga dubbletter." },
      { question: "Är CRM inkluderat i Starter?", answer: "Ja. Kund-CRM ingår i Starter enligt Profferas nuvarande planstruktur." },
    ],
  },
  offertsystem: {
    slug: "offertsystem",
    navLabel: "Offertsystem",
    title: "Offertsystem för serviceföretag | Proffera",
    description: "Ta emot strukturerade offertförfrågningar och fortsätt kundärendet i Proffera – byggt för svenska service- och tjänsteföretag.",
    eyebrow: "Offertsystem",
    heading: "Låt offertförfrågan börja med rätt information från kunden",
    intro: "Alla tjänster går inte att prissätta direkt i en bokningskalender. Proffera låter tjänster som behöver bedömning först leda kunden till en strukturerad offertförfrågan med kontaktuppgifter och beskrivning av behovet.",
    problemTitle: "Bättre underlag innan du börjar räkna",
    problems: [
      "Kunden kan beskriva behovet i ett strukturerat formulär i stället för att skicka ofullständig information i flera meddelanden.",
      "Förfrågan kan kopplas till den tjänst kunden tittade på så att sammanhanget inte försvinner.",
      "Offertflödet blir en del av samma kundresa i stället för ett fristående dokumentflöde.",
    ],
    flowTitle: "Från tjänstesida till offertarbete",
    flow: [
      { title: "1. Välj offert som nästa steg", text: "En tjänst som kräver bedömning kan leda kunden till offertförfrågan i stället för direkt bokning." },
      { title: "2. Kunden beskriver jobbet", text: "Formuläret kan samla namn, kontaktuppgifter, ort, beskrivning och önskat datum samt behålla tjänstekopplingen." },
      { title: "3. Förfrågan kommer in strukturerat", text: "Behovet kan hanteras vidare i arbetsytan med kund och tjänst som sammanhang." },
      { title: "4. Fortsätt kundresan", text: "När affären går vidare kan kunden och tjänsten fortsätta i samma operativa flöde." },
    ],
    featuresTitle: "Byggstenar i offertflödet",
    features: [
      { title: "Offertförfrågan", text: "Samla ett tydligare kundunderlag innan pris och omfattning bedöms." },
      { title: "Tjänstekoppling", text: "Behåll vilken tjänst kunden utgick från när förfrågan skickades." },
      { title: "Kundkontext", text: "Låt kunduppgifter och ärendet fortsätta i samma arbetsyta." },
      { title: "Flera konverteringsvägar", text: "Låt olika tjänster använda bokning, offert eller kontakt beroende på hur arbetet säljs." },
    ],
    audienceTitle: "För jobb där pris eller omfattning måste bedömas först",
    audience: "Passar hantverkare, städ-, installations- och andra serviceföretag där kunden behöver beskriva jobbet innan företaget kan lämna ett relevant pris eller nästa steg.",
    faq: [
      { question: "Kan kunden skicka en offertförfrågan från en tjänst?", answer: "Ja. Offertförfrågan kan bära med sig tjänstekopplingen och samla kundens kontaktuppgifter och beskrivning." },
      { question: "Vilken information kan offertförfrågan samla?", answer: "Det publika formuläret stödjer bland annat namn, e-post, telefon, ort, postnummer, beskrivning och önskat datum." },
      { question: "Måste alla tjänster använda offert?", answer: "Nej. Proffera stödjer olika nästa steg beroende på tjänst, exempelvis onlinebokning, offertförfrågan eller kontakt." },
    ],
  },
  leadhantering: {
    slug: "leadhantering",
    navLabel: "Leadhantering",
    title: "Leadhantering för småföretag | Proffera",
    description: "Samla nya kundförfrågningar och följ dem vidare mot kund, bokning eller offert med Profferas leadhantering för tjänsteföretag.",
    eyebrow: "Leadhantering",
    heading: "Samla nya kundmöjligheter innan de försvinner i inkorgen",
    intro: "När nya förfrågningar kommer från företagets publika kundyta behöver de få ett tydligt nästa steg. Proffera samlar nya kundmöjligheter i arbetsytan så att de kan följas vidare tillsammans med kund- och tjänstekontext.",
    problemTitle: "Färre förfrågningar som faller mellan stolarna",
    problems: [
      "Samla nya kundmöjligheter i arbetsytan i stället för att förlita dig på separata inkorgar och manuella listor.",
      "Behåll sammanhanget kring vilken tjänst eller vilket behov kunden kontaktade företaget om.",
      "Låt nästa steg bli bokning, offert eller fortsatt kunduppföljning beroende på ärendet.",
    ],
    flowTitle: "Ett enklare leadflöde för tjänsteföretag",
    flow: [
      { title: "1. Kunden visar intresse", text: "Förfrågan börjar från företagets publika kundresa eller en tjänst med kontakt som nästa steg." },
      { title: "2. Möjligheten samlas", text: "Nya kundmöjligheter kan samlas i arbetsytan för uppföljning." },
      { title: "3. Kund och behov hålls ihop", text: "Relevant kund- och tjänstekontext följer med så att nästa kontakt blir mer konkret." },
      { title: "4. Flytta vidare i kundresan", text: "När kunden är redo kan ärendet fortsätta mot bokning, offert eller annan uppföljning." },
    ],
    featuresTitle: "Det leadhanteringen ska hjälpa med",
    features: [
      { title: "Samlad leadlista", text: "Få en gemensam plats för nya kundmöjligheter som behöver uppföljning." },
      { title: "Tjänstekontext", text: "Förstå vad kunden visade intresse för utan att börja om från noll." },
      { title: "Koppling till CRM", text: "Låt kundrelationen fortsätta i samma system när ett lead blir en faktisk kund." },
      { title: "Koppling till nästa steg", text: "Fortsätt mot bokning, offert eller kontakt utifrån hur tjänsten säljs." },
    ],
    audienceTitle: "För företag som får förfrågningar från flera kundvägar",
    audience: "Passar små tjänsteföretag som vill skapa bättre struktur mellan första kundintresset och den fortsatta kundrelationen utan att införa ett tungt säljsystem.",
    faq: [
      { question: "Vad är leadhantering i Proffera?", answer: "Det är sättet att samla och följa nya kundmöjligheter i arbetsytan så att de inte försvinner mellan första kontakt och nästa steg." },
      { question: "Kan ett lead fortsätta till CRM?", answer: "Ja. Proffera är byggt för att kundmöjligheter och kundrelationen ska kunna fortsätta i samma arbetsyta." },
      { question: "Ingår leadhantering i Starter?", answer: "Ja. Leadhantering ingår i Starter enligt Profferas nuvarande planstruktur." },
    ],
  },
};

export function isMarketingServiceSlug(value: string): value is MarketingServiceSlug {
  return marketingServiceSlugs.includes(value as MarketingServiceSlug);
}
