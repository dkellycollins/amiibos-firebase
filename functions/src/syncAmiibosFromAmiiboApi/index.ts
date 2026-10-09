import { Amiibo } from '../amiiboSync/Amiibo';
import { readStoredAmiibos } from '../amiiboSync/amiibosCollection';
import { createSyncFunction } from '../amiiboSync/syncFunction';
import { fetchAmiiboApiItems, getImportedType, toAmiibo } from './amiiboApi';
import { ExistingFigureIndex } from './existingFigureIndex';

/**
 * Imports amiibo cards and figures from AmiiboAPI (https://www.amiiboapi.org) into the
 * `amiibos` collection.
 *
 * Figures already imported from the Nintendo line-up are skipped, so run
 * `syncAmiibosFromNintendo` first.
 */
export const syncAmiibosFromAmiiboApi = createSyncFunction('syncAmiibosFromAmiiboApi', async () => {
  const [items, storedAmiibos] = await Promise.all([
    fetchAmiiboApiItems(),
    readStoredAmiibos(),
  ]);
  const existingFigures = new ExistingFigureIndex(storedAmiibos);

  const amiibos: Array<Amiibo> = [];
  const skippedTypes: Array<string> = [];
  const skippedExistingFigures: Array<string> = [];

  for (const item of items) {
    const type = getImportedType(item);
    if (!type) {
      skippedTypes.push(`${item.name} (${item.type})`);
      continue;
    }

    if (type === 'figure' && existingFigures.contains(item.name, item.amiiboSeries)) {
      skippedExistingFigures.push(item.name);
      continue;
    }

    amiibos.push(toAmiibo(item, type));
  }

  const importedFigures = amiibos
    .filter(amiibo => {
      return amiibo.type === 'figure';
    })
    .map(amiibo => {
      return `${amiibo.name} (${amiibo.series})`;
    });
  const cardCount = amiibos.length - importedFigures.length;

  console.log(`Mapped ${cardCount} cards and ${importedFigures.length} figures.`);
  console.log(`Skipped ${skippedExistingFigures.length} figures that already exist and ${skippedTypes.length} unsupported items.`);
  console.log(`Figures imported from AmiiboAPI (review for duplicates): ${importedFigures.join(', ')}`);

  return {
    amiibos,
    details: {
      cards: cardCount,
      importedFigures,
      skippedExistingFigures: skippedExistingFigures.length,
      skippedTypes,
    },
  };
});
