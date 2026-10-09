import * as fs from 'fs';
import * as path from 'path';
import { getFirestore } from 'firebase-admin/firestore';
import { COLLECTION_NAME } from '../amiiboSync/amiibosCollection';
import { getFirebaseApp } from '../amiiboSync/firebaseApp';
import { AmiibosBackup, BACKUP_DIRECTORY } from './backupFile';

/**
 * Writes every document in the `amiibos` collection to `backups/amiibos-<yyyy-mm-dd>.json`.
 * Restore it with `restoreAmiibos`.
 *
 * Run from `functions/` after `npm run build`, with Application Default Credentials set up:
 *
 *   node lib/scripts/backupAmiibos.js
 */
async function main(): Promise<void> {
  const exportedAt = new Date().toISOString();
  const backupPath = path.join(BACKUP_DIRECTORY, `amiibos-${exportedAt.substring(0, 10)}.json`);
  if (fs.existsSync(backupPath)) {
    throw new Error(`${backupPath} already exists. Move or delete it before taking another backup.`);
  }

  const snapshot = await getFirestore(getFirebaseApp())
    .collection(COLLECTION_NAME)
    .get();

  // Sorted by id so that diffs between backups are readable.
  const sortedDocuments = [...snapshot.docs].sort((first, second) => {
    return first.id.localeCompare(second.id);
  });

  const backup: AmiibosBackup = {
    exportedAt,
    documents: {},
  };
  for (const document of sortedDocuments) {
    backup.documents[document.id] = document.data();
  }

  fs.mkdirSync(BACKUP_DIRECTORY, { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2) + '\n');

  console.log(`Backed up ${sortedDocuments.length} documents to ${backupPath}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
