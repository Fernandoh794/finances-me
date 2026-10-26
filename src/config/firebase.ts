import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getEnv } from './env.js';

let firestore: Firestore | undefined;

function getFirebaseApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const env = getEnv();
  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
    projectId: env.FIREBASE_PROJECT_ID,
  });
}

export function getDb(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getFirebaseApp());
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}
