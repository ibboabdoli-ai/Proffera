import "server-only";

import {
  getProfferaModuleAccess,
  profferaModules,
  type ProfferaModuleAccess,
  type ProfferaModuleId,
} from "@/lib/proffera-modules";
import { getWorkspaceEntitlements } from "@/lib/workspace-entitlements";

export type WorkspaceFeatureKey =
  | "online_booking"
  | "customer_crm"
  | "lead_management"
  | "ai_chatbot"
  | "booking_reminders"
  | "verified_reviews"
  | "media_gallery"
  | "quote_management"
  | "website_builder"
  | "customer_portal"
  | "sms"
  | "custom_domain"
  | "video_upload"
  | "multiple_staff"
  | "advanced_automation"
  | "payments"
  | "analytics";

type LegacyWorkspaceFeatureKey =
  | "booking_demo"
  | "crm_customers"
  | "lead_inbox"
  | "ai_assistant"
  | "chat_widget";

const featureAliases: Record<LegacyWorkspaceFeatureKey, WorkspaceFeatureKey> = {
  booking_demo: "online_booking",
  crm_customers: "customer_crm",
  lead_inbox: "lead_management",
  ai_assistant: "ai_chatbot",
  chat_widget: "ai_chatbot",
};

const knownFeatureKeys = new Set<WorkspaceFeatureKey>([
  "online_booking",
  "customer_crm",
  "lead_management",
  "ai_chatbot",
  "booking_reminders",
  "verified_reviews",
  "media_gallery",
  "quote_management",
  "website_builder",
  "customer_portal",
  "sms",
  "custom_domain",
  "video_upload",
  "multiple_staff",
  "advanced_automation",
  "payments",
  "analytics",
]);

const moduleFeatureKeys: Partial<Record<ProfferaModuleId, WorkspaceFeatureKey[]>> = {
  online_booking: ["online_booking"],
  customer_crm: ["customer_crm"],
  ai_chat: ["ai_chatbot"],
  email_automation: ["booking_reminders"],
  qr_booking: ["online_booking"],
};

function normalizeFeatureKey(featureKey: WorkspaceFeatureKey | LegacyWorkspaceFeatureKey): WorkspaceFeatureKey {
  return featureKey in featureAliases
    ? featureAliases[featureKey as LegacyWorkspaceFeatureKey]
    : featureKey as WorkspaceFeatureKey;
}

async function readEnabledFeatureKeys(): Promise<Set<WorkspaceFeatureKey>> {
  const entitlements = await getWorkspaceEntitlements();
  return new Set(
    entitlements
      .filter((item) => item.hasAccess && knownFeatureKeys.has(item.featureKey as WorkspaceFeatureKey))
      .map((item) => item.featureKey as WorkspaceFeatureKey),
  );
}

export async function getDashboardEnabledFeatureKeys(): Promise<WorkspaceFeatureKey[]> {
  try {
    return [...await readEnabledFeatureKeys()];
  } catch (error) {
    console.error("Failed to read workspace feature access", error);
    return [];
  }
}

export async function hasDashboardFeatureAccess(
  featureKey: WorkspaceFeatureKey | LegacyWorkspaceFeatureKey,
): Promise<boolean> {
  const enabledFeatures = await getDashboardEnabledFeatureKeys();
  return enabledFeatures.includes(normalizeFeatureKey(featureKey));
}

export async function hasDashboardModuleAccess(moduleId: ProfferaModuleId): Promise<boolean> {
  const moduleDefinition = profferaModules.find((item) => item.id === moduleId);
  const requiredFeatures = moduleFeatureKeys[moduleId];

  if (!moduleDefinition) return false;
  if (!requiredFeatures) return moduleDefinition.accessState === "active";

  try {
    const enabledFeatures = await readEnabledFeatureKeys();
    return requiredFeatures.every((feature) => enabledFeatures.has(feature));
  } catch (error) {
    console.error("Failed to verify workspace module access", error);
    return false;
  }
}

export async function getDashboardModuleAccess(): Promise<ProfferaModuleAccess[]> {
  try {
    const enabledFeatures = await readEnabledFeatureKeys();

    return profferaModules.map((module) => {
      const requiredFeatures = moduleFeatureKeys[module.id];

      if (!requiredFeatures) {
        return {
          ...module,
          isEnabled: module.accessState === "active",
          isLocked: module.accessState === "locked",
        };
      }

      const isEnabled = requiredFeatures.every((feature) => enabledFeatures.has(feature));
      const accessState = isEnabled ? "active" : module.accessState === "planned" ? "planned" : "locked";

      return {
        ...module,
        accessState,
        isEnabled,
        isLocked: accessState === "locked",
      };
    });
  } catch (error) {
    console.error("Failed to read workspace module access", error);
    return getProfferaModuleAccess();
  }
}
