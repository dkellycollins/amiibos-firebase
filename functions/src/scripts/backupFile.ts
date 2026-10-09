import * as path from 'path';

/**
 * Backups are written to `backups/` at the repository root.
 */
export const BACKUP_DIRECTORY = path.resolve(__dirname, '../../../backups');

/**
 * Shape of a backup file written by `backupAmiibos` and read by `restoreAmiibos`.
 */
export interface AmiibosBackup {
  exportedAt: string;
  /**
   * Document id -> the document's fields.
   */
  documents: Record<string, Record<string, unknown>>;
}
