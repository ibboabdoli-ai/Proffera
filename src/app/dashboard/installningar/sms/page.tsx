import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { getWorkspaceSmsUsage } from "@/lib/workspace-sms-usage";

export const dynamic = "force-dynamic";

export default async function SmsSettingsPage({
  searchParams,
}: { searchParams?: Promise<{ lang?: string }> }) {
  const access=await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");
  const params=await searchParams;
  const en=params?.lang==="en";
  const usage=await getWorkspaceSmsUsage(access.workspaceId);
  const heading=en?"SMS allowance":"SMS-kvot";
  const number=new Intl.NumberFormat(en?"en-GB":"sv-SE");
  return (
    <div className="grid gap-6">
      <DashboardPageHeader eyebrow={en?"Subscription":"Abonnemang"}
        title={heading}
        description={en?"Monthly SMS usage and remaining allowance.":"Månadens SMS-förbrukning och återstående kvot."}
        icon={MessageSquareText}
        actions={<Link href="/dashboard/installningar" className="rounded-control border border-line px-4 py-2 text-sm font-bold">
          {en?"Back to settings":"Tillbaka till inställningar"}
        </Link>}/>
      <section className="rounded-card border border-line bg-surface p-6">
        {!usage.available ? (
          <p>{en?"SMS quota information is currently unavailable. No SMS was sent.":"SMS-kvoten är för tillfället inte tillgänglig. Inget SMS skickades."}</p>
        ) : usage.limit===null ? (
          <p>{en?"An active, paid Starter SMS plan is required before messages can be sent.":"Ett aktivt, betalt Starter-abonnemang krävs för SMS. Ingen aktiv Starter-kvot finns."}</p>
        ) : (
          <>
            <p className="text-2xl font-bold">{number.format(usage.used)} / {number.format(usage.limit)}</p>
            <p className="mt-2 text-sm">{en?"SMS units used or reserved":"SMS-enheter använda eller reserverade"}</p>
            <div role="meter" aria-label={en?"SMS usage":"SMS-förbrukning"} aria-valuemin={0}
              aria-valuemax={usage.limit} aria-valuenow={Math.min(usage.limit,usage.used)}
              className="mt-4 h-3 overflow-hidden rounded-full bg-surface-subtle">
              <div className="h-full bg-brand" style={{width:String(Math.min(100,Math.round(100*usage.used/usage.limit)))+"%"}}/>
            </div>
            <p className="mt-4 font-semibold">{number.format(usage.remaining)} {en?"units remaining":"enheter kvar"}</p>
            {usage.periodEnd ? <p className="mt-2 text-sm">{en?"Next renewal: ":"Nästa period: "}
              {new Intl.DateTimeFormat(en?"en-GB":"sv-SE",{dateStyle:"medium",timeZone:"Europe/Stockholm"}).format(new Date(usage.periodEnd))}
            </p> : null}
            {usage.limit===50 ? <p className="mt-4 text-sm">{en
              ?"Your discounted Starter includes 50 units. Changing to full-price Starter (100) requires your confirmation before any payment changes."
              :"Din rabatterade Starter har 50 enheter. Byte till Starter till fullt pris (100) kräver ditt godkännande innan betalningen ändras."}</p> : null}
          </>
        )}
        <p className="mt-5 text-xs">{en
          ?"Long messages can consume multiple units. Uncertain deliveries remain reserved until reconciled."
          :"Långa meddelanden kan använda flera enheter. Osäkra leveranser förblir reserverade tills de kontrollerats."}</p>
      </section>
    </div>
  );
}
