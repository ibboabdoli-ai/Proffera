import type { ReactNode } from "react";

import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";
import styles from "@/components/dashboard/public-experience-ux-2.module.css";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

export default async function GalleryLayout({ children }: Readonly<{ children: ReactNode }>) {
  const access = await getUserWorkspaceAccess();
  const publicHref = access.ok ? `/galleri/${access.workspaceSlug}` : null;

  return <DashboardModuleGuard featureKey="media_gallery">
    <div className={`${styles.scope} grid gap-6`}>
      {publicHref ? <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <div><p className="text-xs font-black uppercase tracking-[.16em] text-ink-muted">Publik gallerilänk</p><p className="mt-2 break-all text-sm font-semibold text-ink">{publicHref}</p><p className="mt-1 text-xs text-ink-muted">Publicerade medier visas här och på bokningssidan när Galleri är aktiverat under Utseende.</p></div>
        <a href={publicHref} target="_blank" rel="noreferrer" className="rounded-control bg-brand-deep px-4 py-3 text-sm font-black text-white">Öppna publikt galleri</a>
      </section> : null}
      {children}
    </div>
  </DashboardModuleGuard>;
}
