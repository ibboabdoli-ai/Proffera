import type { CSSProperties, ReactNode } from "react";
import QRCode from "qrcode";

import { PublicWorkspaceGallery } from "@/components/public-workspace-gallery";
import { normalizeBookingThemeAppearance } from "@/lib/booking-theme-contract";
import { getSql } from "@/lib/db/server";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";
import { getPublicWorkspaceExperienceSettings } from "@/lib/workspace-experience";
import { getPublishedGalleryItems } from "@/lib/website-gallery-db";
import { getPublishedWebsiteReviews } from "@/lib/website-reviews-db";

import { BookingMediaGuard } from "./booking-media-guard";
import "./booking-themes.css";
import "./booking-theme-controls.css";
import "./booking-polish.css";
import "./booking-contrast.css";
import "./restaurant-v3.css";

type PublicStaffMember = {
  id: string;
  name: string;
  roleLabel: string;
};

type RestaurantService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  coverImageUrl: string;
};

type RestaurantHour = {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
};

type RestaurantReview = {
  id: string;
  reviewerName: string;
  rating: number;
  service: string | null;
  area: string | null;
  message: string;
};

const RESTAURANT_V3_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1753019491860-128b7763f8ee?auto=format&fit=crop&w=2200&q=82";
const RESTAURANT_WEEKDAYS = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];

function safeCssUrl(value: string) {
  return `url(\"${value.replaceAll("\\", "%5C").replaceAll("\"", "%22")}\")`;
}

function RestaurantV3Hero({
  companyName,
  city,
  intro,
  logoUrl,
  slug,
  swedishEnabled,
  englishEnabled,
}: {
  companyName: string;
  city: string;
  intro: string;
  logoUrl: string;
  slug: string;
  swedishEnabled: boolean;
  englishEnabled: boolean;
}) {
  const introLines = intro.split("\n").map((line) => line.trim()).filter(Boolean);
  const headline = introLines[0] || "God mat. Bra stämning. Minnen att dela.";
  const description = introLines.slice(1).join(" ") || "Njut av omsorgsfullt lagad mat i en varm miljö. Boka ditt bord enkelt online.";

  return (
    <section data-restaurant-v3-hero>
      <div className="restaurant-v3-nav">
        <div className="restaurant-v3-brand">
          {logoUrl ? <img src={logoUrl} alt="" className="restaurant-v3-logo" /> : <span className="restaurant-v3-mark" aria-hidden="true">✦</span>}
          <span><strong>{companyName}</strong><small>RESTAURANG</small></span>
        </div>
        <nav className="restaurant-v3-links" aria-label="Restaurant navigation">
          <a href="#restaurant-booking">Hem</a>
          <a href="#restaurant-services">Boka</a>
          <a href="#restaurant-reviews">Omdömen</a>
          <a href="#restaurant-contact">Kontakt</a>
        </nav>
        <div className="restaurant-v3-languages" aria-label="Language">
          {swedishEnabled ? <a href={`/boka/${slug}?lang=sv`}>🇸🇪 Svenska</a> : null}
          {englishEnabled ? <a href={`/boka/${slug}?lang=en`}>English</a> : null}
        </div>
      </div>

      <div className="restaurant-v3-copy">
        <p className="restaurant-v3-eyebrow">VÄLKOMMEN TILL {companyName.toUpperCase()}</p>
        <h1>{headline}</h1>
        <p className="restaurant-v3-description">{description}</p>
        <div className="restaurant-v3-proof">
          <span aria-label="5 av 5 stjärnor">★★★★★</span>
          <strong>4,9</strong>
          <small>Verifierade gäster</small>
        </div>
        {city ? <p className="restaurant-v3-city">⌖ {city}</p> : null}
      </div>

      <div className="restaurant-v3-feature-strip" aria-label="Booking benefits">
        <div><strong>Enkel onlinebokning</strong><span>Boka bord på några sekunder</span></div>
        <div><strong>Flexibel ändring</strong><span>Hantera din bokning enkelt</span></div>
        <div><strong>Bästa upplevelsen</strong><span>Verifierade omdömen från gäster</span></div>
        <div><strong>Säker och trygg</strong><span>Dina uppgifter hanteras säkert</span></div>
      </div>
    </section>
  );
}

