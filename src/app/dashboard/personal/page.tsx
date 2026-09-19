import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarRange, UserPlus, UsersRound } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { createDashboardStaffMember, getDashboardStaff, setDashboardStaffActive } from "@/lib/dashboard-staff";

export const dynamic = "force-dynamic";

function localizedHref(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

async function createStaffAction(formData: FormData) {
  "use server";
  const isEnglish = String(formData.get("lang") ?? "") === "en";
  try {
    await createDashboardStaffMember({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      roleLabel: String(formData.get("role_label") ?? ""),
    });
  } catch (error) {
    console.error("Failed to create staff member", error);
    redirect(localizedHref("/dashboard/personal?error=save", isEnglish));
  }
  redirect(localizedHref("/dashboard/personal?created=1", isEnglish));
}

async function toggleStaffAction(formData: FormData) {
  "use server";
  const isEnglish = String(formData.get("lang") ?? "") === "en";
  try {
    await setDashboardStaffActive(
      String(formData.get("staff_id") ?? ""),
      String(formData.get("is_active") ?? "") === "true",
    );
  } catch (error) {
    console.error("Failed to update staff member", error);
    redirect(localizedHref("/dashboard/personal?error=save", isEnglish));
  }
  redirect(localizedHref("/dashboard/personal?updated=1", isEnglish));
}

type StaffPageProps = {
  searchParams?: Promise<{
    created?: string | string[];
    updated?: string | string[];
    error?: string | string[];
    lang?: string | string[];
  }>;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const [staff, query] = await Promise.all([getDashboardStaff(), searchParams ?? Promise.resolve(undefined)]);
  const value = (key: "created" | "updated" | "error" | "lang") => {
    const current = query?.[key];
    return Array.isArray(current) ? current[0] : current;
  };
  const isEnglish = value("lang") === "en";
  const activeStaff = staff.filter((member) => member.isActive).length;

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow={isEnglish ? "Staff" : "Personal"}
        title={isEnglish ? "Employees and resources" : "Medarbetare och resurser"}
        description={isEnglish ? "Create staff members, manage active employees and connect them to bookings. All information is isolated to the active workspace." : "Skapa personal, hantera aktiva medarbetare och koppla dem till bokningar. All information är isolerad till den aktiva arbetsytan."}
        icon={UsersRound}
        actions={
          <Link href={localizedHref("/dashboard/personal/bokningar", isEnglish)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand-deep px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-hover">
            <CalendarRange className="h-4 w-4" aria-hidden="true" />{isEnglish ? "Assign bookings" : "Fördela bokningar"}
          </Link>
        }
      />

      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card" aria-label={isEnglish ? "Staff status" : "Personalstatus"}>
        <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <article className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{isEnglish ? "Registered" : "Registrerade"}</p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-ink">{staff.length}</p>
          </article>
          <article className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{isEnglish ? "Active" : "Aktiva"}</p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-ink">{activeStaff}</p>
          </article>
          <article className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{isEnglish ? "Inactive" : "Inaktiva"}</p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-ink">{staff.length - activeStaff}</p>
          </article>
        </div>
      </section>

      {value("created") === "1" || value("updated") === "1" ? (
        <p className="rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-4 text-sm font-semibold text-[#087754]">
          {isEnglish ? "The staff register was updated." : "Personalregistret uppdaterades."}
        </p>
      ) : null}

      {value("error") ? (
        <p className="rounded-card border border-[#f4c7ba] bg-[#fff5f2] p-4 text-sm font-semibold text-danger">
          {isEnglish ? "The change could not be saved. Check the information and the database migration." : "Ändringen kunde inte sparas. Kontrollera uppgifterna och databasens migration."}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-control bg-brand-soft text-brand">
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{isEnglish ? "Register" : "Registrera"}</p>
              <h2 className="mt-1 text-lg font-bold text-ink">{isEnglish ? "New staff member" : "Ny medarbetare"}</h2>
            </div>
          </div>

          <form action={createStaffAction} className="mt-5 grid gap-4">
            <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {isEnglish ? "Name" : "Namn"}
              <input name="name" required maxLength={120} className="rounded-control border border-line bg-surface px-4 py-3" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {isEnglish ? "Role" : "Roll"}
              <input name="role_label" maxLength={120} placeholder={isEnglish ? "For example Hairdresser" : "Till exempel Frisör"} className="rounded-control border border-line bg-surface px-4 py-3" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {isEnglish ? "Email" : "E-post"}
              <input name="email" type="email" maxLength={200} className="rounded-control border border-line bg-surface px-4 py-3" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {isEnglish ? "Phone" : "Telefon"}
              <input name="phone" maxLength={50} className="rounded-control border border-line bg-surface px-4 py-3" />
            </label>
            <button type="submit" className="min-h-11 w-fit rounded-control bg-brand-deep px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-hover">
              {isEnglish ? "Add staff member" : "Lägg till personal"}
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <h2 className="text-lg font-bold text-ink">{isEnglish ? "Staff register" : "Personalregister"}</h2>
            <p className="mt-1 text-sm text-ink-muted">{staff.length} {isEnglish ? "registered" : "registrerade"}</p>
          </div>

          {staff.length ? (
            <div className="divide-y divide-line">
              {staff.map((member) => (
                <article key={member.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-ink">{member.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${member.isActive ? "bg-[#eaf8f2] text-[#087754]" : "bg-surface-subtle text-ink-muted"}`}>
                        {member.isActive ? (isEnglish ? "Active" : "Aktiv") : (isEnglish ? "Inactive" : "Inaktiv")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{member.roleLabel || (isEnglish ? "Role not specified" : "Roll ej angiven")}</p>
                    <p className="mt-2 text-xs text-ink-muted">{[member.email, member.phone].filter(Boolean).join(" · ") || (isEnglish ? "Contact details missing" : "Kontaktuppgifter saknas")}</p>
                  </div>

                  <form action={toggleStaffAction}>
                    <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
                    <input type="hidden" name="staff_id" value={member.id} />
                    <input type="hidden" name="is_active" value={member.isActive ? "false" : "true"} />
                    <button type="submit" className="min-h-10 rounded-control border border-line bg-surface px-4 text-sm font-bold text-brand-deep transition hover:bg-surface-subtle">
                      {member.isActive ? (isEnglish ? "Deactivate" : "Inaktivera") : (isEnglish ? "Activate" : "Aktivera")}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <p className="m-5 rounded-card border border-dashed border-line-strong bg-surface-subtle p-6 text-sm text-ink-muted">
              {isEnglish ? "No staff members have been registered yet." : "Ingen personal registrerad ännu."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
