import Link from "next/link";

const navigation = [
  { label: "Översikt", href: "/dashboard" },
  { label: "Leads", href: "/dashboard/leads" },
  { label: "Kunder", href: "/dashboard/kunder" },
  { label: "Bokningar", href: "/dashboard/bokningar" },
  { label: "AI-assistent", href: "/dashboard/ai-assistent" },
  { label: "Inställningar", href: "/dashboard/installningar" },
] as const;

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[#f7f7f4] text-[#17201a]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[#dfe5dd] bg-white px-4 py-4 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <Link href="/" className="flex items-center gap-3 text-xl font-bold text-[#17452f]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#17452f] text-white">P</span>
            <span>Proffera</span>
          </Link>
          <p className="mt-2 text-xs text-[#5b665f]">SaaS dashboard preview</p>
          <nav className="mt-6 grid gap-2" aria-label="Dashboard navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl px-4 py-3 text-sm font-semibold text-[#344139] hover:bg-[#eef5ef] hover:text-[#17452f]">
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[#dfe5dd] bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#17452f]">Workspace</p>
                <h1 className="text-2xl font-bold tracking-tight">Proffera Dashboard</h1>
              </div>
              <div className="rounded-full bg-[#e7f1eb] px-4 py-2 text-sm font-semibold text-[#17452f]">Preview-läge</div>
            </div>
          </header>
          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
