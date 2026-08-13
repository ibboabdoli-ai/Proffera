export const quoteFormCopy = {
  sv: {
    steps: ["Tjänst", "Plats", "Beskrivning", "Kontakt", "Granska"], step: "Steg", of: "av", website: "Webbplats",
    category: "Kategori", chooseCategory: "Välj kategori", service: "Tjänstetyp", chooseService: "Välj tjänstetyp",
    city: "Stad", cityHint: "Till exempel Stockholm", postal: "Postnummer", postalHint: "Till exempel 151 46",
    description: "Beskriv uppdraget", descriptionHint: "Beskriv vad som ska göras, ungefärlig omfattning och annat företagen behöver veta.",
    date: "Önskad tidpunkt", chooseDate: "Välj tidpunkt", name: "Namn", email: "E-post", phone: "Telefon",
    consent: "Jag godkänner att Proffera behandlar mina uppgifter för att hantera förfrågan, matcha den med lämpliga företag och kontakta mig om uppdraget.",
    missing: "Ej angivet", back: "Tillbaka", next: "Fortsätt", sending: "Skickar...", submit: "Skicka förfrågan",
    sent: "Förfrågan är skickad", sentText: "Tack! Din förfrågan har validerats och sparats. Proffera kan nu matcha den med lämpliga företag.", reference: "Referensnummer",
    serverError: "Förfrågan kunde inte skickas. Försök igen om en stund.",
  },
  en: {
    steps: ["Service", "Location", "Description", "Contact", "Review"], step: "Step", of: "of", website: "Website",
    category: "Category", chooseCategory: "Choose category", service: "Service type", chooseService: "Choose service type",
    city: "City", cityHint: "For example Stockholm", postal: "Postal code", postalHint: "For example 151 46",
    description: "Describe the job", descriptionHint: "Describe what needs to be done, the approximate scope and anything the companies should know.",
    date: "Preferred time", chooseDate: "Choose time", name: "Name", email: "Email", phone: "Phone",
    consent: "I agree that Proffera may process my details to handle the request, match it with suitable companies and contact me about the job.",
    missing: "Not provided", back: "Back", next: "Continue", sending: "Sending...", submit: "Send request",
    sent: "Request sent", sentText: "Thank you! Your request has been validated and saved. Proffera can now match it with suitable companies.", reference: "Reference number",
    serverError: "The request could not be sent. Please try again in a moment.",
  },
} as const;
