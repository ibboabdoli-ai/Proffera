import chunk0 from "@/lib/donis-generated-menu-sprite/chunk-0";
import chunk1 from "@/lib/donis-generated-menu-sprite/chunk-1";
import chunk2 from "@/lib/donis-generated-menu-sprite/chunk-2";
import chunk3 from "@/lib/donis-generated-menu-sprite/chunk-3";
import chunk4 from "@/lib/donis-generated-menu-sprite/chunk-4";
import chunk5 from "@/lib/donis-generated-menu-sprite/chunk-5";
import chunk6 from "@/lib/donis-generated-menu-sprite/chunk-6";
import chunk7 from "@/lib/donis-generated-menu-sprite/chunk-7";
import chunk8 from "@/lib/donis-generated-menu-sprite/chunk-8";

export const DONIS_GENERATED_MENU_SPRITE =
  "data:image/webp;base64," +
  chunk0 +
  chunk1 +
  chunk2 +
  chunk3 +
  chunk4 +
  chunk5 +
  chunk6 +
  chunk7 +
  chunk8;

export const DONIS_GENERATED_MENU_IMAGE_IDS = {
  olives: "aa000001-0000-4000-8000-000000000001",
  garlicBread: "aa000002-0000-4000-8000-000000000002",
  cheeseFries: "aa000003-0000-4000-8000-000000000003",
  salsiccia: "aa000004-0000-4000-8000-000000000004",
  aubergine: "aa000005-0000-4000-8000-000000000005",
  bruschettaParma: "aa000006-0000-4000-8000-000000000006",
  burrata: "aa000007-0000-4000-8000-000000000007",
  gamberi: "aa000008-0000-4000-8000-000000000008",
  antipastiMisti: "aa000009-0000-4000-8000-000000000009",
  entrecote: "aa000010-0000-4000-8000-000000000010",
  chickenSalad: "aa000011-0000-4000-8000-000000000011",
  sauces: "aa000012-0000-4000-8000-000000000012",
  softDrinks: "aa000013-0000-4000-8000-000000000013",
  cocktails: "aa000014-0000-4000-8000-000000000014",
  coffeeDrinks: "aa000015-0000-4000-8000-000000000015",
  mocktails: "aa000016-0000-4000-8000-000000000016",
} as const;

export const DONIS_GENERATED_MENU_TILE_BY_IMAGE_ID: Record<
  string,
  { column: number; row: number }
> = {
  [DONIS_GENERATED_MENU_IMAGE_IDS.olives]: { column: 0, row: 0 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.garlicBread]: { column: 1, row: 0 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.cheeseFries]: { column: 2, row: 0 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.salsiccia]: { column: 3, row: 0 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.aubergine]: { column: 0, row: 1 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.bruschettaParma]: { column: 1, row: 1 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.burrata]: { column: 2, row: 1 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.gamberi]: { column: 3, row: 1 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.antipastiMisti]: { column: 0, row: 2 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.entrecote]: { column: 1, row: 2 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.chickenSalad]: { column: 2, row: 2 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.sauces]: { column: 3, row: 2 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.softDrinks]: { column: 0, row: 3 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.cocktails]: { column: 1, row: 3 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.coffeeDrinks]: { column: 2, row: 3 },
  [DONIS_GENERATED_MENU_IMAGE_IDS.mocktails]: { column: 3, row: 3 },
};
