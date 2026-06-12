const fieldStyle = {
  border: "1px solid #cfd8cf",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 16,
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 600,
};

export default function Page() {
  return (
    <main style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>
      <h1>Registrera företag</h1>
      <p>Fyll i uppgifterna så granskar Proffera företaget.</p>
      <form action="/api/foretag" method="post" style={{ display: "grid", gap: 16 }}>
        <label style={labelStyle}>Företagsnamn<input style={fieldStyle} name="companyName" required /></label>
        <label style={labelStyle}>Organisationsnummer<input style={fieldStyle} name="organizationNumber" required /></label>
        <label style={labelStyle}>Kontaktperson<input style={fieldStyle} name="contactPerson" required /></label>
        <label style={labelStyle}>E-post<input style={fieldStyle} name="email" required type="email" /></label>
        <label style={labelStyle}>Telefon<input style={fieldStyle} name="phone" required /></label>
        <label style={labelStyle}>Stad<input style={fieldStyle} name="city" required /></label>
        <label style={labelStyle}>Serviceområden<input style={fieldStyle} name="serviceAreas" required /></label>
        <label style={labelStyle}>Tjänster<input style={fieldStyle} name="services" required /></label>
        <label style={labelStyle}>Beskriv företaget<textarea style={{ ...fieldStyle, minHeight: 120 }} name="description" required /></label>
        <label style={{ display: "flex", gap: 10 }}>
          <input name="consentAccepted" required type="checkbox" /> Jag godkänner kontakt från Proffera.
        </label>
        <button style={{ background: "#17452f", border: 0, borderRadius: 999, color: "white", fontWeight: 700, padding: "12px 18px" }} type="submit">Skicka</button>
      </form>
    </main>
  );
}
