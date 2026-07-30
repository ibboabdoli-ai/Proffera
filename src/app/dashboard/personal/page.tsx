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
    await setDashboardStaffActive(String(formData.get("staff_id") ?? ""), String(formData.get("is_active") ?? "") === "true");
  } catch (error) {
    console.error("Failed to update staff member", error);
    redirect(localizedHref("/dashboard/personal?error=save", isEnglish));
  }
  redirect(localizedHref("/dashboard/personal?updated=1", isEnglish));
}

type StaffPageProps = { searchParams?: Promise<{ created?: string | string[]; updated?: string | string[]; error?: string | string[]; lang?: string | string[] }> };

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const [staff, query] = await Promise.all([getDashboardStaff(), searchParams ?? Promise.resolve(undefined)]);
  const value = (key: "created" | "updated" | "error" | "lang") => { const current = query?.[key]; return Array.isArray(current) ? current[0] : current; };
  const isEnglish = value("lang") === "en";

  return <div className="grid gap-6">
    <DashboardPageHeader
      eyebrow={isEnglish ? "Staff" : "Personal"}
      title={isEnglish ? "Employees and resources" : "Medarbetare och resurser"}
      description={isEnglish ? "Create staff members, manage active employees and connect them to bookings. All information is isolated to the active workspace." : "Skapa personal, hantera aktiva medarbetare och koppla dem till bokningar. All information är isolerad till den aktiva arbetsytan."}
      icon={UsersRound}
      actions={<Link href={localizedHref("/dashboard/personal/bokningar", isEnglish)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-4 py-2.5 text-sm font-bold text-white"><CalendarRange className="h-4 w-4" aria-hidden="true" />{isEnglish ? "Assign bookings" : "Fördela bokningar"}</Link>}
    />

    {value("created") === "1" || value("updated") === "1" ? <p className="rounded-2xl bg-[#eef8f1] p-4 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">{isEnglish ? "The staff register was updated." : "Personalregistret uppdaterades."}</p> : null}
    {value("error") ? <p className="rounded-2xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{isEnglish ? "The change could not be saved. Check the information and the database migration." : "Ändringen kunde inte sparas. Kontrollera uppgifterna och databasens migration."}</p> : null}

    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-[#eef5ef] p-2 text-[#17452f]"><UserPlus className="h-5 w-5" /></span><h2 className="text-xl font-bold text-[#17201a]">{isEnglish ? "New staff member" : "Ny medarbetare"}</h2></div>
        <form action={createStaffAction} className="mt-6 grid gap-4">
          <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Name" : "Namn"}<input name="name" required maxLength={120} className="rounded-xl border border-[#d9e1d7] px-4 py-3" /></label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Role" : "Roll"}<input name="role_label" maxLength={120} placeholder={isEnglish ? "For example Hairdresser" : "Till exempel Frisör"} className="rounded-xl border border-[#d9e1d7] px-4 py-3" /></label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Email" : "E-post"}<input name="email" type="email" maxLength={200} className="rounded-xl border border-[#d9e1d7] px-4 py-3" /></label>
          <label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Phone" : "Telefon"}<input name="phone" maxLength={50} className="rounded-xl border border-[#d9e1d7] px-4 py-3" /></label>
          <button type="submit" className="min-h-11 w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-bold text-white">{isEnglish ? "Add staff member" : "Lägg till personal"}</button>
        </form>
      </section>

      <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
        <div><h2 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Staff register" : "Personalregister"}</h2><p className="mt-1 text-sm text-[#5b665f]">{staff.length} {isEnglish ? "registered" : "registrerade"}</p></div>
        <div className="mt-5 grid gap-3">
          {staff.length ? staff.map((member) => <article key={member.id} className="flex flex-col gap-4 rounded-2xl border border-[#e2e7df] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#17201a]">{member.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${member.isActive ? "bg-[#e7f1eb] text-[#17452f]" : "bg-[#eef0f2] text-[#5d6670]"}`}>{member.isActive ? (isEnglish ? "Active" : "Aktiv") : (isEnglish ? "Inactive" : "Inaktiv")}</span></div><p className="mt-1 text-sm text-[#5b665f]">{member.roleLabel || (isEnglish ? "Role not specified" : "Roll ej angiven")}</p><p className="mt-2 text-xs text-[#6b766e]">{[member.email, member.phone].filter(Boolean).join(" · ") || (isEnglish ? "Contact details missing" : "Kontaktuppgifter saknas")}</p></div>
            <form action={toggleStaffAction}><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} /><input type="hidden" name="staff_id" value={member.id} /><input type="hidden" name="is_active" value={member.isActive ? "false" : "true"} /><button type="submit" className="min-h-10 rounded-xl border border-[#d5ddd3] px-4 text-sm font-bold text-[#17452f]">{member.isActive ? (isEnglish ? "Deactivate" : "Inaktivera") : (isEnglish ? "Activate" : "Aktivera")}</button></form>
          </article>) : <p className="rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] p-6 text-sm text-[#667168]">{isEnglish ? "No staff members have been registered yet." : "Ingen personal registrerad ännu."}</p>}
        </div>
      </section>
    </div>
  </div>;
}
