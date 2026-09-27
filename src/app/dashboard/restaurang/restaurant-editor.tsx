"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { RestaurantSite } from "@/lib/restaurant-site-schema";
import { parseRestaurantPrice } from "@/lib/restaurant-price";
import { saveDraft } from "./actions";

type Media = { id: string; url: string; alt: string };
type Section = "menu" | "categories" | "photos" | "content" | "hours" | "links";
const sections: { id: Section; label: string }[] = [
  { id: "menu", label: "Meny" },
  { id: "categories", label: "Kategorier" },
  { id: "photos", label: "Bilder" },
  { id: "content", label: "Texter" },
  { id: "hours", label: "Öppettider" },
  { id: "links", label: "Länkar" },
];
const days = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
];
const galleryKinds = [
  "interior",
  "exterior",
  "atmosphere",
  "food",
  "family",
] as const;
const galleryKindLabels = {
  interior: "Interiör",
  exterior: "Exteriör",
  atmosphere: "Stämning",
  food: "Mat",
  family: "Familj/team",
};
const input =
  "min-h-12 w-full rounded-lg border border-[#cfc4b5] bg-white px-3 text-base text-[#221d19] focus:border-[#83372e] focus:outline-2 focus:outline-[#83372e]/20";
const button =
  "min-h-11 rounded-lg border border-[#ab9d8b] px-4 py-2 text-sm font-semibold text-[#342a23]";

function moveGalleryById(
  items: RestaurantSite["media"]["gallery"],
  id: string,
  direction: number,
) {
  const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = ordered.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  ordered.forEach((item, position) => {
    item.sortOrder = position;
  });
  items.splice(0, items.length, ...ordered);
}

