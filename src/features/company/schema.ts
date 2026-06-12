import { z } from "zod";

export const companyRegistrationSchema = z.object({
  companyName: z.string().min(2, "Ange företagsnamn."),
  organizationNumber: z.string().min(6, "Ange organisationsnummer."),
  contactPerson: z.string().min(2, "Ange kontaktperson."),
  email: z.string().email("Ange en giltig e-postadress."),
  phone: z.string().min(6, "Ange telefonnummer."),
  city: z.string().min(2, "Ange stad."),
  serviceAreas: z.string().min(2, "Ange serviceområden."),
  services: z.string().min(2, "Ange tjänster."),
  description: z.string().min(20, "Beskriv företaget med minst 20 tecken."),
  consentAccepted: z.boolean().refine((value) => value, "Du måste godkänna att Proffera kontaktar företaget om ansökan."),
});

export type CompanyRegistrationInput = z.infer<typeof companyRegistrationSchema>;

export const initialCompanyRegistration: CompanyRegistrationInput = {
  companyName: "",
  organizationNumber: "",
  contactPerson: "",
  email: "",
  phone: "",
  city: "",
  serviceAreas: "",
  services: "",
  description: "",
  consentAccepted: false,
};
