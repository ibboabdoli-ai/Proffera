"use server";

import { revalidatePath } from "next/cache";

import { rejectCompanyDirectoryClaim } from "@/lib/company-directory-claims-admin";
import { approveSoleTraderDirectoryClaim } from "@/lib/company-directory-sole-trader-owner";

export async function approveSoleTraderClaimAction(formData: FormData) {
  const claimId = String(formData.get("claimId") ?? "");
  const reference = String(formData.get("reference") ?? "");
  await approveSoleTraderDirectoryClaim({ claimId, reference });
  revalidatePath("/admin/foretag/claims/sole-trader");
  revalidatePath("/admin/foretag/claims");
  revalidatePath("/admin/foretag");
  revalidatePath("/dashboard/marknadsplats");
}

export async function rejectSoleTraderClaimAction(formData: FormData) {
  const claimId = String(formData.get("claimId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  await rejectCompanyDirectoryClaim({ claimId, reason });
  revalidatePath("/admin/foretag/claims/sole-trader");
}
