import { Amiibo } from '../amiiboSync/Amiibo';
import { cleanName } from '../amiiboSync/text';

const LINEUP_URL = 'https://www.nintendo.com/us/amiibo/line-up/';
const IMAGE_BASE_URL = 'https://assets.nintendo.com/image/upload/';

/**
 * Site-relative links in descriptions (e.g. "/store/products/...") are resolved against this.
 */
const NINTENDO_SITE_URL = 'https://www.nintendo.com';

/**
 * Card packs whose name and slug do not mention cards, so the keyword check in
 * `getSkipReason` does not catch them.
 */
const CARD_PACK_SLUGS = new Set<string>([
  'mario-sports-superstars-amiibo-series',
  'animal-crossing-sanrio-collaboration-pack-amiibo-animal-crossing-series',
]);

/**
 * Nintendo slug -> slug of the existing document for the same figure. Used where Nintendo has
 * changed a slug since the document was created, so the sync updates that document instead of
 * creating a duplicate.
 */
const LEGACY_SLUGS: Record<string, string> = {
  'shovel-knight-gold-edition-amiibo-shovel-knight-series': 'shovel-knight-amiibo-gold-edition-shovel-knight-series',
};

// ---------------------------------------------------------------------------
// Types describing the parts of the Nintendo page data that we use
// ---------------------------------------------------------------------------

/**
 * A node in a Contentful rich text document.
 */
interface RichTextNode {
  nodeType: string;
  value?: string;
  marks?: Array<{ type: string }>;
  data?: { uri?: string };
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
  if (isCardPack(nintendoAmiibo)) {
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

function isCardPack(nintendoAmiibo: NintendoAmiibo): boolean {
  if (CARD_PACK_SLUGS.has(nintendoAmiibo.slug)) {
    return true;
  }

  const searchText = `${nintendoAmiibo.name} ${nintendoAmiibo.slug}`.toLowerCase();
  if (/\bcards?\b/.test(searchText)) {
    return true;
  }

  return searchText.includes('welcome amiibo');
}

function toAmiibo(nintendoAmiibo: NintendoAmiibo): Amiibo {
  return {
    type: 'figure',
    slug: toDocumentSlug(nintendoAmiibo.slug),
    name: cleanName(nintendoAmiibo.name),
    description: toHtml(nintendoAmiibo.description),
    series: nintendoAmiibo.series || '',
    figureUrl: toImageUrl(nintendoAmiibo.figureAsset),
    releaseDate: toReleaseDate(nintendoAmiibo),
    source: 'nintendo-lineup',
  };
}

/**
 * Returns the id of the document a Nintendo slug is stored under.
 */
function toDocumentSlug(nintendoSlug: string): string {
  const legacySlug = LEGACY_SLUGS[nintendoSlug];
  if (legacySlug) {
    return legacySlug;
  }

  return nintendoSlug;
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

// ---------------------------------------------------------------------------
// Rendering descriptions
// ---------------------------------------------------------------------------

/**
 * Renders a Contentful rich text document as HTML, one `<p>` per paragraph, matching the HTML
 * descriptions already stored in the collection. The line-up page only uses paragraphs, text
 * (with bold and italic marks) and hyperlinks; any other node renders just its children so its
 * text is kept.
 */
function toHtml(description: NintendoAmiibo['description']): string {
  if (!description || !description.json.content) {
    return '';
  }

  return description.json.content
    .map(node => {
      return renderNode(node);
    })
    .filter(html => {
      return html.length > 0;
    })
    .join('\n');
}

function renderNode(node: RichTextNode): string {
  if (node.nodeType === 'text') {
    return renderText(node);
  }

  const children = renderChildren(node);

  if (node.nodeType === 'paragraph') {
    if (children.trim().length === 0) {
      return '';
    }

    return `<p>${children.trim()}</p>`;
  }

  if (node.nodeType === 'hyperlink') {
    const uri = node.data && node.data.uri;
    if (!uri) {
      return children;
    }

    return `<a href="${escapeHtml(toAbsoluteUrl(uri))}">${children}</a>`;
  }

  return children;
}

function renderChildren(node: RichTextNode): string {
  if (!node.content) {
    return '';
  }

  return node.content
    .map(child => {
      return renderNode(child);
    })
    .join('');
}

function renderText(node: RichTextNode): string {
  let html = escapeHtml(node.value || '');
  const markTypes = (node.marks || []).map(mark => {
    return mark.type;
  });

  if (markTypes.includes('italic')) {
    html = `<i>${html}</i>`;
  }
  if (markTypes.includes('bold')) {
    html = `<b>${html}</b>`;
  }

  return html;
}

function toAbsoluteUrl(uri: string): string {
  if (uri.startsWith('/')) {
    return NINTENDO_SITE_URL + uri;
  }

  return uri;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
