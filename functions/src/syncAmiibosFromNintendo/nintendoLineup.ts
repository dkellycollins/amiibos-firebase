import { Amiibo } from '../amiiboSync/Amiibo';
import { cleanName } from '../amiiboSync/text';

const LINEUP_URL = 'https://www.nintendo.com/us/amiibo/line-up/';
const IMAGE_BASE_URL = 'https://assets.nintendo.com/image/upload/';

// ---------------------------------------------------------------------------
// Types describing the parts of the Nintendo page data that we use
// ---------------------------------------------------------------------------

interface RichTextNode {
  nodeType: string;
  value?: string;
  content?: Array<RichTextNode>;
}

export interface NintendoAmiibo {
  id: string;
  name: string;
  slug: string;
  series: string | null;
  releaseDate: string | null;
  releaseDateDisplay: string | null;
  description: { json: RichTextNode } | null;
  figureAsset: { publicId: string } | null;
}

export interface NintendoLineupResult {
  amiibos: Array<Amiibo>;
  skipped: Array<{ slug: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Downloads the Nintendo amiibo line-up page and maps every figure on it to an `Amiibo`.
 */
export async function fetchNintendoLineup(): Promise<NintendoLineupResult> {
  const html = await fetchLineupPage();
  const nintendoAmiibos = extractAmiibos(html);
  console.log(`Found ${nintendoAmiibos.length} entries on the Nintendo line-up page.`);

  return mapNintendoAmiibos(nintendoAmiibos);
}

/**
 * Maps entries from the line-up page to `Amiibo` documents, skipping anything that is not an
 * individual figure (card packs, Power-Up Bands) and duplicate slugs.
 */
export function mapNintendoAmiibos(nintendoAmiibos: Array<NintendoAmiibo>): NintendoLineupResult {
  const amiibos: Array<Amiibo> = [];
  const skipped: Array<{ slug: string; reason: string }> = [];
  const seenSlugs = new Set<string>();

  for (const nintendoAmiibo of nintendoAmiibos) {
    const skipReason = getSkipReason(nintendoAmiibo, seenSlugs);
    if (skipReason) {
      skipped.push({
        slug: nintendoAmiibo.slug,
        reason: skipReason,
      });
      continue;
    }

    seenSlugs.add(nintendoAmiibo.slug);
    amiibos.push(toAmiibo(nintendoAmiibo));
  }

  console.log(`Mapped ${amiibos.length} Nintendo amiibos, skipped ${skipped.length}.`);

  return {
    amiibos,
    skipped,
  };
}

// ---------------------------------------------------------------------------
// Fetching and parsing the page
// ---------------------------------------------------------------------------

async function fetchLineupPage(): Promise<string> {
  const response = await fetch(LINEUP_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; amiibos-firebase sync)',
      'Accept': 'text/html',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${LINEUP_URL}: status code ${response.status}`);
  }

  return await response.text();
}

/**
 * The page is a Next.js app; its data is embedded as JSON in the `__NEXT_DATA__` script tag.
 */
function extractAmiibos(html: string): Array<NintendoAmiibo> {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Could not find __NEXT_DATA__ on the Nintendo line-up page. The page layout may have changed.');
  }

  const nextData = JSON.parse(match[1]);
  const amiibos = nextData?.props?.pageProps?.page?.amiibos;
  if (!Array.isArray(amiibos)) {
    throw new Error('Could not find props.pageProps.page.amiibos in __NEXT_DATA__. The page layout may have changed.');
  }

  return amiibos;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function getSkipReason(nintendoAmiibo: NintendoAmiibo, seenSlugs: Set<string>): string | null {
  const searchText = `${nintendoAmiibo.name} ${nintendoAmiibo.slug}`.toLowerCase();

  if (seenSlugs.has(nintendoAmiibo.slug)) {
    return 'duplicate slug';
  }
  if (/\bcards?\b/.test(searchText) || searchText.includes('welcome amiibo')) {
    return 'card pack (cards are imported from AmiiboAPI)';
  }
  if (/power-up band/.test(searchText)) {
    return 'Power-Up Band';
  }
  if (!nintendoAmiibo.figureAsset) {
    return 'no figure image';
  }

  return null;
}

function toAmiibo(nintendoAmiibo: NintendoAmiibo): Amiibo {
  return {
    type: 'figure',
    slug: nintendoAmiibo.slug,
    name: cleanName(nintendoAmiibo.name),
    description: toPlainText(nintendoAmiibo.description),
    series: nintendoAmiibo.series || '',
    figureUrl: toImageUrl(nintendoAmiibo.figureAsset),
    releaseDate: toReleaseDate(nintendoAmiibo),
    source: 'nintendo-lineup',
  };
}

/**
 * Upcoming amiibos have a placeholder release date and a display value such as "2027";
 * prefer the display value when one is given.
 */
function toReleaseDate(nintendoAmiibo: NintendoAmiibo): string {
  if (nintendoAmiibo.releaseDateDisplay) {
    return nintendoAmiibo.releaseDateDisplay;
  }
  if (nintendoAmiibo.releaseDate) {
    return nintendoAmiibo.releaseDate.substring(0, 10);
  }

  return '';
}

function toImageUrl(figureAsset: NintendoAmiibo['figureAsset']): string {
  if (!figureAsset) {
    return '';
  }

  const encodedPath = figureAsset.publicId
    .split('/')
    .map(segment => {
      return encodeURIComponent(segment);
    })
    .join('/');

  return IMAGE_BASE_URL + encodedPath;
}

/**
 * Flattens a Contentful rich text document into plain text with a blank line between
 * paragraphs.
 */
function toPlainText(description: NintendoAmiibo['description']): string {
  if (!description || !description.json.content) {
    return '';
  }

  return description.json.content
    .map(paragraph => {
      return collectText(paragraph).trim();
    })
    .filter(paragraph => {
      return paragraph.length > 0;
    })
    .join('\n\n');
}

function collectText(node: RichTextNode): string {
  if (node.nodeType === 'text') {
    return node.value || '';
  }
  if (!node.content) {
    return '';
  }

  return node.content
    .map(child => {
      return collectText(child);
    })
    .join('');
}
