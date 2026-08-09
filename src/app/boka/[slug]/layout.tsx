import type { ReactNode } from "react";

import { PublicWorkspaceGallery } from "@/components/public-workspace-gallery";
import { getSql } from "@/lib/db/server";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";
import { getPublicWorkspaceExperienceSettings } from "@/lib/workspace-experience";
import { getPublishedGalleryItems } from "@/lib/website-gallery-db";
import { getPublishedWebsiteReviews } from "@/lib/website-reviews-db";

import "./booking-themes.css";
import "./booking-theme-controls.css";
import "./booking-polish.css";

type PublicStaffMember = {
  id: string;
  name: string;
  roleLabel: string;
};

export default async function PublicBookingLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sql = getSql();
  let publicSections: ReactNode = null;
  let gallery: ReactNode = null;
  let themeKey = "clean";
  let appearance = "light";

  if (sql) {
    const rows = await sql`
      select
        w.id,
        w.slug,
        coalesce(nullif(ws.company_name, ''), nullif(w.company_name, ''), w.name) as company_name
      from workspaces w
      left join workspace_settings ws on ws.workspace_id = w.id::text
      where w.public_booking_slug = ${slug}
        and w.status in ('active', 'trial')
      limit 1
    `;
    const workspace = rows[0];
    if (workspace) {
      const workspaceId = String(workspace.id);
      const workspaceSlug = String(workspace.slug);
      const experience = await getPublicWorkspaceExperienceSettings(workspaceId);
      themeKey = experience.themeKey;
      appearance = experience.appearance;

      if (slug !== "julius-salong") {
        const reviews = experience.reviewsEnabled
          ? await getPublishedWebsiteReviews(workspaceSlug)
          : [];
        let staff: PublicStaffMember[] = [];

        if (experience.staffEnabled) {
          try {
            const staffRows = await sql`
              select id, name, role_label
              from workspace_staff
              where workspace_id = ${workspaceId}
                and is_active = true
              order by sort_order asc, name asc
              limit 12
            `;
            staff = staffRows.map((row) => ({
              id: String(row.id),
              name: String(row.name ?? ""),
              roleLabel: String(row.role_label ?? ""),
            })).filter((member) => member.name);
          } catch (error) {
            console.error("Failed to read public booking staff", error);
          }
        }

        if (reviews.length || staff.length) {
          publicSections = (
            <section className="mx-auto grid max-w-5xl gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-2" data-booking-public-sections>
              {reviews.length ? (
                <div className="rounded-[2rem] bg-white p-5 text-[#17201a] shadow-sm ring-1 ring-black/10 sm:p-6" data-booking-reviews>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607067]">Omdömen · Reviews</p>
                      <h2 className="mt-2 text-xl font-black">Verifierade kundomdömen</h2>
                    </div>
                    <span className="rounded-full bg-[#edf5ef] px-3 py-1.5 text-xs font-black text-[#17452f]">Verifierade ✓</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {reviews.slice(0, 3).map((review) => (
                      <article key={review.id} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfcfa] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="tracking-[0.12em] text-[#17452f]" aria-label={`${review.rating} av 5 stjärnor`}>{"★".repeat(review.rating)}<span className="text-[#cbd3cd]">{"★".repeat(5 - review.rating)}</span></span>
                          <span className="text-[11px] font-bold text-[#657168]">Verifierad kund</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#354139]">“{review.message}”</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#667168]">
                          <strong className="text-[#243028]">{review.reviewerName}</strong>
                          {review.service ? <span>· {review.service}</span> : null}
                          {review.area ? <span>· {review.area}</span> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {staff.length ? (
                <div className="rounded-[2rem] bg-white p-5 text-[#17201a] shadow-sm ring-1 ring-black/10 sm:p-6" data-booking-staff>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607067]">Medarbetare · Staff</p>
                  <h2 className="mt-2 text-xl font-black">Möt teamet</h2>
                  <p className="mt-2 text-sm leading-6 text-[#667168]">Aktiva medarbetare som hjälper kunderna med bokade tjänster.</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {staff.map((member) => (
                      <article key={member.id} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfcfa] p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#edf5ef] text-sm font-black text-[#17452f]" aria-hidden="true">
                          {member.name.slice(0, 1).toUpperCase()}
                        </div>
                        <h3 className="mt-3 text-sm font-black">{member.name}</h3>
                        {member.roleLabel ? <p className="mt-1 text-xs text-[#667168]">{member.roleLabel}</p> : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          );
        }
      }

      if (experience.galleryEnabled) {
        const galleryEnabled = await hasWorkspaceFeatureAccessForWorkspace(workspaceId, "media_gallery");
        if (galleryEnabled) {
          const items = await getPublishedGalleryItems(workspaceSlug);
          gallery = <PublicWorkspaceGallery items={items} companyName={String(workspace.company_name)} workspaceSlug={slug} compact />;
        }
      }
    }
  }

  return <div data-booking-theme={themeKey} data-booking-appearance={appearance}>{children}{publicSections}{gallery}</div>;
}