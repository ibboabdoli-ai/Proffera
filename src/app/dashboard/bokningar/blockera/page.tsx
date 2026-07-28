import Link from "next/link";
import { CalendarOff, Repeat2 } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import {
  AvailabilityBlockValidationError,
  createDashboardAvailabilityBlock,
  createDashboardRecurringAvailabilityBlocks,
} from "@/lib/dashboard-availability-blocks";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    created?: string | string[];
    count?: string | string[];
  }>;
};

const errorMessages: Record<string, string> = {
  access: "Du saknar behörighet att blockera bokningstider.",
  time: "Ange giltiga datum och tider.",
  past: "Minst en vald tid måste ligga framåt i tiden.",
  range: "Kontrollera datumintervallet och att sluttiden ligger efter starttiden.",
  weekdays: "Välj minst en veckodag.",
  conflict: "Minst en vald tid innehåller redan en aktiv bokning eller blockering. Inga tider skapades.",
  save: "Tiden kunde inte blockeras. Kontrollera uppgifterna och försök igen.",
};

const weekdays = [
  { value: 1, label: "Måndag" },
  { value: 2, label: "Tisdag" },
  { value: 3, label: "Onsdag" },
  { value: 4, label: "Torsdag" },
  { value: 5, label: "Fredag" },
  { value: 6, label: "Lördag" },
  { value: 0, label: "Söndag" },
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function requireAvailabilityAccess() {
  const access = await getUserWorkspaceAccess();
  return access.ok && canManageWorkspaceSettings(access) && (await hasDashboardModuleAccess("online_booking"));
}

async function createAvailabilityBlockAction(formData: FormData) {
  "use server";

  if (!(await requireAvailabilityAccess())) redirect("/dashboard/bokningar/blockera?error=access");

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

  redirect("/dashboard/bokningar/blockera?created=single");
}

async function createRecurringAvailabilityBlockAction(formData: FormData) {
  "use server";

  if (!(await requireAvailabilityAccess())) redirect("/dashboard/bokningar/blockera?error=access");

  let count = 0;
  try {
    const result = await createDashboardRecurringAvailabilityBlocks({
      startDate: String(formData.get("recurring_start_date") ?? "").trim(),
      endDate: String(formData.get("recurring_end_date") ?? "").trim(),
      startTime: String(formData.get("recurring_start_time") ?? "").trim(),
      endTime: String(formData.get("recurring_end_time") ?? "").trim(),
      weekdays: formData.getAll("weekdays").map((value) => Number(value)),
      reason: String(formData.get("recurring_reason") ?? "").trim(),
    });
    count = result.count;
  } catch (error) {
    if (error instanceof AvailabilityBlockValidationError) {
      redirect(`/dashboard/bokningar/blockera?error=${error.code}`);
    }
    console.error("Failed to create recurring dashboard availability blocks", error);
    redirect("/dashboard/bokningar/blockera?error=save");
  }

  redirect(`/dashboard/bokningar/blockera?created=recurring&count=${count}`);
}

const inputClass =
  "rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm text-[#17201a] outline-none focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20";

export default async function AvailabilityBlockPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : undefined;
  const error = errorMessages[firstParam(query?.error) ?? ""];
  const created = firstParam(query?.created);
  const count = Math.max(0, Number(firstParam(query?.count)) || 0);

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Tillgänglighet"
        title="Blockera tid"
        description="Skapa enstaka eller återkommande blockeringar för lunch, ledighet, semester, möten och annat arbete. Tiderna försvinner automatiskt från den publika bokningssidan."
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
          {created === "recurring"
            ? `${count} återkommande blockeringar skapades och visas inte längre som bokningsbara.`
            : "Perioden är blockerad och visas inte längre som bokningsbar."}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
          <h2 className="text-xl font-bold text-[#17201a]">Enstaka period</h2>
          <p className="mt-3 text-sm leading-7 text-[#5b665f]">
            Blockera några timmar, en hel dag eller upp till 31 dagar. Tiderna anges i svensk lokal tid.
          </p>

          <form action={createAvailabilityBlockAction} className="mt-6 grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Startdatum och tid
                <input type="datetime-local" name="starts_at" required className={inputClass} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Slutdatum och tid
                <input type="datetime-local" name="ends_at" required className={inputClass} />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
              Orsak
              <input name="reason" maxLength={180} placeholder="Till exempel: Semester eller privat ärende" className={inputClass} />
            </label>

            <button type="submit" className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f3322]">
              Blockera perioden
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-[#d7e3d8] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-[#eef5ef] p-2 text-[#17452f]"><Repeat2 className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#17452f]">Återkommande</p>
              <h2 className="text-xl font-bold text-[#17201a]">Upprepa varje vecka</h2>
            </div>
          </div>
          <p className="mt-3 text-sm leading-7 text-[#5b665f]">
            Välj dagar, tider och datumintervall. Exempel: lunch måndag–fredag klockan 11:00–12:00.
          </p>

          <form action={createRecurringAvailabilityBlockAction} className="mt-6 grid gap-5">
            <fieldset>
              <legend className="text-sm font-semibold text-[#17201a]">Veckodagar</legend>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {weekdays.map((day) => (
                  <label key={day.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#d9e1d7] px-3 py-2 text-sm font-semibold text-[#344139] has-[:checked]:border-[#17452f] has-[:checked]:bg-[#eef5ef]">
                    <input type="checkbox" name="weekdays" value={day.value} className="h-4 w-4 accent-[#17452f]" />
                    {day.label}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#5b665f]">För arbetsvecka: markera måndag till fredag.</p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Från datum
                <input type="date" name="recurring_start_date" required className={inputClass} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Till och med datum
                <input type="date" name="recurring_end_date" required className={inputClass} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Starttid
                <input type="time" name="recurring_start_time" required className={inputClass} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Sluttid
                <input type="time" name="recurring_end_time" required className={inputClass} />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
              Orsak
              <input name="recurring_reason" maxLength={180} placeholder="Till exempel: Lunch" className={inputClass} />
            </label>

            <button type="submit" className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f3322]">
              Skapa återkommande blockeringar
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
