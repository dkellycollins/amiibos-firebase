/**
 * Removes trademark symbols (and their HTML entities) and extra whitespace from a display name.
 */
export function cleanName(name: string): string {
  return name
    .replace(/&#8482;|&#174;|&trade;|&reg;/g, '')
    .replace(/[™®]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts a value into a URL friendly slug, e.g. "K.K. Slider" -> "k-k-slider".
 */
export function toSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Reduces a value to lowercase letters and digits so loosely formatted names can be compared,
 * e.g. "K. K. Slider" and "K.K. Slider" both become "kkslider".
 */
export function toMatchKey(value: string): string {
  return cleanName(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}
