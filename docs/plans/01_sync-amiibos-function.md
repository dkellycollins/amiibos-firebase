# 01 — Replace `loadAmiibosOnFinalize` with a `syncAmiibos` function

## Problem

`loadAmiibosOnFinalize` runs when someone uploads `lineup.model.json` to Storage. That file
was a JSON export from nintendo.com/us/amiibo/line-up, and Nintendo no longer publishes it.
The function also only imports `Figure` and `Plush` items, so it never writes amiibo
**cards**, even though the `amiibos` collection is now meant to hold them.

## What the data sources look like (checked 2026-10-08)

### 1. Nintendo line-up page: `https://www.nintendo.com/us/amiibo/line-up/`

- It is a Next.js page. The full list is embedded as JSON in
  `<script id="__NEXT_DATA__">` at `props.pageProps.page.amiibos`. This is 264 entries,
  and no separate request is needed.
- Fields on each entry: `id`, `name`, `slug`, `series`, `releaseDate` (ISO),
  `releaseDateDisplay` (for example `"2027"` for TBA items), `presentedBy`, `url`,
  `description` (Contentful rich-text JSON), `figureAsset.publicId` and
  `boxartAsset.publicId` (Cloudinary IDs), and `product.sku`.
- Image URL: `https://assets.nintendo.com/image/upload/<publicId>`.
- **There is no `type` field.** Plush and yarn items are mixed in with figures.
- **There are no individual cards.** The page only lists card *packs*, such as
  "Animal Crossing Cards - Series 5" and "STREET FIGHTER 6 amiibo Card Starter Set".
- Some slugs appear more than once. We need to de-duplicate them.
- The page has gaps. Some figures that the community API has are missing here, for example
  "Mario - Wedding" and "Inkling Girl - Neon Pink".

### 2. AmiiboAPI: `https://www.amiiboapi.org/api/amiibo/`

This is the maintained community API (8bitDream fork). The old `amiiboapi.com` returns 404.

- 950 entries: 674 `Card`, 258 `Figure`, 9 `Band`, 5 `Yarn` and 4 `Block`.
- Fields: `name`, `character`, `amiiboSeries`, `gameSeries`, `type`, `head` and `tail`
  (together these make the unique NFC ID), `image` (GitHub raw PNG), and
  `release.{na,eu,jp,au}`.
- **There are no descriptions.** Card names are not unique. For example, there are several
  "Isabelle" cards in the Animal Crossing series, with 40 colliding name/series pairs.
- 14 cards have no `na` release date.

### Conclusion

Neither source covers everything on its own. Nintendo has descriptions and official art,
but no individual cards. AmiiboAPI has every card, but no descriptions. The plan uses both,
as two separate functions.

| Item type             | Source    | Notes                                                                    |
|-----------------------|-----------|--------------------------------------------------------------------------|
| Figures, plush, yarn  | Nintendo  | Same source and slug style as before; keeps descriptions                 |
| Cards                 | AmiiboAPI | `type: 'card'`; description is an empty string unless we decide otherwise |
| Card packs on Nintendo | skipped  | Filtered out by name (`/\bcards?\b/i`), so the individual cards replace them |

## Decisions (confirmed 2026-10-08)

- A card document has the same shape as an amiibo document, with `type: 'card'`.
- Accept Nintendo's new slugs. Old documents are left alone, and there is no migration.
- Import figures from AmiiboAPI as well as cards.
- Use two separate functions, each triggered by hand.
- Upgrade to Node 20 as part of this change.

## Changes

### Shared code: `functions/src/amiiboSync/`

```
amiiboSync/
  Amiibo.ts            // Firestore document shape: type, slug, name, description, series,
                       // figureUrl, releaseDate, source
  firebaseApp.ts       // getApp(): reuses an existing admin app or initialises one
  text.ts              // toSlug(), cleanName(), toMatchKey() helpers
  images.ts            // copy source images into the bucket (limited concurrency)
  amiibosCollection.ts // read existing docs, batched set({ merge: true })
  syncRunner.ts        // wraps a sync as a private onRequest function and returns a JSON summary
```

### Function 1: `syncAmiibosFromNintendo`

Source: the `__NEXT_DATA__` JSON on the Nintendo line-up page.

