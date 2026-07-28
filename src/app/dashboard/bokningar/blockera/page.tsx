import Link from "next/link";
import { CalendarOff } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import {
  AvailabilityBlockValidationError,
  createDashboardAvailabilityBlock,
} from "@/lib/dashboard-availability-blocks";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string | string[]; created?: string | string[] }>;
};

const errorMessages: Record<string, string> = {
  access: "Du saknar behörighet att blockera bokningstider.",
  time: "Ange giltigt start- och slutdatum med tid.",
  past: "Starttiden måste ligga framåt i tiden.",
  range: "Sluttiden måste vara efter starttiden. En blockering kan vara högst 31 dagar.",
  conflict: "Tiden innehåller redan en aktiv bokning eller blockering.",
  save: "Tiden kunde inte blockeras. Kontrollera uppgifterna och försök igen.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function createAvailabilityBlockAction(formData: FormData) {
  "use server";

  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access) || !(await hasDashboardModuleAccess("online_booking"))) {
    redirect("/dashboard/bokningar/blockera?error=access");
  }

  try {
    await createDashboardAvailabilityBlock({
      localStartsAt: String(formData.get("starts_at") ?? "").trim(),
      localEndsAt: String(formData.get("ends_at") ?? "").trim(),
      reason: String(formData.get("reason") ?? "").trim(),
    });
  } catch (error) {
    if (error instanceof AvailabilityBlockValidationError) {
      redirect(`/dashboard/bokningar/blockera?error=${error.code}`);
    }
    console.error("Failed to create dashboard availability block", error);
    redirect("/dashboard/bokningar/blockera?error=save");
  }

  redirect("/dashboard/bokningar/blockera?created=1");
}

export default async function AvailabilityBlockPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : undefined;
  const error = errorMessages[firstParam(query?.error) ?? ""];
  const created = firstParam(query?.created) === "1";

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Tillgänglighet"
        title="Blockera tid"
        description="Stäng några timmar, en hel dag eller flera dagar för lunch, ledighet, semester, privat ärende eller annat arbete. Perioden försvinner automatiskt från den publika bokningssidan."
        icon={CalendarOff}
        actions={
          <Link
            href="/dashboard/bokningar"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f] transition hover:bg-[#f3f6f2]"
          >
            Tillbaka till bokningar
          </Link>
        }
      />

      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {error}
        </p>
      ) : null}

      {created ? (
        <p role="status" className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">
          Perioden är blockerad och visas inte längre som bokningsbar.
        </p>
      ) : null}

      <section className="max-w-2xl rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
        <h2 className="text-xl font-bold text-[#17201a]">Ny blockering</h2>
        <p className="mt-3 text-sm leading-7 text-[#5b665f]">
          Tiderna anges i svensk lokal tid. Du kan välja olika datum för start och slut och blockera upp till 31 dagar. En befintlig aktiv bokning kan inte skrivas över.
        </p>

        <div className="mt-4 rounded-xl bg-[#f3f6f2] p-4 text-sm leading-6 text-[#344139] ring-1 ring-[#e0e5dd]">
          <p className="font-semibold text-[#17201a]">Exempel</p>
          <p>En hel dag: 29 juli 00:00 till 30 juli 00:00.</p>
          <p>Semester: välj första dagens starttid och sista dagens sluttid.</p>
        </div>

        <form action={createAvailabilityBlockAction} className="mt-6 grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
              Startdatum och tid
              <input
                type="datetime-local"
                name="starts_at"
                required
                className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm text-[#17201a] outline-none focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
              Slutdatum och tid
              <input
                type="datetime-local"
                name="ends_at"
                required
                className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm text-[#17201a] outline-none focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
            Orsak
            <input
              name="reason"
              maxLength={180}
              placeholder="Till exempel: Lunch, semester eller privat ärende"
              className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm text-[#17201a] outline-none focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
            />
          </label>

          <button
            type="submit"
            className="inline-flex w-fit min-h-11 items-center justify-center rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f3322] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
          >
            Blockera perioden
          </button>
        </form>
      </section>
    </div>
  );
}
