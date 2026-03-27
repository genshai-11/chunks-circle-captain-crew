import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface PublicTimingSettings {
  crewResponseTimeoutMs: number;
}

const TIMING_DOC = ['game_settings', 'timing'] as const;
const STORAGE_KEY = 'caption-crew-public-timing-v2';

export const defaultPublicTimingSettings: PublicTimingSettings = {
  crewResponseTimeoutMs: 3000,
};

function normalize(raw?: Partial<PublicTimingSettings> | null): PublicTimingSettings {
  const ms = Number(raw?.crewResponseTimeoutMs);
  const crewResponseTimeoutMs = Number.isFinite(ms) ? Math.max(3000, Math.min(60000, Math.floor(ms))) : defaultPublicTimingSettings.crewResponseTimeoutMs;
  return { crewResponseTimeoutMs };
}

export function loadCachedPublicTimingSettings(): PublicTimingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPublicTimingSettings;
    return normalize(JSON.parse(raw));
  } catch {
    return defaultPublicTimingSettings;
  }
}

function cache(settings: PublicTimingSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export async function loadPublicTimingSettings(): Promise<PublicTimingSettings> {
  const cached = loadCachedPublicTimingSettings();
  if (!db) return cached;

  try {
    const snap = await getDoc(doc(db, ...TIMING_DOC));
    if (!snap.exists()) {
      cache(cached);
      return cached;
    }
    const settings = normalize(snap.data() as any);
    cache(settings);
    return settings;
  } catch {
    return cached;
  }
}

export async function savePublicTimingSettings(settings: PublicTimingSettings) {
  const normalized = normalize(settings);
  cache(normalized);
  if (db) {
    await setDoc(doc(db, ...TIMING_DOC), { ...normalized, updatedAt: new Date().toISOString() }, { merge: true });
  }
  return normalized;
}

export function subscribePublicTimingSettings(onValue: (settings: PublicTimingSettings) => void, onError?: (err: any) => void) {
  const cached = loadCachedPublicTimingSettings();
  onValue(cached);
  if (!db) return () => undefined;

  return onSnapshot(
    doc(db, ...TIMING_DOC),
    (snap) => {
      const settings = snap.exists() ? normalize(snap.data() as any) : cached;
      cache(settings);
      onValue(settings);
    },
    (err) => {
      onError?.(err);
      onValue(cached);
    }
  );
}