function RestaurantV3Content({
  slug,
  companyName,
  city,
  contactEmail,
  contactPhone,
  services,
  hours,
  reviews,
  qrDataUrl,
}: {
  slug: string;
  companyName: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  services: RestaurantService[];
  hours: RestaurantHour[];
  reviews: RestaurantReview[];
  qrDataUrl: string;
}) {
  return (
    <div data-restaurant-v3-content>
      {services.length ? (
        <section className="restaurant-v3-services" id="restaurant-services" aria-label="Tjänster">
          {services.slice(0, 3).map((service, index) => (
            <article
              key={service.id}
              className="restaurant-v3-service-card"
              style={{ "--restaurant-service-image": safeCssUrl(service.coverImageUrl || RESTAURANT_V3_FALLBACK_IMAGE), "--restaurant-service-position": `${50 + index * 7}%` } as CSSProperties}
            >
              <div>
                <span className="restaurant-v3-service-icon" aria-hidden="true">{index === 0 ? "◫" : index === 1 ? "♙" : "◇"}</span>
                <h2>{service.name}</h2>
                <p>{service.description || `${service.durationMinutes} min · Boka enkelt online`}</p>
                <a href={`/boka/${slug}?service_id=${encodeURIComponent(service.id)}#restaurant-booking`}>{index === 2 ? "Skicka förfrågan" : "Boka bord"} →</a>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {reviews.length ? (
        <section className="restaurant-v3-review-strip" id="restaurant-reviews">
          <header><h2>Vad våra gäster säger</h2><span>Verifierade omdömen</span></header>
          <div>
            {reviews.slice(0, 4).map((review) => (
              <article key={review.id}>
                <div className="restaurant-v3-review-person"><span>{review.reviewerName.slice(0, 1).toUpperCase()}</span><strong>{review.reviewerName}</strong></div>
                <p className="restaurant-v3-stars">{"★".repeat(review.rating)}<span>{"★".repeat(Math.max(0, 5 - review.rating))}</span></p>
                <p>“{review.message}”</p>
                {(review.service || review.area) ? <small>{[review.service, review.area].filter(Boolean).join(" · ")}</small> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="restaurant-v3-info-grid" id="restaurant-contact">
        <article>
          <h3>◷ Bokningstider</h3>
          <div className="restaurant-v3-hours">
            {hours.map((hour) => <p key={hour.weekday}><span>{RESTAURANT_WEEKDAYS[hour.weekday]}</span><strong>{hour.isClosed ? "Stängt" : `${hour.opensAt.slice(0, 5)}–${hour.closesAt.slice(0, 5)}`}</strong></p>)}
          </div>
        </article>
        <article>
          <h3>⌕ Kontakt</h3>
          {contactPhone ? <a href={`tel:${contactPhone}`}>{contactPhone}</a> : null}
          {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : null}
          {city ? <p>{city}</p> : null}
        </article>
        <article className="restaurant-v3-location-card">
          <h3>⌖ Hitta hit</h3>
          <div className="restaurant-v3-map-placeholder"><span>⌖</span><strong>{city || companyName}</strong></div>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${companyName} ${city}`)}`} target="_blank" rel="noreferrer">Visa på karta</a>
        </article>
        <article className="restaurant-v3-qr-card">
          <h3>▦ QR-bokning</h3>
          <div><p>Skanna QR-koden för att boka direkt från mobilen.</p><img src={qrDataUrl} alt={`QR-kod till ${companyName}s bokningssida`} /></div>
        </article>
      </section>

      <section className="restaurant-v3-faq">
        <h2>Vanliga frågor</h2>
        <div>
          <details><summary>Hur avbokar jag min bokning?</summary><p>Använd länken i bokningsmejlet för att hantera din bokning.</p></details>
          <details><summary>Kan jag ändra min bokning?</summary><p>Ja, när ombokning är tillgänglig för bokningen kan du hantera den via kundlänken.</p></details>
          <details><summary>Kan jag boka samma dag?</summary><p>Lediga tider visas automatiskt utifrån restaurangens bokningsregler och tillgänglighet.</p></details>
          <details><summary>När är bokningen bekräftad?</summary><p>Bokningen registreras efter e-postverifiering och följer restaurangens bekräftelseflöde.</p></details>
        </div>
      </section>

      <footer className="restaurant-v3-footer">
        <div><strong>{companyName}</strong><p>{city ? `Restaurang i ${city}` : "Restaurang"}</p></div>
        <div><strong>Snabblänkar</strong><a href="#restaurant-services">Boka</a><a href="#restaurant-reviews">Omdömen</a><a href="#restaurant-contact">Kontakt</a></div>
        <div><strong>Kontakt</strong>{contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : null}{contactPhone ? <a href={`tel:${contactPhone}`}>{contactPhone}</a> : null}</div>
        <small>Powered by Proffera · Säker onlinebokning</small>
      </footer>
    </div>
  );
}

export default async function PublicBookingLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sql = getSql();
  let publicSections: ReactNode = null;
  let gallery: ReactNode = null;
  let restaurantHero: ReactNode = null;
  let restaurantContent: ReactNode = null;
  let restaurantImageUrl = "";
  let themeKey = "clean";
  let appearance: "light" | "dark" = "light";

  if (sql) {
    const rows = await sql`
      select
        w.id,
        w.slug,
        coalesce(nullif(ws.company_name, ''), nullif(w.company_name, ''), w.name) as company_name,
        coalesce(nullif(ws.primary_city, ''), nullif(w.primary_city, ''), '') as primary_city,
        coalesce(nullif(ws.contact_email, ''), '') as contact_email,
        coalesce(nullif(ws.contact_phone, ''), '') as contact_phone
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
      appearance = normalizeBookingThemeAppearance(experience.themeKey, experience.appearance);

      const reviews = slug !== "julius-salong" && experience.reviewsEnabled
        ? await getPublishedWebsiteReviews(workspaceSlug)
        : [];

      if (experience.themeKey === "restaurant" && slug !== "julius-salong") {
        const [introRows, serviceRows, hourRows] = await Promise.all([
          sql`select business_intro from workspace_experience_settings where workspace_id = ${workspaceId}::uuid limit 1`,
          sql`
            select id, name, coalesce(nullif(short_description, ''), nullif(description, ''), '') as description,
              duration_minutes, coalesce(nullif(cover_image_url, ''), '') as cover_image_url
            from workspace_services
            where workspace_id = ${workspaceId}
              and is_active = true
            order by sort_order asc, name asc
            limit 6
          `,
          sql`select weekday, opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${workspaceId} order by weekday asc`,
        ]);
        const intro = String(introRows[0]?.business_intro ?? "").trim();
        const restaurantServices: RestaurantService[] = serviceRows.map((row) => ({
          id: String(row.id),
          name: String(row.name ?? ""),
          description: String(row.description ?? ""),
          durationMinutes: Number(row.duration_minutes) || 60,
          coverImageUrl: String(row.cover_image_url ?? ""),
        }));
        const restaurantHours: RestaurantHour[] = hourRows.map((row) => ({
          weekday: Number(row.weekday),
          opensAt: String(row.opens_at ?? ""),
          closesAt: String(row.closes_at ?? ""),
          isClosed: Boolean(row.is_closed),
        }));
        const fallbackServiceImage = restaurantServices.find((service) => service.coverImageUrl)?.coverImageUrl || "";
        restaurantImageUrl = experience.heroImageUrl || fallbackServiceImage || RESTAURANT_V3_FALLBACK_IMAGE;
        const qrDataUrl = await QRCode.toDataURL(`https://www.proffera.se/boka/${encodeURIComponent(slug)}`, { width: 180, margin: 1, color: { dark: "#1d120d", light: "#fffdf9" } });

        restaurantHero = (
          <RestaurantV3Hero
            companyName={String(workspace.company_name)}
            city={String(workspace.primary_city ?? "")}
            intro={intro}
            logoUrl={experience.logoUrl}
            slug={slug}
            swedishEnabled={experience.swedishEnabled}
            englishEnabled={experience.englishEnabled}
          />
        );
        restaurantContent = (
          <RestaurantV3Content
            slug={slug}
            companyName={String(workspace.company_name)}
            city={String(workspace.primary_city ?? "")}
            contactEmail={String(workspace.contact_email ?? "")}
            contactPhone={String(workspace.contact_phone ?? "")}
            services={restaurantServices}
            hours={restaurantHours}
            reviews={reviews as RestaurantReview[]}
            qrDataUrl={qrDataUrl}
          />
        );
      } else if (slug !== "julius-salong") {
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
                    <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#607067]">Omdömen · Reviews</p><h2 className="mt-2 text-xl font-black">Verifierade kundomdömen</h2></div>
                    <span className="rounded-full bg-[#edf5ef] px-3 py-1.5 text-xs font-black text-[#17452f]">Verifierade ✓</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {reviews.slice(0, 3).map((review) => (
                      <article key={review.id} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfcfa] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2"><span className="tracking-[0.12em] text-[#17452f]" aria-label={`${review.rating} av 5 stjärnor`}>{"★".repeat(review.rating)}<span className="text-[#cbd3cd]">{"★".repeat(5 - review.rating)}</span></span><span className="text-[11px] font-bold text-[#657168]">Verifierad kund</span></div>
                        <p className="mt-3 text-sm leading-6 text-[#354139]">“{review.message}”</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#667168]"><strong className="text-[#243028]">{review.reviewerName}</strong>{review.service ? <span>· {review.service}</span> : null}{review.area ? <span>· {review.area}</span> : null}</div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
              {staff.length ? (
                <div className="rounded-[2rem] bg-white p-5 text-[#17201a] shadow-sm ring-1 ring-black/10 sm:p-6" data-booking-staff>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607067]">Medarbetare · Staff</p><h2 className="mt-2 text-xl font-black">Möt teamet</h2><p className="mt-2 text-sm leading-6 text-[#667168]">Aktiva medarbetare som hjälper kunderna med bokade tjänster.</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">{staff.map((member) => <article key={member.id} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfcfa] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#edf5ef] text-sm font-black text-[#17452f]" aria-hidden="true">{member.name.slice(0, 1).toUpperCase()}</div><h3 className="mt-3 text-sm font-black">{member.name}</h3>{member.roleLabel ? <p className="mt-1 text-xs text-[#667168]">{member.roleLabel}</p> : null}</article>)}</div>
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

  const restaurantStyle = themeKey === "restaurant" && restaurantImageUrl
    ? ({ "--restaurant-v3-image": safeCssUrl(restaurantImageUrl) } as CSSProperties)
    : undefined;

  return <div data-booking-theme={themeKey} data-booking-appearance={appearance} style={restaurantStyle}>{restaurantHero}{children}{restaurantContent}{publicSections}{gallery}<BookingMediaGuard /></div>;
}
