import { redirect } from "next/navigation";

import { BookingLinkCard } from "@/app/dashboard/installningar/booking-link-card";
import { getDashboardWorkspaceBookingHours } from "@/lib/workspace-booking-hours-db";
import { getWorkspaceOnboarding, updateWorkspaceOnboarding } from "@/lib/workspace-experience";
import { getDashboardModuleAccess } from "@/lib/workspace-module-access";
import { seedWorkspaceServicesForIndustry } from "@/lib/workspace-service-seeding";
import { getDashboardWorkspaceServices } from "@/lib/workspace-services-db";
import { getDashboardWorkspaceSettings } from "@/lib/workspace-settings-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

type LaunchReadiness = {
  activeServices: number;
  bookingHoursConfigured: boolean;
  bookingEnabled: boolean;
  publicBookingSlug: string;
};

function getLaunchState(input: LaunchReadiness) {
  const servicesReady = input.activeServices > 0;
  const hoursReady = input.bookingHoursConfigured;
  const bookingReady = input.bookingEnabled && Boolean(input.publicBookingSlug);
  const isReady = servicesReady && hoursReady && bookingReady;

  return {
    servicesReady,
    hoursReady,
    bookingReady,
    isReady,
    bookingUrl: isReady ? `https://www.proffera.se/boka/${input.publicBookingSlug}` : null,
  };
}

async function readLaunchState() {
  const [services, bookingHours, workspaceSettings, moduleAccess] = await Promise.all([
    getDashboardWorkspaceServices(),
    getDashboardWorkspaceBookingHours(),
    getDashboardWorkspaceSettings(),
    getDashboardModuleAccess(),
  ]);

  return getLaunchState({
    activeServices: services.filter((service) => service.isActive).length,
    bookingHoursConfigured: bookingHours.isConfigured,
    bookingEnabled: moduleAccess.some((module) => module.id === "online_booking" && module.isEnabled),
    publicBookingSlug: workspaceSettings.publicBookingSlug,
  });
}

async function saveIndustryAndPrepareBooking(formData: FormData) {
  "use server";

  const industryKey = String(formData.get("industryKey") ?? "other");
  const seeded = await seedWorkspaceServicesForIndustry(industryKey);
  const launch = await readLaunchState();
  const completedSteps = ["industry"];

  if (launch.servicesReady) completedSteps.push("services");
  if (launch.hoursReady) completedSteps.push("hours");
  if (launch.bookingReady) completedSteps.push("booking");
  if (launch.isReady) completedSteps.push("publish");

  const currentStep = !launch.servicesReady
    ? "services"
    : !launch.hoursReady
      ? "hours"
      : !launch.bookingReady
        ? "booking"
        : "publish";

  await updateWorkspaceOnboarding({
    industryKey: seeded.industryKey,
    currentStep,
    completedSteps,
    isComplete: launch.isReady,
  });

  redirect(`/dashboard/onboarding?saved=1&services=${seeded.created}${launch.isReady ? "&ready=1" : ""}`);
}

