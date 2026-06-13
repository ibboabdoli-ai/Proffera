const bookings = [
  { time: "09:00", title: "Hemstädning", customer: "Anna Karlsson", status: "Bekräftad" },
  { time: "13:30", title: "Demo Proffera", customer: "Nordic Kontor AB", status: "Planerad" },
  { time: "16:00", title: "Uppföljning lead", customer: "Bostadsservice Demo", status: "Att göra" },
] as const;

export default function BookingsPage() {
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Bokningar</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Bokningsöversikt</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">Preview för kommande kalender- och uppföljningsflöde.</p>
      </section>
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div key={`${booking.time}-${booking.title}`} className="grid gap-2 rounded-2xl bg-[#f7f7f4] p-4 sm:grid-cols-[90px_1fr_auto] sm:items-center">
              <span className="font-bold text-[#17452f]">{booking.time}</span>
              <span><strong>{booking.title}</strong><br /><span className="text-sm text-[#5b665f]">{booking.customer}</span></span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#344139]">{booking.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
