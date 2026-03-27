import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { VisualTheme } from '@/types';

export interface AdminRuntimeConfig {
  deepgramApiKey: string;
  captainDeepgramModel: string;
  crewDeepgramModel: string;
  router9ApiKey: string;
  router9BaseUrl: string;
  router9Model: string;
  router9FallbackModel: string;
  meaningStrictness: 'loose' | 'medium' | 'strict';
  meaningWeight: number;
  feedbackEnabled: boolean;
  feedbackMode: 'gentle' | 'balanced' | 'detailed';
  feedbackTone: 'encouraging' | 'neutral' | 'strict';
  showGrammarReminder: boolean;
  showImprovedSentence: boolean;
  showWhenMeaningCorrect: boolean;
  onlyIfAffectsClarity: boolean;
  visualTheme: VisualTheme;
}

const STORAGE_KEY = 'caption-crew-admin-runtime-config';
const PUBLIC_THEME_STORAGE_KEY = 'caption-crew-public-visual-theme';
const ADMIN_CONFIG_DOC = ['admin_runtime_config', 'shared'] as const;
const PUBLIC_THEME_DOC = ['game_settings', 'app_theme'] as const;

export const defaultAdminRuntimeConfig: AdminRuntimeConfig = {
  deepgramApiKey: '',
  captainDeepgramModel: 'nova-3',
  crewDeepgramModel: 'nova-3',
  router9ApiKey: '',
  router9BaseUrl: 'https://rqlaeq5.9router.com/v1',
  router9Model: '',
  router9FallbackModel: '',
  meaningStrictness: 'medium',
  meaningWeight: 100,
  feedbackEnabled: true,
  feedbackMode: 'gentle',
  feedbackTone: 'encouraging',
  showGrammarReminder: false,
  showImprovedSentence: false,
  showWhenMeaningCorrect: false,
  onlyIfAffectsClarity: true,
  visualTheme: 'minimal',
};

function normalizeVisualTheme(value?: string | null): VisualTheme {
  return value === 'bold' ? 'bold' : 'minimal';
}

function emitVisualTheme(theme: VisualTheme) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PUBLIC_THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent('thc-visual-theme-change', { detail: theme }));
}

function normalizeAdminConfig(raw?: Partial<AdminRuntimeConfig> | null): AdminRuntimeConfig {
  return {
    ...defaultAdminRuntimeConfig,
    ...(raw || {}),
    visualTheme: normalizeVisualTheme(raw?.visualTheme || defaultAdminRuntimeConfig.visualTheme),
  };
}

export function loadAdminRuntimeConfig(): AdminRuntimeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAdminRuntimeConfig;
    return normalizeAdminConfig(JSON.parse(raw));
  } catch {
    return defaultAdminRuntimeConfig;
  }
}

export function loadCachedVisualTheme(): VisualTheme {
  if (typeof window === 'undefined') return defaultAdminRuntimeConfig.visualTheme;
  return normalizeVisualTheme(localStorage.getItem(PUBLIC_THEME_STORAGE_KEY) || loadAdminRuntimeConfig().visualTheme);
}

export function cacheAdminRuntimeConfig(config: AdminRuntimeConfig) {
  const normalized = normalizeAdminConfig(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  emitVisualTheme(normalized.visualTheme);
}

export function saveAdminRuntimeConfig(config: AdminRuntimeConfig) {
  cacheAdminRuntimeConfig(config);
}

export async function loadPublicVisualTheme(): Promise<VisualTheme> {
  const cached = loadCachedVisualTheme();
  if (!db) return cached;

  try {
    const snap = await getDoc(doc(db, ...PUBLIC_THEME_DOC));
    if (!snap.exists()) {
      emitVisualTheme(cached);
      return cached;
    }
    const theme = normalizeVisualTheme((snap.data() as { visualTheme?: string } | undefined)?.visualTheme);
    emitVisualTheme(theme);
    return theme;
  } catch {
    return cached;
  }
}

export async function savePublicVisualTheme(theme: VisualTheme): Promise<VisualTheme> {
  const normalized = normalizeVisualTheme(theme);
  emitVisualTheme(normalized);
  if (db) {
    await setDoc(doc(db, ...PUBLIC_THEME_DOC), { visualTheme: normalized, updatedAt: new Date().toISOString() }, { merge: true });
  }
  return normalized;
}

export async function loadSharedAdminRuntimeConfig(): Promise<AdminRuntimeConfig> {
  const local = loadAdminRuntimeConfig();
  const publicTheme = await loadPublicVisualTheme();
  if (!db) return { ...local, visualTheme: publicTheme };

  const snap = await getDoc(doc(db, ...ADMIN_CONFIG_DOC));
  if (!snap.exists()) {
    const mergedLocal = normalizeAdminConfig({ ...local, visualTheme: publicTheme });
    cacheAdminRuntimeConfig(mergedLocal);
    return mergedLocal;
  }

  const merged = normalizeAdminConfig({ ...(snap.data() as Partial<AdminRuntimeConfig>), visualTheme: publicTheme });
  cacheAdminRuntimeConfig(merged);
  return merged;
}

export async function saveSharedAdminRuntimeConfig(config: AdminRuntimeConfig): Promise<AdminRuntimeConfig> {
  const normalized = normalizeAdminConfig(config);
  cacheAdminRuntimeConfig(normalized);
  if (db) {
    await setDoc(doc(db, ...ADMIN_CONFIG_DOC), normalized, { merge: true });
  }
  await savePublicVisualTheme(normalized.visualTheme);
  return normalized;
}

export async function hydrateAdminRuntimeConfigFromCloud() {
  try {
    return await loadSharedAdminRuntimeConfig();
  } catch {
    const local = loadAdminRuntimeConfig();
    const theme = await loadPublicVisualTheme().catch(() => local.visualTheme);
    const merged = normalizeAdminConfig({ ...local, visualTheme: theme });
    cacheAdminRuntimeConfig(merged);
    return merged;
  }
}
