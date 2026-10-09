# amiibos-firebase

Firebase backend for the amiibos project (Firebase project `amiibos-firebase`). It holds the
`amiibos` Firestore collection, the figure images in Cloud Storage, and the Cloud Functions that
serve and update them.

## Functions

All functions are 1st-gen HTTP functions in `us-central1`. Their URLs follow the pattern
`https://us-central1-amiibos-firebase.cloudfunctions.net/<function name>`.

| Function                   | Access  | What it does                                                        |
|----------------------------|---------|---------------------------------------------------------------------|
| `api`                      | Public  | REST API (NestJS). Swagger UI at the root, the spec at `/swagger.json`. |
| `graphql`                  | Public  | GraphQL API over the `amiibos` collection.                          |
| `syncAmiibosFromNintendo`  | Private | Imports figures from the Nintendo amiibo line-up page.              |
| `syncAmiibosFromAmiiboApi` | Private | Imports cards and figures from AmiiboAPI, skipping figures that the Nintendo sync already imported. |

## Setup

Requires Node 20 and the Firebase CLI (`npm install -g firebase-tools`).

```bash
cd functions
npm install
npm run build
```

`npm run lint` runs tslint. Deploying runs lint and build automatically.

## Deploying

From `functions/`:

```bash
npm run deploy
```

To deploy a single function:

```bash
firebase deploy --only functions:syncAmiibosFromNintendo
```

## Running the sync functions

The sync functions are private: only project members can call them, and every request must carry
a Google identity token. There is no "run" button in the Firebase console.

### Order

Always run `syncAmiibosFromNintendo` first, then `syncAmiibosFromAmiiboApi`. The AmiiboAPI sync
skips figures that the Nintendo sync has already imported, so running them the other way round
creates duplicate figures.

### Dry runs

Add `?dryRun=true` to the URL to fetch and map the source data without writing anything to
Firestore or Storage. The response shows what would be saved and which source items were skipped
and why. Do a dry run before every live run.

### From Cloud Shell (no local setup)

1. Open the [Google Cloud console](https://console.cloud.google.com) and select the
   `amiibos-firebase` project.
2. Click the Cloud Shell icon (`>_`) at the top right. Cloud Shell is already signed in as you.
3. Run a dry run:

   ```bash
   curl -X POST -H "Authorization: bearer $(gcloud auth print-identity-token)" "https://us-central1-amiibos-firebase.cloudfunctions.net/syncAmiibosFromNintendo?dryRun=true"
   ```

4. Check the response, then run it for real by removing `?dryRun=true`:

   ```bash
   curl -X POST -H "Authorization: bearer $(gcloud auth print-identity-token)" "https://us-central1-amiibos-firebase.cloudfunctions.net/syncAmiibosFromNintendo"
   ```

5. Repeat for `syncAmiibosFromAmiiboApi`.

A sync can take several minutes (the timeout is 9 minutes). If `curl` gives up before the
function finishes, the function keeps running. Check the result in the logs.

### From your own machine

The same `curl` commands work locally once the [gcloud CLI](https://cloud.google.com/sdk/docs/install)
is installed and you have run `gcloud auth login`.

### Avoid the console's Testing tab

The Cloud console's Testing tab for a function can only send a request body. It cannot add the
`dryRun` query parameter, so every call from there is a **live run**.

### Response

A successful run returns JSON such as:

```json
{
  "dryRun": true,
  "amiibos": 255,
  "saved": 0,
  "images": null,
  "skipped": [ ... ]
}
```

- `amiibos`: how many amiibos were mapped from the source.
- `saved`: how many were written. Always `0` in a dry run. Amiibos whose image could not be
  stored are not saved.
- `images`: a summary of the image copies, or `null` in a dry run.
- The remaining fields are specific to each source, such as the skipped items.

A failed run returns status 500 with an `error` message.

### Logs

```bash
firebase functions:log --only syncAmiibosFromNintendo
```

The logs are also on the Functions page in the Firebase console.

## Backing up and restoring the amiibos collection

Back up the collection before any live sync that may change existing documents. Storage images
need no backup, because the syncs never overwrite an existing image.

The scripts use the Admin SDK with Application Default Credentials. Set them up once in one of
these ways:

- Install the gcloud CLI and run `gcloud auth application-default login`.
- Download a service account key from Firebase console → Project settings → Service accounts, and
  set `GOOGLE_APPLICATION_CREDENTIALS` to its path. Keep the key outside the repo.

Run the scripts from `functions/` after `npm run build`.

**Back up** to `backups/amiibos-<yyyy-mm-dd>.json` and commit the file:

```bash
node lib/scripts/backupAmiibos.js
```

**Restore** from a backup. Without `--apply` it only prints what it would write and delete:

```bash
node lib/scripts/restoreAmiibos.js ../backups/amiibos-2026-10-09.json
```

```bash
node lib/scripts/restoreAmiibos.js ../backups/amiibos-2026-10-09.json --apply
```

A restore makes the collection match the backup exactly. It replaces every backed-up document and
deletes any document that is not in the backup.

## Recommended order for a live sync

1. `npm run build`
2. Back up the collection and commit the backup file.
3. Dry run `syncAmiibosFromNintendo` and check the response.
4. Run `syncAmiibosFromNintendo`.
5. Dry run, then run `syncAmiibosFromAmiiboApi`.
6. Compare the collection against the backup. If something went wrong, restore it.
