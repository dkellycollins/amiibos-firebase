import { createSyncFunction } from '../amiiboSync/syncFunction';
import { fetchNintendoLineup } from './nintendoLineup';

/**
 * Imports amiibo figures from the Nintendo amiibo line-up page
 * (https://www.nintendo.com/us/amiibo/line-up/) into the `amiibos` collection.
 *
 * Run this before `syncAmiibosFromAmiiboApi`, which skips figures that this function already
 * imported.
 */
export const syncAmiibosFromNintendo = createSyncFunction('syncAmiibosFromNintendo', async () => {
  const lineup = await fetchNintendoLineup();

  return {
    amiibos: lineup.amiibos,
    details: {
      skipped: lineup.skipped,
    },
  };
});
