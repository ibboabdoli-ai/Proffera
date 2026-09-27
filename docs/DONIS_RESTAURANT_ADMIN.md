# Doni’s Trattoria owner editing

The public `/demo/donis-trattoria` route reads only the published snapshot for the fixed `donis-trattoria` slug. The authenticated `/dashboard/restaurang` route is visible only to a manager of the Workspace provisioned for that slug. Server actions and the image upload route repeat the Workspace and role checks. A dashboard user cannot claim the slug.

## Activation sequence

1. Apply `db/migrations/20260927_0068_restaurant_sites.sql` to an isolated Preview database and validate its table and constraints. Production migration requires its separate release approval.
2. Verify the restaurant owner’s actual Proffera Workspace ID and active membership. An authorized operator provisions exactly one row: `insert into restaurant_sites (workspace_id, public_slug) values (<verified UUID>, 'donis-trattoria');`. Do not use a guessed ID or a customer-facing claim form.
3. The owner signs in, chooses that Workspace, enters the real menu, photos, bilingual text, opening hours and confirmed links, then uses **Spara utkast → Förhandsgranska → Publicera**. The initial draft is empty; no sample dishes, prices, history or booking URL are seeded.
4. Verify the exact public URL in Swedish and English, desktop and narrow mobile, including price edit, photo capture/upload, hide/re-publish, category order, hours, booking and order destinations. The final customer domain and direct Google booking URL must be supplied and checked separately.

Media uploads reuse `website_gallery_items` and the existing Vercel Blob path. Photo references are accepted only when the item belongs to the selected Workspace and is an image. Removing a photo from the site unlinks it from the site snapshot; the gallery library keeps it for reuse. Site edits use an optimistic draft revision; a stale save fails instead of overwriting another editor. Publishing copies the validated draft atomically, leaving the prior public snapshot intact until that step. Visible dishes must have a price.

## Rollback

Before a customer publishes, reverting the application code restores the prior page. After publication, preserve/export the `restaurant_sites` row before any rollback; a code rollback will not delete customer content. The additive migration can remain in place harmlessly. Do not drop it or delete the Workspace row as a routine rollback. To revert a mistaken publication, restore the previous saved snapshot through an authorized, audited data repair; draft changes alone do not alter the public version.
