import { getStorage } from 'firebase-admin/storage';
import { Amiibo } from './Amiibo';
import { getFirebaseApp } from './firebaseApp';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

/**
 * How many images are downloaded at the same time.
 */
const IMAGE_CONCURRENCY = 8;

export interface ImageCopySummary {
  copied: number;
  alreadyStored: number;
  failed: Array<string>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Copies each amiibo's figure image into the default storage bucket (if it is not already there)
 * and returns the amiibos with `figureUrl` pointing at the stored copy.
 *
 * When an image cannot be copied the amiibo keeps its original source url.
 */
export async function storeFigureImages(amiibos: Array<Amiibo>): Promise<{
  amiibos: Array<Amiibo>;
  summary: ImageCopySummary;
}> {
  const bucket = getStorage(getFirebaseApp()).bucket();
  const summary: ImageCopySummary = {
    copied: 0,
    alreadyStored: 0,
    failed: [],
  };
  const updatedAmiibos: Array<Amiibo> = [];

  for (let start = 0; start < amiibos.length; start += IMAGE_CONCURRENCY) {
    const chunk = amiibos.slice(start, start + IMAGE_CONCURRENCY);
    const updatedChunk = await Promise.all(chunk.map(async amiibo => {
      return await storeFigureImage(bucket, amiibo, summary);
    }));
    updatedAmiibos.push(...updatedChunk);
  }

  console.log(`Images: ${summary.copied} copied, ${summary.alreadyStored} already stored, ${summary.failed.length} failed.`);
  if (summary.failed.length > 0) {
    console.warn(`Failed to copy images for: ${summary.failed.join(', ')}`);
  }

  return {
    amiibos: updatedAmiibos,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function storeFigureImage(bucket: Bucket, amiibo: Amiibo, summary: ImageCopySummary): Promise<Amiibo> {
  const destination = `amiibos/${amiibo.slug}/figure`;
  const storedUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;

  try {
    const [exists] = await bucket.file(destination).exists();
    if (exists) {
      summary.alreadyStored += 1;
      return {
        ...amiibo,
        figureUrl: storedUrl,
      };
    }

    await copyImage(bucket, amiibo.figureUrl, destination);
    summary.copied += 1;
    return {
      ...amiibo,
      figureUrl: storedUrl,
    };
  }
  catch (error) {
    console.error(`Failed to copy image for amiibo "${amiibo.slug}" from ${amiibo.figureUrl}.`, error);
    summary.failed.push(amiibo.slug);
    return amiibo;
  }
}

async function copyImage(bucket: Bucket, sourceUrl: string, destination: string): Promise<void> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Request failed with status code ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || undefined;
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  await bucket
    .file(destination)
    .save(imageBuffer, {
      public: true,
      contentType,
    });
}
