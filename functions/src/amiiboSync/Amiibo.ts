/**
 * The kind of amiibo a document describes.
 */
export type AmiiboType = 'figure' | 'card';

/**
 * Where a document's data was imported from.
 */
export type AmiiboSource = 'nintendo-lineup' | 'amiibo-api';

/**
 * Shape of a document in the `amiibos` Firestore collection.
 */
export interface Amiibo {
  type: AmiiboType;
  slug: string;
  name: string;
  description: string;
  series: string;
  figureUrl: string;
  releaseDate: string;
  source: AmiiboSource;
}