function PriceInput({
  value,
  onChange,
  label,
  className = input,
}: {
  value: number | null;
  onChange: (ore: number | null) => void;
  label: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(() =>
    value === null ? "" : String(value / 100),
  );
  return (
    <input
      aria-label={label}
      className={className}
      type="text"
      inputMode="decimal"
      value={raw}
      onChange={(event) => {
        const next = event.target.value;
        const ore = parseRestaurantPrice(next);
        if (ore === undefined) return;
        setRaw(next);
        onChange(ore);
      }}
      onBlur={() =>
        setRaw((current) =>
          current === "" ? "" : String(Number(current.replace(",", "."))),
        )
      }
    />
  );
}

export function RestaurantEditor({
  initial,
  images: initialImages,
}: {
  initial: {
    draft: RestaurantSite;
    published: RestaurantSite | null;
    revision: number;
    publishedRevision: number | null;
  };
  images: Media[];
}) {
  const router = useRouter();
  const [site, setSite] = useState(initial.draft);
  const [images, setImages] = useState(initialImages);
  const [revision, setRevision] = useState(initial.revision);
  const publishedRevision = initial.publishedRevision;
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState<Section>("menu");
  const [selectedDish, setSelectedDish] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const allowNavigationRef = useRef(false);
  const restoringHistoryRef = useRef(false);

  useEffect(() => {
    if (!dirty) {
      allowNavigationRef.current = false;
      restoringHistoryRef.current = false;
      return;
    }

    const warning =
      "Du har osparade ändringar. Lämna sidan och kasta ändringarna?";

    const confirmNavigation = () => {
      if (allowNavigationRef.current) return true;
      const allowed = window.confirm(warning);
      if (allowed) allowNavigationRef.current = true;
      return allowed;
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search &&
        destination.hash
      ) {
        return;
      }
      if (!confirmNavigation()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onDocumentSubmit = (event: SubmitEvent) => {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!confirmNavigation()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onPopState = () => {
      if (allowNavigationRef.current) return;
      if (restoringHistoryRef.current) {
        restoringHistoryRef.current = false;
        return;
      }
      if (window.confirm(warning)) {
        allowNavigationRef.current = true;
        return;
      }
      restoringHistoryRef.current = true;
      window.history.forward();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onDocumentClick, true);
    document.addEventListener("submit", onDocumentSubmit, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onDocumentClick, true);
      document.removeEventListener("submit", onDocumentSubmit, true);
    };
  }, [dirty]);

  function edit(change: (next: RestaurantSite) => void) {
    if (busy) return;
    setSite((current) => {
      const next = structuredClone(current);
      change(next);
      return next;
    });
    setDirty(true);
    setNotice("");
  }

  async function save() {
    setBusy(true);
    try {
      const result = await saveDraft(site, revision);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setRevision(result.revision);
      setDirty(false);
      setNotice("Utkast sparat. Förhandsgranska före publicering.");
    } catch {
      setNotice("Det gick inte att spara. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(
    event: ChangeEvent<HTMLInputElement>,
    onDone: (media: Media) => void,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!alt.trim()) {
      setNotice("Skriv bildens alt-text innan du laddar upp.");
      event.target.value = "";
      return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("alt", alt.trim());
      const response = await fetch("/api/dashboard/restaurang/upload", {
        method: "POST",
        body: data,
      });
      const result = (await response.json()) as Media & { error?: string };
      if (!response.ok) {
        setNotice(result.error ?? "Uppladdningen misslyckades.");
        return;
      }
      setImages((current) => [result, ...current]);
      onDone(result);
      setAlt("");
      setNotice(
        "Bilden uppladdad. Spara utkastet och publicera för att visa ändringen.",
      );
    } catch {
      setNotice("Uppladdningen misslyckades.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function photoPicker(
    current: { id: string; alt: { sv: string; en: string } } | null,
    setPhoto: (
      image: { id: string; alt: { sv: string; en: string } } | null,
    ) => void,
  ) {
    return (
      <div className="grid gap-3">
        {current && images.find((image) => image.id === current.id) ? (
          <img
            src={images.find((image) => image.id === current.id)?.url}
            alt={current.alt.sv}
            className="h-36 w-full rounded-lg object-cover"
          />
        ) : null}
        <select
          className={input}
          value={current?.id ?? ""}
          aria-label="Välj befintlig bild"
          onChange={(event) => {
            const media = images.find((item) => item.id === event.target.value);
            setPhoto(
              media
                ? { id: media.id, alt: { sv: media.alt, en: media.alt } }
                : null,
            );
          }}
        >
          <option value="">Ingen bild</option>
          {images.map((item) => (
            <option key={item.id} value={item.id}>
              {item.alt} · {item.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <label className="text-sm font-semibold">
          Välj bild från telefonen
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={busy}
            onChange={(event) =>
              upload(event, (media) =>
                setPhoto({
                  id: media.id,
                  alt: { sv: media.alt, en: media.alt },
                }),
              )
            }
            className="mt-2 block w-full text-sm"
          />
        </label>
        <label className="text-sm font-semibold">
          Ta ett nytt foto
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            capture="environment"
            disabled={busy}
            onChange={(event) =>
              upload(event, (media) =>
                setPhoto({
                  id: media.id,
                  alt: { sv: media.alt, en: media.alt },
                }),
              )
            }
            className="mt-2 block w-full text-sm"
          />
        </label>
        {current && (
          <div className="grid gap-2 sm:grid-cols-2">
            {(["sv", "en"] as const).map((language) => (
              <label key={language} className="text-sm">
                Alt-text {language.toUpperCase()}
                <input
                  className={input}
                  value={current.alt[language]}
                  onChange={(event) =>
                    setPhoto({
                      ...current,
                      alt: { ...current.alt, [language]: event.target.value },
                    })
                  }
                />
              </label>
            ))}
          </div>
        )}
        {current && (
          <button
            className={button}
            type="button"
            onClick={() => setPhoto(null)}
          >
            Ta bort bild från sidan
          </button>
        )}
      </div>
    );
  }

  function move<T extends { sortOrder: number }>(
    items: T[],
    index: number,
    direction: number,
  ) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    items.forEach((item, position) => {
      item.sortOrder = position;
    });
  }
  const dish = site.dishes.find((item) => item.id === selectedDish);
  const status = dirty
    ? "Osparade ändringar"
    : revision !== publishedRevision
      ? "Utkast sparat"
      : "Publicerad";

  return (
    <main className="mx-auto max-w-6xl bg-[#f8f3ea] px-4 pb-28 pt-6 text-[#221d19] sm:px-8 sm:pb-10">
      <header className="border-b border-[#d9cfc1] pb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[#8a493a]">
          Doni’s Trattoria · Ägarvy
        </p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl">
          Hantera restaurangen
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <strong aria-live="polite">{status}</strong>
          <span className="text-[#665b50]">
            Redigera → Förhandsgranska → Publicera
          </span>
        </div>
        {notice && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-[#c8a891] bg-[#fff9f1] p-3 text-sm"
          >
            {notice}
          </p>
        )}
      </header>
      <div
        className={`mt-6 grid gap-8 md:grid-cols-[170px_minmax(0,1fr)] ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <nav
          aria-label="Restaurangadministration"
          className="flex gap-1 overflow-x-auto border-b border-[#d9cfc1] pb-2 md:flex-col md:border-b-0"
        >
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setSelectedDish(null);
              }}
              className={`min-h-11 shrink-0 rounded-lg px-4 text-left text-sm font-semibold ${section === item.id ? "bg-[#572e28] text-white" : "hover:bg-[#eee5d8]"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {section === "menu" && (
            <section>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-serif text-2xl">Meny</h2>
                <button
                  type="button"
                  className={button}
                  onClick={() => {
                    if (!site.categories.length) {
                      setSection("categories");
                      setNotice("Skapa en kategori först.");
                      return;
                    }
                    const id = crypto.randomUUID();
                    edit((next) =>
                      next.dishes.push({
                        id,
                        categoryId: next.categories[0].id,
                        name: "Ny rätt",
                        priceOre: null,
                        description: { sv: "", en: "" },
                        image: null,
                        sortOrder: next.dishes.length,
                        hidden: true,
                        archived: false,
                      }),
                    );
                    setSelectedDish(id);
                  }}
                >
                  + Lägg till rätt
                </button>
              </div>
              {dish ? (
                <div className="mt-5 grid gap-4">
                  <button
                    className="w-fit text-sm underline"
                    onClick={() => setSelectedDish(null)}
                  >
                    ← Tillbaka till menyn
                  </button>
                  <label className="text-sm font-semibold">
                    Rättens namn
                    <input
                      className={input}
                      value={dish.name}
                      maxLength={120}
                      onChange={(event) =>
                        edit((next) => {
                          next.dishes.find(
                            (item) => item.id === dish.id,
                          )!.name = event.target.value;
                        })
                      }
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Pris i kronor
                    <PriceInput
                      key={dish.id}
                      label={`Pris ${dish.name}`}
                      value={dish.priceOre}
                      onChange={(ore) =>
                        edit((next) => {
                          next.dishes.find(
                            (item) => item.id === dish.id,
                          )!.priceOre = ore;
                        })
                      }
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Kategori
                    <select
                      className={input}
                      value={dish.categoryId}
                      onChange={(event) =>
                        edit((next) => {
                          next.dishes.find(
                            (item) => item.id === dish.id,
                          )!.categoryId = event.target.value;
                        })
                      }
                    >
                      {site.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name.sv}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(["sv", "en"] as const).map((language) => (
                    <label key={language} className="text-sm font-semibold">
                      Beskrivning {language.toUpperCase()}
                      <textarea
                        className={`${input} min-h-24 py-3`}
                        value={dish.description[language]}
                        onChange={(event) =>
                          edit((next) => {
                            next.dishes.find(
                              (item) => item.id === dish.id,
                            )!.description[language] = event.target.value;
                          })
                        }
                      />
                    </label>
                  ))}
                  <h3 className="font-serif text-xl">Rättens bild</h3>
                  <label className="text-sm font-semibold">
                    Bildbeskrivning inför uppladdning
                    <input
                      className={input}
                      value={alt}
                      maxLength={180}
                      onChange={(event) => setAlt(event.target.value)}
                      placeholder="Beskriv det som syns på bilden"
                    />
                  </label>
                  {photoPicker(dish.image, (photo) =>
                    edit((next) => {
                      next.dishes.find((item) => item.id === dish.id)!.image =
                        photo;
                    }),
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={button}
                      onClick={() =>
                        edit((next) => {
                          next.dishes.find(
                            (item) => item.id === dish.id,
                          )!.hidden = !dish.hidden;
                        })
                      }
                    >
                      {dish.hidden ? "Visa rätt igen" : "Dölj tillfälligt"}
                    </button>
                    <button
                      className={button}
                      onClick={() => {
                        edit((next) => {
                          next.dishes.find(
                            (item) => item.id === dish.id,
                          )!.archived = !dish.archived;
                        });
                        setSelectedDish(null);
                      }}
                    >
                      {dish.archived ? "Återställ" : "Arkivera rätt"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-[#d9cfc1]">
                  {[...site.categories]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((category) => (
                      <div key={category.id}>
                        <h3 className="mt-5 font-serif text-xl">
                          {category.name.sv}{" "}
                          {category.hidden && (
                            <small className="text-sm">(dold kategori)</small>
                          )}
                        </h3>
                        {site.dishes
                          .filter(
                            (item) =>
                              item.categoryId === category.id && !item.archived,
                          )
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((item, index, list) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center gap-2 border-b border-[#e0d6c9] py-3"
                            >
                              <button
                                className="min-h-11 min-w-0 flex-1 text-left font-semibold underline decoration-[#b5a797] underline-offset-4"
                                onClick={() => setSelectedDish(item.id)}
                              >
                                {item.name}
                                <span className="ml-2 text-xs font-normal">
                                  {item.hidden ? "Dold" : ""}
                                </span>
                              </button>
                              <label className="text-xs">
                                Pris (kr)
                                <PriceInput
                                  label={`Pris ${item.name}`}
                                  className={`${input} w-24 text-right`}
                                  value={item.priceOre}
                                  onChange={(ore) =>
                                    edit((next) => {
                                      next.dishes.find(
                                        (dish) => dish.id === item.id,
                                      )!.priceOre = ore;
                                    })
                                  }
                                />
                              </label>
                              <button
                                className={button}
                                aria-label={`${item.hidden ? "Visa" : "Dölj"} ${item.name}`}
                                onClick={() =>
                                  edit((next) => {
                                    next.dishes.find(
                                      (dish) => dish.id === item.id,
                                    )!.hidden = !item.hidden;
                                  })
                                }
                              >
                                {item.hidden ? "Visa" : "Dölj"}
                              </button>
                              <button
                                className={button}
                                disabled={index === 0}
                                aria-label={`Flytta upp ${item.name}`}
                                onClick={() =>
                                  edit((next) =>
                                    move(
                                      next.dishes
                                        .filter(
                                          (dish) =>
                                            dish.categoryId === category.id &&
                                            !dish.archived,
                                        )
                                        .sort(
                                          (a, b) => a.sortOrder - b.sortOrder,
                                        ),
                                      index,
                                      -1,
                                    ),
                                  )
                                }
                              >
                                ↑
                              </button>
                              <button
                                className={button}
                                disabled={index === list.length - 1}
                                aria-label={`Flytta ner ${item.name}`}
                                onClick={() =>
                                  edit((next) =>
                                    move(
                                      next.dishes
                                        .filter(
                                          (dish) =>
                                            dish.categoryId === category.id &&
                                            !dish.archived,
                                        )
                                        .sort(
                                          (a, b) => a.sortOrder - b.sortOrder,
                                        ),
                                      index,
                                      1,
                                    ),
                                  )
                                }
                              >
                                ↓
                              </button>
                            </div>
                          ))}
                        {!site.dishes.some(
                          (item) =>
                            item.categoryId === category.id && !item.archived,
                        ) && <p className="py-3 text-sm">Inga rätter än.</p>}
                      </div>
                    ))}
                  {site.dishes.some((item) => item.archived) && (
                    <div className="py-6">
                      <h3 className="font-serif text-xl">Arkiverade rätter</h3>
                      {site.dishes
                        .filter((item) => item.archived)
                        .map((item) => (
                          <button
                            key={item.id}
                            className={`${button} mr-2 mt-2`}
                            onClick={() =>
                              edit((next) => {
                                next.dishes.find(
                                  (dish) => dish.id === item.id,
                                )!.archived = false;
                              })
                            }
                          >
                            {item.name} · Återställ
                          </button>
                        ))}
                    </div>
                  )}
                  {!site.categories.length && (
                    <p>Skapa en kategori för att börja med menyn.</p>
                  )}
                </div>
              )}
            </section>
          )}
          {section === "categories" && (
            <section>
              <h2 className="font-serif text-2xl">Kategorier</h2>
              <button
                className={`${button} mt-4`}
                onClick={() =>
                  edit((next) =>
                    next.categories.push({
                      id: crypto.randomUUID(),
                      name: { sv: "Ny kategori", en: "" },
                      sortOrder: next.categories.length,
                      hidden: false,
                    }),
                  )
                }
              >
                + Skapa kategori
              </button>
              <div className="mt-5 grid gap-5">
                {[...site.categories]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((category, index) => (
                    <div
                      key={category.id}
                      className="border-b border-[#d9cfc1] pb-4"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(["sv", "en"] as const).map((language) => (
                          <label
                            key={language}
                            className="text-sm font-semibold"
                          >
                            Namn {language.toUpperCase()}
                            <input
                              className={input}
                              value={category.name[language]}
                              onChange={(event) =>
                                edit((next) => {
                                  next.categories.find(
                                    (item) => item.id === category.id,
                                  )!.name[language] = event.target.value;
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          className={button}
                          onClick={() =>
                            edit((next) => {
                              next.categories.find(
                                (item) => item.id === category.id,
                              )!.hidden = !category.hidden;
                            })
                          }
                        >
                          {category.hidden ? "Visa" : "Dölj"}
                        </button>
                        <button
                          className={button}
                          disabled={index === 0}
                          onClick={() =>
                            edit((next) =>
                              move(
                                next.categories.sort(
                                  (a, b) => a.sortOrder - b.sortOrder,
                                ),
                                index,
                                -1,
                              ),
                            )
                          }
                        >
                          ↑ Flytta upp
                        </button>
                        <button
                          className={button}
                          disabled={index === site.categories.length - 1}
                          onClick={() =>
                            edit((next) =>
                              move(
                                next.categories.sort(
                                  (a, b) => a.sortOrder - b.sortOrder,
                                ),
                                index,
                                1,
                              ),
                            )
                          }
                        >
                          ↓ Flytta ner
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
          {section === "photos" && (
            <section className="grid gap-6">
              <h2 className="font-serif text-2xl">Bilder</h2>
              <label className="text-sm font-semibold">
                Bildbeskrivning inför uppladdning
                <input
                  className={input}
                  value={alt}
                  maxLength={180}
                  onChange={(event) => setAlt(event.target.value)}
                  placeholder="Beskriv det som syns på bilden"
                />
              </label>
              {(["hero", "owner", "family"] as const).map((kind) => (
                <div key={kind} className="border-t border-[#d9cfc1] pt-4">
                  <h3 className="mb-3 font-serif text-xl">
                    {kind === "hero"
                      ? "Huvudbild"
                      : kind === "owner"
                        ? "Ägarbild"
                        : "Familjebild"}
                  </h3>
                  {photoPicker(site.media[kind], (photo) =>
                    edit((next) => {
                      next.media[kind] = photo;
                    }),
                  )}
                </div>
              ))}
              <div className="border-t border-[#d9cfc1] pt-4">
                <h3 className="font-serif text-xl">Galleri</h3>
                <button
                  className={`${button} mt-3`}
                  onClick={() => {
                    const first = images.find(
                      (image) =>
                        !site.media.gallery.some((item) => item.id === image.id),
                    );
                    if (!first) {
                      setNotice(
                        images.length
                          ? "Alla bilder finns redan i galleriet. Ladda upp en ny bild."
                          : "Ladda upp en bild först.",
                      );
                      return;
                    }
                    edit((next) => {
                      if (next.media.gallery.some((item) => item.id === first.id))
                        return;
                      next.media.gallery.push({
                        id: first.id,
                        alt: { sv: first.alt, en: first.alt },
                        kind: "interior",
                        sortOrder: next.media.gallery.length,
                      });
                    });
                  }}
                >
                  + Lägg till från mediabiblioteket
                </button>
                {[...site.media.gallery]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((item, index) => (
                    <div
                      key={item.id}
                      className="mt-5 border-b border-[#d9cfc1] pb-5"
                    >
                      {photoPicker(item, (photo) => {
                        if (
                          photo &&
                          photo.id !== item.id &&
                          site.media.gallery.some((entry) => entry.id === photo.id)
                        ) {
                          setNotice("Bilden finns redan i galleriet. Välj en annan bild.");
                          return;
                        }
                        edit((next) => {
                          const itemIndex = next.media.gallery.findIndex(
                            (galleryItem) => galleryItem.id === item.id,
                          );
                          if (itemIndex < 0) return;
                          if (
                            photo &&
                            next.media.gallery.some(
                              (entry) => entry.id === photo.id && entry.id !== item.id,
                            )
                          ) return;
                          if (photo)
                            next.media.gallery[itemIndex] = {
                              ...next.media.gallery[itemIndex],
                              ...photo,
                            };
                          else next.media.gallery.splice(itemIndex, 1);
                        });
                      })}
                      <select
                        className={`${input} mt-2`}
                        value={item.kind}
                        onChange={(event) =>
                          edit((next) => {
                            const galleryItem = next.media.gallery.find(
                              (entry) => entry.id === item.id,
                            );
                            if (galleryItem)
                              galleryItem.kind = event.target
                                .value as typeof item.kind;
                          })
                        }
                      >
                        {galleryKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {galleryKindLabels[kind]}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 flex gap-2">
                        <button
                          className={button}
                          disabled={index === 0}
                          onClick={() =>
                            edit((next) =>
                              moveGalleryById(next.media.gallery, item.id, -1),
                            )
                          }
                        >
                          ↑
                        </button>
                        <button
                          className={button}
                          disabled={index === site.media.gallery.length - 1}
                          onClick={() =>
                            edit((next) =>
                              moveGalleryById(next.media.gallery, item.id, 1),
                            )
                          }
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
          {section === "content" && (
            <section className="grid gap-5">
              <h2 className="font-serif text-2xl">Webbplatstexter</h2>
              {(
                [
                  "heroTitle",
                  "heroDescription",
                  "aboutTitle",
                  "story",
                  "ownerIntroduction",
                  "philosophy",
                ] as const
              ).map((field) => (
                <div
                  key={field}
                  className="grid gap-3 border-b border-[#d9cfc1] pb-4"
                >
                  <h3 className="font-semibold">
                    {
                      {
                        heroTitle: "Huvudrubrik",
                        heroDescription: "Inledning",
                        aboutTitle: "Om oss-rubrik",
                        story: "Restaurangens berättelse",
                        ownerIntroduction: "Presentation av ägaren",
                        philosophy: "Gästfrihet",
                      }[field]
                    }
                  </h3>
                  {(["sv", "en"] as const).map((language) => (
                    <label key={language} className="text-sm">
                      {language.toUpperCase()}
                      <textarea
                        className={`${input} min-h-20 py-3`}
                        value={site.text[field][language]}
                        onChange={(event) =>
                          edit((next) => {
                            next.text[field][language] = event.target.value;
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              ))}
              <label className="text-sm">
                Grundat år (om bekräftat)
                <input
                  className={input}
                  type="number"
                  min="1800"
                  max="2100"
                  value={site.text.foundedYear ?? ""}
                  onChange={(event) =>
                    edit((next) => {
                      next.text.foundedYear = event.target.value
                        ? Number(event.target.value)
                        : null;
                    })
                  }
                />
              </label>
            </section>
          )}
          {section === "hours" && (
            <section>
              <h2 className="font-serif text-2xl">Öppettider</h2>
              <p className="mt-2 text-sm">
                Kontrollera tiderna innan du publicerar dem.
              </p>
              <div className="mt-4 divide-y divide-[#d9cfc1]">
                {site.hours.map((hour) => (
                  <div
                    key={hour.day}
                    className="grid gap-3 py-4 sm:grid-cols-[120px_1fr_1fr_100px] sm:items-center"
                  >
                    <strong>{days[hour.day]}</strong>
                    <label className="text-sm">
                      Öppnar
                      <input
                        className={input}
                        type="time"
                        disabled={hour.closed}
                        value={hour.open}
                        onChange={(event) =>
                          edit((next) => {
                            next.hours[hour.day].open = event.target.value;
                          })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Stänger
                      <input
                        className={input}
                        type="time"
                        disabled={hour.closed}
                        value={hour.close}
                        onChange={(event) =>
                          edit((next) => {
                            next.hours[hour.day].close = event.target.value;
                          })
                        }
                      />
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={hour.closed}
                        onChange={(event) =>
                          edit((next) => {
                            next.hours[hour.day].closed = event.target.checked;
                          })
                        }
                      />{" "}
                      Stängt
                    </label>
                  </div>
                ))}
              </div>
            </section>
          )}
          {section === "links" && (
            <section className="grid gap-5">
              <h2 className="font-serif text-2xl">Bokning och beställning</h2>
              <p className="text-sm">
                Bokningslänken ska öppna själva bokningsflödet, inte en
                kart-sökning. Lämna tom tills den är bekräftad.
              </p>
              {(["booking", "order"] as const).map((field) => (
                <label key={field} className="text-sm font-semibold">
                  {field === "booking"
                    ? "Direkt bokningsadress"
                    : "Beställningsadress"}
                  <input
                    className={input}
                    type="url"
                    inputMode="url"
                    value={site.links[field]}
                    onChange={(event) =>
                      edit((next) => {
                        next.links[field] = event.target.value;
                      })
                    }
                    placeholder="https://"
                  />
                </label>
              ))}
            </section>
          )}
        </div>
      </div>
      <div
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[#d9cfc1] bg-[#f8f3ea] p-3 shadow-lg sm:sticky sm:bottom-0 sm:mt-8 sm:rounded-lg"
      >
        <span className="hidden text-sm sm:block">{status}</span>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={save}
          className="min-h-12 flex-1 rounded-lg bg-[#572e28] px-5 font-bold text-white disabled:opacity-50 sm:flex-none"
        >
          {busy ? "Sparar…" : "Spara utkast"}
        </button>
        <button
          type="button"
          disabled={dirty || busy || revision === 0}
          onClick={() => router.push("/dashboard/restaurang/forhandsgranska")}
          className={`${button} flex-1 disabled:opacity-50 sm:flex-none`}
        >
          Förhandsgranska →
        </button>
      </div>
    </main>
  );
}
