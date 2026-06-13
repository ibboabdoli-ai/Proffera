const bookings = [
  { time: "09:00", title: "Hemstädning", customer: "Anna Karlsson", status: "Bekräftad", address: "Södertälje" },
  { time: "11:30", title: "Fönsterputs", customer: "Villa kund", status: "Väntar svar", address: "Tumba" },
  { time: "13:30", title: "Demo Proffera", customer: "Nordic Kontor AB", status: "Planerad", address: "Online" },
  { time: "16:00", title: "Uppföljning lead", customer: "Bostadsservice Demo", status: "Att göra", address: "Telefon" },
] as const;

const days = [
  { day: "Mån", count: "3" },
  { day: "Tis", count: "5" },
  { day: "Ons", count: "2" },
  { day: "Tor", count: "4" },
  { day: "Fre", count: "6" },
] as const;

export default function BookingsPage() {
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Bokningar</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Bokningsöversikt</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Preview för kommande kalender, dagsvy och uppföljningsflöde.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {days.map((item) => (
          <article key={item.day} className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold text-[#344139]">{item.day}</p>
            <p className="mt-2 text-2xl font-bold text-[#17452f]">{item.count}</p>
            <p className="text-xs text-[#5b665f]">bokningar</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex items-center justify-between border-b border-[#dfe5dd] pb-4">
            <div>
              <h3 className="text-xl font-bold text-[#17201a]">Dagens schema</h3>
              <p className="text-sm text-[#5b665f]">Preview med tid, kund och status.</p>
            </div>
            <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Live preview</span>
          </div>
          <div className="mt-5 space-y-3">
            {bookings.map((booking) => (
              <div key={`${booking.time}-${booking.title}`} className="grid gap-2 rounded-2xl bg-[#f7f7f4] p-4 sm:grid-cols-[90px_1fr_auto] sm:items-center">
                <span className="font-bold text-[#17452f]">{booking.time}</span>
                <span>
                  <strong>{booking.title}</strong>
                  <br />
                  <span className="text-sm text-[#5b665f]">{booking.customer} · {booking.address}</span>
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#344139]">{booking.status}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-3xl bg-[#17452f] p-6 text-white">
          <h3 className="text-xl font-bold">Kommande automation</h3>
          <p className="mt-3 text-sm leading-7 text-white/80">
            Bokningar kan senare kopplas till automatiska bekräftelser, påminnelser och kalenderintegration.
          </p>
        </aside>
      </section>
    </div>
  );
}