| Field         | Mapping                                                                          |
|---------------|----------------------------------------------------------------------------------|
| `type`        | `'figure'`                                                                       |
| `slug`        | Nintendo `slug`, de-duplicated                                                   |
| `name`        | `name` with ™/® and HTML entities removed                                        |
| `description` | rich-text paragraphs flattened to plain text, separated by blank lines           |
| `series`      | `series`, or `''` when it is null                                                |
| `releaseDate` | `releaseDateDisplay` when present (a year-only TBA), otherwise `YYYY-MM-DD`      |
| `figureUrl`   | `https://assets.nintendo.com/image/upload/<figureAsset.publicId>`, copied to bucket |
| `source`      | `'nintendo-lineup'`                                                              |

The function skips card packs (`card` in the name or slug, or "Welcome amiibo series") and
Power-Up Bands, because AmiiboAPI provides the individual cards.

### Function 2: `syncAmiibosFromAmiiboApi`

Source: `https://www.amiiboapi.org/api/amiibo/`

| AmiiboAPI `type` | Result                      |
|------------------|-----------------------------|
| `Card`           | imported as `type: 'card'`  |
| `Figure`, `Yarn` | imported as `type: 'figure'`, unless the figure already exists (see below) |
| `Band`, `Block`  | skipped (logged)            |

- `slug`: `<name>-<amiiboSeries>-<card|figure>-<head><tail>`, slugified. The NFC ID suffix
  keeps it unique, because card names repeat.
- `description`: `''`. `series`: `amiiboSeries`. `releaseDate`: `release.na`, falling back
  to `eu`, then `jp`, then `au`, then `''`.
- `figureUrl`: `image`, copied to the bucket. `source`: `'amiibo-api'`.
- **Avoiding duplicate figures:** before it writes, the function reads the existing figure
  docs whose `source` is not `'amiibo-api'` (so Nintendo docs and legacy docs). It skips an
  AmiiboAPI figure when a doc has the same normalised name, and either the series match
  (equal, or one contains the other) or the name is unique among those docs. Checked against
  today's data, this matches 219 of 263 figures. Most of the other 44 really are missing from
  Nintendo (wedding Mario, Skylanders, neon Inklings). A few might be duplicates, so every
  imported figure is logged for review.
- This means **the Nintendo function should be run first**.

### Triggering

Both functions are `https.onRequest` with `invoker: 'private'`, a 540s timeout and 1GiB of
memory, so only an authenticated project member can call them:

```
curl -X POST -H "Authorization: bearer $(gcloud auth print-identity-token)" <function-url>
```

Add `?dryRun=true` to fetch and map the data and return the summary, without writing to
Firestore or Storage.

### Writes

- `set(doc, { merge: true })` in batches of up to 500. Nothing is ever deleted.
- Images are stored at `amiibos/<slug>/figure` (public), the same as before. Existing files
  are not downloaded again. `figureUrl` always points at Firebase Storage, never at the
  source. If an image fails to copy, that amiibo is not written, and the next run tries it
  again.

### Remove `loadAmiibosOnFinalize`

Delete `functions/src/loadAmiibosOnFinalize/` and its tracked `lib/*.d.ts` output, and update
`functions/src/index.ts`.

### GraphQL: expose `type`

Add `type` to `AmiiboModel`, `AmiiboObject` and the `AmiibosService` mapping. Add an
optional `type` filter to the `amiibos` query.

### Runtime upgrade

- Set `engines.node` to `20`. Upgrade to `firebase-functions@^6` (imported from
  `firebase-functions/v1`, which keeps the existing API style), `firebase-admin@^13`,
  `typescript@~4.9` (TypeScript 5 rejects the NestJS 7 constructor-parameter decorators),
  `tslint@^6` and `@types/node@^20`. Turn on `skipLibCheck`, because the old NestJS/Apollo
  typings no longer type-check.
- Use Node's built-in `fetch` instead of the `http`/`https` modules.
- The NestJS packages stay on their current versions, unless the build forces an upgrade.

## Verification

- `npm run lint` and `npm run build` pass.
- Run both mappers against the live sources locally with a dry run, then check the counts
  by type and the skip reasons.
- After deploying, run `syncAmiibosFromNintendo` first, then `syncAmiibosFromAmiiboApi`.
