export const juliusSalon = {
  name: "Julius Salong",
  slug: "julius-salong",
  category: "Herrfrisör i Södertälje",
  tagline: "Stilren herrsalong där tradition möter trend.",
  address: "Nedre Torekällgatan 5, 151 72 Södertälje",
  phone: "072-872 22 XX",
  website: "www.juliussalong.se",
  instagram: "salong_julius",
  rating: "5/5",
  reviewsCount: 92,
  staff: [
    {
      name: "Elias",
      role: "Frisör",
      rating: "5/5",
      reviews: 92,
    },
  ],
  openingHours: [
    { day: "Måndag", hours: "10:00 - 18:00" },
    { day: "Tisdag", hours: "10:00 - 18:00" },
    { day: "Onsdag", hours: "10:00 - 18:00" },
    { day: "Torsdag", hours: "10:00 - 18:00" },
    { day: "Fredag", hours: "10:00 - 18:00" },
    { day: "Lördag", hours: "10:00 - 15:00" },
    { day: "Söndag", hours: "Stängt" },
  ],
} as const;

export const salonServices = [
  { category: "Klippning", name: "Herrklippning", duration: "25 min", price: "299 kr", active: true },
  { category: "Klippning", name: "Herrklippning inkl. skäggtrimning", duration: "40 min", price: "349 kr", active: true },
  { category: "Klippning", name: "Herrklippning - Studenter", duration: "25 min", price: "249 kr", active: true },
  { category: "Klippning", name: "Herrklippning & skäggtrim - Studenter", duration: "40 min", price: "299 kr", active: true },
  { category: "Klippning", name: "Pensionärsklippning", duration: "20 min", price: "199 kr", active: true },
  { category: "Klippning", name: "Barnklippning upp till 12 år", duration: "20 min", price: "199 kr", active: true },
  { category: "Klippning", name: "Maskin snaggning", duration: "15 min", price: "149 kr", active: true },
  { category: "Hårborttagning", name: "Vax, kinder, öron och näsa", duration: "15 min", price: "99 kr", active: true },
  { category: "Skägg", name: "Skäggtrimning", duration: "20 min", price: "149 kr", active: true },
  { category: "Styling", name: "Hårtvätt", duration: "5 min", price: "80 kr", active: true },
] as const;

export const demoTimeSlots = ["10:00", "10:30", "11:00", "13:00", "14:30", "16:00", "17:30"] as const;

export const salonReviews = [
  "Fantastisk frisör som känner in sina kunder otroligt bra! Rekommenderar starkt!",
  "Välkomnande och professionell. Gick därifrån riktigt nöjd.",
  "En av de bästa frisörerna jag har haft. Rekommenderar starkt.",
] as const;

export const demoBookings = [
  {
    customer: "Rebecca T.",
    service: "Herrklippning inkl. skäggtrimning",
    time: "Idag 14:30",
    status: "Väntar på godkännande",
    statusTone: "pending",
  },
  {
    customer: "Christian R.",
    service: "Herrklippning",
    time: "Imorgon 10:00",
    status: "Bekräftad",
    statusTone: "confirmed",
  },
  {
    customer: "Emanuell H.",
    service: "Skäggtrimning",
    time: "Fredag 16:00",
    status: "Bekräftad",
    statusTone: "confirmed",
  },
] as const;
