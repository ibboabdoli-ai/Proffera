import { z } from "zod";

export const companyRegistrationSchema = z.object({
  companyName: z.string().trim().min(2, "Ange företagsnamn.").max(120, "Företagsnamnet är för långt."),
  organizationNumber: z.string().trim().min(6, "Ange organisationsnummer.").max(32, "Organisationsnumret är för långt."),
  contactPerson: z.string().trim().min(2, "Ange kontaktperson.").max(120, "Namnet är för långt."),
  email: z.string().email("Ange en giltig e-postadress."),
  phone: z.string().trim().min(6, "Ange telefonnummer.").max(40, "Telefonnumret är för långt."),
  city: z.string().trim().min(2, "Ange stad.").max(120, "Orten är för lång."),
  serviceAreas: z.string().trim().min(2, "Ange serviceområden.").max(300, "Serviceområdena är för långa."),
  services: z.string().trim().min(2, "Ange tjänster.").max(300, "Tjänsterna är för långa."),
  description: z.string().trim().min(20, "Beskriv företaget med minst 20 tecken.").max(2000, "Beskrivningen är för lång."),
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
