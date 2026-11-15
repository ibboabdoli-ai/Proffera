import type { WorkspaceTimeZone } from "@/lib/workspace-market";
import { sendWorkspaceTransactionalSms, type WorkspaceSmsDelivery } from "@/lib/workspace-sms-dispatch";

type SendBookingOwnerSmsInput = WorkspaceSmsDelivery & {
  ownerPhone: string; companyName: string; customerName: string;
  customerPhone: string; service: string; startsAt: string; timeZone?: WorkspaceTimeZone;
};
type SendBookingCustomerSmsInput = WorkspaceSmsDelivery & {
  customerPhone: string; companyName: string;
  status: "confirmed" | "cancelled" | "rescheduled";
  service: string; startsAt: string; previousStartsAt?: string; timeZone?: WorkspaceTimeZone;
};
type SendBookingVerificationSmsInput = WorkspaceSmsDelivery & {
  customerPhone: string; companyName: string; code: string;
  expiresMinutes?: number; language?: "sv" | "en";
};

function formatBookingDate(value: string, timeZone: WorkspaceTimeZone = "Europe/Stockholm") {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone, weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export async function sendBookingVerificationSms(input: SendBookingVerificationSmsInput) {
  const expiresMinutes = input.expiresMinutes ?? 10;
  const content = input.language === "en"
    ? input.code + " is your " + input.companyName + " booking verification code. Valid for " + expiresMinutes + " minutes."
    : input.code + " är din verifieringskod för bokningen hos " + input.companyName + ". Gäller i " + expiresMinutes + " minuter.";
  return sendWorkspaceTransactionalSms({ ...input, content });
}

export async function sendBookingOwnerSms(input: SendBookingOwnerSmsInput) {
  const customerPhone = input.customerPhone.trim() || "telefon saknas";
  const content = "Ny bokning hos " + input.companyName + ". Kund: " + input.customerName
    + ", tel: " + customerPhone + ". " + input.service + ", "
    + formatBookingDate(input.startsAt, input.timeZone) + ". Öppna Proffera.";
  return sendWorkspaceTransactionalSms({
    workspaceId: input.workspaceId, deliveryKey: input.deliveryKey,
    customerPhone: input.ownerPhone, content,
  });
}

export async function sendBookingCustomerSms(input: SendBookingCustomerSmsInput) {
  const time = formatBookingDate(input.startsAt, input.timeZone);
  let content: string;
  if (input.status === "confirmed") {
    content = "Din bokning hos " + input.companyName + " är bekräftad: " + input.service + ", " + time + ".";
  } else if (input.status === "cancelled") {
    content = "Din bokning hos " + input.companyName + " är avbokad: " + input.service + ", " + time + ". Kontakta företaget för ny tid.";
  } else {
    const previous = input.previousStartsAt
      ? " från " + formatBookingDate(input.previousStartsAt, input.timeZone) : "";
    content = "Din bokning hos " + input.companyName + " har flyttats" + previous + " till " + time + ": " + input.service + ".";
  }
  return sendWorkspaceTransactionalSms({ ...input, content });
}
