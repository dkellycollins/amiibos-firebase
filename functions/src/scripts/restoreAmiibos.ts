import * as fs from 'fs';
import { getFirestore } from 'firebase-admin/firestore';
import { COLLECTION_NAME, MAX_BATCH_SIZE } from '../amiiboSync/amiibosCollection';
import { getFirebaseApp } from '../amiiboSync/firebaseApp';
import { AmiibosBackup } from './backupFile';

type Firestore = ReturnType<typeof getFirestore>;

/**
 * A single change needed to make the collection match the backup.
 */
type RestoreOperation =
  | { kind: 'set'; id: string; fields: Record<string, unknown> }
  | { kind: 'delete'; id: string };

/**
 * Makes the `amiibos` collection match a backup written by `backupAmiibos`:
 *   - every document in the backup is replaced with its backed up fields, and
 *   - every document that is not in the backup is deleted.
 *
 * Only prints what it would change unless `--apply` is passed. Run from `functions/` after
 * `npm run build`, with Application Default Credentials set up:
 *
 *   node lib/scripts/restoreAmiibos.js ../backups/amiibos-2026-10-08.json [--apply]
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const backupPath = args.find(arg => {
    return !arg.startsWith('--');
  });
  if (!backupPath) {
    throw new Error('Usage: node lib/scripts/restoreAmiibos.js <backup file> [--apply]');
  }

  const backup: AmiibosBackup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const firestore = getFirestore(getFirebaseApp());
  const operations = await planRestore(firestore, backup);

  const setIds = getIds(operations, 'set');
  const deleteIds = getIds(operations, 'delete');
  console.log(`Backup from ${backup.exportedAt}: ${setIds.length} documents to write, ${deleteIds.length} to delete.`);
  if (deleteIds.length > 0) {
    console.log(`Documents to delete: ${deleteIds.join(', ')}`);
  }

  if (!apply) {
    console.log('Dry run: nothing was changed. Pass --apply to restore.');
    return;
  }

  await commitOperations(firestore, operations);
  console.log('Restore complete.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function planRestore(firestore: Firestore, backup: AmiibosBackup): Promise<Array<RestoreOperation>> {
  const operations: Array<RestoreOperation> = [];

  for (const [id, fields] of Object.entries(backup.documents)) {
    operations.push({
      kind: 'set',
      id,
      fields,
    });
  }

  const currentDocuments = await firestore
    .collection(COLLECTION_NAME)
    .select()
    .get();
  for (const document of currentDocuments.docs) {
    if (backup.documents[document.id]) {
      continue;
    }

    operations.push({
      kind: 'delete',
      id: document.id,
    });
  }

  return operations;
}

function getIds(operations: Array<RestoreOperation>, kind: RestoreOperation['kind']): Array<string> {
  return operations
    .filter(operation => {
      return operation.kind === kind;
    })
    .map(operation => {
      return operation.id;
    });
}

/**
 * Applies the operations in batches. A plain `set` (no merge) replaces the whole document, which
 * removes fields added since the backup, such as `source`.
 */
async function commitOperations(firestore: Firestore, operations: Array<RestoreOperation>): Promise<void> {
  const collection = firestore.collection(COLLECTION_NAME);

  for (let start = 0; start < operations.length; start += MAX_BATCH_SIZE) {
    const chunk = operations.slice(start, start + MAX_BATCH_SIZE);
    const batch = firestore.batch();

    for (const operation of chunk) {
      if (operation.kind === 'set') {
        batch.set(collection.doc(operation.id), operation.fields);
      }
      else {
        batch.delete(collection.doc(operation.id));
      }
    }

    await batch.commit();
    console.log(`Committed ${start + chunk.length} of ${operations.length} operations.`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
