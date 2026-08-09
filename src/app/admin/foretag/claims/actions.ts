"use server";

import { revalidatePath } from "next/cache";

import {
  approveAndProvisionCompanyDirectoryClaim,
  rejectCompanyDirectoryClaim,
  releaseStaleCompanyDirectoryClaimReservation,
} from "@/lib/company-directory-claims-admin";

export async function approveDirectoryClaimAction(formData: FormData) {
  const claimId = String(formData.get("claimId") ?? "");
  const reference = String(formData.get("reference") ?? "");
  await approveAndProvisionCompanyDirectoryClaim({ claimId, reference });
  revalidatePath("/admin/foretag/claims");
  revalidatePath("/admin/foretag");
}

export async function rejectDirectoryClaimAction(formData: FormData) {
  const claimId = String(formData.get("claimId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  await rejectCompanyDirectoryClaim({ claimId, reason });
  revalidatePath("/admin/foretag/claims");
}

export async function releaseStaleDirectoryClaimReservationAction(formData: FormData) {
  const claimId = String(formData.get("claimId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  await releaseStaleCompanyDirectoryClaimReservation({ claimId, reason });
  revalidatePath("/admin/foretag/claims");
}
