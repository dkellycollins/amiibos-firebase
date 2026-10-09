# Fix problems found in the `syncAmiibosFromNintendo` dry run

## Background

A dry run of `syncAmiibosFromNintendo`, compared against the live `amiibos` collection
(194 legacy documents, none with a `source` yet), maps 255 of the 264 entries on the Nintendo
line-up page: 187 update an existing document by slug and 68 create a new one.

The updates are mostly safe: apart from the description (see change 3), every field change is
either a format change (ISO release date, `"Link (Majora's Mask)"` naming), a missing value being filled in, or the
untyped `wolf-amiibo-super-smash-bros-series` document gaining `type: figure`. No update blanks
out an existing value.

Two problems are in the creates.

### 1. Two card packs are imported as figures

`getSkipReason` recognises card packs by the words "card"/"cards" or "welcome amiibo". Two packs
use neither:

| Nintendo slug | Name |
|---|---|
| `mario-sports-superstars-amiibo-series` | Mario Sports Superstars |
| `animal-crossing-sanrio-collaboration-pack-amiibo-animal-crossing-series` | Animal Crossing Sanrio Collaboration Pack |

Nothing in the page data (series, `presentedBy`, assets) marks them as cards, so there is no
general rule to catch them. A broader keyword such as "pack" would also catch figure multi-packs
(e.g. the Samus & E.M.M.I. 2-pack).

### 2. Shovel Knight (Gold Edition) would be duplicated

The live collection has `shovel-knight-amiibo-gold-edition-shovel-knight-series` (a legacy
document with no `type`). Nintendo now uses the slug
`shovel-knight-gold-edition-amiibo-shovel-knight-series` for the same figure, so the sync creates
a second document instead of updating the existing one.

I checked the other creates whose name matches a live document (Young Link, two Samus figures,
Mega Man). They are different figures, so Shovel Knight is the only slug mismatch.

## Changes

### 0. Back up the collection before the first live run

Nothing currently protects the collection: point-in-time recovery is disabled (1 hour version
retention) and there are no backup schedules. The collection is small (194 documents, every field
a string or null), so a JSON snapshot in the repo is enough, and it can be diffed in git.

Two local scripts in `functions/src/scripts/`. They reuse `getFirebaseApp` and the collection
name from `amiiboSync/amiibosCollection.ts`, which gets a `COLLECTION_NAME` export for this. They
are not exported from `index.ts`, so they are never deployed as functions.

- **`backupAmiibos.ts`**: reads every document in `amiibos` and writes
  `backups/amiibos-<yyyy-mm-dd>.json` at the repo root, shaped as
  `{ "exportedAt": "...", "documents": { "<doc id>": { ...fields } } }`, with documents sorted by
  id so diffs between backups are readable. It refuses to overwrite an existing file.
- **`restoreAmiibos.ts <backup file>`**: makes the collection match the backup exactly:
  1. Every document in the backup is written with a plain `set` (no merge), which drops fields
     the sync added such as `source`.
  2. Every document in the collection whose id is not in the backup (the ones the sync created)
     is deleted.

  By default it only prints what it would write and delete. It needs `--apply` to change
  anything. Writes are batched at 500, the same as `saveAmiibos`.

Run them from `functions/` after `npm run build`:

```bash
node lib/scripts/backupAmiibos.js
node lib/scripts/restoreAmiibos.js ../backups/amiibos-2026-10-08.json
```

**Credentials:** the scripts use the Admin SDK with Application Default Credentials. This machine
has none (and no `gcloud`), so before the first run you need to either
- download a service account key from Firebase console → Project settings → Service accounts
  and set `GOOGLE_APPLICATION_CREDENTIALS` to its path (keep the key outside the repo), or
- install `gcloud` and run `gcloud auth application-default login`.

Storage images need no backup: `storeFigureImage` only uploads when nothing exists at
`amiibos/<slug>/figure`, so existing images are never overwritten.

Order for the first live run: build → backup → commit the backup file → dry run → live run →
compare the collection against the backup.

### Nintendo sync fixes

All in `functions/src/syncAmiibosFromNintendo/nintendoLineup.ts`.

1. **Known card packs.** Add a `CARD_PACK_SLUGS` set containing the two slugs above. In
   `getSkipReason`, treat an entry as a card pack when its slug is in that set, in addition to
   the existing keyword check. It uses the same skip reason
   (`card pack (cards are imported from AmiiboAPI)`).

2. **Slug aliases for legacy documents.** Add a `LEGACY_SLUGS` map from a Nintendo slug to the
   slug of the existing document for that figure:

   ```ts
   const LEGACY_SLUGS: Record<string, string> = {
     'shovel-knight-gold-edition-amiibo-shovel-knight-series': 'shovel-knight-amiibo-gold-edition-shovel-knight-series',
   };
   ```

   `toAmiibo` uses the legacy slug when there is one, so the sync updates the existing document
   (and fills in its missing `type`), and the image path `amiibos/<slug>/figure` stays the same.
   Duplicate detection in `mapNintendoAmiibos` keeps using the Nintendo slug.

   I chose this over deleting the legacy document by hand because it keeps the document id
   stable for anything that links to it, and it keeps working if the collection is rebuilt.

3. **Keep descriptions as HTML.** The live documents store descriptions as HTML (`<p>`, `<b>`,
   `<i>`, `<a>`), but `toPlainText` flattens Nintendo's description to plain text, so all 187
   updates would strip the formatting and links.

   Nintendo provides the description as Contentful rich-text JSON rather than HTML. Across the
   whole line-up page it only uses `document`, `paragraph`, `text` (with `bold` and `italic`
   marks) and `hyperlink` nodes, so a small renderer covers it without adding a dependency:

   - `paragraph` → `<p>…</p>`, joined with `\n`; empty paragraphs are dropped.
   - `text` → HTML-escaped value (`&`, `<`, `>`, `"`), wrapped in `<b>` / `<i>` for its marks.
   - `hyperlink` → `<a href="…">…</a>`. 13 links are site-relative (`/store/products/…`), so
     they are resolved against `https://www.nintendo.com`, which redirects to the `/us/` store
     page.
   - Any other node type renders its children, so unexpected content still keeps its text.

   `toPlainText` and `collectText` are replaced by `toHtml` and its helpers, and
   `RichTextNode` gains the `marks` and `data.uri` fields it needs.

## Out of scope

- `syncAmiibosFromAmiiboApi` (you asked to ignore it).
- The 7 live documents the Nintendo page doesn't list (e.g. `test-k-k-slider`,
  `delicious-amiibo`). The sync never deletes, so they stay as they are, and cleaning them up is a
  separate data decision.

## Verification

Re-run the local dry-run comparison against the live collection snapshot. Expected result:
253 mapped (2 more skipped), 188 updates (Shovel Knight now updates its legacy document), and
65 creates. Spot-check a few rendered descriptions (one with a link, one with bold/italic text)
against the Nintendo page. `npm run build` and `npm run lint` pass.

For the backup scripts: run the backup and check that it has all 194 documents and matches the
snapshot taken for the dry-run comparison. Then run the restore without `--apply` against the
unchanged collection, which should report 194 writes and 0 deletes.
