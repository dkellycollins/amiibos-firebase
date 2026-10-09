import { StoredAmiibo } from '../amiiboSync/amiibosCollection';
import { toMatchKey } from '../amiiboSync/text';

/**
 * Looks up whether a figure is already in the collection from another source (the Nintendo
 * line-up, or documents created before `source` was recorded).
 *
 * The two sources format names and series differently, e.g. AmiiboAPI's "Legend Of Zelda"
 * versus Nintendo's "The Legend of Zelda: Breath of the Wild", so matching is approximate:
 * a figure counts as existing when a stored figure has the same name and either
 *   - a similar series (equal, or one contains the other), or
 *   - that name is only used by one stored figure.
 */
export class ExistingFigureIndex {
  /**
   * Normalised figure name -> normalised series of every stored figure with that name.
   */
  private readonly seriesByName = new Map<string, Array<string>>();

  constructor(storedAmiibos: Array<StoredAmiibo>) {
    for (const stored of storedAmiibos) {
      if (!isFigureFromAnotherSource(stored)) {
        continue;
      }

      const nameKey = toMatchKey(stored.name || '');
      const seriesList = this.seriesByName.get(nameKey) || [];
      seriesList.push(toSeriesKey(stored.series || ''));
      this.seriesByName.set(nameKey, seriesList);
    }
  }

  public contains(name: string, series: string): boolean {
    const storedSeriesList = this.seriesByName.get(toMatchKey(name));
    if (!storedSeriesList) {
      return false;
    }

    const seriesKey = toSeriesKey(series);
    const hasSimilarSeries = storedSeriesList.some(storedSeries => {
      return isSimilarSeries(storedSeries, seriesKey);
    });
    if (hasSimilarSeries) {
      return true;
    }

    return storedSeriesList.length === 1;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFigureFromAnotherSource(stored: StoredAmiibo): boolean {
  if (stored.source === 'amiibo-api') {
    return false;
  }
  if (stored.type === 'card') {
    return false;
  }

  return true;
}

/**
 * Normalises a series name, ignoring a leading "The" and "Bros" so that e.g.
 * "Super Mario Bros." and "Super Mario" compare equal.
 */
function toSeriesKey(series: string): string {
  return toMatchKey(series)
    .replace(/^the/, '')
    .replace(/bros/g, '');
}

function isSimilarSeries(first: string, second: string): boolean {
  if (!first || !second) {
    return false;
  }
  if (first === second) {
    return true;
  }

  return first.includes(second) || second.includes(first);
}
