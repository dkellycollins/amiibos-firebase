import { Amiibo, AmiiboType } from '../amiiboSync/Amiibo';
import { cleanName, toSlug } from '../amiiboSync/text';

const AMIIBO_API_URL = 'https://www.amiiboapi.org/api/amiibo/';

// ---------------------------------------------------------------------------
// Types describing the AmiiboAPI response
// ---------------------------------------------------------------------------

export interface AmiiboApiItem {
  name: string;
  character: string;
  amiiboSeries: string;
  gameSeries: string;
  /**
   * Card, Figure, Yarn, Band or Block.
   */
  type: string;
  /**
   * Together `head` and `tail` form the unique identifier stored on the amiibo's NFC chip.
   */
  head: string;
  tail: string;
  image: string;
  release: {
    na?: string | null;
    eu?: string | null;
    jp?: string | null;
    au?: string | null;
  };
}

/**
 * Maps AmiiboAPI types to the document type they are imported as. Types not listed here
 * (Band, Block) are skipped.
 */
const IMPORTED_TYPES: Record<string, AmiiboType> = {
  Card: 'card',
  Figure: 'figure',
  Yarn: 'figure',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchAmiiboApiItems(): Promise<Array<AmiiboApiItem>> {
  const response = await fetch(AMIIBO_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to download ${AMIIBO_API_URL}: status code ${response.status}`);
  }

  const body = await response.json();
  if (!Array.isArray(body?.amiibo)) {
    throw new Error(`Unexpected response from ${AMIIBO_API_URL}: missing "amiibo" array.`);
  }

  console.log(`Found ${body.amiibo.length} entries in AmiiboAPI.`);
  return body.amiibo;
}

/**
 * Returns the document type an AmiiboAPI item is imported as, or null when it is not imported.
 */
export function getImportedType(item: AmiiboApiItem): AmiiboType | null {
  const importedType = IMPORTED_TYPES[item.type];
  if (!importedType) {
    return null;
  }

  return importedType;
}

export function toAmiibo(item: AmiiboApiItem, type: AmiiboType): Amiibo {
  const nfcId = `${item.head}${item.tail}`.toLowerCase();

  return {
    type,
    // Card names repeat (e.g. several "Isabelle" cards), so the NFC id keeps slugs unique.
    slug: toSlug(`${item.name} ${item.amiiboSeries} ${type} ${nfcId}`),
    name: cleanName(item.name),
    description: '',
    series: item.amiiboSeries,
    figureUrl: item.image,
    releaseDate: toReleaseDate(item),
    source: 'amiibo-api',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Prefers the North American release date, falling back to the other regions.
 */
function toReleaseDate(item: AmiiboApiItem): string {
  const release = item.release || {};
  const candidates = [release.na, release.eu, release.jp, release.au];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return '';
}
