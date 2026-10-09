import * as functions from 'firebase-functions/v1';
import { Amiibo } from './Amiibo';
import { saveAmiibos } from './amiibosCollection';
import { ImageCopySummary, storeFigureImages } from './images';

export interface SyncOptions {
  /**
   * When true the sync fetches and maps data but does not write to Storage or Firestore.
   */
  dryRun: boolean;
}

/**
 * Result returned from a sync. The amiibos are persisted by `createSyncFunction`.
 */
export interface SyncResult {
  amiibos: Array<Amiibo>;
  /**
   * Source specific details (counts, skipped items, ...) to include in the response.
   */
  details: Record<string, unknown>;
}

export type SyncOperation = (options: SyncOptions) => Promise<SyncResult>;

/**
 * Wraps a sync operation in a private HTTP function. Only authenticated project members can
 * call it, e.g.:
 *
 *   curl -X POST -H "Authorization: bearer $(gcloud auth print-identity-token)" <function-url>
 *
 * Append `?dryRun=true` to see what would be written without writing anything.
 */
export function createSyncFunction(name: string, operation: SyncOperation): functions.HttpsFunction {
  return functions
    .runWith({
      invoker: 'private',
      timeoutSeconds: 540,
      memory: '1GB',
    })
    .https.onRequest(async (request, response) => {
      const dryRun = request.query.dryRun === 'true';

      try {
        console.log(`${name}: starting. Dry run: ${dryRun}.`);
        const result = await operation({ dryRun });
        const images = await persist(result.amiibos, dryRun);

        response.status(200).json({
          dryRun,
          amiibos: result.amiibos.length,
          saved: getSavedCount(result.amiibos, images),
          images,
          ...result.details,
        });
      }
      catch (error) {
        console.error(`${name}: failed.`, error);
        response.status(500).json({
          error: toErrorMessage(error),
        });
      }
    });
}

async function persist(amiibos: Array<Amiibo>, dryRun: boolean): Promise<ImageCopySummary | null> {
  if (dryRun) {
    return null;
  }

  const stored = await storeFigureImages(amiibos);
  await saveAmiibos(stored.amiibos);

  return stored.summary;
}

/**
 * Amiibos whose image could not be stored are not saved.
 */
function getSavedCount(amiibos: Array<Amiibo>, images: ImageCopySummary | null): number {
  if (!images) {
    return 0;
  }

  return amiibos.length - images.failed.length;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
