"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setMariaManualSwishStatus, type ManualSwishState } from "@/lib/maria-manual-swish";

function safeTarget(bookingId: string, data: FormData) {
  const isDetail = data.get("return_to") === "detail";
  const locale = data.get("lang") === "en" ? "?lang=en" : "";
  return isDetail
    ? `/dashboard/bokningar/${bookingId}${locale ? locale + "&" : "?"}`
    : `/dashboard/bokningar${locale ? locale + "&" : "?"}`;
}

export async function recordMariaSwishPaymentAction(bookingId: string, data: FormData) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
    redirect("/dashboard/bokningar?payment_error=save");
  }
  const url = safeTarget(bookingId, data);
  const state = String(data.get("payment_state") ?? "");
  if ((state !== "paid" && state !== "unverified")
    || (state === "paid" && data.get("swish_checked") !== "on")) {
    redirect(`${url}payment_error=verify`);
  }
  try {
    await setMariaManualSwishStatus(bookingId, state as ManualSwishState);
  } catch {
    redirect(`${url}payment_error=save`);
  }
  revalidatePath("/dashboard/bokningar");
  revalidatePath(`/dashboard/bokningar/${bookingId}`);
  redirect(`${url}payment_saved=${state}`);
}
