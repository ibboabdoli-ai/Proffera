export type ProfferaModuleId =
  | "online_booking"
  | "customer_crm"
  | "ai_chat"
  | "email_automation"
  | "qr_booking";

export type ProfferaModule = {
  id: ProfferaModuleId;
  name: string;
  description: string;
  status: "active" | "planned";
};

export const profferaModules: ProfferaModule[] = [
  {
    id: "online_booking",
    name: "Onlinebokning",
    description: "Bokningsflode for serviceforetag.",
    status: "active",
  },
  {
    id: "customer_crm",
    name: "Kund-CRM",
    description: "Kunder, leads, bokningar och historik.",
    status: "active",
  },
  {
    id: "ai_chat",
    name: "AI-chattassistent",
    description: "AI-stod for kunddialog och leadhantering.",
    status: "planned",
  },
  {
    id: "email_automation",
    name: "Automatiska mejl",
    description: "Bekraftelser, paminnelser och uppfoljning.",
    status: "planned",
  },
  {
    id: "qr_booking",
    name: "QR-bokning",
    description: "Snabb bokning via QR-koder.",
    status: "planned",
  },
];

export const dashboardNavigation = [
  { label: "\u00d6versikt", href: "/dashboard" },
  { label: "Leads", href: "/dashboard/leads", moduleId: "customer_crm" },
  { label: "Kunder", href: "/dashboard/kunder", moduleId: "customer_crm" },
  { label: "Bokningar", href: "/dashboard/bokningar", moduleId: "online_booking" },
  { label: "AI-assistent", href: "/dashboard/ai-assistent", moduleId: "ai_chat" },
  { label: "Inst\u00e4llningar", href: "/dashboard/installningar" },
] as const;
