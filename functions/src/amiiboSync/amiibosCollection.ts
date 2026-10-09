import { getFirestore } from 'firebase-admin/firestore';
import { Amiibo } from './Amiibo';
import { getFirebaseApp } from './firebaseApp';

const COLLECTION_NAME = 'amiibos';

/**
 * Firestore allows at most 500 writes per batch.
 */
const MAX_BATCH_SIZE = 500;

/**
 * A document already stored in the collection. Older documents may be missing newer fields
 * such as `source`.
 */
export type StoredAmiibo = Partial<Amiibo> & { slug: string };

/**
 * Reads every document currently in the `amiibos` collection.
 */
export async function readStoredAmiibos(): Promise<Array<StoredAmiibo>> {
  const snapshot = await getFirestore(getFirebaseApp())
    .collection(COLLECTION_NAME)
    .get();

  return snapshot.docs.map(document => {
    return {
      ...(document.data() as Partial<Amiibo>),
      slug: document.id,
    };
  });
}

/**
 * Creates or updates a document for each amiibo, keyed by slug. Existing fields that are not
 * part of the `Amiibo` shape are left untouched, and nothing is deleted.
 */
export async function saveAmiibos(amiibos: Array<Amiibo>): Promise<void> {
  const firestore = getFirestore(getFirebaseApp());
  const collection = firestore.collection(COLLECTION_NAME);

  for (let start = 0; start < amiibos.length; start += MAX_BATCH_SIZE) {
    const chunk = amiibos.slice(start, start + MAX_BATCH_SIZE);
    const batch = firestore.batch();

    for (const amiibo of chunk) {
      batch.set(collection.doc(amiibo.slug), amiibo, { merge: true });
    }

    await batch.commit();
  }

  console.log(`Saved ${amiibos.length} amiibos.`);
}
