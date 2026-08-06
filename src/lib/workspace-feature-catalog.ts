export const workspaceFeatureCatalog = [
  {
    key: "booking_demo",
    label: "Onlinebokning",
    description: "Ger workspace åtkomst till det publika bokningsflödet.",
  },
  {
    key: "crm_customers",
    label: "Kund-CRM",
    description: "Ger workspace åtkomst till kundregister och CRM-vyer.",
  },
  {
    key: "lead_inbox",
    label: "Leadhantering",
    description: "Ger workspace åtkomst till lead inbox och leadflöden.",
  },
  {
    key: "ai_assistant",
    label: "AI-assistent",
    description: "Ger workspace åtkomst till AI-assistentens serverfunktioner.",
  },
  {
    key: "chat_widget",
    label: "AI-chattwidget",
    description: "Ger workspace åtkomst till den inbäddningsbara chattwidgeten.",
  },
] as const;

export type WorkspaceFeatureKey = (typeof workspaceFeatureCatalog)[number]["key"];

const workspaceFeatureKeys = new Set<string>(workspaceFeatureCatalog.map((feature) => feature.key));

export function isWorkspaceFeatureKey(value: string): value is WorkspaceFeatureKey {
  return workspaceFeatureKeys.has(value);
}
