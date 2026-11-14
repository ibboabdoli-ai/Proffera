import Link from "next/link";
import { redirect } from "next/navigation";
import { BookingSoftDeleteControl } from "../booking-soft-delete-control";
import { listMariaArchivedBookings } from "@/lib/maria-booking-soft-delete";
import { canManageWorkspaceMembers, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export default async function MariaBookingArchive({ searchParams }: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceMembers(access)
    || access.workspaceSlug !== "makeup-by-maria") redirect("/dashboard/bokningar");
  const en = (await searchParams)?.lang === "en";
  const bookings = await listMariaArchivedBookings(access.workspaceId);
  return <div className="grid gap-6">
    <h1 className="text-2xl font-bold">{en ? "Booking archive" : "Bokningsarkiv"}</h1>
    <p>{en ? "Archived bookings are recoverable. Payment records and audit history stay intact."
      : "Arkiverade bokningar kan återställas. Betalningar och historik bevaras."}</p>
    <Link className="text-brand underline" href="/dashboard/bokningar">
      {en ? "Back to bookings" : "Tillbaka till bokningar"}</Link>
    {bookings.length === 0 ? <p>{en ? "No archived bookings." : "Inga arkiverade bokningar."}</p>
      : bookings.map(booking => <article className="grid gap-3" key={booking.id}>
        <h2 className="font-bold">{booking.title}</h2>
        <p className="text-sm">{booking.status} · {new Intl.DateTimeFormat(en ? "en-GB" : "sv-SE", {
          dateStyle: "medium", timeZone: "Europe/Stockholm",
        }).format(new Date(booking.deletedAt))}</p>
        <BookingSoftDeleteControl bookingId={booking.id} action="restore" en={en} />
      </article>)}
  </div>;
}
