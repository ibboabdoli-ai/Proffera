export default function Page() {
  return (
    <main style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>
      <h1>Registrera företag</h1>
      <p>Fyll i uppgifterna så granskar Proffera företaget.</p>
      <form action="/api/foretag" method="post" style={{ display: "grid", gap: 12 }}>
        <input name="companyName" placeholder="Företagsnamn" required />
        <input name="organizationNumber" placeholder="Organisationsnummer" required />
        <input name="contactPerson" placeholder="Kontaktperson" required />
        <input name="email" placeholder="E-post" required type="email" />
        <input name="phone" placeholder="Telefon" required />
        <input name="city" placeholder="Stad" required />
        <input name="serviceAreas" placeholder="Serviceområden" required />
        <input name="services" placeholder="Tjänster" required />
        <textarea name="description" placeholder="Beskriv företaget" required />
        <label>
          <input name="consentAccepted" required type="checkbox" /> Jag godkänner kontakt från Proffera.
        </label>
        <button type="submit">Skicka</button>
      </form>
    </main>
  );
}
