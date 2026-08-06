import Link from "next/link";

export default function ReviewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid gap-5">
      <nav
        className="flex flex-wrap gap-2 rounded-2xl border border-[#e0e5dd] bg-white p-3 text-sm font-bold shadow-sm"
        aria-label="Reviews navigation"
      >
        <Link
          href="/dashboard/omdomen"
          className="rounded-xl border border-[#d5ddd3] px-4 py-2 text-[#17452f]"
        >
          Kundomdömen
        </Link>
        <Link
          href="/dashboard/omdomen/inbjudningar"
          className="rounded-xl border border-[#d5ddd3] px-4 py-2 text-[#17452f]"
        >
          Verifierade inbjudningar
        </Link>
      </nav>
      {children}
    </div>
  );
}