function StatusBadge({ ready }: { ready: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${ready ? "bg-[#e7f1eb] text-[#17452f]" : "bg-[#f3f1e8] text-[#705d24]"}`}>
      {ready ? "Klart" : "Nästa steg"}
    </span>
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; services?: string; ready?: string }>;
}) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");

  const [onboarding, launch] = await Promise.all([getWorkspaceOnboarding(), readLaunchState()]);
  const params = searchParams ? await searchParams : {};
  const createdServices = Math.max(0, Number(params.services) || 0);

  return (
    <div className="grid gap-6">
      <header className="rounded-[28px] bg-[#173e2b] p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Kom igång</p>
        <h1 className="mt-2 text-3xl font-bold">Din bokningssida på under 5 minuter</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">
          Välj din bransch. Proffera skapar starttjänster automatiskt och använder de bokningstider som redan finns i arbetsytan. När de tre stegen är klara kan du dela länken direkt.
        </p>
      </header>

      {params.saved === "1" ? (
        <p className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]" role="status">
          {createdServices > 0
            ? `${createdServices} rekommenderade tjänster skapades automatiskt. Befintliga tjänster skrivs aldrig över.`
            : "Branschen sparades. Befintliga tjänster behölls utan ändringar."}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[24px] border border-[#dfe6df] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#173e2b] text-sm font-black text-white">1</span>
            <StatusBadge ready={launch.servicesReady} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#17201a]">Bransch och tjänster</h2>
          <p className="mt-2 text-sm leading-6 text-[#667168]">
            {launch.servicesReady ? "Minst en aktiv tjänst finns och kan bokas." : "Välj bransch så skapar Proffera ett redigerbart startpaket med tjänster."}
          </p>
        </article>

        <article className="rounded-[24px] border border-[#dfe6df] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#173e2b] text-sm font-black text-white">2</span>
            <StatusBadge ready={launch.hoursReady} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#17201a]">Bokningstider</h2>
          <p className="mt-2 text-sm leading-6 text-[#667168]">
            {launch.hoursReady ? "Bokningstider finns redan. Du kan justera dem senare om du vill." : "Lägg in tider då kunder ska kunna boka."}
          </p>
          <a href="/dashboard/installningar" className="mt-3 inline-flex text-sm font-bold text-[#17452f] underline underline-offset-4">Justera tider</a>
        </article>

        <article className="rounded-[24px] border border-[#dfe6df] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#173e2b] text-sm font-black text-white">3</span>
            <StatusBadge ready={launch.bookingReady && launch.servicesReady && launch.hoursReady} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#17201a]">Dela bokningssidan</h2>
          <p className="mt-2 text-sm leading-6 text-[#667168]">
            {launch.isReady ? "Din sida är redo. Öppna den, kopiera länken eller använd QR-koden." : "När tjänster och tider är klara visas din bokningslänk här automatiskt."}
          </p>
        </article>
      </section>

      <form action={saveIndustryAndPrepareBooking} className="rounded-[24px] border border-[#dfe6df] bg-white p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-bold text-[#17201a]">
            Välj typ av företag
            <select name="industryKey" defaultValue={onboarding.industryKey} className="w-full rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal">
              <option value="salon">Salong och skönhet</option>
              <option value="cleaning">Städning</option>
              <option value="window_cleaning">Fönsterputs</option>
              <option value="consulting">Konsult</option>
              <option value="repair">Reparation och service</option>
              <option value="healthcare">Hälsa</option>
              <option value="restaurant">Restaurang</option>
              <option value="other">Annat</option>
            </select>
            <span className="text-xs font-normal leading-5 text-[#667168]">Om du redan har tjänster ändras eller raderas de inte.</span>
          </label>
          <button className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#173e2b] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#123824]">
            {launch.servicesReady ? "Spara bransch" : "Skapa mina starttjänster"}
          </button>
        </div>
      </form>

      {launch.bookingUrl ? (
        <section className="grid gap-4">
          <div className="rounded-[24px] border border-[#c9e6d0] bg-[#eef8f0] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#17452f]">Redo att ta emot bokningar</p>
            <h2 className="mt-2 text-2xl font-bold text-[#17201a]">Din första bokningssida är klar ✅</h2>
            <p className="mt-2 text-sm leading-6 text-[#466352]">Du kan börja dela länken nu. Tema, personal, priser och företagsprofil kan finjusteras efteråt utan att blockera lanseringen.</p>
          </div>
          <BookingLinkCard url={launch.bookingUrl} />
          <a href="/dashboard" className="inline-flex min-h-12 w-fit items-center justify-center rounded-xl bg-[#173e2b] px-6 py-3 text-sm font-bold text-white">Fortsätt till dashboard</a>
        </section>
      ) : (
        <section className="rounded-[24px] border border-[#e0e5dd] bg-[#f7f9f6] p-6">
          <h2 className="text-lg font-bold text-[#17201a]">Det som återstår</h2>
          <ul className="mt-3 grid gap-2 text-sm text-[#5b665f]">
            {!launch.servicesReady ? <li>• Skapa minst en aktiv tjänst genom att välja bransch ovan.</li> : null}
            {!launch.hoursReady ? <li>• Spara bokningstider under Inställningar.</li> : null}
            {!launch.bookingReady ? <li>• Onlinebokning eller den publika bokningslänken behöver vara aktiv.</li> : null}
          </ul>
        </section>
      )}

      <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6">
        <h2 className="text-lg font-bold text-[#17201a]">Finputs efter lansering</h2>
        <p className="mt-2 text-sm leading-6 text-[#667168]">Det här behöver inte stoppa din första bokningssida.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/dashboard/installningar" className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd9d0] px-5 py-3 text-sm font-bold text-[#17452f]">Företagsprofil och tjänster</a>
          <a href="/dashboard/installningar/utseende" className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd9d0] px-5 py-3 text-sm font-bold text-[#17452f]">Tema och utseende</a>
          <a href="/dashboard/personal" className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd9d0] px-5 py-3 text-sm font-bold text-[#17452f]">Lägg till personal</a>
        </div>
      </section>
    </div>
  );
}
