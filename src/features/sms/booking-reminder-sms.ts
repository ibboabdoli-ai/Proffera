import type { WorkspaceTimeZone } from "@/lib/workspace-market";
import { sendWorkspaceTransactionalSms, type WorkspaceSmsDelivery } from "@/lib/workspace-sms-dispatch";

type Input = WorkspaceSmsDelivery & {
  customerPhone: string; companyName: string;
  service: string; startsAt: string; timeZone?: WorkspaceTimeZone;
};

function formatDate(value: string, timeZone: WorkspaceTimeZone = "Europe/Stockholm") {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone, weekday: "short", day: "numeric",
    month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export async function sendBookingReminderSms(input: Input) {
  const content = "Påminnelse: du har en bokning hos " + input.companyName
    + ", " + input.service + ", " + formatDate(input.startsAt, input.timeZone) + ".";
  return sendWorkspaceTransactionalSms({ ...input, content });
}
