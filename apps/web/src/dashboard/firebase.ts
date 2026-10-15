import type { Firestore } from 'firebase/firestore';

// Loaded only by the dashboard (dynamic import), so the phone page never pulls
// Firebase in. Config comes from Firebase Hosting's init.json; local dev falls
// back to VITE_FIREBASE_* values (`firebase apps:sdkconfig WEB` prints them).

interface WebConfig {
  apiKey: string;
  projectId: string;
  appId: string;
  authDomain?: string;
}

async function loadConfig(): Promise<WebConfig> {
  try {
    const res = await fetch('/__/firebase/init.json', { headers: { accept: 'application/json' } });
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && type.includes('json')) {
      const json = (await res.json()) as Partial<WebConfig>;
      if (json.apiKey && json.projectId) return json as WebConfig;
    }
  } catch {
    // Not on Firebase Hosting; use the env fallback.
  }
  const env = import.meta.env;
  if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };
  }
  throw new Error('No Firebase config: /__/firebase/init.json is unavailable and VITE_FIREBASE_* is not set.');
}

let db: Promise<Firestore> | undefined;

export function getDb(): Promise<Firestore> {
  db ??= (async () => {
    const [{ initializeApp, getApps }, { getFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ]);
    const config = await loadConfig();
    const app = getApps()[0] ?? initializeApp(config);
    return getFirestore(app);
  })();
  db.catch(() => {
    db = undefined; // let a remount retry
  });
  return db;
}
