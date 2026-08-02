export type ProfferaModuleId =
  | "online_booking"
  | "customer_crm"
  | "ai_chat"
  | "email_automation"
  | "qr_booking";

export type ProfferaModuleAccessState = "active" | "planned" | "locked";

export type ProfferaModule = {
  id: ProfferaModuleId;
  name: string;
  description: string;
  accessState: ProfferaModuleAccessState;
};

export type ProfferaModuleAccess = ProfferaModule & {
  isEnabled: boolean;
  isLocked: boolean;
};

export const profferaModules: ProfferaModule[] = [
  { id: "online_booking", name: "Onlinebokning", description: "Bokningsflöde för serviceföretag.", accessState: "active" },
  { id: "customer_crm", name: "Kund-CRM", description: "Kunder, bokningar och historik.", accessState: "active" },
  { id: "ai_chat", name: "AI-chattassistent", description: "AI-stöd för kunddialog och leadhantering.", accessState: "planned" },
  { id: "email_automation", name: "Automatiska mejl", description: "Bekräftelser, påminnelser och uppföljning.", accessState: "planned" },
  { id: "qr_booking", name: "QR-bokning", description: "Snabb bokning via QR-koder.", accessState: "planned" },
];

export function getModuleAccessLabel(accessState: ProfferaModuleAccessState) {
  if (accessState === "active") return "Aktiv";
  if (accessState === "locked") return "Låst";
  return "Planerad";
}

export function getProfferaModuleAccess(): ProfferaModuleAccess[] {
  return profferaModules.map((module) => ({ ...module, isEnabled: module.accessState === "active", isLocked: module.accessState === "locked" }));
}

export const dashboardNavigation = [
  { label: "Översikt", href: "/dashboard" },
  { label: "Leads", href: "/dashboard/leads", featureKey: "lead_inbox" },
  { label: "Offerter", href: "/dashboard/offerter" },
  { label: "Uppdrag", href: "/dashboard/uppdrag" },
  { label: "Kunder", href: "/dashboard/kunder", moduleId: "customer_crm" },
  { label: "Bokningar", href: "/dashboard/bokningar", moduleId: "online_booking" },
  { label: "Kalender", href: "/dashboard/kalender", moduleId: "online_booking" },
  { label: "Personal", href: "/dashboard/personal", moduleId: "online_booking" },
  { label: "Galleri", href: "/dashboard/galleri" },
  { label: "Omdömen", href: "/dashboard/omdomen" },
  { label: "AI-assistent", href: "/dashboard/ai-assistent", moduleId: "ai_chat" },
  { label: "Inställningar", href: "/dashboard/installningar" },
] as const;
