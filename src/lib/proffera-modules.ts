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
  {
    id: "online_booking",
    name: "Onlinebokning",
    description: "Bokningsfl\u00f6de f\u00f6r servicef\u00f6retag.",
    accessState: "active",
  },
  {
    id: "customer_crm",
    name: "Kund-CRM",
    description: "Kunder, bokningar och historik.",
    accessState: "active",
  },
  {
    id: "ai_chat",
    name: "AI-chattassistent",
    description: "AI-st\u00f6d f\u00f6r kunddialog och leadhantering.",
    accessState: "planned",
  },
  {
    id: "email_automation",
    name: "Automatiska mejl",
    description: "Bekr\u00e4ftelser, p\u00e5minnelser och uppf\u00f6ljning.",
    accessState: "planned",
  },
  {
    id: "qr_booking",
    name: "QR-bokning",
    description: "Snabb bokning via QR-koder.",
    accessState: "planned",
  },
];

export function getModuleAccessLabel(accessState: ProfferaModuleAccessState) {
  if (accessState === "active") return "Aktiv";
  if (accessState === "locked") return "L\u00e5st";
  return "Planerad";
}

export function getProfferaModuleAccess(): ProfferaModuleAccess[] {
  return profferaModules.map((module) => ({
    ...module,
    isEnabled: module.accessState === "active",
    isLocked: module.accessState === "locked",
  }));
}

export const dashboardNavigation = [
  { label: "\u00d6versikt", href: "/dashboard" },
  { label: "Leads", href: "/dashboard/leads", featureKey: "lead_inbox" },
  { label: "Kunder", href: "/dashboard/kunder", moduleId: "customer_crm" },
  { label: "Bokningar", href: "/dashboard/bokningar", moduleId: "online_booking" },
  { label: "AI-assistent", href: "/dashboard/ai-assistent", moduleId: "ai_chat" },
  { label: "Inst\u00e4llningar", href: "/dashboard/installningar" },
] as const;
