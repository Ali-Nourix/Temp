# Brief — building a catalog variant

Every catalog in this repository is one page showing the *same kind of
product catalog* in a different design language. They share a design
system and a set of interaction mechanisms; what changes is layout,
density, colour and motion.

## Where your file goes

Write **one** file: `src/<NN>-<name>.html`. Do not touch anything else.

It links the shared assets the ordinary way — the build inlines them so
the delivered page is self-contained:

```html
<link rel="stylesheet" href="../shared/ds-core.css">
...
<script src="../shared/catalog-kit.js"></script>
```

Use exactly those two paths. Anything else under `shared/` fails the build.
Build and check your own page with:

```bash
python3 build.py <NN>-<name>.html
```

## Non-negotiables

1. **RTL Persian first.** `<html dir="rtl" lang="fa">`. Persian copy is
   real Persian, not transliteration. Latin is for SKUs, sizes, codes and
   the brand name only.
2. **Bilingual toggle.** A control switches every string between Persian
   and English, flipping `dir` on the root. Keep a single string table;
   don't duplicate the DOM.
3. **Theme.** Set `data-theme` on the root to the theme named in your
   assignment. Never hard-code a colour: every value comes from the design
   system's custom properties (`--ink`, `--surface`, `--accent`, `--line`,
   `--s-4`, `--t-md`, `--dur-base`, `--ease-out`, …). A raw hex in your CSS
   is a bug. The one exception is decorative art you generate yourself.
4. **The three media mechanisms, on every product.** Detail-on-click,
   video playback, and 360 spin. See the API below — do not reimplement
   them.
5. **Real placeholders.** No lorem ipsum, no stock photos, no invented
   social proof ("+۱۰٬۰۰۰ مشتری"). Product copy is short, concrete and
   plausible: a name, one line, three specs.
6. **No emoji anywhere.** Icons are inline SVG from one consistent set, and
   only when they do a job.
7. **Keyboard and touch.** Every control is reachable by keyboard and has
   a visible focus ring. Tap targets are at least `--tap-min` (44px).
8. **`prefers-reduced-motion`.** The design system already collapses its
   duration tokens. If you write a custom animation, honour it too.
9. **Print.** `@media print` is already handled for the shared components;
   don't break it with fixed positioning that leaks into print.

## CatalogKit API

`shared/catalog-kit.js` exposes `window.CatalogKit`. It handles the
artwork, the detail viewer, the video transport and the spin.

```js
// Procedural artwork as a data URI. Deterministic per seed.
CatalogKit.image(seed, {
  w: 1000, h: 1250,
  subject: 'vase',     // bottle chair lamp vase bag watch shoe textile
  palette: 'warm',     // warm stone ink sage clay indigo amber rose
  t: 0,                // 0..1 — animates the light and framing
  spin: 0              // degrees — rotates the subject
});                     // -> 'data:image/svg+xml;...'

CatalogKit.subjects   // array of subject names
CatalogKit.palettes   // array of palette names
CatalogKit.toFa('12') // '۱۲'  — Persian digits
```

A **media descriptor** describes one piece of media:

```js
{ type: 'photo' | 'video' | 'spin',
  seed: 'SKU-1-a',
  subject: 'vase', palette: 'warm',
  src: undefined,      // a real image or video URL — wins when present
  poster: undefined,   // poster for a video
  duration: 12,        // seconds, synthetic clips only
  hotspots: [ { x: 50, y: 38, title: 'بدنه', body: 'سرامیک لعاب‌دار.' } ] }
```

`x` / `y` are percentages of the artwork, not of the screen.

```js
// Four descriptors — photo with hotspots, clip, spin, second photo.
const media = CatalogKit.defaultMedia('SK-101', hotspots, { subject, palette });

// Turn an element into a product's media: poster, a badge naming what it
// is, a muted hover preview for video, and click/Enter to open the viewer.
CatalogKit.mountMedia(element, media, { title, sku }, lang);

// Open the viewer directly — for a "details" button.
CatalogKit.open(media, { title, sku }, lang, index);
```

The viewer gives you, for free: zoom to the clicked point, drag to pan,
wheel and pinch zoom, hotspots pinned to the artwork, a thumbnail strip,
play/pause/scrub/mute with a live clock, drag-to-rotate, Escape to close,
arrow keys, and a focus trap. `lang` is `'fa'` or `'en'` — pass the current
language so its labels match the page.

**Call `CatalogKit.mountMedia` on an element that is already in the
document**, and re-mount after a language switch so the viewer's own
labels follow.

## Design system quick reference

Layout `.cat-page .cat-grid .cat-spread` · cards `.cat-card
.cat-card__media .cat-card__name .cat-card__name-en .cat-card__meta
.cat-card__actions` · cover `.cat-cover .cat-cover__kicker
.cat-cover__title` · price `.cat-price .cat-price__unit .cat-sku` ·
controls `.cat-btn .cat-btn--ghost .cat-btn--quiet .cat-btn--icon .cat-chip
.cat-search .cat-toolbar .cat-lang` · detail `.cat-gallery .cat-thumb
.cat-swatches .cat-swatch .cat-sizes .cat-size .cat-specs` · overlay
`.cat-scrim .cat-dialog` · state `.cat-badge .cat-tag .cat-skeleton
.cat-stagger` · type `.num` for any Latin numeral.

Use them where they fit and write variant-specific CSS where they don't —
but build that CSS out of the same tokens. Prefix your own classes so they
cannot collide with `cat-` or `ck-`.

Motion tokens: `--dur-instant|fast|base|slow|page`, `--ease-out|in|inout|soft`,
`--stagger` (cap staggered entrances at 8 items).

## What "good" looks like

The page should look like a real brand made it, not like a component
gallery. That means a point of view: a cover or masthead that sets the
tone, a considered type hierarchy, deliberate whitespace, and a catalog
flow someone could actually browse — find a product, look closely at it,
and add it to a price inquiry. Aim for roughly 12 products.

Write the HTML and CSS the way a careful front-end engineer would: no dead
rules, no commented-out experiments, no comments restating what the code
says, and no narration of the prompt. Comment only where a reader would
otherwise wonder *why*.
