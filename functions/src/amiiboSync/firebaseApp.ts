import { App, getApps, initializeApp } from 'firebase-admin/app';

/**
 * Returns the default Firebase app, initializing it on first use.
 */
export function getFirebaseApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  return initializeApp();
}
