import { COLLECTIONS } from '@scamshield/shared';
import { useEffect, useState } from 'react';
import { getDb } from './firebase';
import { toHoldViews, toRiskPoints, toSessionView, type HoldView, type RiskPoint, type Raw, type SessionView } from './view';

export type Loadable<T> = { status: 'loading' | 'error'; error?: string; data: T } | { status: 'ready'; data: T };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Subscribes to a Firestore query for as long as the component is mounted.
// `build` receives the firestore module and db and returns the query.
function useQuery<T>(
  key: string | null,
  empty: T,
  build: (fs: typeof import('firebase/firestore'), db: import('firebase/firestore').Firestore) => import('firebase/firestore').Query,
  map: (docs: Array<{ id: string; data: Raw }>) => T,
): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading', data: empty });

  useEffect(() => {
    if (key === null) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    setState({ status: 'loading', data: empty });
    (async () => {
      try {
        const [db, fs] = await Promise.all([getDb(), import('firebase/firestore')]);
        if (cancelled) return;
        unsub = fs.onSnapshot(
          build(fs, db),
          (snap) => setState({ status: 'ready', data: map(snap.docs.map((d) => ({ id: d.id, data: d.data() as Raw }))) }),
          (err) => setState({ status: 'error', error: message(err), data: empty }),
        );
      } catch (err) {
        if (!cancelled) setState({ status: 'error', error: message(err), data: empty });
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
    // build/map/empty are stable per key by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

const NO_SESSIONS: SessionView[] = [];
const NO_POINTS: RiskPoint[] = [];
const NO_HOLDS: HoldView[] = [];

export function useSessions(): Loadable<SessionView[]> {
  return useQuery(
    'sessions',
    NO_SESSIONS,
    ({ collection, query, orderBy, limit }, db) =>
      query(collection(db, COLLECTIONS.sessions), orderBy('updatedAtMs', 'desc'), limit(20)),
    (docs) => docs.map((d) => toSessionView(d.id, d.data)),
  );
}

export function useRisk(sessionId: string | null): Loadable<RiskPoint[]> {
  return useQuery(
    sessionId && `risk/${sessionId}`,
    NO_POINTS,
    ({ collection, query, orderBy }, db) =>
      query(collection(db, COLLECTIONS.sessions, sessionId!, COLLECTIONS.risk), orderBy('atSec', 'asc')),
    (docs) => toRiskPoints(docs.map((d) => d.data)),
  );
}

export function useHolds(sessionId: string | null): Loadable<HoldView[]> {
  return useQuery(
    sessionId && `holds/${sessionId}`,
    NO_HOLDS,
    ({ collection, query }, db) => query(collection(db, COLLECTIONS.sessions, sessionId!, COLLECTIONS.holds)),
    toHoldViews,
  );
}
